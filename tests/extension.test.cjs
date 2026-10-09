const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function run(context, file) {
  vm.runInContext(read(file), context, { filename: file });
}

function contentHarness() {
  const storage = deferred();
  const listeners = {};
  let storageListener;
  class Element {
    constructor(primary = false) {
      this.clicks = 0;
      this.disabled = false;
      this.visible = true;
      this.classList = { contains: () => primary };
    }
    getBoundingClientRect() {
      return { width: this.visible ? 20 : 0, height: 20 };
    }
    getAttribute() {
      return null;
    }
    click() {
      this.clicks++;
    }
  }
  const confirm = new Element(true);
  const cancel = new Element();
  const buttons = new Element();
  buttons.querySelectorAll = () => [confirm, cancel];
  const context = vm.createContext({
    HTMLElement: Element,
    console: { info() {} },
    document: {
      querySelector: (selector) =>
        selector.includes("primary") ? confirm : buttons,
    },
    window: {
      addEventListener: (type, handler) => { listeners[type] = handler; },
      getComputedStyle: () => ({
        display: "block", visibility: "visible", pointerEvents: "auto",
      }),
    },
    chrome: {
      storage: {
        sync: { get: () => storage.promise },
        onChanged: { addListener: (handler) => { storageListener = handler; } },
      },
    },
  });
  run(context, "settings.js");
  run(context, "content.js");
  return {
    storage, confirm, cancel,
    change: (value, area = "sync") =>
      storageListener({ keybindings: { newValue: value } }, area),
    listeners, document: context.document,
    key(code, key, overrides = {}, type = "keydown") {
      const event = {
        code, key, target: {},
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; },
        ...overrides,
      };
      listeners[type]?.(event);
      return event;
    },
  };
}

function popupHarness(delayedSave = false) {
  const storage = deferred();
  const save = deferred();
  const writes = [];
  let failSave = false;
  let storageListener;
  class Select {
    constructor(id) {
      const tag = read("popup.html").match(new RegExp(`<select id="${id}"[^>]*>`));
      this.disabled = /\bdisabled\b/.test(tag[0]);
      this.value = "";
      this.listeners = {};
    }
    append(option) {
      if (!this.value) this.value = option.value;
    }
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
    async choose(value) {
      if (this.disabled) return;
      this.value = value;
      await this.listeners.change();
    }
  }
  const confirm = new Select("confirm-key");
  const cancel = new Select("cancel-key");
  const status = {};
  const context = vm.createContext({
    document: {
      querySelector: (selector) => ({
        "#confirm-key": confirm, "#cancel-key": cancel, "#status": status,
      })[selector],
      createElement: () => ({}),
    },
    window: { clearTimeout() {}, setTimeout() {} },
    chrome: {
      storage: {
        onChanged: { addListener: handler => { storageListener = handler; } },
        sync: {
          get: () => storage.promise,
          async set(value) {
            if (delayedSave) await save.promise;
            if (failSave) throw new Error("Storage unavailable");
            writes.push(plain(value));
          },
        },
      },
    },
  });
  run(context, "settings.js");
  run(context, "popup.js");
  return { storage, save, confirm, cancel, status, writes,
    change: (value, area = "sync", key = "keybindings") =>
      storageListener({ [key]: { newValue: value } }, area),
    failSave: () => { failSave = true; } };
}

test("initial storage loading cannot trigger the opposite move action", async () => {
  const app = contentHarness();
  app.key("Space", " ");
  assert.equal(app.confirm.clicks, 0);
  app.storage.resolve({ keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "Space" } });
  await flush();
  assert.equal(app.key("Space", " ").prevented, true);
  assert.equal(app.confirm.clicks, 0);
  assert.equal(app.cancel.clicks, 1);
});

test("removed keys normalize to defaults without activating letters", async () => {
  const app = contentHarness();
  app.storage.resolve({ keybindings: { confirmKeyCode: "KeyA", cancelKeyCode: "KeyS" } });
  await flush();
  assert.equal(app.key("KeyA", "a").prevented, undefined);
  assert.equal(app.key("Space", " ").prevented, true);
  assert.equal(app.key("Escape", "Escape").prevented, true);
});

test("storage read failure enables default shortcuts", async () => {
  const app = contentHarness();
  app.storage.reject(new Error("Storage unavailable"));
  await flush();
  assert.equal(app.key("Space", " ").prevented, true);
  assert.equal(app.key("Escape", "Escape").prevented, true);
});

test("shortcut guards and live storage changes remain effective", async () => {
  const app = contentHarness();
  app.storage.resolve({});
  await flush();
  for (const flag of ["repeat", "metaKey", "ctrlKey", "altKey", "shiftKey"]) {
    assert.equal(app.key("Space", " ", { [flag]: true }).prevented, undefined);
  }
  assert.equal(app.key("Space", " ", { target: { closest: () => ({}) } }).prevented, undefined);
  app.confirm.disabled = true;
  assert.equal(app.key("Space", " ").prevented, undefined);
  app.confirm.disabled = false;
  app.confirm.visible = false;
  assert.equal(app.key("Space", " ").prevented, undefined);
  app.confirm.visible = true;
  app.change({ confirmKeyCode: "Enter", cancelKeyCode: "Control" }, "local");
  assert.equal(app.key("Enter", "Enter").prevented, undefined);
  app.change({ confirmKeyCode: "Enter", cancelKeyCode: "Control" });
  assert.equal(app.key("Enter", "Enter").prevented, true);
  assert.equal(app.key("Escape", "Escape").prevented, undefined);
  app.change(undefined);
  assert.equal(app.key("Space", " ").prevented, true);
});

test("popup prevents edits until the stored pair renders", async () => {
  const app = popupHarness();
  assert.equal(app.confirm.disabled, true);
  assert.equal(app.cancel.disabled, true);
  await app.confirm.choose("Enter");
  assert.equal(app.writes.length, 0);
  app.storage.resolve({ keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "Control" } });
  await flush();
  assert.equal(app.confirm.disabled, false);
  assert.equal(app.cancel.disabled, false);
  assert.equal(app.confirm.value, "Enter");
  assert.equal(app.cancel.value, "Control");
  await app.confirm.choose("Enter");
  assert.deepEqual(app.writes, [{ keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "Control" } }]);
});

test("popup enables defaults after a failed initial read", async () => {
  const app = popupHarness();
  app.storage.reject(new Error("Storage unavailable"));
  await flush();
  assert.equal(app.confirm.disabled, false);
  assert.equal(app.cancel.disabled, false);
  assert.equal(app.confirm.value, "Space");
  assert.equal(app.cancel.value, "Escape");
  assert.equal(app.status.textContent, "Settings unavailable. Using defaults.");
});

test("popup blocks overlapping changes until the pending save completes", async () => {
  const app = popupHarness(true);
  app.storage.resolve({});
  await flush();
  const pending = app.confirm.choose("Enter");
  assert.equal(app.confirm.disabled, true);
  assert.equal(app.cancel.disabled, true);
  await app.cancel.choose("Enter");
  assert.equal(app.confirm.value, "Enter");
  assert.equal(app.cancel.value, "Escape");
  app.save.resolve();
  await pending;
  assert.deepEqual(app.writes, [{ keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "Escape" } }]);
  assert.equal(app.confirm.disabled, false);
  assert.equal(app.cancel.disabled, false);
  await app.cancel.choose("Control");
  assert.deepEqual(app.writes[1], { keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "Control" } });
});

test("popup rejects duplicate keys and restores settings after a failed save", async () => {
  const app = popupHarness();
  app.storage.resolve({});
  await flush();
  await app.cancel.choose("Space");
  assert.equal(app.writes.length, 0);
  assert.equal(app.confirm.value, "Space");
  await app.confirm.choose("Enter");
  app.failSave();
  await app.confirm.choose("Control");
  assert.equal(app.confirm.value, "Enter");
  assert.equal(app.status.textContent, "Could not save settings.");
  assert.equal(app.confirm.disabled, false);
  assert.equal(app.cancel.disabled, false);
});


test("both Ctrl keys act only on standalone release; chords, blur and focus cancel", async () => {
  const app = contentHarness(); app.storage.resolve({}); await flush();
  app.change({ confirmKeyCode: "Control", cancelKeyCode: "Escape" });
  for (const code of ["ControlLeft", "ControlRight"]) {
    app.key(code, "Control", { ctrlKey: true });
    assert.equal(app.confirm.clicks, code === "ControlLeft" ? 0 : 1);
    assert.equal(app.key(code, "Control", {}, "keyup").prevented, true);
  }
  app.key("ControlLeft", "Control", { ctrlKey: true });
  app.key("KeyC", "c", { ctrlKey: true });
  assert.equal(app.key("ControlLeft", "Control", {}, "keyup").prevented, undefined);
  for (const reset of ["blur", "focusin", "pagehide"]) {
    app.key("ControlLeft", "Control", { ctrlKey: true }); app.listeners[reset]();
    assert.equal(app.key("ControlLeft", "Control", {}, "keyup").prevented, undefined);
  }
  assert.equal(app.confirm.clicks, 2);
  app.change({ confirmKeyCode: "Space", cancelKeyCode: "Control" });
  app.key("ControlRight", "Control", { ctrlKey: true });
  app.key("ControlRight", "Control", {}, "keyup");
  assert.equal(app.cancel.clicks, 1);
});

test("active input focus and composed editable targets suppress all hotkeys", async () => {
  const app = contentHarness(); app.storage.resolve({}); await flush();
  app.document.activeElement = { closest: () => ({}) };
  assert.equal(app.key("Space", " ").prevented, undefined);
  assert.equal(app.key("Escape", "Escape").prevented, undefined);
  app.document.activeElement = { shadowRoot: { activeElement: { isContentEditable: true } } };
  assert.equal(app.key("Space", " ").prevented, undefined);
  app.document.activeElement = null;
  assert.equal(app.key("Space", " ", { composedPath: () => [{ isContentEditable: true }] }).prevented, undefined);
  app.change({ confirmKeyCode: "Control", cancelKeyCode: "Escape" });
  app.key("ControlLeft", "Control", { ctrlKey: true });
  app.document.activeElement = { isContentEditable: true };
  assert.equal(app.key("ControlLeft", "Control", {}, "keyup").prevented, undefined);
  assert.equal(app.confirm.clicks, 0);
});


test("normalization enforces action-specific options and preserves valid stored values", () => {
  const context = vm.createContext({}); run(context, "settings.js");
  const { normalizeKeybindings: normalize, CONFIRM_KEYS, CANCEL_KEYS } = context.ChessConfirmMoveSettings;
  assert.deepEqual(plain(CONFIRM_KEYS.map(key => key.code)), ["Enter", "Space", "Control"]);
  assert.deepEqual(plain(CANCEL_KEYS.map(key => key.code)), ["Escape", "Space", "Control"]);
  for (const input of [{ confirmKeyCode: "Escape", cancelKeyCode: "Enter" },
    { confirmKeyCode: "Control", cancelKeyCode: "Control" }, { confirmKeyCode: "KeyA", cancelKeyCode: "Space" }]) {
    assert.deepEqual(plain(normalize(input)), { confirmKeyCode: "Space", cancelKeyCode: "Escape" });
  }
  assert.deepEqual(plain(normalize({ confirmKeyCode: "Enter", cancelKeyCode: "KeyF" })), { confirmKeyCode: "Enter", cancelKeyCode: "Escape" });
});

test("popup reconciles incoming sync state before editing another field", async () => {
  const app = popupHarness(); app.storage.resolve({}); await flush();
  app.change({ confirmKeyCode: "Space", cancelKeyCode: "Control" }, "local");
  app.change({ confirmKeyCode: "Space", cancelKeyCode: "Control" }, "sync", "fogPreferences");
  assert.equal(app.cancel.value, "Escape");
  app.change({ confirmKeyCode: "Space", cancelKeyCode: "Control" });
  assert.equal(app.cancel.value, "Control");
  await app.confirm.choose("Enter");
  assert.deepEqual(app.writes, [{ keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "Control" } }]);
  app.change(undefined);
  assert.equal(app.confirm.value, "Space"); assert.equal(app.cancel.value, "Escape");
  app.change({ confirmKeyCode: "invalid", cancelKeyCode: "invalid" });
  assert.equal(app.confirm.value, "Space"); assert.equal(app.cancel.value, "Escape");
  app.change({ confirmKeyCode: "Control", cancelKeyCode: "Control" });
  assert.equal(app.confirm.value, "Space"); assert.equal(app.cancel.value, "Escape");
});

for (const failRead of [false, true]) {
  test(`incoming sync state supersedes initial ${failRead ? "failed" : "stale"} read`, async () => {
    const app = popupHarness();
    app.change({ confirmKeyCode: "Enter", cancelKeyCode: "Control" });
    assert.equal(app.confirm.disabled, true); assert.equal(app.cancel.disabled, true);
    if (failRead) app.storage.reject(new Error("Unavailable")); else app.storage.resolve({});
    await flush();
    assert.equal(app.confirm.value, "Enter"); assert.equal(app.cancel.value, "Control");
    assert.equal(app.confirm.disabled, false); assert.equal(app.cancel.disabled, false);
    assert.notEqual(app.status.textContent, "Settings unavailable. Using defaults.");
  });
}

for (const failSave of [false, true]) {
  for (const incoming of [{ confirmKeyCode: "Control", cancelKeyCode: "Space" }, undefined, { confirmKeyCode: "invalid" }]) {
    test(`incoming sync state survives delayed ${failSave ? "failed" : "successful"} save: ${JSON.stringify(incoming)}`, async () => {
      const app = popupHarness(true); app.storage.resolve({}); await flush();
      const pending = app.confirm.choose("Enter");
      app.change(incoming);
      assert.equal(app.confirm.disabled, true); assert.equal(app.cancel.disabled, true);
      if (failSave) app.failSave();
      app.save.resolve(); await pending;
      const expected = incoming?.confirmKeyCode === "Control" ? incoming : { confirmKeyCode: "Space", cancelKeyCode: "Escape" };
      assert.equal(app.confirm.value, expected.confirmKeyCode); assert.equal(app.cancel.value, expected.cancelKeyCode);
      assert.equal(app.confirm.disabled, false); assert.equal(app.cancel.disabled, false);
      assert.equal(app.writes.length, failSave ? 0 : 1);
    });
  }
}

test("own storage event preserves saved selection without extra writes", async () => {
  const app = popupHarness(true); app.storage.resolve({}); await flush();
  const pending = app.confirm.choose("Enter");
  app.change({ confirmKeyCode: "Enter", cancelKeyCode: "Escape" });
  app.save.resolve(); await pending;
  assert.equal(app.confirm.value, "Enter"); assert.equal(app.cancel.value, "Escape");
  assert.equal(app.writes.length, 1);
  assert.equal(app.status.textContent, "Saved.");
  await app.cancel.choose("Control");
  assert.deepEqual(app.writes[1], { keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "Control" } });
});
