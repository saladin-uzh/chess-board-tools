# Architecture

Chess Board Tools is a Manifest V3 extension with no build step, background
worker, production dependencies, or remote code. `manifest.json` is the source
of truth for injected files and URL matches.

## Modules

| Files | Responsibility |
| --- | --- |
| `settings.js` | Shared selectors, shortcut choices, storage keys and preference normalization |
| `content.js` | Confirm/cancel shortcuts; legacy and suffixed Chess.com button classes; premove cancellation fallback |
| `popup.html`, `popup.css`, `popup.js` | Popup layout, appearance and shortcut settings |
| `assist-popup.js`, `fog-popup.js` | Local helper preferences and overlay status |
| `settings-view.js`, `popup-entry.js` | Shared settings markup and toolbar entry point; the popup controllers initialize against either UI root |
| `floating-settings.js`, `floating-settings-geometry.js` | Isolated-world page panel, local geometry, focus and SPA lifecycle |
| `assist-bridge.js` | Read-only MAIN-world board snapshots for coordinates, clock metadata and premove counts |
| `assist-board.js` | Snapshot validation, square geometry and native pointer-event dispatch |
| `assist-content.js`, `assist.css` | Active visible board selection, coordinate/promotion input and helper lifecycle |
| `assist-timer.js` | Own-turn scheduling and Web Audio ticks |
| `fog-bridge.js`, `fog-board.js` | Read-only MAIN-world adapter and restricted standard-board snapshot validation |
| `fog-visibility.js` | FEN parsing and piece-visibility calculation |
| `fog-content.js`, `fog.css` | Overlay lifecycle, selection outlines and rendering layers |
| `site/` | Static support/privacy pages deployed by `.github/workflows/pages.yml` |
| `scripts/package-extension.py` | Deterministic runtime ZIP, reference/integrity validation, hashes and provenance |

## Boundaries and behavior

MAIN-world adapters read Chess.com's exposed board API and return JSON via DOM
events. Isolated-world code validates snapshots before using them. Missing or
unstable host state makes the affected helper unavailable. Bridges have no
extension storage access and do not call move-mutation APIs.

Coordinate snapshots are independent of the restricted timer/premove context.
Coordinate input uses the visible active board; timing and premove cancellation
use the primary game board. Input dispatch follows the host's ordinary pointer
path, including its synthetic-event reporting.

The overlay loads across Chess.com for SPA navigation but remains restricted at
runtime: standard bots, analysis, completed reviews, Daily analysis and
Rated/Daily/Learning puzzles. It excludes active human play, Puzzle Rush,
Puzzle Battle, classrooms and variants. Coordinates are not restricted by these
overlay rules. Pieces render above the fog; arrows render above the fog and
ordinary square highlights remain below pieces.

Shortcut preferences use `chrome.storage.sync`; overlay and board-helper
preferences use separate `chrome.storage.local` keys. Popup revision tracking
prevents stale initial reads or delayed saves from overwriting incoming changes.
Existing settings are normalized; new tick options default to Auto and 50%.
No stored positions or history are required.

Page settings live in a shadow root and reuse the popup controllers and storage
keys. The page panel reads/subscribes to overlay status directly in the isolated
world; toolbar status still uses extension messaging. MAIN-world bridges have no
settings interface. Only the bundled 32px extension icon is web-accessible on
Chess.com. The `chess-open-settings` extension message opens/focuses the panel and
acknowledges `{ opened: true }`; it accepts no settings values.

`floatingSettingsPreferences` stores only local left/top/width/height. Geometry
is bounded to the current viewport, and writes are serialized. Open state stays
in tab memory across SPA navigation and BFCache, and resets on full reload.
The host is restored if page rendering removes it. Settings UI focus suppresses
extension board shortcuts, including events retargeted through the shadow root.

See [English instructions](../README.md), [Ukrainian instructions](../README.uk.md)
and [validation coverage](validation.md) for supported behavior and limits.
