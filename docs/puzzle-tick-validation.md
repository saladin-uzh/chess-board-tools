# Board cancellation, puzzles and configurable ticks

## Automated validation

The starting main commit is `4904825`; its 82 Node tests pass. The updated
suite has 95 passing tests. All top-level JavaScript files pass `node --check`,
and `git diff --check` passes. Candidate packaging validates all 22 runtime
files without adding permissions or dependencies. The manifest version is
unchanged; this is a development candidate, not a published release.

Coverage includes cancel shortcuts with no confirmation panel, standalone
Ctrl and input guards, native right-button pointer dispatch, repeated file
selection without a second board click, five puzzle routes, fog route/board
exclusions, clock metadata units, settings migration and popup save races.

Tick tests cover ceil/clamp Auto, increment fallback, fixed intervals,
frequency changes, volume changes without timer restart, mute and audio gain.
Existing own-turn, pending-confirmation, background, snapshot outage and
AudioContext lifecycle regressions remain passing.

## Host inspection

On 2026-10-13, the user confirmed switching Safari to `hellhelder_dev` before
browser inspection. Chess.com reported chessboard version `1.188.0`.

- Rated and Learning use `wc-chess-board#board-primary`; Daily uses
  `wc-chess-board#board-board`. Playing mode, standard variant, player color
  and orientation APIs were read on the actual boards.
- The shared native premove plugin handles `PointerdownRight` before other
  state transitions. When its queue is nonempty, it queues
  `api.premoves.cancel` and stops further processing. Extension cancellation
  follows this right-pointer path and does not call a mutation API.
- The host reads time control through `game.timeControl.get()`. Its
  `baseTime` and `increment` are milliseconds; native PGN conversion divides
  each by 1000. The extension emits validated seconds in its read-only
  snapshot, independently of the remaining clock time.

Inspected source: Chess.com's puzzles client `2026.10.1`,
`shared.eager.YHIg8rsjCq.chunk.js`. Existing synthetic-event reporting remains
in the board's pointer handler. A premove API on a puzzle board does not mean
that puzzle mode supports premoves.

## Runtime validation in Safari

The user authorized Reload of the temporary extension on `hellhelder_dev`.
The changed popup displayed one frequency select and a 50% default volume.
Its controls were visible in the native dark appearance.

- Learning accepted complete keyboard moves for White and flipped Black,
  displaying Correct in both cases. Next Puzzle replaced the position and
  retained exactly one fog overlay.
- The repeated destination file key removed the file preview while the
  selected host piece remained selected. Recorder output retained
  `highlight growing-circle square-67` across the second `c` with no FEN change.
- Rated and Daily produced one fog overlay and accepted keyboard selection
  of the expected native piece. These selections did not change their FEN.
- Rush Survival accepted a complete keyboard move and displayed Correct.
  Its active board had zero fog overlays while the saved fog setting was enabled.
- In a disposable bot game, native Esc cleared two queued premoves during
  Black's turn. The recorder observed queue counts 0, 1, 2, 0; Black remained
  the side to move at cancellation.
- Native Space cleared one queued premove during Black's turn with keyboard
  control disabled. Pointer recorder counts were 0, 0, 0, 1, 0.
- Dispatched standalone ControlLeft and ControlRight keydown/keyup events
  each cleared one queued premove in the installed controller, during Black's
  turn, without changing the FEN. These are not physical-key tests: the
  automation API rejects modifier-only native key presses.
- Real Web Audio oscillator starts were approximately two seconds apart in
  fixed-interval mode. The contexts were running and the 50% gain peaks were
  0.1; 100% gain peaks were 0.2. The user independently confirmed audible ticks.
  At 0% volume, no new
  oscillator starts occurred during an 86-second observation. A 48-second
  hidden-tab interval retained the same oscillator count (18) on hide and
  return; subsequent starts followed the existing two-second cadence.

- A real 5+5 bot game emitted `initialSeconds: 300` and `incrementSeconds: 5`.
  Auto computed three seconds; sampled oscillator gaps were 2912, 3016 and
  3015 ms. Increment computed five seconds; sampled gaps were 4992, 4993 and
  5067 ms. The initial-time metadata stayed 300 despite the running clock.
- After Reload with the new Auto policy, a No Timer probe recorded zero
  oscillators over 114 seconds including setup. Its final snapshot confirmed
  an active own turn and null initial/increment metadata. The extension tick
  preference remained enabled.

The No Timer game has `timeControl.get()` returning null. The updated
policy keeps Auto silent without a confirmed positive initial time. Increment
also stays silent when it falls back to Auto in this state. Fixed intervals
remain an explicit manual choice. No guessing of the initial clock time is used.

## Remaining runtime checks

- Battle: navigation to `/puzzles/battle` went to `/home` on this test account;
  no active Battle board was available. Automated route exclusions pass.
- Physical standalone left/right Ctrl: unsupported by the automation API;
  dispatched-key coverage in the installed controller passed.
- Native human-game confirmation/cancellation panel and active human-game
  clock metadata: only the existing automated regressions were exercised.
- Fixed 5/10/15/20/30-second presets and additional time controls: only the
  automated matrix was executed. Browser samples cover fixed two seconds,
  Auto three seconds and Increment five seconds on 5+5.
- Complete puzzle-mode matrix: promotion, focused-input guards, both
  orientations outside Learning and each mode's review/next-puzzle lifecycle
  were not all exercised. Existing automated guards and promotion tests pass.
- Native popup change-and-save interaction: automated pointer attempts
  dismissed the popover instead of operating its select. Display/defaults
  were inspected; popup persistence and races passed Node tests.
- Light appearance and physical touch/pen audio activation: not exercised.

Audio probes, event recorders and changed preferences were removed/restored.
The temporary Latin input source was restored, and the bot preset returned to
No Timer without starting another game. Disposable bot fixtures were ended.

The user created and pushed the first three signed commits; draft PR #21
contains those commits. Two local follow-up commits separate the unknown-time Auto policy
from the runtime report. Its signing and push remain reserved for the user.
No tag, merge or store publication has been performed.
