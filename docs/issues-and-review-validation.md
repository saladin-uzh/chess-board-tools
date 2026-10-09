# Issues #2–#4 and completed-review validation

Base: `6216e13` (main). No dependency, storage migration, permission, or version change.

## Automated checks

- `node --test tests/*.test.cjs`: 67 passing tests.
- `node --check` passes for all changed JavaScript files.
- `git diff --check` passes.

Popup regressions cover incoming sync values while idle, during initial reads,
and during successful/failed delayed saves; deleted, malformed, or duplicate
values; unrelated storage events; and the popup's own write event. Both fields
remain disabled during reads/writes and render the latest accepted pair.

Review regressions require a completed standard game in observing mode, reject
unfinished games and mismatched routes, and keep own-turn ticking inactive.
Selection tests cover immediate file highlighting, square outlines in both
orientations, timeout, Escape, and position changes. Existing pointer, promotion,
focus, lifecycle, timer, and fog visibility tests remain included.

## Chrome runtime evidence

Tested the unpacked working copy in Chrome for Testing 154.0.8037.0, using
disposable analysis boards and the completed review at
`https://www.chess.com/game/live/185051491238?move=4`.

- With the popup open, an extension-context write changed Cancel to Control.
  Editing Confirm to Enter preserved the received Control value. This verifies
  a real storage event, not synchronization between two devices.
- The review exposes `board-single`, observing mode, and result `1-0`.
  Fog appeared and the keyboard handler's `b2b3` sequence produced the native
  hypothetical b2–b3 move with the expected FEN. No active game was modified.
- The promotion picker is a direct board child with
  `.promotion-window--visible`. Its native z-index is 2; fog is 5. The scoped
  rule raises the entire picker to 9, including all pieces and cancellation.
- After extension/page reload, the persisted rule produced picker z-index 9,
  file z-index 8, and a square outline above fog.
- The persisted styles passed 64 promotion cases: white/black, both board
  orientations, q/r/b/n, 20%/80% fog, and light/dark page presentation.
  Sixteen cancellation cases preserved the original FEN and retained fog.
  Each case reopened the picker. Themes were changed only by toggling the
  observed page `dark-mode` class on the disposable page, without saving account
  settings. The normal mask after cancellation matched the visibility union.
- Native pointer annotations still rendered: the arrow layer remained at
  z-index 7 and the selected-pawn highlight at 6; selection outlines are at 8.

Keyboard and cancellation matrices dispatched events in the real page through
the extension/host handlers. They do not establish trusted physical-key input.
Native input with the current system layout did not establish Latin-coordinate
behavior; the system layout was left unchanged while the user was playing.

## Safari runtime evidence

Tested on 2026-10-09 in Safari 27.0.1 with the existing temporary extension.
Keyboard board control was already enabled. The original injected bridge lacked
the new review snapshot's `result` field. Settings → Extensions → Reload loaded
the current code, including the new file and square indicators.

- Native b2–b3 worked on standalone analysis and the requested completed review,
  producing the expected host FEN. File and square indicators were visually
  verified after native letter/digit input.
- A tab that was open across the extension reload read storage but stopped
  delivering storage change events and runtime status messages. A fresh tab
  restored both: toggling fog in the popup immediately removed the mask and
  the popup reported the active perspective correctly. This is a development
  reload limitation; no browser-specific production workaround was added.
- Fresh `/analysis?fen=…` received the scripts and 80% fog. Sixteen promotion
  cases used native key presses: both colors, both orientations, and q/r/b/n.
  All produced the expected promoted piece, closed the picker, and retained fog.
- All picker choices and cancellation were visibly above fog. A native click
  on cancellation restored the original white FEN and retained the mask.

The Safari checks establish native-key behavior in analysis and completed
review, unlike the earlier Chrome event-dispatch matrices. Tests used only
disposable analysis positions and hypothetical completed-review moves.

## Coverage limits

Actual two-device Chrome Sync and active human-game runtime checks were not
performed. Distributed conflict merging remains outside issue #3's scope.
Safari packaging/distribution, older Safari releases, and Safari's full
20%/80% light/dark matrix were not tested. Release and publication remain outside
this work.
