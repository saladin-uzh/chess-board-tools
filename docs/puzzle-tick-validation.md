# Board cancellation, puzzles and configurable ticks

## Automated validation

The starting main commit is `4904825`; its 82 Node tests pass. The updated
suite has 94 passing tests. All top-level JavaScript files pass `node --check`,
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

## Runtime acceptance

Host inspection and Node tests do not establish execution of the changed
installed extension. Runtime checks must be recorded separately:

- On a disposable game, queue one and several premoves during the opponent's
  turn; verify Esc, Space and both standalone Ctrl choices clear the queue,
  with keyboard control disabled as well as enabled. No unintended move or
  marking should remain. Test the existing confirmation panel separately.
- In each of Rated, Daily, Learning, Rush and Battle, verify coordinate input
  with both orientations, repeated-file cancellation and focused-input guards.
  Check promotion and transition to the next puzzle when available.
- Fog appears only in Rated, Daily and Learning. Enable it before navigating
  to Rush/Battle and verify there is no stale mask. Verify changing puzzles,
  entering review, resize and board replacement.
- Verify the single frequency selector, 50% default volume, mute, audible
  volume changes and configured intervals. Check hidden-tab silence and
  pending confirmation; inspect popup layout in light and dark appearance.

No commit, push, tag, merge or store publication is performed by this change
preparation. Signed commits and push are reserved for the user; the draft PR
is created after the user confirms the push.
