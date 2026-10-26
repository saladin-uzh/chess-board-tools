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
Package validation checks the 22 runtime files, manifest/popup/CSS references,
ZIP integrity, hashes and provenance. Generated output stays in ignored `build/`.

For a browser DOM regression fixture, serve the repository locally and open
`tests/confirmation-buttons.html`. Its 16 checks use the real `settings.js` and
`content.js`; they do not exercise a Chess.com account or installed extension.

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
