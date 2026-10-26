# Changelog

## 1.2.0 — 2026-10-26

Changes since 1.1.3:

- Enable coordinate input across Chess.com board routes, including puzzles,
  variants and observed games; select the visible active board independently
  from the primary timer board.
- Cancel the file preview by pressing its letter again without deselecting the
  host piece. Cancel all queued premoves without a Cancel button, including
  during the opponent's turn and with keyboard board control disabled.
- Recognize legacy and suffixed Chess.com primary button classes for move
  confirmation, cancellation and pending-confirmation timing.
- Rename the visual helper to Piece Vision Overlay. Support ongoing Daily
  analysis, named bot routes, Game Review routes and Rated/Daily/Learning
  puzzles, including navigation and review states. Keep Rush/Battle excluded.
- Render pieces above the mask and distinguish squares unseen by both sides
  with darker fog and sparse diagonal stripes.
- Add Auto, Increment and fixed 2/5/10/15/20/30-second tick intervals plus
  0–100% volume. Auto is silent without a known initial time. Frequency changes
  restart timing; volume changes preserve it.
- Fit popup settings and the privacy footer within browser popup height.
- Refresh English/Ukrainian instructions, support and privacy pages; consolidate
  architecture and validation documentation. Remove superseded release plans,
  session reports and internal store-preparation material from the current tree.

The only extension permission remains `storage`; helper injection now matches
all `https://www.chess.com/*` routes. Runtime overlay restrictions still apply.
No dependencies, telemetry or game-history storage were added. Existing
preferences are retained; missing tick options default to Auto and 50% volume.

## 1.1.3

- Restore coordinate entry after completed direct-game pages switch to analysis.
- Support completed observing reviews on direct, live and Daily game URLs.
- Preserve Daily analysis and keep turn ticks disabled in analysis/review.

## 1.1.2

- Make pawns reveal capture diagonals rather than forward movement squares.
- Restore coordinate input on direct human-game URLs and native Daily analysis.
- Add light/dark popup appearance and consistent Chess Board Tools naming.
- Add static support/privacy pages and deterministic runtime packaging.

## 1.1.1

- Reconcile incoming Chrome Sync shortcut changes with delayed popup reads/saves.
- Keep the complete promotion picker above fog.
- Support completed standard-game reviews and coordinate selection highlights.

## 1.1.0

- Add optional keyboard board controls and own-turn sound cues.

Earlier releases and original notes are available in
[GitHub releases](https://github.com/saladin-uzh/chess-board-tools/releases).
