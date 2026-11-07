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
      if (!polygon) {
        const matrix = shape.getScreenCTM?.(), color = getComputedStyle(shape).stroke;
        const raw = ["x1", "y1", "x2", "y2"].map(name => shape.getAttribute(name));
        if (!matrix || !color || color === "none" || raw.some(value => value === null || !Number.isFinite(Number(value)))) return [];
        const [x1, y1, x2, y2] = raw.map(Number);
        const x = matrix.a * x1 + matrix.c * y1 + matrix.e - rect.left;
        const y = matrix.b * x1 + matrix.d * y1 + matrix.f - rect.top;
        const vx = matrix.a * (x2 - x1) + matrix.c * (y2 - y1);
        const vy = matrix.b * (x2 - x1) + matrix.d * (y2 - y1);
        const length = Math.hypot(vx, vy);
        if (!length || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > rect.width || y > rect.height) return [];
        return [{ x, y, dx: vx / length, dy: vy / length, color }];
      }
      const point = polygon && shape.points?.numberOfItems >= 2 ? shape.points.getItem(0) : null;
      const matrix = shape.getScreenCTM?.();
      const fill = getComputedStyle(shape).fill;
      const color = polygon ? fill : getComputedStyle(shape).stroke;
      const notation = shape.getAttribute("data-arrow")?.match(/^[a-h][1-8][a-h][1-8]$/);
      const rotation = shape.transform?.baseVal;
      const rotate = rotation && Array.from({ length: rotation.numberOfItems }, (_, i) => rotation.getItem(i))
        .find(item => item.type === 4);
      if (!point || !matrix || !notation || !rotate || !color || color === "none" || color === "transparent") return [];
      const transform = shape.getAttribute("transform")?.match(/rotate\(\s*[-+\d.eE]+[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)\s*\)/);
      if (!transform) return [];
      const cx = Number(transform[1]), cy = Number(transform[2]);
      const x = matrix.a * cx + matrix.c * cy + matrix.e - rect.left;
      const y = matrix.b * cx + matrix.d * cy + matrix.f - rect.top;
      if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x > rect.width || y > rect.height) return [];
      const next = shape.points.getItem(1);
      const vx = matrix.a * (next.x - point.x) + matrix.c * (next.y - point.y);
      const vy = matrix.b * (next.x - point.x) + matrix.d * (next.y - point.y);
      const length = Math.hypot(vx, vy);
      if (!Number.isFinite(length) || !length) return [];
      return [{ x, y, dx: vx / length, dy: vy / length, color }];
    });
  }
  function number(arrows, width, height) {
    const counts = new Map();
    const occupied = [];
    const radius = 14;
    return arrows.map(arrow => {
      const ordinal = (counts.get(arrow.color) || 0) + 1;
      counts.set(arrow.color, ordinal);
      const dx = arrow.dx ?? 0, dy = arrow.dy ?? -1;
      const offsets = [[dx, dy], [-dy, dx], [dy, -dx], [-dx, -dy], [dx - dy, dy + dx], [dx + dy, dy - dx], [-dx - dy, -dy + dx], [-dx + dy, -dy - dx]];
      let place = null, best = null, bestDistance = -1;
      const step = radius * 1.6;
      const maxRing = 3;
      for (let ring = 1; ring <= maxRing && !place; ring++) {
        for (const [dx, dy] of offsets) {
          const candidate = {
            x: Math.max(radius, Math.min(width - radius, arrow.x + dx * step * ring)),
            y: Math.max(radius, Math.min(height - radius, arrow.y + dy * step * ring)),
          };
          const distance = occupied.reduce((min, other) => Math.min(min, Math.hypot(candidate.x - other.x, candidate.y - other.y)), Infinity);
          if (distance > bestDistance) { best = candidate; bestDistance = distance; }
          if (distance >= radius * 2.2) { place = candidate; break; }
        }
      }
      place ||= best;
      occupied.push(place);
      return { ...place, anchorX: arrow.x, anchorY: arrow.y, color: arrow.color, ordinal, radius };
    });
  }
  globalThis.ChessArrowBoard = Object.freeze({ read, number });
})();
