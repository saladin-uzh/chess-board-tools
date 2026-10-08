(() => {
  "use strict";
  const { parseFEN } = globalThis.ChessFogVisibility;

  function validateSnapshot(raw, board, path, perspective) {
    if (typeof raw !== "string" || raw.length > 700 || !board?.isConnected) return null;
    let input;
    try { input = JSON.parse(raw); } catch { return null; }
    if (!input || typeof input !== "object" || input.stable !== true || typeof input.flipped !== "boolean") return null;
    const bot = input.context === "bot" && path === "/play/computer" && board.id === "board-play-computer";
    const analysis = input.context === "analysis" && board.id === "board-analysis-board" &&
      (path === "/analysis" || /^\/analysis\/game\/(?:live|daily|computer)\/\d+(?:\/analysis)?\/?$/.test(path));
    if (!bot && !analysis) return null;
    const position = parseFEN(input.fen);
    if (!position || !(input.selected === null || Number.isInteger(input.selected) && input.selected >= 0 && input.selected < 64)) return null;
    const side = perspective === "auto" ? input.side : perspective;
    if (!["white", "black"].includes(side)) return { unavailable: "Choose White or Black in the popup." };
    return { position, side, selected: input.selected, flipped: input.flipped };
  }

  function read(board, perspective) {
    let raw = null;
    const receive = event => { if (event.target === board) raw = event.detail; };
    board.addEventListener("chess-fog-snapshot", receive);
    try { board.dispatchEvent(new Event("chess-fog-request", { bubbles: true })); }
    finally { board.removeEventListener("chess-fog-snapshot", receive); }
    return validateSnapshot(raw, board, location.pathname, perspective);
  }

  globalThis.ChessFogBoard = Object.freeze({ read, validateSnapshot });
})();
