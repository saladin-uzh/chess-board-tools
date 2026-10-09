# Chess.com Confirm Move Hotkeys

[Українська версія](README.uk.md)

A minimal Manifest V3 extension for Chrome and Chromium-based browsers that
controls the Chess.com move confirmation dialog with configurable keyboard
shortcuts, with optional semi-transparent Fog of War for bots and analysis.

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

Confirmation offers Enter, Space, or Ctrl; cancellation offers Esc, Space, or
Ctrl. Defaults are Space and Esc, and the two actions require different keys.
Previously saved unsupported keys fall back to defaults.

Ctrl means either Control key pressed and released alone. Ctrl combinations
such as Ctrl+C are ignored. Shortcuts activate after settings load; popup
controls are disabled while loading or saving.

The extension handles a shortcut only when its visible, enabled confirmation
or cancellation button is present. All extension keyboard actions pause while
an input, textarea, select, editable element, or textbox has focus. Events
inside buttons and other interactive controls are also ignored.

## Keyboard board control

The popup has a **Keyboard board control** switch. It starts disabled and uses
local preferences.

Type coordinates sequentially: `b`, `2` selects b2; `b`, `3` clicks b3.
Coordinates stay algebraic when flipped. An incomplete letter appears beside
the board and clears after five seconds, Escape, focus changes, scrolling,
position changes, or board replacement. Use Latin `a–h` in your active layout.
When the host promotion picker opens, `q/r/b/n` choose queen/rook/bishop/knight;
coordinate entry pauses. Chess.com validates moves and retains its normal
confirmation flow. All keyboard actions pause while an input has focus.

Board control supports standard human games, bots, and analysis. Unknown modes
and unavailable APIs disable it. Clicks use the host pointer path; Chess.com
may report them as synthetic events. The extension does not hide or bypass
those checks.

## Supported pages

The content script runs only on:

- `https://www.chess.com/play/*`
- `https://www.chess.com/game/*`
- `https://www.chess.com/analysis`
- `https://www.chess.com/analysis/game/*`

## Semi-transparent Fog of War

In the popup, enable **Semi-transparent Fog of War**, choose opacity (20–80%,
default 55%), and select Auto, White, or Black. It starts disabled. Auto follows
your player color when available; otherwise it uses the side at the bottom of
the board and follows board flips. Manual White/Black perspectives stay fixed.

Fog is supported on `/play/computer`, standalone `/analysis`, and completed
`/analysis/game/live/*`, `/analysis/game/daily/*`, or
`/analysis/game/computer/*` games. It stays unavailable for human games,
classrooms, variants, incomplete state, and unsupported pages. Human-game use
is outside this release under [Chess.com's Fair Play Policy](https://www.chess.com/legal/fair-play).

Clear squares are the union of your pieces' occupied squares and movement
destinations. Sliding pieces stop at blockers, knights jump, and pawns reveal
empty forward moves and available captures rather than all attacked diagonals.
Castling uses actual rights and clear paths; en passant uses the current FEN
target and side to move. Check, pins, and enemy king attacks do not filter this
visibility. A clear square does not mean a standard-chess move is legal.

Selecting your piece outlines its own visibility while retaining the union.
The overlay allows normal clicks, drags, and board controls. Fog returns when
visibility is lost; there is no explored-area memory. During uncertain or
animated positions, the mask is removed. The popup reports unavailable state.
Reload the extension and page after updates, as described above.

The adapter reads Chess.com's exposed board API. If that API changes, fog
becomes unavailable instead of inferring castling or en-passant rights from
piece placement.

## Troubleshooting

- Reload the Chess.com tab after installing or updating the extension.
- Verify that move confirmation is enabled in your Chess.com settings.
- Select the extension icon and confirm that the popup shows the expected
  shortcut settings.
- Open the page console and look for
  `[Chess.com Confirm Move Hotkeys] Initialized.`
- Confirm that the current page URL matches one of the supported patterns.

## Security and privacy

The extension uses the `storage` permission only to save your shortcut, fog, and board helper settings.
It makes no external network requests and does not collect or transmit data. It
runs only on the listed Chess.com URLs.

Fog display preferences use a separate `chrome.storage.local` key. Position
snapshots are used in memory to draw the mask; positions, move history, and
account/game identifiers are not stored by the extension.

## Tests

With Node.js 18 or newer, run `node --test tests/*.test.cjs`. The tests
use mocked DOM and Chrome storage APIs; they do not require a Chess.com account.
They cover hotkeys, visibility rules, complete-state/context validation, popup
races, and overlay lifecycle. Live-browser evidence is tracked separately in
[the implementation checklist](docs/fog-of-war-implementation.md).
