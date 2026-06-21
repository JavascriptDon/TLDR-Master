# TLDR Web Summariser
A Chrome extension that summarises the current web page instantly, without API keys or external dependencies.

## Extension Overview
This extension provides a lightweight, fully client‑side summarisation tool directly inside a Chrome popup. It works by injecting analysis functions into the active browser tab using chrome.scripting.executeScript, allowing it to read and process visible page content without external APIs.

---

## 📌 Core Features

- **Extracts readable text** from the current webpage.
- **Counts total words** and **estimates reading time** based on ~200 wpm.
- **Generates a concise bullet‑point summary** using TF‑IDF scoring, heading weighting, and position bias.
- **Allows the user to choose the number of summary bullets** (e.g., 3, 5, 7).
- **Copies the generated summary to the clipboard** in a clean bullet‑list format.
- **Supports light/dark theme toggling**, with the user’s preference stored in `chrome.storage.local`.
- **Runs entirely in the browser**, with no server calls or external dependencies.

---

## ⚙️ How It Works

When the popup opens or the user clicks **Summarise**, the extension:

1. **Injects a self‑contained summarisation function** into the active tab.
2. **Extracts visible text** while ignoring navigation, ads, forms, and UI elements.
3. **Splits content** into paragraphs and sentences.
4. **Scores sentences** using TF‑IDF, heading bonuses, length penalties, and position bias.
5. **Selects the top N sentences** and returns them to the popup UI.
6. **Displays the summary**, word count, and estimated reading time.

This design keeps the extension **fast, private, and fully offline**.

---

## Local testing

1. Install dependencies:

```bash
npm install
```

2. Build the extension:

```bash
npm run build
```

3. Open Chrome/Edge and go to:

- chrome://extensions/ or edge://extensions/
- Enable Developer mode
- Click Load unpacked
- Select the dist folder from this project

## Notes
The extension entry point is defined by manifest.json. 
Assets are copied into dist during build so popup.html, manifest.json, and assets/ are available for the browser to load. 

