(() => {
  "use strict";

  // MAIN-world adapter: only reads the board API. No extension privileges or move calls.
  document.addEventListener("chess-fog-request", (event) => {
    const board = event.target;
    if (!(board instanceof HTMLElement) || board.tagName !== "WC-CHESS-BOARD") return;
    let snapshot = null;
    try {
      const game = board.game;
      const path = location.pathname;
      const mode = game?.getMode()?.name;
      const bot = path === "/play/computer" && board.id === "board-play-computer" && mode === "playing";
      const analysis = board.id === "board-analysis-board" && mode === "analysis" &&
        (path === "/analysis" || /^\/analysis\/game\/(?:live|daily|computer)\/\d+(?:\/analysis)?\/?$/.test(path) && ["1-0", "0-1", "1/2-1/2"].includes(game.getResult()));
      const review = board.id === "board-single" && mode === "observing" &&
        /^\/game\/(?:live|daily)\/\d+\/?$/.test(path) && ["1-0", "0-1", "1/2-1/2"].includes(game.getResult());
      if ((bot || analysis || review) && game.getVariant() === "chess") {
        const selected = board.querySelector(".highlight.growing-circle");
        const square = selected?.className.match(/\bsquare-([1-8])([1-8])\b/);
        const playingAs = game.getPlayingAs();
        snapshot = {
          context: review ? "review" : bot ? "bot" : "analysis",
          result: game.getResult(),
          fen: game.getFEN(),
          flipped: game.getOptions().flipped,
          side: playingAs === 1 ? "white" : playingAs === 2 ? "black" : null,
          selected: square ? (Number(square[2]) - 1) * 8 + Number(square[1]) - 1 : null,
          stable: game.isDragging() === false && game.isAnimating() === false,
        };
      }
    } catch { /* A missing or changing host API makes this snapshot unavailable. */ }
    board.dispatchEvent(new CustomEvent("chess-fog-snapshot", { detail: JSON.stringify(snapshot) }));
  });
})();
