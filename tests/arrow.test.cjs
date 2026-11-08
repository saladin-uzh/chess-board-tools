const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const context = vm.createContext({ getComputedStyle: shape => shape.style });
for (const file of ["settings.js", "arrow-board.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
}

function polygon(notation, fill, points = [{ x: 54.875, y: 85.75 }, { x: 54.875, y: 101.75 }]) {
  const cx = notation === "e2e4" ? 56.25 : 81.25, cy = notation === "e2e4" ? 81.25 : 93.75;
  return { localName: "polygon", points: { numberOfItems: points.length, getItem: i => points[i] },
    transform: { baseVal: { numberOfItems: 1, getItem: () => ({ type: 4 }) } },
    getAttribute: name => name === "data-arrow" ? notation : name === "transform" ? `rotate(180 ${cx} ${cy})` : null,
    getScreenCTM: () => ({ a: -8, b: 0, c: 0, d: -8, e: 100 + 16 * cx, f: 200 + 16 * cy }), style: { fill } };
}

test("native arrow polygons are read in DOM order and mapped to board coordinates", () => {
  const knight = [{ x: 79.875, y: 98.25 }, { x: 79.875, y: 120.125 },
    { x: 89.25, y: 120.125 }, { x: 89.25, y: 122 }, { x: 93.75, y: 118.75 },
    { x: 89.25, y: 115.5 }, { x: 89.25, y: 117.375 }, { x: 82.625, y: 117.375 }, { x: 82.625, y: 98.25 }];
  const shapes = [polygon("e2e4", "rgb(255, 0, 0)"), polygon("g1f3", "rgb(0, 0, 255)", knight)];
  const svg = { querySelectorAll: () => shapes };
  const board = { classList: { contains: () => false }, querySelector: () => svg, getBoundingClientRect: () => ({ left: 100, top: 200, width: 800, height: 800 }) };
  assert.deepEqual(JSON.parse(JSON.stringify(context.ChessArrowBoard.read(board))), [
    { x: 450, y: 650, dx: 0, dy: -1, color: "rgb(255, 0, 0)" },
    { x: 650, y: 750, dx: 0, dy: -1, color: "rgb(0, 0, 255)" },
  ]);
  shapes.splice(0, 1);
  assert.equal(context.ChessArrowBoard.read(board).length, 1);
});

test("SVG rotation pivot identifies the source after a board flip", () => {
  const shape = polygon("e2e4", "orange");
  const board = { querySelector: () => ({ querySelectorAll: () => [shape] }),
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 800, height: 800 }) };
  shape.getAttribute = name => name === "data-arrow" ? "e2e4" : name === "transform" ? "rotate(0 43.75 18.75)" : null;
  shape.getScreenCTM = () => ({ a: 8, b: 0, c: 0, d: 8, e: 100, f: 200 });
  const [arrow] = context.ChessArrowBoard.read(board);
  assert.equal(arrow.x, 350);
  assert.equal(arrow.y, 150);
  assert.equal(arrow.dy, 1);
});

test("first label follows the initial segment and crowded labels stay near their anchor", () => {
  const arrows = Array.from({ length: 5 }, () => ({ x: 400, y: 400, dx: 1, dy: 0, color: "orange" }));
  const labels = context.ChessArrowBoard.number(arrows, 800, 800);
  assert.ok(labels[0].x > 400);
  assert.equal(labels[0].y, 400);
  for (const label of labels) {
    assert.equal(label.anchorX, 400);
    assert.equal(label.anchorY, 400);
    assert.ok(Math.hypot(label.x - 400, label.y - 400) <= label.radius * 1.6 * 3 * Math.SQRT2 + 1e-9);
  }
  assert.ok(labels.some(label => Math.hypot(label.x - 400, label.y - 400) > label.radius * 2));
});

test("numbers are independent by color, close gaps after removal, and avoid nearby labels", () => {
  const arrows = [
    { x: 100, y: 100, color: "red" }, { x: 100, y: 100, color: "blue" },
    { x: 105, y: 100, color: "red" },
  ];
  const labels = context.ChessArrowBoard.number(arrows, 800, 800);
  assert.deepEqual(Array.from(labels, label => label.ordinal), [1, 1, 2]);
  assert.ok(Math.hypot(labels[0].x - labels[1].x, labels[0].y - labels[1].y) >= labels[0].radius * 2);
  assert.deepEqual(Array.from(context.ChessArrowBoard.number(arrows.slice(1), 800, 800), label => label.ordinal), [1, 1]);
  assert.equal(context.ChessConfirmMoveSettings.normalizeArrows(null).enabled, false);
  assert.equal(context.ChessConfirmMoveSettings.normalizeArrows({ enabled: true }).enabled, true);
});

test("crowded starting squares place five numbers separately, including at board edges", () => {
  for (const [x, y] of [[400, 400], [0, 0], [800, 400]]) {
    const labels = context.ChessArrowBoard.number(Array.from({ length: 5 }, () => ({ x, y, color: "red" })), 800, 800);
    for (let i = 0; i < labels.length; i++) {
      assert.equal(labels[i].ordinal, i + 1);
      assert.ok(labels[i].x >= labels[i].radius && labels[i].x <= 800 - labels[i].radius);
      assert.ok(labels[i].y >= labels[i].radius && labels[i].y <= 800 - labels[i].radius);
      for (let j = 0; j < i; j++) assert.ok(Math.hypot(labels[i].x - labels[j].x, labels[i].y - labels[j].y) >= labels[i].radius * 2.2 - 1e-9);
    }
  }
});

test("small boards keep 28px badges inside the board and separated", () => {
  for (const [x, y] of [[160, 160], [0, 0], [320, 160]]) {
    const labels = context.ChessArrowBoard.number(Array.from({ length: 5 }, () => ({ x, y, color: "red" })), 320, 320);
    for (let i = 0; i < labels.length; i++) {
      assert.ok(labels[i].x >= 14 && labels[i].x <= 306);
      assert.ok(labels[i].y >= 14 && labels[i].y <= 306);
      for (let j = 0; j < i; j++) assert.ok(Math.hypot(labels[i].x - labels[j].x, labels[i].y - labels[j].y) >= 28);
    }
  }
});

test("arrow observer ignores fog and number overlays but responds to native changes", async () => {
  const observers = [], frames = new Map();
  let id = 0;
  const board = { getBoundingClientRect: () => ({ width: 800, height: 800 }), querySelector: () => null };
  const ctx = vm.createContext({
    document: { documentElement: {}, querySelectorAll: () => [board] },
    MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key),
    addEventListener() {}, chrome: { storage: { local: { get: async () => ({}) }, sync: { get: async () => ({ arrowNumberPreferences: { enabled: true } }) }, onChanged: { addListener() {} } } },
    ChessArrowBoard: { read: () => [] },
  });
  for (const file of ["settings.js", "arrow-content.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), ctx);
  await new Promise(resolve => setImmediate(resolve));
  const frame = [...frames.values()][0]; frames.clear(); frame();
  const observer = observers[1];
  const fog = { classList: { contains: name => name === "chess-fog-overlay" }, closest: selector => selector.includes(".chess-fog-overlay") ? fog : null };
  const numbers = { classList: { contains: name => name === "chess-arrow-numbers" }, closest: selector => selector.includes(".chess-arrow-numbers") ? numbers : null };
  observer.fn([{ target: fog, type: "attributes" }]);
  observer.fn([{ target: board, type: "childList", addedNodes: [fog], removedNodes: [] }]);
  observer.fn([{ target: board, type: "childList", addedNodes: [], removedNodes: [numbers] }]);
  assert.equal(frames.size, 0);
  observer.fn([{ target: board, type: "childList", addedNodes: [fog, {}], removedNodes: [] }]);
  assert.equal(frames.size, 1);
});
