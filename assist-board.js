(() => {
  "use strict";
  function validate(raw, board, path) {
    if (typeof raw !== "string" || raw.length > 700 || !board?.isConnected) return null;
    let input;
    try { input = JSON.parse(raw); } catch { return null; }
    if (!input || typeof input.stable !== "boolean" || typeof input.flipped !== "boolean" ||
        typeof input.active !== "boolean" || !Number.isSafeInteger(input.session) || input.session < 1 ||
        ![null, "white", "black"].includes(input.side)) return null;
    const bot = input.context === "bot" && path === "/play/computer" && board.id === "board-play-computer";
    const analysis = input.context === "analysis" && board.id === "board-analysis-board" &&
      (path === "/analysis" || /^\/analysis\/game\/(?:live|daily|computer)\/\d+(?:\/analysis)?\/?$/.test(path));
    const human = input.context === "human" && board.id === "board-single" &&
      (/^\/play\/(?:online|daily)(?:\/|$)/.test(path) || /^\/game\/(?:live|daily)\/\d+\/?$/.test(path));
    const review = input.context === "review" && input.active === false && board.id === "board-single" &&
      /^\/game\/(?:live|daily)\/\d+\/?$/.test(path) && ["1-0", "0-1", "1/2-1/2"].includes(input.result);
    if (!bot && !analysis && !review && !human) return null;
    if (typeof input.fen !== "string" || input.fen.length > 160) return null;
    const fields = input.fen.split(" ");
    if (fields.length !== 6 || !/^[wb]$/.test(fields[1]) || !/^(?:-|K?Q?k?q?)$/.test(fields[2]) ||
        !/^(?:-|[a-h][36])$/.test(fields[3]) || !/^\d+$/.test(fields[4]) || !/^[1-9]\d*$/.test(fields[5])) return null;
    const ranks = fields[0].split("/");
    if (ranks.length !== 8 || ranks.some(rank => !/^[prnbqkPRNBQK1-8]+$/.test(rank) ||
      [...rank].reduce((size, char) => size + (/[1-8]/.test(char) ? Number(char) : 1), 0) !== 8)) return null;
    return { ...input, turn: fields[1] === "w" ? "white" : "black" };
  }
  function read(board) {
    let raw = null;
    const receive = event => { if (event.target === board) raw = event.detail; };
    board.addEventListener("chess-assist-snapshot", receive);
    try { board.dispatchEvent(new Event("chess-assist-request", { bubbles: true })); }
    finally { board.removeEventListener("chess-assist-snapshot", receive); }
    return validate(raw, board, location.pathname);
  }
  function point(square, flipped, rect) {
    if (!/^[a-h][1-8]$/.test(square) || typeof flipped !== "boolean" || !rect?.width || !rect?.height ||
        Math.abs(rect.width - rect.height) > 1) return null;
    const file = square.charCodeAt(0) - 97, rank = Number(square[1]) - 1;
    return { x: rect.left + ((flipped ? 7 - file : file) + 0.5) * rect.width / 8,
      y: rect.top + ((flipped ? rank : 7 - rank) + 0.5) * rect.height / 8 };
  }
  function clickSquare(board, square, snapshot) {
    const target = point(square, snapshot.flipped, board.getBoundingClientRect());
    if (!target || !board.isConnected) return false;
    pointerClick(board, target);
    return true;
  }
  function pointerClick(element, target) {
    const options = { bubbles: true, composed: true, pointerId: 1, pointerType: "mouse", isPrimary: true,
      button: 0, buttons: 1, clientX: target.x, clientY: target.y };
    // Use the host pointer path, including its ordinary untrusted-event reporting.
    element.dispatchEvent(new PointerEvent("pointerdown", options));
    document.dispatchEvent(new PointerEvent("pointerup", { ...options, buttons: 0 }));
  }
  function clickPromotion(element) {
    const rect = element.getBoundingClientRect();
    if (!element.isConnected || !rect.width || !rect.height) return false;
    pointerClick(element, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    return true;
  }
  globalThis.ChessBoardAssist = Object.freeze({ read, validate, point, clickSquare, clickPromotion });
})();
