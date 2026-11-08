const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const run = (c, file) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), c);
const flush = () => new Promise(r => setImmediate(r));
function harness() {
  let resolveLoad, rejectLoad, listener, change, fail = false;
  const writes = [], status = { textContent: "" };
  const toggle = { checked: false, disabled: true, addEventListener: (_, fn) => { change = fn; } };
  const c = vm.createContext({ chrome: { storage: {
    local: { get: async () => ({}) },
    sync: { get: () => new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; }),
      set: async data => { if (fail) throw Error("save"); writes.push(JSON.parse(JSON.stringify(data))); } },
    onChanged: { addListener: fn => { listener = fn; } },
  } } });
  run(c, "settings.js"); run(c, "player-popup.js");
  c.ChessSettingsControllers.players({ querySelector: s => s === "#hide-player-info" ? toggle : status });
  return { c, toggle, status, writes, load: resolveLoad, reject: rejectLoad,
    emit: (value, area = "sync") => listener({ playerPrivacyPreferences: { newValue: value } }, area),
    save: async checked => { toggle.checked = checked; await change(); }, fail: () => { fail = true; } };
}
test("player privacy is opt-in and normalizes malformed values", () => {
  const a = harness();
  for (const input of [null, {}, true, { enabled: "true" }]) assert.equal(a.c.ChessConfirmMoveSettings.normalizePlayers(input).enabled, false);
  assert.equal(a.c.ChessConfirmMoveSettings.normalizePlayers({ enabled: true }).enabled, true);
  assert.equal(a.toggle.disabled, true);
});
test("player privacy saves only its own synced preference and rolls back failed saves", async () => {
  const a = harness(); a.load({ playerPrivacyPreferences: { enabled: false } }); await flush();
  assert.equal(a.toggle.disabled, false);
  await a.save(true);
  assert.deepEqual(a.writes, [{ playerPrivacyPreferences: { enabled: true } }]);
  a.fail(); await a.save(false);
  assert.equal(a.toggle.checked, true);
  assert.match(a.status.textContent, /Could not save/);
});
test("new synced privacy values win over delayed initial reads", async () => {
  const a = harness(); a.emit({ enabled: true });
  a.load({ playerPrivacyPreferences: { enabled: false } }); await flush();
  assert.equal(a.toggle.checked, true);
  a.emit({ enabled: false }, "local"); assert.equal(a.toggle.checked, true);
  a.emit(undefined); assert.equal(a.toggle.checked, false);
});
test("privacy load failure allows retrying a save", async () => {
  const a = harness(); a.reject(Error("read")); await flush();
  assert.equal(a.toggle.disabled, false); assert.match(a.status.textContent, /unavailable/);
  await a.save(true); assert.equal(a.toggle.checked, true);
});

function contentHarness() {
  let load, listener, interval, observed = false;
  const attrs = new Set(), frames = new Map(), events = {};
  const c = vm.createContext({
    document: { documentElement: { setAttribute: k => attrs.add(k), removeAttribute: k => attrs.delete(k) },
      querySelector: () => null, querySelectorAll: () => [] },
    MutationObserver: class { observe() { observed = true; } disconnect() { observed = false; } },
    requestAnimationFrame: fn => { frames.set(1, fn); return 1; }, cancelAnimationFrame: id => frames.delete(id),
    setInterval: fn => { interval = fn; return 1; }, clearInterval: () => { interval = null; },
    addEventListener: (key, fn) => { events[key] = fn; },
    chrome: { storage: { sync: { get: () => new Promise(r => { load = r; }) },
      local: { get: async () => ({}) }, onChanged: { addListener: fn => { listener = fn; } } } },
  });
  run(c, "settings.js"); run(c, "player-content.js");
  return { attrs, frames, events, load, observed: () => observed, polling: () => !!interval,
    emit: (value, area = "sync") => listener({ playerPrivacyPreferences: { newValue: value } }, area) };
}
test("content ignores a stale load, cleans up on disable and restores across page cycles", async () => {
  const a = contentHarness();
  assert.equal(a.observed(), false); assert.equal(a.polling(), false);
  a.emit({ enabled: true });
  a.load({ playerPrivacyPreferences: { enabled: false } }); await flush();
  assert.equal(a.attrs.has("data-chess-hide-players"), true);
  assert.equal(a.observed(), true); assert.equal(a.polling(), true);
  a.events.pagehide();
  assert.equal(a.attrs.size, 0); assert.equal(a.frames.size, 0);
  assert.equal(a.observed(), false); assert.equal(a.polling(), false);
  a.events.pageshow(); assert.equal(a.attrs.size, 1);
  a.emit({ enabled: false }, "local"); assert.equal(a.attrs.size, 1);
  a.emit(undefined); assert.equal(a.attrs.size, 0); assert.equal(a.polling(), false);
});
