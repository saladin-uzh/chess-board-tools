# Fog of War implementation preparation

## Starting point

- Branch: `semi-transparent-fog-of-war`.
- Base: `5e529a2f524808e020b420fdee686a89a1a18001`, merged PR #1.
- Scope: [approved feature plan](fog-of-war-plan.md).
- Implementation adds isolated fog modules and a read-only MAIN-world bridge.
  The existing hotkey controller, permissions, and dependencies are unchanged.
- Node.js built-in tests are the existing validation path. There is no package
  manifest, dependency installation, build step, or CI workflow in this checkout.

Baseline validation performed on the base commit:

```sh
node --test tests/extension.test.cjs
node --check settings.js
node --check content.js
node --check popup.js
```

Result: 8 tests passed; all three scripts passed syntax checks.

## Adapter verification checklist

Complete this investigation before wiring a visibility overlay into the page.
Inspect a disposable bot/analysis context; never use an existing user game as a
test fixture or make a move in it.

- [x] Confirm the actual supported bot and completed-analysis URLs. The current
  manifest matches `/play/*`, `/game/*`, and `/analysis/game/*`; it does not
  inject into the public `/analysis` page previously inspected; the new fog
  entries explicitly add that page and verified analysis routes.
- [x] Verify a complete, consistent piece placement snapshot and algebraic
  coordinate mapping on both supported board types.
- [x] Find reliable markers for selected piece and board orientation. Treat
  perspective and orientation separately.
- [x] Establish player color and an explicit manual perspective fallback.
- [x] Establish reliable context detection: bot game, completed analysis, human
  game, or unknown. Unknown and unsupported contexts must not enable fog.
- [x] Establish authoritative side-to-move, castling rights, and en-passant
  target/expiration. Piece placement alone is insufficient.
- [ ] Check state during dragging, confirmed moves, animations, history
  navigation, promotion, and board replacement. Document when a snapshot is
  safe to consume.
- [x] Record verified selectors, data sources, and limitations in a scoped
  adapter-evidence section of the feature plan. Avoid account identifiers and
  private game histories in committed evidence or fixtures.

Do not silently downgrade special-move visibility if full state is unavailable.
Report the concrete missing source and review the scope before proceeding.

## Implemented module boundaries

Modules follow the existing IIFE/global namespace conventions.

| File | Responsibility |
| --- | --- |
| `fog-bridge.js` | Read only the verified host API in MAIN world; reject unknown modes and unfinished imported games. |
| `fog-board.js` | Read and validate supported context, position, perspective, orientation, selection, and board geometry. No visibility calculation or move execution. |
| `fog-visibility.js` | Pure movement-based visibility calculation from validated state; return the union mask and optional selected-piece mask. No DOM, storage, or network access. |
| `fog-content.js` | Overlay lifecycle, rendering, scoped observers, batched updates, settings changes, and cleanup. |
| `fog.css` | Board-aligned tint and selected-piece visibility outline; pointer-transparent rendering and reduced-motion behavior. |
| `settings.js` | Add a separate validated fog preference schema/key; preserve existing keybinding normalization and storage semantics. |
| `popup.html`, `fog-popup.js`, `popup.css` | Small Fog of War section with enable switch, opacity, and perspective; race-safe loading/saving and incoming preference changes. |
| `manifest.json` | Register verified supported URL patterns and script/style load order once integration is ready. |

Retain plain JavaScript and existing IIFE/global namespace conventions. Use
explicit JSDoc contracts where useful; do not introduce TypeScript, a bundler,
an engine, or new dependencies for preparation or by default during execution.

## Data contracts

- **Position:** 64 logical squares with validated piece type/color, side to
  move, explicit castling rights, and an en-passant target or explicit absence.
  Unknown state must remain distinguishable from known absence.
- **Board view:** board element, supported context, orientation, player/manual
  perspective, and selected own-piece square or null. Flipping the board must
  not change the selected side's visibility mask.
- **Visibility:** a 64-square union mask plus an optional 64-square selected-piece
  mask, both using one documented square indexing convention.
- **Preferences:** separate local-storage object with enabled=false by default,
  opacity=0.55 bounded to 0.20–0.80, and perspective=auto/white/black. The stored
  format should represent opacity consistently and reject malformed values.

Do not persist positions, move history, or account/game identifiers. Keep fog
preferences separate from the existing `keybindings` sync-storage object.

## Ordered implementation checklist

- [x] Finish and document the adapter investigation above (see plan evidence).
- [x] Implement and test the pure visibility calculator for both colors.
- [x] Implement the validated adapter and test incomplete/transient snapshots.
- [x] Implement overlay alignment/lifecycle with mocked DOM regression tests
  and real disposable analysis-board validation.
- [x] Add local preferences and popup controls, with loading/save concurrency
  tests and incoming-change handling.
- [x] Integrate verified manifest matches and dependency-ordered script loading.
- [x] Verify disposable bot and completed-analysis contexts in Chrome for Testing.
- [x] Update both README versions for behavior, allowed contexts, privacy,
  installation/reload steps, and test commands.
- [ ] Review the scoped diff and open a separate implementation PR when asked.

## Test matrix and completion evidence

Create regression tests as each behavior is implemented; do not add empty,
skipped, or permanently failing scaffolding tests.

| Area | Required cases |
| --- | --- |
| Visibility | Own occupied squares; all piece types; both pawn directions; board edges; friendly/enemy blockers; empty pawn diagonals; initial double steps; pinned pieces; attacked king destinations. |
| Special moves | Castling rights absent/present; blocked path; en passant destination and captured pawn; expiration; promotion. |
| Adapter | Unsupported/unknown context; incomplete state; transient animation/drag state; perspective versus orientation; selected-piece changes; board replacement. |
| Overlay | Flip, resize, zoom, enable/disable cycles, SPA navigation, no observer loops or duplicates, pointer-transparent behavior, reduced motion. |
| Preferences | Defaults, invalid values, initial read failure, delayed load/save, incoming changes, isolation from keybindings. |
| Regression | Existing confirmation/cancellation hotkeys, editable targets, modifiers, storage updates, popup save behavior. |

Run all existing and new Node tests, syntax checks for changed scripts, and
`git diff --check`. Browser checks must additionally confirm drag/click moves,
arrows, selected-piece outlines, confirmation controls, hotkeys, and readability
on light/dark boards at both opacity bounds. Report mocked tests separately from
real browser evidence; a Node pass does not prove live board compatibility.

## Existing follow-ups outside this feature

- [Issue #2](https://github.com/saladin-uzh/chess-confirm-move-hotkeys/issues/2):
  clarify existing shortcut-sync privacy documentation.
- [Issue #3](https://github.com/saladin-uzh/chess-confirm-move-hotkeys/issues/3):
  reconcile existing popup keybindings with remote sync updates.

Do not fold these fixes into preparation or expand feature scope implicitly.
For later PR reviews, the user requested that additional minor findings be
tracked as separate GitHub issues rather than repeatedly expanding the PR.
Critical correctness/security findings still require assessment before merging.

## Implementation validation, 2026-10-08

`node --test tests/*.test.cjs`: 25 tests passed (8 existing hotkey tests and 17
fog tests). DOM, bridge, lifecycle, and storage tests use mocks; they do not prove
live compatibility. Pure tests cover both colors, every piece, blockers, pins,
king attacks, castling rights/path, en passant/expiration, and promotion.

Real unpacked-extension checks in Chrome for Testing:

- Standalone analysis: explicit perspective required for Auto; White and Black
  selected successfully, with preference persistence and active status.
- Union mask and selected-piece outline; e2-e4 click move and e7-e5 drag move.
- Board flip, drag resize, and browser zoom from 75% to 67% preserved alignment.
- Light and Dark Blue themes remained readable at opacity 20% and 80%.
- Right-click square annotation passed through fog; enable/disable/re-enable
  updated the mask and popup status.
- One new disposable bot fixture verified Auto color and e2-e4; it was ended.
  Further interactive testing uses analysis boards per user preference.

- Completed analysis: verified `/analysis/game/computer/{id}/analysis` after
  extension/page reload; Auto requests a side, White activates the overlay,
  and navigating to the last move updates the mask.
- Custom analysis: selected king outlines c1/g1 with rights; O-O relocates both
  pieces and removes expired en-passant visibility. Returning in history restores
  d6/d5 visibility; e5-d6 removes the captured pawn and recomputes fog.
- Promotion: a7-a8 opens the host picker; choosing Queen completes a8=Q+ and
  reveals the queen's rays immediately. Picker lower options remain tinted at
  80%; tracked in [issue #4](https://github.com/saladin-uzh/chess-confirm-move-hotkeys/issues/4) as a minor visual follow-up.

The user drew seven arrows on the analysis board. Its direct `svg.arrows` layer
had computed `z-index: auto`, below fog at 5. The new scoped CSS rule was applied
through DevTools on that board: arrows computed to 6 and remained clearly visible
across fogged cells. The rule applies only while a direct fog overlay exists.
Native CUA supports left drag and right click but not right drag.
Live move-confirmation hotkeys are not exercised
on standalone analysis because it has no move-confirmation prompt; all eight
existing mocked hotkey regression tests pass and `content.js` is unchanged.
No claim of live confirmation-prompt validation is made.
