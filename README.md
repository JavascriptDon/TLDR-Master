# TLDR Web Summariser
A Vite-powered Chrome extension that summarises the current web page instantly, without API keys or external dependencies.

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
