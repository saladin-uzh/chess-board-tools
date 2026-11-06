# Architecture

Chess Board Tools is a Manifest V3 extension with no build step, background
worker, production dependencies, or remote extension code. `manifest.json` is the source
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
| `tournament-companion.js`, `tournament-companion-view.js` | Optional same-origin native tournament iframe, validated Share URL and child-only layout/lifecycle |
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

The tournament companion is opt-in through the native Share dialog. It validates
an exact `https://www.chess.com/play/{arena|tournament}/{numeric-id}` URL; page
location is not used to infer the selected event. One iframe per parent tab
loads the native app with its existing session. Content scripts remain top-frame
only; the isolated parent accesses the same-origin child DOM without a MAIN-world
bridge, private requests, artificial data polling or copied chat content.
The child retains its native title, tabs, input, subscriptions and error dialogs.
Only its own tournament tab is selected; the parent Play tab is untouched.

The child view is hidden until its native tournament tab and container are ready,
and hidden again if they become unavailable. The extension does not independently
verify server freshness or message delivery. Closing removes the child document
and observer. Parent Play/game SPA changes retain the companion; leaving those
routes, pagehide or host removal disposes it. Geometry is bounded by the existing
settings helper and kept in memory. A different event requires explicit close
before opening, preserving the current draft from silent replacement.
Mouse and pointer events from the companion's controls and drag shield are
stopped at its shadow root during bubbling, as are control key events. Native
input inside the child document is unchanged. This does not isolate host-page
capture listeners or the native app's session effects when the iframe unloads.
Within the child, activation is restricted to the three native content tabs and
Chat. Canonical Chess.com member links and native username components open profiles
in a new tab using noopener/noreferrer; invalid or shortened usernames are rejected.
Games/Standings game actions and other detached popover actions are read-only; scrolling
and non-activation keys remain native. No pointer movement/drag handlers are
installed in the child. Capture guards for click/auxclick/double-click/context
menu and activation keys are disposed with the view. Chat-related native dialogs
remain interactive, while tournament header/footer actions stay blocked.
