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
let activeTab = 'page';
let fileParagraphs = [];

// ── Tab Switching Logic ────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;

    const fileSection = document.getElementById('file-section');
    const summarizeBtn = document.getElementById('summarize-btn');
    const pageMeta = document.getElementById('page-meta');
    const output = document.getElementById('output');

    if (activeTab === 'file') {
      fileSection.classList.remove('hidden');
      summarizeBtn.textContent = 'Summarise File';
      pageMeta.classList.add('hidden'); // Hide page stats until file is processed
      output.classList.add('hidden');
    } else {
      fileSection.classList.add('hidden');
      summarizeBtn.textContent = 'Summarise Page';
      // Re-run word meta for page to restore stats
      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')))) return;
        try {
          const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractWordMeta });
          if (results?.[0]?.result?.wordCount > 0) {
            document.getElementById('word-count').textContent = results[0].result.wordCount.toLocaleString() + ' words';
            document.getElementById('read-time').textContent = results[0].result.readMinutes + ' min read';
            pageMeta.classList.remove('hidden');
          }
        } catch (_) {}
      })();
    }
  });
});

// ── File Handling & Parsing ────────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // --- ADD THIS: Limit file size to 5MB ---
  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    document.getElementById('error').textContent = `File is too large. Please upload a file under ${MAX_SIZE_MB}MB.`;
    document.getElementById('error').classList.remove('hidden');
    e.target.value = ''; // Clear the input
    return;
  }

  const fileNameEl = document.getElementById('file-name');
  fileNameEl.textContent = `Selected: ${file.name}`;
  fileNameEl.classList.remove('hidden');

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    const parsed = parseFileContent(text, file.name);
    fileParagraphs = parsed.paragraphs;
  };
  reader.readAsText(file);
});

function parseFileContent(text, fileName) {
  let cleanText = text;
  
  // If VTT, strip headers, timestamps, and sequence numbers
  if (fileName.toLowerCase().endsWith('.vtt')) {
    cleanText = cleanText.replace(/^(WEBVTT|NOTE|STYLE|REGION).*?(\n\n|$)/gs, '');
    cleanText = cleanText.replace(/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*$/gm, '');
    cleanText = cleanText.replace(/^\d+\s*$/gm, '');
  }

  cleanText = cleanText.replace(/\r\n/g, '\n');
  
  // Split into paragraphs (try double newlines first, then single)
  let rawParagraphs = cleanText.split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  if (rawParagraphs.length <= 1) {
    rawParagraphs = cleanText.split('\n').map(p => p.trim()).filter(Boolean);
  }

  const paragraphs = rawParagraphs.map(p => ({ text: p, isHeading: false }));
  return { paragraphs };
}

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

// ── Helper to display results ──────────────────────────────────────────────
function displayResults(res) {
  const { bullets, wordCount, readMinutes } = res;
  const metaEl = document.getElementById('page-meta');
  const output = document.getElementById('output');
  const errorEl = document.getElementById('error');
  const summaryList = document.getElementById('summary-list');
  const loading = document.getElementById('loading');
  const btn = document.getElementById('summarize-btn');

  loading.classList.add('hidden');
  btn.disabled = false;

  document.getElementById('word-count').textContent = wordCount.toLocaleString() + ' words';
  document.getElementById('read-time').textContent = readMinutes + ' min read';
  metaEl.classList.remove('hidden');

  if (!bullets || bullets.length === 0 || (bullets.length === 1 && bullets[0].includes("doesn't contain enough text"))) {
    errorEl.textContent = bullets[0] || 'No clear text content found to summarise.';
    errorEl.classList.remove('hidden');
    return;
  }

  summaryList.innerHTML = '';
  bullets.forEach(sentence => {
    const li = document.createElement('li');
    li.textContent = sentence;
    summaryList.appendChild(li);
  });
  output.classList.remove('hidden');
}

// ── Main summarise action ──────────────────────────────────────────────────
document.getElementById('summarize-btn').addEventListener('click', async () => {
  const loading = document.getElementById('loading');
  const output = document.getElementById('output');
  const errorEl = document.getElementById('error');
  const btn = document.getElementById('summarize-btn');

  loading.classList.remove('hidden');
  output.classList.add('hidden');
  errorEl.classList.add('hidden');
  btn.disabled = true;

  if (activeTab === 'file') {
    if (!fileParagraphs || fileParagraphs.length === 0) {
      loading.classList.add('hidden');
      errorEl.textContent = 'Please select a .txt or .vtt file first.';
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      return;
    }
    // Run locally on the parsed file content
    const result = summariseFileParagraphs(fileParagraphs, bulletCount);
    displayResults(result);
    return;
  }

  // ── Page Tab Logic (Existing Injection) ────────────────────────────────
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')))) {
    loading.classList.add('hidden');
    errorEl.textContent = 'Cannot summarise browser system pages.';
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    return;
  }

  chrome.scripting.executeScript(
    { target: { tabId: tab.id }, func: extractAndSummarise },
    (results) => {
      if (chrome.runtime.lastError || !results || !results[0] || !results[0].result?.paragraphs?.length) {
        loading.classList.add('hidden');
        btn.disabled = false;
        errorEl.textContent = 'Failed to read page content. Try reloading the page.';
        errorEl.classList.remove('hidden');
        return;
      }
      displayResults(summariseFileParagraphs(results[0].result.paragraphs, bulletCount));
    }
  );
});

// ── Injected page function — runs inside the active tab ────────────────────
function extractAndSummarise() {
  const avoid = new Set(['nav','header','footer','aside','script','style',
    'noscript','form','select','option','menu','dialog']);
  const paragraphs = [];

  function hidden(el) {
    const style = window.getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden';
  }

  function blocked(el) {
    for (let p = el; p; p = p.parentElement) {
      if (avoid.has(p.tagName.toLowerCase()) || hidden(p)) return true;
    }
    return false;
  }

  const roots = document.querySelectorAll('article, [role="main"], main');
  const scopes = roots.length ? roots : [document.body];
  scopes.forEach(scope => {
    scope.querySelectorAll('p, h1, h2, h3').forEach(el => {
      if (blocked(el)) return;
      const text = el.innerText.replace(/\s+/g, ' ').trim();
      if (text) paragraphs.push({ text, isHeading: /^H[1-3]$/.test(el.tagName) });
    });
  });

  return { paragraphs };
}

// ── Local TF-IDF function for File Uploads ─────────────────────────────────
// Duplicated logic to avoid CSP/serialization issues with chrome.scripting
function summariseFileParagraphs(paragraphs, maxBullets) {
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

  function tokenise(text) {
    return (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [])
      .filter(w => !STOP.has(w));
  }

  function buildIndex(sentences) {
    const index = new Map();
    sentences.forEach((s, i) => {
      const terms = new Set(tokenise(s.text));
      terms.forEach(term => {
        if (!index.has(term)) index.set(term, []);
        index.get(term).push(i);
      });
    });
    return index;
  }

  function scoreSentences(sentences, index, totalSentences) {
    const idf = new Map();
    index.forEach((list, term) => {
      idf.set(term, Math.log((totalSentences + 1) / (list.length + 1)) + 1);
    });

    return sentences.map((s, i) => {
      const terms = tokenise(s.text);
      if (terms.length === 0) return { ...s, score: 0, index: i };

      const tf = new Map();
      terms.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));

      let score = 0;
      tf.forEach((count, term) => {
        score += (count / terms.length) * (idf.get(term) || 1);
      });

      if (s.isHeading) score *= 1.5;
      const wc = s.text.split(/\s+/).length;
      if (wc < 8 || wc > 50) score *= 0.3;
      const positionBias = 1 - (i / totalSentences) * 0.4;
      score *= positionBias;

      return { text: s.text, score, index: i, isHeading: s.isHeading };
    });
  }

  function chunkAndReduce(paragraphs, targetSentences) {
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

    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const keep = Math.max(Math.ceil(sorted.length * 0.6), Math.ceil(targetSentences * 2));
    const keepSet = new Set(sorted.slice(0, keep).map(p => p.origIndex));

    const sentences = [];
    scored.forEach((p, i) => {
      if (!keepSet.has(i)) return;
      const raw = p.text.match(/[^.!?]+[.!?]+/g) || [p.text];
      raw.forEach(s => sentences.push({ text: s.trim(), isHeading: p.isHeading }));
    });

    return sentences;
  }

  // Main logic for file
  const allText = paragraphs.map(p => p.text).join(' ');
  const wordCount = allText.split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  if (wordCount < 80) {
    return { bullets: ["File doesn't contain enough text to summarise."], wordCount, readMinutes };
  }

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
    return { bullets: sentences.map(s => s.text).filter(Boolean), wordCount, readMinutes };
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
