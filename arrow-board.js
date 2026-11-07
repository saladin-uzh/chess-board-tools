(() => {
  "use strict";
  function read(board) {
    const svg = board.querySelector(":scope > svg.arrows");
    if (!svg) return [];
    const polygons = [...svg.querySelectorAll("polygon")];
    const shapes = polygons.length ? polygons : [...svg.querySelectorAll("line")];
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    return shapes.flatMap(shape => {
      const polygon = shape.localName === "polygon";
      const point = polygon ? shape.points?.getItem(0) : { x: Number(shape.getAttribute("x1")), y: Number(shape.getAttribute("y1")) };
      const matrix = shape.getScreenCTM?.();
      const fill = getComputedStyle(shape).fill;
      const color = polygon ? fill : getComputedStyle(shape).stroke;
      if (!point || !matrix || !color || color === "none" || color === "transparent") return [];
      const x = matrix.a * point.x + matrix.c * point.y + matrix.e - rect.left;
      const y = matrix.b * point.x + matrix.d * point.y + matrix.f - rect.top;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > rect.width || y > rect.height) return [];
      return [{ x, y, color }];
    });
  }
  function number(arrows, width, height) {
    const counts = new Map();
    const occupied = [];
    const radius = Math.max(9, Math.min(width, height) / 38);
    return arrows.map(arrow => {
      const ordinal = (counts.get(arrow.color) || 0) + 1;
      counts.set(arrow.color, ordinal);
      const offsets = [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
      const candidates = offsets.map(([dx, dy]) => ({
        x: Math.max(radius, Math.min(width - radius, arrow.x + dx * radius * 1.6)),
        y: Math.max(radius, Math.min(height - radius, arrow.y + dy * radius * 1.6)),
      }));
      const place = candidates.find(candidate => occupied.every(other => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= radius * 2.2)) || candidates[0];
      occupied.push(place);
      return { ...place, color: arrow.color, ordinal, radius };
    });
  }
  globalThis.ChessArrowBoard = Object.freeze({ read, number });
})();
