(() => {
  "use strict";
  // Read-only MAIN-world bridge, independent of fog's restricted contexts.
  const sessions = new WeakMap();
  let sequence = 0;
  document.addEventListener("chess-assist-request", event => {
    const board = event.target;
    if (!(board instanceof HTMLElement) || board.tagName !== "WC-CHESS-BOARD") return;
    let snapshot = null;
    try {
      const game = board.game;
      const mode = game.getMode().name;
      const path = location.pathname;
      const bot = path === "/play/computer" && board.id === "board-play-computer" && mode === "playing";
      const analysis = board.id === "board-analysis-board" && mode === "analysis" &&
        (path === "/analysis" || /^\/analysis\/game\/(?:live|daily|computer)\/\d+(?:\/analysis)?\/?$/.test(path));
      const human = board.id === "board-single" && mode === "playing" &&
        (/^\/play\/(?:online|daily)(?:\/|$)/.test(path) || /^\/game\/(?:live|daily)\/\d+\/?$/.test(path));
      if ((bot || analysis || human) && game.getVariant() === "chess") {
        if (!sessions.has(game)) sessions.set(game, ++sequence);
        const side = game.getPlayingAs();
        snapshot = {
          context: analysis ? "analysis" : bot ? "bot" : "human",
          session: sessions.get(game),
          fen: game.getFEN(),
          side: side === 1 ? "white" : side === 2 ? "black" : null,
          flipped: game.getOptions().flipped,
          active: mode === "playing" && game.getResult() === "*" && game.isAtEndOfLine() === true,
          stable: game.isDragging() === false && game.isAnimating() === false,
        };
      }
    } catch { /* Unknown host APIs disable helpers rather than guessing. */ }
    board.dispatchEvent(new CustomEvent("chess-assist-snapshot", { detail: JSON.stringify(snapshot) }));
  });
})();
