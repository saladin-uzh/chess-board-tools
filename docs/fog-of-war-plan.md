# Semi-transparent Fog of War overlay

Status: implemented on the feature branch; final browser validation and review in progress.

Implementation branch: `semi-transparent-fog-of-war`, based on merged
`main` commit `5e529a2f524808e020b420fdee686a89a1a18001`.
See [implementation preparation](fog-of-war-implementation.md) for the starting
checks, proposed module boundaries, and ordered work checklist.

## Goal and confirmed decision

Add an optional, semi-transparent visibility overlay to a standard Chess.com
board. Clear squares show the visibility of the player's pieces; fogged squares
remain readable underneath the tint. The user selected movement-based visibility
inspired by Chess.com's Fog of War, rather than an attack/defense map.

The underlying game remains standard chess. Check, checkmate, move legality,
clocks, and the existing confirmation hotkeys continue to be controlled by
Chess.com. This is a visual overlay, not a new game variant.

## Supported-use decision

Recommend the first release for standard games against Chess.com bots and
post-game analysis. Chess.com's Fair Play Policy prohibits extensions that
analyze positions during games against other users, with an explicit exception
for games against its computer bots. A visibility calculation may fall within
that prohibition; do not claim human-game use is approved. Human-game support
requires clarification from Chess.com before enabling it as a supported mode.

This recommendation narrows the supported context, not the underlying standard
chess rules. It does not assume unrated human games are exempt.

## Visual behavior

- Disabled by default; enabled explicitly in the extension popup.
- Unseen squares receive a uniform dark neutral tint. Start with 55% opacity,
  adjustable between 20% and 80%; confirm readability on actual board themes.
- Visible squares and all of the chosen side's pieces stay clear.
- Selecting an own piece through the board's existing controls adds a subtle
  outline to that piece's visibility squares while retaining the overall mask.
  This distinguishes an individual piece's range from the union.
- Keep the boundary aligned to the square grid; no blur or drifting smoke.
- Fog disappears from newly visible squares and returns when visibility is lost.
  No persistent explored-area memory in the first release.
- Board coordinates, pieces, selected-square feedback, and move confirmations
  remain usable. The overlay does not intercept clicks, drags, or keyboard input.
- Optional short opacity transitions respect reduced-motion settings. Never
  animate speculative intermediate positions during a drag or move animation.
- Popup controls: enable switch, fog opacity, and perspective Auto/White/Black.
  Changing perspective is independent of flipping the board. If Auto cannot
  determine the player reliably, ask for a side instead of guessing.
- Store only display preferences in a separate local-storage key. Do not store
  positions or game history. Leave existing shortcut storage unchanged.

## Visibility semantics

The visibility mask is the union of the chosen side's occupied squares and its
movement destinations under Fog-of-War-style movement rules. It is computed for
that side regardless of whose turn it is. It is not a map of legal responses to
check and does not filter pinned pieces or king moves based on enemy attacks.

| Piece | Squares revealed |
| --- | --- |
| Rook, bishop, queen | Empty squares along movement rays, stopping at the first occupied square. The first enemy square is visible because it can be captured; friendly occupied squares are already visible through the own-piece rule. No visibility beyond a blocker. |
| Knight | In-board jump destinations not occupied by friendly pieces; blockers do not affect jumps. |
| King | Adjacent destinations not occupied by friendly pieces, without filtering enemy attacks. |
| Pawn | Empty forward destination; both forward destinations for an unobstructed initial double step. Diagonals become visible for available enemy captures, not merely because the pawn attacks an empty square. |
| En passant | Reveal the capture destination and capturable enemy pawn only while the right is active. This requires verified side-to-move and en-passant state. |
| Castling | Reveal the king's castling destination when castling rights and an unobstructed path are verified. Follow Fog of War's absence of attack/check restrictions for visibility only. |

The visibility mask must not alter the move rules of the standard game. In
particular, a visible king destination is not a recommendation or confirmation
that the standard game permits moving there.

## Repository and browser evidence

The current extension is plain JavaScript, Manifest V3, with no package manager
or runtime dependencies. It already has shared settings validation, a popup,
Chrome storage, and a content script. Use the existing stack and Node's built-in
test runner.

Read-only inspection of the public analysis page on 2026-10-03 found:

- A `wc-chess-board` element with a square board rectangle.
- Piece elements containing classes such as `piece wp square-52` and
  `piece bk square-58`, exposing piece type, color, and board coordinates.
- No authoritative FEN or special-move state was established by that inspection.

This confirms a candidate position-reading approach for the analysis page only.
It does not prove the same selectors, perspective markers, or game-state sources
work during a bot or human game.

### Verified adapter evidence, 2026-10-08

Chrome for Testing 154 loaded the unpacked extension in the existing testing
profile. Disposable analysis positions were used; existing user games were not
used as move fixtures. A temporary read-only MAIN-world probe established:

- `wc-chess-board#board-analysis-board` and `#board-play-computer` expose
  `board.game.getFEN()` continuously, including all six FEN fields.
- `getMode().name`, `getVariant()`, and `getResult()` identify supported standard
  chess contexts. Completed-game analysis uses `/analysis/game/{type}/{id}/analysis`
  (with `computer`, `live`, or `daily`); a finished result is required.
- `getPlayingAs()` returns 1/2 for White/Black in bot play; standalone analysis
  returns no player side and requires explicit White/Black perspective.
- `getOptions().flipped` tracks orientation independently of perspective.
- `.highlight.growing-circle.square-XY` identifies the selected square; ordinary
  last-move highlights do not count as selection.
- `isDragging()` and `isAnimating()` must both return false before rendering.
  Missing or changing APIs remove the mask instead of approximating state.
- Loading `r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1` in a disposable analysis
  board preserved rights and en passant outside the editor. Moving e5-d6 produced
  `r3k2r/8/3P4/8/8/8/8/R3K2R b KQkq - 0 1`, confirming capture removal,
  turn change, and expiration.

The production MAIN-world bridge only reads this whitelist and passes a bounded
JSON snapshot to the isolated controller. It never executes moves, reads engines,
or persists positions. The host API is undocumented and may change; unsupported
contexts and incomplete snapshots remain unavailable. The development probe is
disabled and is not included in the repository.

## Implementation sequence

1. **Validate the board adapter first.** Inspect a standard bot board and a
   completed-game analysis board without playing or changing an existing user
   game. Verify piece coordinates, orientation, player side, selection,
   committed positions, board replacement, and navigation. Establish an
   authoritative source of castling rights, en-passant target, and side to move,
   such as exposed FEN or a
   complete accessible move history. Do not infer rights from king/rook placement.
   Verify the allowed-use context before attaching the overlay.
2. **Implement a pure visibility module.** Take a validated position and side;
   return a 64-square mask. Use existing JavaScript and explicit piece movement
   rules. No engine, recommendations, network requests, or new dependency.
3. **Implement the overlay separately from hotkeys.** Add a dedicated controller
   and stylesheet, keeping content.js focused on confirmations. Use a 64-cell
   grid aligned to the actual board rectangle, `pointer-events: none`, and
   `aria-hidden="true"`. Handle z-index and orientation using verified board
   behavior rather than assumed host styles.
4. **Observe position and layout changes.** Use scoped MutationObserver and
   ResizeObserver instances; batch updates through requestAnimationFrame.
   Recompute from consistent committed snapshots after moves, captures,
   promotion, castling, en passant, and history navigation. Never calculate from
   a mixed snapshot while pieces are being animated. Handle board replacement
   and SPA navigation, clean up observers, and avoid observing the overlay's own
   changes in a loop. If position or side cannot be trusted, remove the mask and
   show an unavailable state rather than leaving incorrect fog visible.
5. **Add popup settings.** Extend the existing popup with a small Fog of War
   section. Validate and synchronize local display preferences across open tabs;
   prevent initialization/write races and observe incoming settings changes.
   Do not couple fog preferences to the existing keybindings pair.
6. **Validate and document.** Run focused regression tests and syntax checks,
   then verify the unpacked extension on real supported boards. Document
   visibility semantics, allowed-use contexts, storage behavior, and limitations
   in both README versions. Publish through a separate implementation PR.

The adapter investigation is a gate: if full state cannot be established, report
the limitation before implementation rather than silently approximating the
confirmed Fog of War rules. No extra host permissions are expected; verify the
exact bot/analysis URL match patterns before adjusting manifest coverage.

## Acceptance criteria

- Correct masks for both colors, all piece types, blockers, board edges, pawn
  movement/captures, promotion, castling rights, and en passant expiration.
- Tests distinguish Fog visibility from attack maps and standard legal moves,
  including pinned pieces and king destinations attacked by the opponent.
- The same logical position produces the same mask when the board is flipped;
  rendered squares rotate correctly.
- Overlay stays aligned after resize, zoom, and supported layout changes.
- No duplicate overlays, stale masks, update loops, or growing observers after
  navigation, board replacement, or repeated enable/disable cycles.
- Piece drag, click-to-move, arrows, board coordinates, and confirmation hotkeys
  still work with fog enabled.
- Loading and saving settings cannot corrupt other preferences; invalid settings
  fall back predictably. Unknown game context or position disables the overlay.
- Both light and dark board themes remain readable at the opacity bounds.
- Existing hotkey tests remain green. Browser integration must be reported
  separately from tests that use mocked DOM and storage.

## Outside the first release

Attack/defense heatmaps, threat warnings, best moves, position evaluation,
opponent-vision comparison, explored-square memory, fully opaque hidden pieces,
and support for other chess variants.

## Sources

- [Chess.com Fog of War rules](https://support.chess.com/en/articles/8708650-what-is-fog-of-war-chess)
- [Chess.com Fog of War overview](https://www.chess.com/terms/fog-of-war-chess)
- [Chess.com Fair Play Policy](https://www.chess.com/legal/fair-play)
