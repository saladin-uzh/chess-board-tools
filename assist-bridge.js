(() => {
  "use strict";
  // Read-only MAIN-world bridge, independent of fog's restricted contexts.
  const sessions = new WeakMap();
  let sequence = 0;
  function respond(event) {
    const board = event.target;
    if (!(board instanceof HTMLElement) || board.tagName !== "WC-CHESS-BOARD") return;
    let snapshot = null;
    try {
      const game = board.game;
      if (event.type === "chess-coordinate-request") {
        if (!sessions.has(game)) sessions.set(game, ++sequence);
        snapshot = {
          session: sessions.get(game),
          fen: game.getFEN(),
          flipped: game.getOptions().flipped,
          stable: game.isDragging() === false && game.isAnimating() === false,
        };
        return;
      }
      const mode = game.getMode().name;
      const path = location.pathname;
      const bot = path === "/play/computer" && board.id === "board-play-computer" && mode === "playing";
      const analysis = mode === "analysis" && (
        board.id === "board-analysis-board" &&
          (path === "/analysis" || /^\/analysis\/game\/(?:live|daily|computer)\/\d+(?:\/analysis)?\/?$/.test(path)) ||
        board.id === "board-single" && (
          /^\/game\/daily\/\d+\/?$/.test(path) ||
          /^\/game\/(?:live\/)?\d+\/?$/.test(path) &&
            ["1-0", "0-1", "1/2-1/2"].includes(game.getResult())));
      const review = board.id === "board-single" && mode === "observing" &&
        /^\/game\/(?:(?:live|daily)\/)?\d+\/?$/.test(path) && ["1-0", "0-1", "1/2-1/2"].includes(game.getResult());
      const human = board.id === "board-single" && mode === "playing" &&
        (/^\/play\/(?:online|daily)(?:\/|$)/.test(path) || /^\/game\/(?:(?:live|daily)\/)?\d+\/?$/.test(path));
      if ((bot || analysis || review || human) && game.getVariant() === "chess") {
        if (!sessions.has(game)) sessions.set(game, ++sequence);
        const side = game.getPlayingAs();
        let timeControl = null, premoveCount = 0;
        try { timeControl = game.timeControl?.get?.(); } catch { /* Clock metadata is optional. */ }
        try { premoveCount = game.premoves?.getQueue?.().length || 0; } catch { /* Unknown queues cannot be cancelled. */ }
        snapshot = {
          context: review ? "review" : analysis ? "analysis" : bot ? "bot" : "human",
          session: sessions.get(game),
          fen: game.getFEN(),
          result: game.getResult(),
          side: side === 1 ? "white" : side === 2 ? "black" : null,
          flipped: game.getOptions().flipped,
          active: mode === "playing" && game.getResult() === "*" && game.isAtEndOfLine() === true,
          stable: game.isDragging() === false && game.isAnimating() === false,
          initialSeconds: Number.isFinite(timeControl?.baseTime) && timeControl.baseTime > 0 ? timeControl.baseTime / 1000 : null,
          incrementSeconds: Number.isFinite(timeControl?.increment) && timeControl.increment >= 0 ? timeControl.increment / 1000 : null,
          premoveCount,
        };
      }
    } catch { /* Unknown host APIs disable helpers rather than guessing. */ }
    finally {
      const type = event.type === "chess-coordinate-request" ? "chess-coordinate-snapshot" : "chess-assist-snapshot";
      board.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(snapshot) }));
    }
  }
  document.addEventListener("chess-assist-request", respond);
  document.addEventListener("chess-coordinate-request", respond);
})();
