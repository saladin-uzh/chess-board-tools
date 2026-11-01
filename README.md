# Chess Board Tools

[![Support and privacy pages](https://github.com/saladin-uzh/chess-board-tools/actions/workflows/pages.yml/badge.svg?branch=prod)](https://github.com/saladin-uzh/chess-board-tools/actions/workflows/pages.yml)

[Українська версія](README.uk.md)

A browser extension for Chess.com with keyboard board controls, configurable
move confirmation shortcuts, and optional sound cues during your turn.
Piece Vision Overlay is available against bots, in analysis, and in
completed game reviews, and Rated, Daily and Learning puzzles.

## Installation

[Chrome Web Store listing](https://chromewebstore.google.com/detail/chess-board-tools/cjcnnbgmhglibikfjocccmgfcpopclie) · [GitHub releases](https://github.com/saladin-uzh/chess-board-tools/releases)

The store listing shows its current availability and version. To install a
local copy, follow the unpacked-extension steps below. The extension popup is
in English. No macOS App Store edition is published.

### 1. Get the extension files

Choose one option:

- Clone the repository:

  ```bash
  git clone https://github.com/saladin-uzh/chess-board-tools.git
  ```

- Or select **Code → Download ZIP** on GitHub and extract the downloaded
  archive. Do not load the ZIP file directly.

### 2. Load the unpacked extension

1. Open `chrome://extensions` in Chrome or a Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select the extracted `chess-board-tools` directory containing
   `manifest.json`.
5. Reload any Chess.com tabs that were already open.

After pulling or downloading an update, select the extension's **Reload**
button on `chrome://extensions`, then reload the Chess.com tab.

### Updating a temporary Safari copy

For an already-installed temporary Safari extension, use **Safari Settings →
Extensions → Reload** after changing the files, then close and reopen the test
tabs. Existing tabs can retain old scripts or stale extension event handlers.
See [validation coverage](docs/validation.md) for recorded browser checks and
remaining limits. Temporary Safari installations do not constitute an App Store build.

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

Confirmation requires a visible, enabled confirmation button. Cancellation
uses the visible Cancel button, or clears all queued premoves on your active
game board, including during the opponent’s turn. It works with keyboard
board control disabled. All extension keyboard actions pause while
an input, textarea, select, editable element, or textbox has focus. Events
inside buttons and other interactive controls are also ignored.

## Board control and thinking ticks

The popup has separate **Keyboard board control** and **Tick during my turn** switches. Both start disabled and use local preferences.

Type coordinates sequentially: `b`, `2` selects b2; `b`, `3` clicks b3.
Coordinates stay algebraic when flipped. A letter immediately highlights its
file; pressing the same letter again cancels the file selection without
deselecting the piece already selected on the board. A different letter replaces
the file selection. The following digit outlines the chosen square above fog. The square
outline clears on position or lifecycle changes. An incomplete letter appears beside
the board and clears after five seconds, Escape, focus changes, scrolling,
position changes, or board replacement. Use Latin `a–h` in your active layout.
When the host promotion picker opens, `q/r/b/n` choose queen/rook/bishop/knight;
coordinate entry pauses. Chess.com validates moves and retains its normal
confirmation flow. All keyboard actions pause while an input has focus.

Board control works on Chess.com chessboards on every route, including
ongoing games you watch, analysis, puzzles, and variants. It requires the host
board position/orientation APIs and a stable, visible board. Clicks use the host pointer path; Chess.com
may report them as synthetic events. The extension does not hide or bypass
those checks.

Ticks follow the selected frequency during your own turn in an active game,
including pending confirmation. The single frequency selector offers:

- **Auto** (default): `ceil(initial seconds / 120)`, bounded to 2–30 seconds.
- **Increment**: every increment interval; no increment falls back to Auto.
- **2, 5, 10, 15, 20 or 30 seconds**: a fixed interval.

Auto stays silent when initial time is unavailable, including No Timer games;
Increment does the same when it falls back to Auto. Fixed intervals still work.
Volume defaults to 50%,
with a range of 0–100%; 0% mutes ticks. Changing frequency starts a fresh
interval; changing volume preserves the current schedule. Puzzles do not tick.

Each new turn resets the timer. Unknown player color and
analysis disable sound. First click or press a key in the game tab to unlock
audio. Hidden tabs stay silent; missed ticks never accumulate. Enabling the
feature or loading a page midway through a turn starts timing from that point.

## Supported pages

Keyboard board control loads on `https://www.chess.com/*`. Move confirmation
shortcuts retain their existing routes:

- `https://www.chess.com/play/*`
- `https://www.chess.com/game/*`
- `https://www.chess.com/analysis`
- `https://www.chess.com/analysis/game/*`

## Piece Vision Overlay

In the popup, enable **Piece Vision Overlay**, choose opacity (20–80%,
default 55%), and select Auto, White, or Black. It starts disabled. Auto follows
your player color when available; otherwise it uses the side at the bottom of
the board and follows board flips. Manual White/Black perspectives stay fixed.

The overlay supports `/play/computer` (including named bot routes), standalone
`/analysis`, and completed
`/analysis/game/live/*`, `/analysis/game/daily/*`, or
`/analysis/game/computer/*` games (including `/analysis` and `/review` suffixes),
plus completed `/game/live/*` and
`/game/daily/*` reviews. Ongoing daily games also support fog while in analysis
mode on `/game/daily/*` or `/analysis/game/daily/*`. It stays unavailable during
active human play, in classrooms, variants, incomplete state, and unsupported pages. Fog also
works in `/puzzles/rated`, `/daily` and `/puzzles/learning`; it is unavailable
in Puzzle Rush and Puzzle Battle.

Squares unseen by either side use a darker tint: their remaining transparency is
half that of ordinary fog. Thin diagonal stripes distinguish these squares from
ordinary fog. Square highlights stay below pieces; arrows stay above fog.

Clear squares are the union of your pieces' occupied squares and movement
destinations, except that pawns reveal their two forward capture diagonals
regardless of occupancy or side to move, without revealing forward movement
squares. Sliding pieces stop at blockers and knights jump. Castling uses actual
rights and clear paths. En passant does not expand pawn sight beyond those
diagonals. Check, pins, and enemy king attacks do not filter this
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
The extension code makes no external network requests and does not collect
telemetry or game history. It runs only on the listed Chess.com URLs.

Shortcut settings use `chrome.storage.sync`. When Chrome Sync is enabled, Chrome
synchronizes these settings with your other signed-in Chrome browsers. When
syncing is disabled, these settings stay local to the browser. Chrome stores
offline changes locally and resumes synchronization when back online.

Fog and board helper preferences use separate `chrome.storage.local` keys
and are not synchronized. Position
snapshots are used in memory to draw the mask; positions, move history, and
account/game identifiers are not stored by the extension.

Safari implements the sync storage API but does not synchronize these settings
between devices. The popup follows system/browser light or dark appearance.

## Tests

With Node.js 18 or newer, run `node --test tests/*.test.cjs`. The tests
use mocked DOM and Chrome storage APIs; they do not require a Chess.com account.
They cover hotkeys, visibility rules, complete-state/context validation, popup
races, and overlay lifecycle. Recorded browser evidence and remaining limits are listed in
[validation coverage](docs/validation.md). See the [changelog](CHANGELOG.md) for
release changes and [architecture](docs/architecture.md) for module boundaries.

[Production CI/CD](docs/ci-cd.md): production ZIP builds and Chrome Web Store setup.
