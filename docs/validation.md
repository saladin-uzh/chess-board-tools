# Validation and browser coverage

## Reproducible local checks

Node.js 18 or newer and Python 3 are sufficient; no dependency installation is
required.

```sh
node --test tests/*.test.cjs
for file in *.js; do node --check "$file" || exit; done
git diff --check
python3 scripts/package-extension.py
```

The Node suite mocks DOM and Chrome APIs. It covers shortcuts and focus guards,
legacy/suffixed confirmation classes, preference normalization and save races,
coordinate geometry and board selection, promotion, premove dispatch, route and
snapshot validation, overlay visibility/lifecycle, and tick scheduling/audio.
Package validation checks the 29 runtime files, manifest/popup/CSS references,
ZIP integrity, hashes and provenance. Generated output stays in ignored `build/`.

For a browser DOM regression fixture, serve the repository locally and open
`tests/confirmation-buttons.html`. Its 16 checks use the real `settings.js` and
`content.js`; they do not exercise a Chess.com account or installed extension.

`tests/fog-layers.html` checks the real fog stylesheet against native highlight
markup, including annotation ordering, service highlights, promotion, element
reuse, and overlay removal/reinsertion. On 31 October 2026, all 12 browser checks
and 99 Node tests passed; syntax, diff and package validation also passed.
Live Chess.com analysis DOM inspection confirmed inline `opacity: 0.8` for
right-click annotations, `opacity: 0.5` for last-move highlights, and
`.growing-circle` with `--opacity: 0.5` for selection. The annotation selector
depends on that native inline opacity convention. The updated extension was not
reloaded or tested on a live Chess.com board.

For floating settings, open `tests/settings-panel.html` from the same server.
Its 18 checks exercise the real shared settings controllers and panel DOM with
mocked Chrome APIs, including cross-surface updates, delayed/failed saves, focus,
keyboard geometry, SPA navigation and host restoration.

For the tournament companion preview, open `tests/tournament-companion.html`.
It uses the production runtime files with simulated same-origin native pages;
no Chess.com request is made by the fixture. Its 56 checks cover Share launch,
one-frame ownership, parent Play retention, native input/handlers/dialogs,
bounds, unavailable state, close/reopen, route cleanup and pagehide.
The Node suite also tests Share URL validation, child selection/disposal and
pointer cancellation/lost capture with the iframe shield. See the separate
[live release gate](tournament-companion.md#evidence-and-remaining-release-gate).
On 6 November 2026, all 131 Node tests and 52 companion fixture checks passed.
The browser run includes the real startup deadline for a missing native view;
its Node regression failed before the deadline was added. Layout checks also
passed with a 280×240 override. Real pointer dragging and resizing over the
iframe were checked separately.
The mobile header regression uses the observed `#mobile-toolbar` inside
`.board-layout-nav`; it failed before those selectors were added. Recovery tests
verify that Show tournament reuses the existing child and never selects a parent tab.
Pointer/mouse bubbling and the close click are checked against parent-document
listeners; the regression failed before propagation was stopped at the shadow root.
The 52-check fixture also passed in Safari 27.2 (22625.2.8.11.9), in a separate
test window. It verifies native tab selection, read-only Games/Standings and
detached popovers, unblocked scrolling, and restored Chat activation. Header/
footer pointer exclusion and detached-popover activation each reproduced a
failure before their fixes. These are local DOM checks, not live account/game tests.
The profile-link update passed all 132 Node tests and 56 local Chromium fixture
checks. These include separate-tab profile routing, no opener access, and rejection
of game URLs and shortened usernames. The popup call is intercepted by the fixture;
this does not verify actual browser popup policy or live profile-page loading.
The updated 56-check fixture also passed in a separate Safari test window.
The popup call remains intercepted there; actual popup policy/profile loading is
not established by either local fixture run.
JavaScript syntax, diff and packaging checks passed with 29 runtime files.
This is local candidate validation, not installed-extension or live-service proof.

`tests/tournament-companion-security.html` checks that the simulated child page
rejects unsupported tournament kinds and renders markup-like tab labels as text.
It also checks normal Arena/Swiss standings, native Chat handlers and missing-view
behavior. This regression reproduced HTML interpretation before the fixture fix.

## Unreleased floating settings checks — 28 October 2026

- 104 Node tests passed, including geometry bounds, shadow focus guards, toolbar
  open acknowledgements and stale board-status responses.
- All top-level JavaScript syntax checks and `git diff --check` passed. Candidate
  packaging validated 26 runtime files, including the web-accessible icon.
- The floating-settings fixture passed all 18 checks in Chromium 154. Real pointer
  dragging/resizing, dark/light page tokens, a 280×240 viewport, scrolling and
  geometry restoration after viewport growth were checked separately.
- The existing confirmation-button fixture passed all 16 checks. The toolbar
  popup measured 360×599.7 CSS pixels with its new entry command and unavailable
  board status in the isolated profile.
- An unpacked extension was loaded in a disposable Chromium profile. A locally
  fulfilled `https://www.chess.com/analysis` document verified manifest injection,
  actual Chrome sync/local storage, toolbar-to-page messaging, icon loading,
  preference preservation after reload and independent open state in a second tab.
  This was an isolated integration check, not a live Chess.com account/game test.
- The protected Safari extension was not changed or reloaded. Safari runtime and
  visual integration with the current authenticated Chess.com UI remain unverified.

## 1.2.0 release checks — 26 October 2026

- 99 Node tests passed.
- Every top-level JavaScript file passed `node --check`; `git diff --check` passed.
- Candidate packaging validated 22 runtime files and ZIP/reference integrity.
- All 16 confirmation-button checks passed in the in-app browser.
- Local Markdown/HTML file references were checked; support pages were inspected
  in the browser.

## Recorded runtime evidence

These are historical checks of the changes included in 1.2.0, not a claim that
every scenario was repeated against the final release package.

- Safari 27.0.1: keyboard entry in analysis and completed reviews; native
  promotion choices and cancellation with both colors and orientations.
- Safari, 13 October 2026: complete keyboard moves in Learning with White and
  flipped Black; next-puzzle overlay lifecycle; Rated/Daily selection; Rush
  keyboard move with no overlay. The owner also confirmed Battle keyboard
  controls and overlay exclusion.
- Safari, 13 October: Esc cleared two premoves during the opponent's turn;
  Space cleared a premove with keyboard board control disabled. Dispatched
  standalone left/right Ctrl events passed; physical modifier-only input was
  unsupported by the automation tool.
- Safari, 13 October: fixed two-second ticks, Auto three-second and Increment
  five-second ticks in a 5+5 bot game, volume gain, mute, hidden-tab silence and
  unknown-time Auto silence. The owner confirmed audible sound. The compact
  dark popup showed all controls and the privacy footer without scrolling.
- Live Chess DOM, 20 October 2026: the updated selector found exactly one
  visible enabled Submit Move button with a suffixed primary class; the cancel
  selector excluded it. This was read-only inspection, not a submitted move.
  The 16-check browser fixture also passed.

## Remaining coverage limits

Real two-device Chrome Sync, physical standalone Ctrl, a complete puzzle
promotion/orientation/review matrix, every fixed tick preset and human-game clock
metadata were not all runtime-tested. The final confirmation selector was not
reloaded into the protected Safari installation. No signed macOS App Store or
TestFlight build was validated. Temporary Safari checks do not establish App
Store distribution readiness.

Historical step-by-step plans and session reports remain available in Git
history through commit `6db74ad`; this document replaces them as the current
coverage summary. See [architecture](architecture.md) and [changelog](../CHANGELOG.md).
