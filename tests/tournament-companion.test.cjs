const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "../tournament-companion-view.js"), "utf8");
const simple = vm.createContext({ URL });
vm.runInContext(source, simple);
const parse = simple.ChessTournamentCompanionView.parseUrl;

test("tournament Share URLs accept only exact same-origin Arena/Swiss routes", () => {
  for (const kind of ["arena", "tournament"]) {
    const target = parse(`https://www.chess.com/play/${kind}/123`);
    assert.equal(target.kind, kind);
    assert.equal(target.url, `https://www.chess.com/play/${kind}/123`);
  }
  for (const value of [null, {}, "", "not a URL", "javascript:alert(1)", "https://evil.test/play/arena/123",
    "https://www.chess.com.evil.test/play/arena/123", "http://www.chess.com/play/arena/123",
    "https://user:password@www.chess.com/play/arena/123", "https://www.chess.com:444/play/arena/123",
    "https://www.chess.com/play/arena/0", "https://www.chess.com/play/arena/-1", "https://www.chess.com/play/arena/1e3",
    "https://www.chess.com/play/arena/123?event=456", "https://www.chess.com/play/arena/123#other",
    "https://www.chess.com/game/live/123", "https://www.chess.com/play/tournament/" + "1".repeat(201)]) {
    assert.equal(parse(value), null);
  }
});

test("profile links allow only canonical Chess.com member routes", () => {
  const { profileUrl, profileTarget } = simple.ChessTournamentCompanionView;
  for (const value of ["/member/Player_1", "https://www.chess.com/member/player-1/"])
    assert.equal(profileUrl(value), new URL(value, "https://www.chess.com/").href);
  for (const value of [null, "/game/123", "javascript:alert(1)", "https://evil.test/member/player",
    "https://user@www.chess.com/member/player", "/member/player?x=1", "/member/player#x", "/member/name…", "/member/a/b"])
    assert.equal(profileUrl(value), null);
  const target = (href, username) => ({ closest: selector => selector === "a[href]"
    ? href == null ? null : { getAttribute: () => href }
    : username == null ? null : { textContent: username } });
  assert.equal(profileTarget(target("/member/known", "Other")), "https://www.chess.com/member/known");
  assert.equal(profileTarget(target(null, " Player_1 ")), "https://www.chess.com/member/player_1");
  for (const name of ["short...", "short…", "player (1000)", "", "two names"])
    assert.equal(profileTarget(target(null, name)), null);
  assert.equal(profileTarget(target("/game/123", "Known")), null);
  assert.equal(profileTarget(target(null, null)), null);
});

function fixture(initiallySelected = false) {
  const styles = [], states = [], listeners = new Map();
  let callback, disconnected = false, clicks = 0, panel = initiallySelected, selected = initiallySelected;
  const makeTab = () => ({ classList: { contains: () => selected }, getAttribute: () => null,
    click() { clicks++; selected = true; panel = true; } });
  let tab = makeTab();
  const doc = {
    documentElement: { append: sheet => styles.push(sheet) },
    addEventListener() {}, removeEventListener() {},
    createElement: () => ({ remove() { this.removed = true; } }),
    querySelector: selector => selector.includes('[role="tab"]') ? tab : panel ? {} : null,
    defaultView: { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) },
  };
  const c = vm.createContext({ URL, MutationObserver: class {
    constructor(fn) { callback = fn; } observe() {} disconnect() { disconnected = true; }
  } });
  vm.runInContext(source, c);
  const view = c.ChessTournamentCompanionView.mount(doc, "tournament", state => states.push(state));
  return { states, styles, listeners, dispose: view.dispose, showTournament: view.showTournament, inspect: () => callback(), clicks: () => clicks,
    disconnected: () => disconnected,
    leave() { selected = false; panel = false; callback(); },
    remount() { selected = false; panel = false; tab = makeTab(); callback(); } };
}

test("child view uses one native selection and reports unavailable instead of fighting a later switch", () => {
  const f = fixture();
  assert.equal(f.clicks(), 1);
  assert.deepEqual(f.states, ["ready"]);
  f.inspect(); f.inspect();
  assert.equal(f.clicks(), 1);
  f.leave(); f.inspect();
  assert.equal(f.clicks(), 1);
  assert.deepEqual(f.states, ["ready", "unavailable"]);
  f.remount();
  assert.equal(f.clicks(), 2);
  assert.deepEqual(f.states, ["ready", "unavailable", "ready"]);
});

test("already selected child view does not click again after a host-initiated switch", () => {
  const f = fixture(true);
  assert.equal(f.clicks(), 0);
  f.leave();
  assert.equal(f.clicks(), 0);
  assert.deepEqual(f.states, ["ready", "unavailable"]);
});

test("explicit Show tournament recovers the same child view without an automatic click loop", () => {
  const f = fixture();
  f.leave();
  assert.deepEqual(f.states, ["ready", "unavailable"]);
  assert.equal(f.showTournament(), true);
  assert.equal(f.clicks(), 2);
  assert.equal(f.states.at(-1), "ready");
  f.inspect();
  assert.equal(f.clicks(), 2);
  f.dispose();
  assert.equal(f.showTournament(), false);
});

test("child pagehide is unavailable and disposal removes observers, styles and listeners", () => {
  const f = fixture();
  f.listeners.get("pagehide")();
  assert.equal(f.states.at(-1), "unavailable");
  f.dispose();
  assert.equal(f.disconnected(), true);
  assert.equal(f.styles[0].removed, true);
  assert.equal(f.listeners.size, 0);
  const count = f.states.length;
  f.inspect();
  assert.equal(f.states.length, count);
});

test("child view rejects unsupported kinds and missing documents", () => {
  assert.throws(() => simple.ChessTournamentCompanionView.mount(null, "arena", () => {}));
  assert.throws(() => simple.ChessTournamentCompanionView.mount({ documentElement: {} }, "game", () => {}));
});

function panelFixture() {
  const controls = new Map(), events = new Map(), timers = new Map();
  let nextTimer = 0;
  let host, frame, root;
  class Element {
    constructor(name = "") { this.className = name; this.style = {}; this.listeners = {}; this.isConnected = true; }
    setAttribute() {}
    attachShadow() { root = new Element(); root.querySelector = selector => {
      if (!controls.has(selector)) controls.set(selector, new Element(selector.slice(1)));
      return controls.get(selector);
    }; return root; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    append(child) { child.parentNode = this; }
    prepend(child) { child.parentNode = this; }
    remove() { this.isConnected = false; }
    focus() {}
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
    dispatch(type, overrides = {}) {
      for (const fn of this.listeners[type] || []) fn({ type, button: 0, pointerId: 1, clientX: 800, clientY: 100,
        preventDefault() {}, stopPropagation() {}, ...overrides });
    }
  }
  const c = vm.createContext({ URL, innerWidth: 1000, innerHeight: 800, location: { pathname: "/play/online" },
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id),
    addEventListener: (type, fn) => events.set(type, fn), MutationObserver: class { observe() {} disconnect() {} },
    document: { body: new Element(), documentElement: new Element(), querySelectorAll: () => [],
      createElement: name => { const e = new Element(); if (name === "section") host = e; if (name === "iframe") frame = e; return e; } } });
  for (const name of ["floating-settings-geometry.js", "tournament-companion-view.js", "tournament-companion.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", name), "utf8"), c);
  }
  c.ChessTournamentCompanion.open("https://www.chess.com/play/arena/123");
  return { c, controls, host, frame, events,
    load(ready = false) {
      frame.contentDocument = { documentElement: new Element(), createElement: () => new Element(),
        addEventListener() {}, removeEventListener() {},
        querySelector: selector => ready ? selector.includes('[role="tab"]')
          ? { classList: { contains: () => true }, getAttribute: () => "true" } : {} : null,
        defaultView: { addEventListener() {}, removeEventListener() {} } };
      frame.dispatch("load");
    },
    expireTimers() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    timers: () => timers.size,
    styles: () => Object.fromEntries(["left", "top", "width", "height"].map(k => [k, host.style[k]])) };
}

for (const control of [".move", ".resize"]) {
  for (const ending of ["pointerup", "pointercancel", "lostpointercapture"]) {
    test(`companion ${control} ${ending} releases the iframe shield and preserves only completed geometry`, () => {
      const f = panelFixture(), handle = f.controls.get(control), initial = f.styles();
      handle.dispatch("pointerdown");
      assert.equal(f.controls.get(".shield").hidden, false);
      handle.dispatch("pointermove", { clientX: 760, clientY: 80 });
      const moved = f.styles();
      assert.notDeepEqual(moved, initial);
      handle.dispatch(ending, { pointerId: 2 });
      assert.deepEqual(f.styles(), moved);
      handle.dispatch(ending);
      assert.deepEqual(f.styles(), ending === "pointerup" ? moved : initial);
      assert.equal(f.controls.get(".shield").hidden, true);
      assert.equal(handle.capture, null);
    });
  }
}

test("closing companion during a drag releases capture and destroys its child page", () => {
  const f = panelFixture(), handle = f.controls.get(".move");
  handle.dispatch("pointerdown");
  f.c.ChessTournamentCompanion.close();
  assert.equal(handle.capture, null);
  assert.equal(f.frame.isConnected, false);
  assert.equal(f.host.isConnected, false);
  assert.equal(f.timers(), 0);
});

test("a child page that never mounts the tournament becomes unavailable instead of loading forever", () => {
  const f = panelFixture();
  f.load();
  assert.match(f.controls.get(".status").textContent, /Loading/);
  f.expireTimers();
  assert.match(f.controls.get(".status").textContent, /unavailable/);
  assert.equal(f.frame.style.visibility, "hidden");
  f.c.ChessTournamentCompanion.close();
});

test("a ready child cancels the startup deadline and stays visible", () => {
  const f = panelFixture();
  f.load(true);
  assert.equal(f.frame.style.visibility, "visible");
  assert.equal(f.timers(), 0);
  f.expireTimers();
  assert.equal(f.frame.style.visibility, "visible");
  f.c.ChessTournamentCompanion.close();
});
