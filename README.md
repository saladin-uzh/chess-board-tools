# Chess.com Confirm Move Hotkeys

[Українська версія](README.uk.md)

A minimal Manifest V3 extension for Chrome and Chromium-based browsers that
controls the Chess.com move confirmation dialog with configurable keyboard
shortcuts.

## Install locally

This extension is not distributed through the Chrome Web Store. Install it as
an unpacked extension from a local copy of this repository.

### 1. Get the extension files

Choose one option:

- Clone the repository:

  ```bash
  git clone https://github.com/saladin-uzh/chess-confirm-move-hotkeys.git
  ```

- Or select **Code → Download ZIP** on GitHub and extract the downloaded
  archive. Do not load the ZIP file directly.

### 2. Load the unpacked extension

1. Open `chrome://extensions` in Chrome or a Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select the extracted `chess-confirm-move-hotkeys` directory containing
   `manifest.json`.
5. Reload any Chess.com tabs that were already open.

After pulling or downloading an update, select the extension's **Reload**
button on `chrome://extensions`, then reload the Chess.com tab.

## Shortcuts and settings

- `Space` confirms the move.
- `Escape` cancels the move.

Select the extension icon in the browser toolbar to open the popup. The popup
shows a short description of the extension and lets you change the confirmation
and cancellation keys. Changes are saved automatically and are applied to open
Chess.com tabs without reloading the page.

Letter shortcuts match the letter produced by the active keyboard layout,
regardless of its physical position. Settings load before shortcuts become
active. Popup controls are disabled while settings load or save.

The extension handles a shortcut only when the corresponding visible and
enabled confirmation or cancellation button is present. It ignores key events
inside form controls, text fields, editable elements, and shortcuts combined
with modifier keys.

## Supported pages

The content script runs only on:

- `https://www.chess.com/play/*`
- `https://www.chess.com/game/*`
- `https://www.chess.com/analysis/game/*`

## Troubleshooting

- Reload the Chess.com tab after installing or updating the extension.
- Verify that move confirmation is enabled in your Chess.com settings.
- Select the extension icon and confirm that the popup shows the expected
  shortcut settings.
- Open the page console and look for
  `[Chess.com Confirm Move Hotkeys] Initialized.`
- Confirm that the current page URL matches one of the supported patterns.

## Security and privacy

The extension uses the `storage` permission only to save your shortcut settings.
It makes no external network requests and does not collect or transmit data. It
runs only on the listed Chess.com URLs.

## Tests

With Node.js 18 or newer, run `node --test tests/extension.test.cjs`. The tests
use mocked DOM and Chrome storage APIs; they do not require a Chess.com account.
