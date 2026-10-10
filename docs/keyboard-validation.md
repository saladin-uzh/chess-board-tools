# Keyboard board control validation

Base: v1.0.0. No new dependency or extension permission.

## Automated checks

`node --test tests/*.test.cjs`: 38 passing tests. New coverage includes
coordinate mapping in both orientations, five-second buffering and lifecycle
resets, modifier/repeat/focus guards, promotion choices, local preference
races, read-only snapshots, and host pointer dispatch. Existing shortcut and
fog regression tests remain included. Changed scripts pass `node --check`;
`git diff --check` passes.

## Runtime evidence

Tested in an isolated Chrome for Testing 154 profile with Chess.com board
1.188.0, using disposable analysis and bot contexts. Safari was not reloaded
or modified.

- Analysis: b2-b3 and flipped b7-b6 produced the expected host moves.
- Bot game: sequential g1-f3 produced Nf3 through the host handler.
- Focused input: b2b3 stayed literal input and did not move a piece.
- Promotion: a7-a8 followed by n produced a8=N through the host picker.
- The combined keyboard/timer popup fit with Auto fog status and no visible
  scrollbar or clipped content. The keyboard-only popup contains less content.
- The bot and completed-human board pointerdown handlers were inspected.
  Both use the host pointer path, including FairPlay.UntrustedUserEvent
  reporting for synthetic events. The extension does not bypass that report.

## Runtime coverage limits

Active human live/daily games and their native confirmation prompt have not
been exercised in a disposable game. Completed human-game inspection does
not establish active-game behavior. Safari runtime behavior is also not
verified. These limitations remain documented for the v1.1.0 release.

## Direct human-game URL regression

The human-game bridge and adapter now accept `/game/<numeric-id>` and its
optional trailing slash, alongside `/game/live/<id>` and `/game/daily/<id>`.
Previously the direct URL was rejected before coordinate input could run.
The existing `https://www.chess.com/game/*` manifest matches already cover
these URLs; no new permission or injection scope is needed.

`node --test tests/*.test.cjs`: 70 tests pass. Changed scripts pass
`node --check`, and `git diff --check` passes.

Regression tests reproduce the rejected route in both the bridge and adapter,
check legacy routes and malformed paths, and preserve the standard-game,
playing-mode, latest-position, completed-result, and stable-board guards.
Content tests check that active human snapshots accept coordinate input while
inactive or unstable snapshots do not.

Runtime acceptance remains pending: after the tournament, use a disposable
unrated human game at `/game/<id>`, enable keyboard control, and verify a legal
move with sequential source/destination coordinates, both board orientations,
and native move confirmation if enabled. Do not test by changing an existing
competitive game. Host pointer dispatch and untrusted-event reporting are
unchanged. This regression has not been verified in Safari or an active human
game.
