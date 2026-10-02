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
    key(code, key, overrides = {}) {
      const event = {
        code, key, target: {},
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; },
        ...overrides,
      };
      listeners.keydown?.(event);
      return event;
    },
  };
}

function popupHarness() {
  const storage = deferred();
  const writes = [];
  let failSave = false;
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
        sync: {
          get: () => storage.promise,
          async set(value) {
            if (failSave) throw new Error("Storage unavailable");
            writes.push(plain(value));
          },
        },
      },
    },
  });
  run(context, "settings.js");
  run(context, "popup.js");
  return { storage, confirm, cancel, status, writes,
    failSave: () => { failSave = true; } };
}

test("initial storage loading cannot trigger the opposite move action", async () => {
  const app = contentHarness();
  app.key("Space", " ");
  assert.equal(app.confirm.clicks, 0);
  app.storage.resolve({ keybindings: { confirmKeyCode: "KeyA", cancelKeyCode: "Space" } });
  await flush();
  assert.equal(app.key("Space", " ").prevented, true);
  assert.equal(app.confirm.clicks, 0);
  assert.equal(app.cancel.clicks, 1);
});

test("letter shortcuts follow AZERTY characters and handle Caps Lock", async () => {
  const app = contentHarness();
  app.storage.resolve({ keybindings: { confirmKeyCode: "KeyA", cancelKeyCode: "KeyS" } });
  await flush();
  assert.equal(app.key("KeyA", "q").prevented, undefined);
  assert.equal(app.key("KeyQ", "a").prevented, true);
  assert.equal(app.key("KeyQ", "A").prevented, true);
  assert.equal(app.key("KeyS", "s").prevented, true);
  assert.equal(app.confirm.clicks, 2);
  assert.equal(app.cancel.clicks, 1);
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
  app.change({ confirmKeyCode: "Enter", cancelKeyCode: "KeyF" }, "local");
  assert.equal(app.key("Enter", "Enter").prevented, undefined);
  app.change({ confirmKeyCode: "Enter", cancelKeyCode: "KeyF" });
  assert.equal(app.key("Enter", "Enter").prevented, true);
  assert.equal(app.key("KeyF", "f").prevented, true);
  app.change(undefined);
  assert.equal(app.key("Space", " ").prevented, true);
});

test("popup prevents edits until the stored pair renders", async () => {
  const app = popupHarness();
  assert.equal(app.confirm.disabled, true);
  assert.equal(app.cancel.disabled, true);
  await app.confirm.choose("KeyA");
  assert.equal(app.writes.length, 0);
  app.storage.resolve({ keybindings: { confirmKeyCode: "Enter", cancelKeyCode: "KeyF" } });
  await flush();
  assert.equal(app.confirm.disabled, false);
  assert.equal(app.cancel.disabled, false);
  assert.equal(app.confirm.value, "Enter");
  assert.equal(app.cancel.value, "KeyF");
  await app.confirm.choose("KeyA");
  assert.deepEqual(app.writes, [{ keybindings: { confirmKeyCode: "KeyA", cancelKeyCode: "KeyF" } }]);
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

test("popup rejects duplicate keys and restores settings after a failed save", async () => {
  const app = popupHarness();
  app.storage.resolve({});
  await flush();
  await app.confirm.choose("Escape");
  assert.equal(app.writes.length, 0);
  assert.equal(app.confirm.value, "Space");
  await app.confirm.choose("KeyA");
  app.failSave();
  await app.confirm.choose("KeyS");
  assert.equal(app.confirm.value, "KeyA");
  assert.equal(app.status.textContent, "Could not save settings.");
});
