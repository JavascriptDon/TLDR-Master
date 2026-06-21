# TLDR Web Summariser

A minimal Chrome extension that summarises the current web page instantly — no API keys or external services required.

## Repository Structure

- `manifest.json` — extension manifest (metadata, permissions, background/popup config)
- `popup.html` — popup UI shown when the extension icon is clicked
- `popup.js` — popup logic and summarisation code
- `assets/`
	- `css/`
		- `popup.css` — styles for the popup
	- `images/` — icons and other images
- `README.md` — this file

## Quick Start — Load Unpacked Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select this repository folder
4. Click the extension icon to open the popup and try the summariser

## Contributing

Contributions welcome: open issues or submit pull requests with improvements or bug fixes.

## License

This project is licensed under the MIT License.

## Local Testing Guide for your Browsers

Follow these general steps to test this extension on popular browsers. Always ensure your `manifest.json` matches the target browser's required manifest version and permissions.

Users can load the extension unpacked during development:

**Chrome / Edge (Chromium‑based)**
- Open chrome://extensions or edge://extensions.
- Enable Developer mode.
- Click **Load unpacked**.
- Select your extension folder (must contain manifest.json).

**Firefox**

- Open about:debugging#/runtime/this-firefox.
- Click **Load Temporary Add-on**.
- Select manifest.json or the extension folder.
- This allows users to test your extension locally without packaging it.

**Microsoft Edge**

- Open edge://extensions in the address bar.
- Turn on Developer mode (toggle in the bottom-left corner).
- Click **Load unpacked**.
- Select your extension’s folder — the one containing manifest.json.
- Edge will load it immediately, and you’ll see it appear in the extensions list.
- If your extension has a popup, click the toolbar icon to test it.
- For background scripts or service workers, use the Inspect link inside the extension card.

