// ── Lightweight word-meta function — injected on popup open ───────────────
function extractWordMeta() {
  const avoid = new Set(['nav','header','footer','aside','script','style',
    'noscript','form','select','option','menu','dialog']);

  const zones = document.querySelectorAll('article, [role="main"], main');
  let text = '';

  if (zones.length > 0) {
    zones.forEach(zone => {
      zone.querySelectorAll('p, h1, h2, h3').forEach(el => {
        if (!avoid.has(el.tagName.toLowerCase())) text += el.innerText + ' ';
      });
    });
  } else {
    document.querySelectorAll('p').forEach(el => {
      let p = el.parentElement, skip = false;
      while (p) { if (avoid.has(p.tagName.toLowerCase())) { skip = true; break; } p = p.parentElement; }
      if (!skip) text += el.innerText + ' ';
    });
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  return { wordCount, readMinutes };
}

// ── Theme toggle ───────────────────────────────────────────────────────────
(function initTheme() {
  try {
    chrome.storage.local.get('theme', function (d) {
      if (d.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    });
  } catch (_) {}
})();

document.getElementById('theme-btn').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  if (next === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try { chrome.storage.local.set({ theme: next }); } catch (_) {}
});

// ── Run word-count on popup open ───────────────────────────────────────────
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')))) return;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractWordMeta
    });
    if (results && results[0] && results[0].result) {
      const { wordCount, readMinutes } = results[0].result;
      if (wordCount > 0) {
        document.getElementById('word-count').textContent = wordCount.toLocaleString() + ' words';
        document.getElementById('read-time').textContent = readMinutes + ' min read';
        document.getElementById('page-meta').classList.remove('hidden');
      }
    }
  } catch (_) {}
})();

// ── State ──────────────────────────────────────────────────────────────────
let bulletCount = 5;

// ── Bullet-count pill toggle ───────────────────────────────────────────────
document.querySelectorAll('.pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    bulletCount = parseInt(btn.dataset.value, 10);
  });
});

// ── Copy to clipboard ──────────────────────────────────────────────────────
document.getElementById('copy-btn').addEventListener('click', () => {
  const items = [...document.querySelectorAll('#summary-list li')].map(li => '• ' + li.textContent);
  if (!items.length) return;
  navigator.clipboard.writeText(items.join('\n')).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });
});

// ── Main summarise action ──────────────────────────────────────────────────
document.getElementById('summarize-btn').addEventListener('click', async () => {
  const loading   = document.getElementById('loading');
  const output    = document.getElementById('output');
  const errorEl   = document.getElementById('error');
  const summaryList = document.getElementById('summary-list');
  const btn       = document.getElementById('summarize-btn');

  loading.classList.remove('hidden');
  output.classList.add('hidden');
  errorEl.classList.add('hidden');
  summaryList.innerHTML = '';
  btn.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')))) {
    loading.classList.add('hidden');
    errorEl.textContent = 'Cannot summarise browser system pages.';
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    return;
  }

  chrome.scripting.executeScript(
    { target: { tabId: tab.id }, func: extractAndSummarise, args: [bulletCount] },
    (results) => {
      loading.classList.add('hidden');
      btn.disabled = false;

      if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
        errorEl.textContent = 'Failed to read page content. Try reloading the page.';
        errorEl.classList.remove('hidden');
        return;
      }

      const { bullets, wordCount, readMinutes } = results[0].result;

      // Update page-meta badge
      const metaEl = document.getElementById('page-meta');
      document.getElementById('word-count').textContent = wordCount.toLocaleString() + ' words';
      document.getElementById('read-time').textContent = readMinutes + ' min read';
      metaEl.classList.remove('hidden');

      if (!bullets || bullets.length === 0) {
        errorEl.textContent = 'No clear text content found to summarise.';
        errorEl.classList.remove('hidden');
        return;
      }

      bullets.forEach(sentence => {
        const li = document.createElement('li');
        li.textContent = sentence;
        summaryList.appendChild(li);
      });

      output.classList.remove('hidden');
    }
  );
});

// ── Injected page function — runs inside the active tab ────────────────────
// Must be self-contained: no closures over popup scope.
function extractAndSummarise(maxBullets) {

  // ── Stop-word list (~200 common English words) ───────────────────────────
  const STOP = new Set([
    'a','about','above','after','again','against','all','also','am','an','and',
    'any','are','aren','as','at','be','because','been','before','being','below',
    'between','both','but','by','can','cannot','could','couldn','did','didn',
    'do','does','doesn','doing','down','during','each','few','for','from',
    'further','get','got','had','hadn','has','hasn','have','haven','having',
    'he','her','here','hers','herself','him','himself','his','how','i','if',
    'in','into','is','isn','it','its','itself','just','me','might','more',
    'most','must','mustn','my','myself','needn','no','nor','not','now','of',
    'off','on','once','only','or','other','our','ours','ourselves','out',
    'over','own','re','s','same','shan','she','should','shouldn','so','some',
    'such','t','than','that','the','their','theirs','them','themselves','then',
    'there','these','they','this','those','through','to','too','under','until',
    'up','us','very','was','wasn','we','were','weren','what','when','where',
    'which','while','who','whom','why','will','with','won','would','wouldn',
    'you','your','yours','yourself','yourselves','said','says','say','like',
    'make','made','know','take','want','use','find','give','tell','think',
    'see','come','go','well','also','back','way','even','new','old','many',
    'first','last','long','great','little','own','right','big','high','small',
    'large','next','early','young','important','public','private','real','best',
    'free','lot','used','still','become','part','place','case','week','company',
    'system','program','however','each','much','before','need','home','hand',
    'port','large','spell','add','land','here','must','big','high','such',
    'follow','act','why','ask','men','change','went','light','kind','off',
    'play','spell','air','away','animal','house','point','page','letter',
    'mother','answer','found','study','still','learn','plant','cover','food',
    'sun','four','between','state','keep','eye','never','last','let','thought',
    'city','tree','cross','farm','hard','start','might','story','saw','far',
    'sea','draw','left','late','run','don','while','press','close','night',
    'real','life','few','north','open','seem','together','next','white',
    'children','begin','got','walk','example','ease','paper','group','always',
    'music','those','both','mark','book','carry','took','science','eat','room',
    'friend','began','idea','fish','mountain','stop','once','base','hear',
    'horse','cut','sure','watch','color','face','wood','main','enough','plain',
    'girl','usual','young','ready','above','ever','red','list','though','feel',
    'talk','bird','soon','body','dog','family','direct','pose','leave','song',
    'measure','door','product','black','short','numeral','class','wind',
    'question','happen','complete','ship','area','half','rock','order','fire',
    'south','problem','piece','told','knew','pass','since','top','whole',
    'king','space','heard','best','hour','better','true','during','hundred',
    'five','remember','step','early','hold','west','ground','interest','reach',
    'fast','verb','sing','listen','six','table','travel','less','morning',
    'ten','simple','several','vowel','toward','war','lay','against','pattern',
    'slow','center','love','person','money','serve','appear','road','map',
    'rain','rule','govern','pull','cold','notice','voice','unit','power',
    'town','fine','drive','print','active','side','machine','teeth','coat',
    'garden','equal','sent','choose','fell','fit','flow','fair','bank',
    'collect','save','control','decimal','gentle','woman','captain','practice',
    'separate','difficult','doctor','please','protect','noon','whose','locate',
    'ring','character','insect','caught','period','indicate','radio','spoke',
    'atom','human','history','effect','electric','expect','crop','modern',
    'element','hit','student','corner','party','supply','bone','rail',
    'imagine','provide','agree','thus','capital','won','chair','danger',
    'fruit','rich','thick','soldier','process','operate','guess','necessary',
    'sharp','wing','create','neighbor','wash','bat','rather','crowd','corn',
    'compare','poem','string','bell','depend','meat','rub','tube','famous',
    'dollar','stream','fear','sight','thin','triangle','planet','hurry',
    'chief','colony','clock','mine','tie','enter','major','fresh','search',
    'send','yellow','gun','allow','print','dead','spot','desert','suit',
    'current','lift','rose','continue','block','chart','hat','sell','success',
    'company','subtract','particular','deal','swim','term','opposite','wife',
    'shoe','shoulder','spread','arrange','camp','invent','cotton','born',
    'determine','quart','nine','truck','noise','level','chance','gather',
    'shop','stretch','throw','shine','property','column','molecule','select',
    'wrong','gray','repeat','require','broad','prepare','salt','nose',
    'plural','anger','claim','possible','gold','milk','quiet','natural'
  ]);

  // ── Tokenise a string into meaningful terms ──────────────────────────────
  function tokenise(text) {
    return (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [])
      .filter(w => !STOP.has(w));
  }

  // ── Extract text from the page ───────────────────────────────────────────
  function extractText() {
    const avoid = new Set(['nav','header','footer','aside','script','style',
      'noscript','form','figure','figcaption','button','select','option',
      'menu','menuitem','dialog']);

    // Prefer semantic content zones
    const zones = document.querySelectorAll('article, [role="main"], main');
    let paragraphs = [];

    if (zones.length > 0) {
      zones.forEach(zone => {
        zone.querySelectorAll('p, h1, h2, h3').forEach(el => {
          if (!avoid.has(el.tagName.toLowerCase())) {
            const t = el.innerText.trim();
            if (t) paragraphs.push({ text: t, isHeading: /^h[1-3]$/i.test(el.tagName) });
          }
        });
      });
    }

    // Fallback: all paragraphs in body
    if (paragraphs.length === 0) {
      document.querySelectorAll('p').forEach(el => {
        let parent = el.parentElement;
        let skip = false;
        while (parent) {
          if (avoid.has(parent.tagName.toLowerCase())) { skip = true; break; }
          parent = parent.parentElement;
        }
        if (!skip) {
          const t = el.innerText.trim();
          if (t) paragraphs.push({ text: t, isHeading: false });
        }
      });
    }

    return paragraphs;
  }

  // ── Build an inverted index: term → Set of sentence indices ─────────────
  function buildIndex(sentences) {
    const index = new Map(); // term → array of sentence indices
    sentences.forEach((s, i) => {
      const terms = new Set(tokenise(s.text));
      terms.forEach(term => {
        if (!index.has(term)) index.set(term, []);
        index.get(term).push(i);
      });
    });
    return index;
  }

  // ── Score sentences via TF-IDF with inverted index (O(n)) ───────────────
  function scoreSentences(sentences, index, totalSentences) {
    // IDF: log(total / df)
    const idf = new Map();
    index.forEach((list, term) => {
      idf.set(term, Math.log((totalSentences + 1) / (list.length + 1)) + 1);
    });

    return sentences.map((s, i) => {
      const terms = tokenise(s.text);
      if (terms.length === 0) return { ...s, score: 0, index: i };

      // TF: count of each term in this sentence
      const tf = new Map();
      terms.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));

      let score = 0;
      tf.forEach((count, term) => {
        score += (count / terms.length) * (idf.get(term) || 1);
      });

      // Heading bonus
      if (s.isHeading) score *= 1.5;

      // Length penalty (ideal: 10–40 words)
      const wc = s.text.split(/\s+/).length;
      if (wc < 8 || wc > 50) score *= 0.3;

      // Position bias — earlier content scores higher (journalistic pyramid)
      const positionBias = 1 - (i / totalSentences) * 0.4;
      score *= positionBias;

      return { text: s.text, score, index: i, isHeading: s.isHeading };
    });
  }

  // ── Paragraph-first chunking for large pages ─────────────────────────────
  // Groups paragraphs, scores them, then only flattens sentences from the
  // top-scoring paragraphs — keeps the candidate pool small regardless of
  // total page length.
  function chunkAndReduce(paragraphs, targetSentences) {
    // Score each paragraph block by keyword density
    const allText = paragraphs.map(p => p.text).join(' ');
    const globalTerms = tokenise(allText);
    const globalFreq = new Map();
    globalTerms.forEach(t => globalFreq.set(t, (globalFreq.get(t) || 0) + 1));

    const scored = paragraphs.map((p, i) => {
      const terms = tokenise(p.text);
      let score = 0;
      const seen = new Set();
      terms.forEach(t => {
        if (!seen.has(t)) { score += globalFreq.get(t) || 0; seen.add(t); }
      });
      return { ...p, score, origIndex: i };
    });

    // Keep top 60% of paragraphs by score, preserve order
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const keep = Math.max(Math.ceil(sorted.length * 0.6), Math.ceil(targetSentences * 2));
    const keepSet = new Set(sorted.slice(0, keep).map(p => p.origIndex));

    // Flatten kept paragraphs into sentences, preserving document order
    const sentences = [];
    scored.forEach((p, i) => {
      if (!keepSet.has(i)) return;
      const raw = p.text.match(/[^.!?]+[.!?]+/g) || [p.text];
      raw.forEach(s => sentences.push({ text: s.trim(), isHeading: p.isHeading }));
    });

    return sentences;
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  const paragraphs = extractText();
  if (paragraphs.length === 0) {
    return { bullets: ["Page doesn't contain enough text to summarise."], wordCount: 0, readMinutes: 0 };
  }

  const allText = paragraphs.map(p => p.text).join(' ');
  const wordCount = allText.split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  if (wordCount < 80) {
    return { bullets: ["Page doesn't contain enough text to summarise."], wordCount, readMinutes };
  }

  // For large pages, use paragraph chunking first to reduce candidate set
  const LARGE_PAGE_THRESHOLD = 1500;
  let sentences;
  if (wordCount > LARGE_PAGE_THRESHOLD) {
    sentences = chunkAndReduce(paragraphs, maxBullets);
  } else {
    sentences = [];
    paragraphs.forEach(p => {
      const raw = p.text.match(/[^.!?]+[.!?]+/g) || [p.text];
      raw.forEach(s => sentences.push({ text: s.trim(), isHeading: p.isHeading }));
    });
  }

  if (sentences.length <= maxBullets) {
    return {
      bullets: sentences.map(s => s.text).filter(Boolean),
      wordCount,
      readMinutes
    };
  }

  const index = buildIndex(sentences);
  const scored = scoreSentences(sentences, index, sentences.length);

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxBullets)
    .sort((a, b) => a.index - b.index)
    .map(s => s.text)
    .filter(Boolean);

  return { bullets: top, wordCount, readMinutes };
}
