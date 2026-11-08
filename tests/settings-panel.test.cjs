const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
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
    document: { adoptedStyleSheets: [], querySelector: selector => selector === "#open-floating-settings" ? open : status },
    ChessSettingsLayout: {},
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

function pointerPanel() {
  class Element {
    constructor(tag) { this.tag = tag; this.style = {}; this.listeners = {}; this.isConnected = true; }
    setAttribute() {}
    append(child) { child.parentNode = this; this.panel = child; }
    attachShadow() { return root; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    replaceWith(node) { this.replacement = node; }
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: data => { this.pixels = data.data; } }; }
    focus() {}
    setPointerCapture() {}
    dispatch(type, overrides = {}) {
      this.listeners[type]({ type, pointerId: 1, button: 0, clientX: 500, clientY: 100,
        currentTarget: this, preventDefault() {}, ...overrides });
    }
  }
  const elements = new Map(), created = [];
  const root = new Element();
  root.querySelector = selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const writes = [];
  const c = vm.createContext({
    document: { createElement: tag => { const element = new Element(tag); created.push(element); return element; }, body: new Element(), documentElement: new Element() },
    atob: value => Buffer.from(value, "base64").toString("binary"),
    CSSStyleSheet: class { replaceSync() {} },
    ChessSettingsLayout: {},
    MutationObserver: class { observe() {} disconnect() {} },
    innerWidth: 1000, innerHeight: 800, addEventListener() {},
    ChessSettingsView: { mount: () => () => {} },
    chrome: {
      runtime: { getURL: value => value, onMessage: { addListener() {} } },
      storage: { local: { get: async () => ({}), set: async value => writes.push(value) },
        onChanged: { addListener() {} } },
    },
  });
  vm.runInContext(read("floating-settings-geometry.js"), c);
  vm.runInContext(read("floating-settings.js"), c);
  c.ChessFloatingSettings.open();
  // The panel is the last element appended to the shadow root.
  const styles = () => JSON.parse(JSON.stringify(root.panel.style));
  return { c, root, elements, created, writes, styles };
}

for (const control of [".move", ".resize"]) {
  for (const ending of ["pointercancel", "lostpointercapture", "pointerup"]) {
    test(`${control} ${ending} restores canceled geometry or saves completed geometry`, async () => {
      const { elements, writes, styles } = pointerPanel();
      await new Promise(resolve => setImmediate(resolve));
      const initial = styles();
      const handle = elements.get(control);
      handle.dispatch("pointerdown");
      handle.dispatch("pointermove", { clientX: 460, clientY: 80 });
      const moved = styles();
      assert.notDeepEqual(moved, initial);
      handle.dispatch(ending, { pointerId: 2 });
      assert.deepEqual(styles(), moved);
      assert.equal(writes.length, 0);
      handle.dispatch(ending);
      handle.dispatch("lostpointercapture");
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(styles(), ending === "pointerup" ? moved : initial);
      assert.equal(writes.length, ending === "pointerup" ? 1 : 0);
      if (writes.length) {
        const saved = writes[0].floatingSettingsPreferences;
        for (const key of ["left", "top", "width", "height"]) assert.equal(`${saved[key]}px`, moved[key]);
      }
    });
  }
}

// Decode the checked-in RGB PNG so the embedded fallback cannot silently drift.
function iconRgb() {
  const png = fs.readFileSync(path.join(__dirname, "..", "icons/icon-32.png"));
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR") {
      assert.equal(png.readUInt32BE(offset + 8), 32);
      assert.equal(png.readUInt32BE(offset + 12), 32);
      assert.deepEqual([...png.subarray(offset + 16, offset + 18)], [8, 2]);
    }
    if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), rgb = Buffer.alloc(32 * 32 * 3), stride = 32 * 3;
  for (let y = 0; y < 32; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 3 ? rgb[i - 3] : 0, b = y ? rgb[i - stride] : 0;
      const c = y && x >= 3 ? rgb[i - stride - 3] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else assert.equal(filter, 0);
      rgb[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return rgb;
}

test("both icons fall back to the bundled artwork when image loading fails", () => {
  const { elements, created } = pointerPanel();
  const images = [created.find(element => element.tag === "img"), elements.get(".mark")];
  const expected = iconRgb();
  for (const image of images) {
    assert.equal(image.src, "icons/icon-32.png");
    image.dispatch("error");
    const canvas = image.replacement;
    assert.equal(canvas.tag, "canvas");
    assert.equal(canvas.className, image.className);
    assert.equal(canvas.width, 32);
    assert.equal(canvas.height, 32);
    const rgb = [];
    for (let i = 0; i < canvas.pixels.length; i += 4) {
      rgb.push(...canvas.pixels.slice(i, i + 3));
      assert.equal(canvas.pixels[i + 3], 255);
    }
    assert.deepEqual(Buffer.from(rgb), expected);
  }
});
