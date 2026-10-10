(() => {
  "use strict";

  // Logical indexes run from a1=0 through h8=63, independently of board rotation.
  const colorOf = (piece) => piece === piece.toUpperCase() ? "white" : "black";
  const squareIndex = (square) => /^[a-h][1-8]$/.test(square)
    ? square.charCodeAt(0) - 97 + (Number(square[1]) - 1) * 8 : null;

  function parseFEN(fen) {
    if (typeof fen !== "string" || fen.length > 160) return null;
    const fields = fen.trim().split(/\s+/);
    if (fields.length !== 6) return null;
    const [placement, turn, castling, ep, halfmove, fullmove] = fields;
    if (!/^[wb]$/.test(turn) || !/^(?:-|[KQkq]+)$/.test(castling) ||
        new Set(castling).size !== castling.length ||
        !/^\d+$/.test(halfmove) || !/^[1-9]\d*$/.test(fullmove) ||
        !Number.isSafeInteger(Number(halfmove)) || !Number.isSafeInteger(Number(fullmove))) return null;
    const ranks = placement.split("/");
    if (ranks.length !== 8) return null;
    const squares = Array(64).fill(null);
    for (let row = 0; row < 8; row++) {
      let file = 0;
      for (const token of ranks[row]) {
        if (/^[1-8]$/.test(token)) file += Number(token);
        else if (/^[prnbqkPRNBQK]$/.test(token) && file < 8) {
          squares[(7 - row) * 8 + file++] = token;
        } else return null;
      }
      if (file !== 8) return null;
    }
    if (squares.filter(piece => piece === "K").length !== 1 ||
        squares.filter(piece => piece === "k").length !== 1) return null;
    const sideToMove = turn === "w" ? "white" : "black";
    const enPassant = ep === "-" ? null : squareIndex(ep);
    if (ep !== "-" && (enPassant === null || squares[enPassant] ||
        Math.floor(enPassant / 8) !== (turn === "w" ? 5 : 2) ||
        squares[enPassant + (turn === "w" ? -8 : 8)] !== (turn === "w" ? "p" : "P"))) return null;
    return { squares, sideToMove, castling: castling === "-" ? "" : castling, enPassant };
  }

  function visibility(position, side, selected = null) {
    if (!position || !["white", "black"].includes(side)) return null;
    const { squares, castling } = position;
    const union = Array(64).fill(false);
    let selectedMask = null;
    for (let from = 0; from < 64; from++) {
      const piece = squares[from];
      if (!piece || colorOf(piece) !== side) continue;
      const mask = Array(64).fill(false);
      mask[from] = true;
      const x = from % 8;
      const y = Math.floor(from / 8);
      const reveal = (dx, dy) => {
        const file = x + dx;
        const rank = y + dy;
        if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
        const target = rank * 8 + file;
        if (!squares[target] || colorOf(squares[target]) !== side) mask[target] = true;
        return target;
      };
      const type = piece.toLowerCase();
      if (["b", "r", "q"].includes(type)) {
        const rays = [];
        if (type !== "b") rays.push([1, 0], [-1, 0], [0, 1], [0, -1]);
        if (type !== "r") rays.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        for (const [dx, dy] of rays) {
          for (let step = 1; step < 8; step++) {
            const target = reveal(dx * step, dy * step);
            if (target === null || squares[target]) break;
          }
        }
      } else if (type === "n") {
        for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) reveal(dx, dy);
      } else if (type === "k") {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) reveal(dx, dy);
        const base = side === "white" ? 0 : 56;
        if (from === base + 4) {
          const rook = side === "white" ? "R" : "r";
          for (const [right, rookFile, path, destination] of [
            [side === "white" ? "K" : "k", 7, [5, 6], 6],
            [side === "white" ? "Q" : "q", 0, [1, 2, 3], 2],
          ]) {
            if (castling.includes(right) && squares[base + rookFile] === rook && path.every(file => !squares[base + file])) mask[base + destination] = true;
          }
        }
      } else if (type === "p") {
        const direction = side === "white" ? 1 : -1;
        // Pawn sight follows capture diagonals, regardless of occupancy or turn.
        for (const dx of [-1, 1]) {
          if (x + dx < 0 || x + dx > 7 || y + direction < 0 || y + direction > 7) continue;
          mask[(y + direction) * 8 + x + dx] = true;
        }
      }
      for (let i = 0; i < 64; i++) union[i] ||= mask[i];
      if (from === selected) selectedMask = mask;
    }
    return { union, selected: selectedMask };
  }

  globalThis.ChessFogVisibility = Object.freeze({ parseFEN, visibility, squareIndex, colorOf });
})();
