# gh-no-tests

This Chrome extension marks test files as **Viewed** and collapses their diffs on GitHub.

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Choose the folder with `manifest.json`.
5. Reload GitHub.

The extension starts on. Clear **Viewed** to review a file.
Your choice stays until you leave the diff or reload.
Use the extension panel to turn it off. GitHub keeps the Viewed state.

Run `node --test tests/*.test.cjs` for unit tests.
Run `node tests/server.cjs` for the browser tests.
Open `http://127.0.0.1:8765/tests/browser.html` to see the results.
