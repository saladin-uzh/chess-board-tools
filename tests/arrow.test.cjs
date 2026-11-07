const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const context = vm.createContext({ getComputedStyle: shape => shape.style });
for (const file of ["settings.js", "arrow-board.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
}

function polygon(x, y, fill) {
  return { localName: "polygon", points: { getItem: () => ({ x, y }) },
    getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 100, f: 200 }), style: { fill } };
}

test("native arrow polygons are read in DOM order and mapped to board coordinates", () => {
  const shapes = [polygon(50, 50, "rgb(255, 0, 0)"), polygon(150, 150, "rgb(0, 0, 255)")];
  const svg = { querySelectorAll: () => shapes };
  const board = { querySelector: () => svg, getBoundingClientRect: () => ({ left: 100, top: 200, width: 800, height: 800 }) };
  assert.deepEqual(JSON.parse(JSON.stringify(context.ChessArrowBoard.read(board))), [
    { x: 50, y: 50, color: "rgb(255, 0, 0)" },
    { x: 150, y: 150, color: "rgb(0, 0, 255)" },
  ]);
  shapes.splice(0, 1);
  assert.equal(context.ChessArrowBoard.read(board).length, 1);
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
