const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const context = vm.createContext({});
vm.runInContext(read("floating-settings-geometry.js"), context);
const geometry = (value, viewport = { width: 1000, height: 800 }) =>
  JSON.parse(JSON.stringify(context.ChessFloatingSettingsGeometry.geometry(value, viewport)));

test("floating geometry defaults and malformed stored values remain inside the viewport", () => {
  assert.deepEqual(geometry(null), { left: 628, top: 12, width: 360, height: 640 });
  assert.deepEqual(geometry({ left: Infinity, top: NaN, width: "400", height: null }), geometry(null));
  assert.deepEqual(geometry({ left: -900, top: 9000, width: -1, height: -10 }),
    { left: 12, top: 508, width: 300, height: 280 });
});

test("floating geometry clamps oversized windows and fits viewports below the usual minimum", () => {
  for (const viewport of [{ width: 200, height: 150 }, { width: 1, height: 1 }, { width: 1024, height: 768 }]) {
    const result = geometry({ left: 9000, top: 9000, width: 9000, height: 9000 }, viewport);
    assert.ok(result.width > 0 && result.height > 0);
    assert.ok(result.left >= 0 && result.top >= 0);
    assert.ok(result.left + result.width <= viewport.width);
    assert.ok(result.top + result.height <= viewport.height);
  }
});

test("page settings focus is guarded even when a shadow host is the retargeted event target", () => {
  const c = vm.createContext({ document: { activeElement: null } });
  vm.runInContext(read("settings.js"), c);
  const host = { closest: selector => selector.includes("[data-chess-settings-ui]") ? {} : null };
  assert.equal(c.ChessConfirmMoveSettings.hasInputFocus({ target: host }), true);
  assert.equal(c.ChessConfirmMoveSettings.hasInputFocus({ target: {}, composedPath: () => [host] }), true);
  assert.equal(c.ChessConfirmMoveSettings.hasInputFocus({ target: {} }), false);
});

test("toolbar open reports success only after the active page acknowledges it", async () => {
  let click, closed = false, disabledDuringSend = false;
  const open = { disabled: false, addEventListener(type, callback) { click = callback; } };
  const status = {};
  let response = { opened: true }, message;
  const c = vm.createContext({
    document: { querySelector: selector => selector === "#open-floating-settings" ? open : status },
    ChessSettingsView: { mount() {} }, window: { close() { closed = true; } },
    chrome: { tabs: { query: async () => [{ id: 7 }], sendMessage: async (id, value) => {
      disabledDuringSend = open.disabled; message = { id, type: value.type }; return response;
    } } },
  });
  vm.runInContext(read("popup-entry.js"), c);
  await click();
  assert.deepEqual(message, { id: 7, type: "chess-open-settings" });
  assert.equal(disabledDuringSend, true);
  assert.equal(closed, true);
  assert.equal(open.disabled, false);
  closed = false; response = undefined;
  await click();
  assert.equal(closed, false);
  assert.match(status.textContent, /Open a Chess.com tab/);
  assert.equal(open.disabled, false);
});
