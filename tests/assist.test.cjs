const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const run = (context, file) => vm.runInContext(source(file), context, { filename: file });
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
const context = vm.createContext({});
for (const file of ['settings.js', 'assist-board.js']) run(context, file);
const snapshot = { session: 1, context: 'bot', fen: '7k/8/8/8/8/8/P7/7K w - - 0 1', side: 'white', turn: 'white', active: true, stable: true, flipped: false };

test('allowed action keys, old values and duplicate migration', () => {
  const s = context.ChessConfirmMoveSettings;
  assert.deepEqual(plain(s.CONFIRM_KEYS.map(k => k.code)), ['Enter', 'Space', 'Control']);
  assert.deepEqual(plain(s.CANCEL_KEYS.map(k => k.code)), ['Escape', 'Space', 'Control']);
  for (const input of [null, {}, { confirmKeyCode: 'Escape', cancelKeyCode: 'Enter' },
    { confirmKeyCode: 'KeyA', cancelKeyCode: 'KeyF' }, { confirmKeyCode: 'Space', cancelKeyCode: 'Space' },
    { confirmKeyCode: 'Control', cancelKeyCode: 'Control' }]) {
    assert.deepEqual(plain(s.normalizeKeybindings(input)), { confirmKeyCode: 'Space', cancelKeyCode: 'Escape' });
  }
  assert.deepEqual(plain(s.normalizeKeybindings({ confirmKeyCode: 'Enter', cancelKeyCode: 'KeyS' })), { confirmKeyCode: 'Enter', cancelKeyCode: 'Escape' });
  assert.deepEqual(plain(s.normalizeAssist({ keyboard: 'true', ticking: 1 })), { keyboard: false });
});

test('adapter rejects unknown contexts, malformed state and transient boards', () => {
  const board = { id: 'board-play-computer', isConnected: true };
  const validate = (value, b = board, route = '/play/computer') => context.ChessBoardAssist.validate(JSON.stringify(value), b, route);
  assert.equal(validate(snapshot).turn, 'white');
  for (const change of [{ active: 1 }, { stable: null }, { flipped: null }, { side: 'red' }, { session: 0 },
    { fen: '8/8/8/8/8/8/8/8' }, { fen: snapshot.fen.replace('P7', 'P8') }, { context: 'puzzle' }]) assert.equal(validate({ ...snapshot, ...change }), null);
  assert.equal(validate(snapshot, { ...board, isConnected: false }), null);
  assert.equal(validate(snapshot, board, '/analysis/classroom'), null);
  assert.equal(validate({ ...snapshot, context: 'human' }, { ...board, id: 'board-single' }, '/play/online').context, 'human');
  assert.equal(validate({ ...snapshot, context: 'analysis', side: null, active: false }, { ...board, id: 'board-analysis-board' }, '/analysis').context, 'analysis');
});

test('coordinate mapping is algebraic on both orientations and rejects bad geometry', () => {
  const { point } = context.ChessBoardAssist;
  const rect = { left: 10, top: 20, width: 800, height: 800 };
  assert.deepEqual(plain(point('b2', false, rect)), { x: 160, y: 670 });
  assert.deepEqual(plain(point('b2', true, rect)), { x: 660, y: 170 });
  assert.equal(point('b9', false, rect), null);
  assert.equal(point('b2', undefined, rect), null);
  assert.equal(point('b2', false, { ...rect, height: 700 }), null);
});



function harness() {
  const listeners = {}, docListeners = {}, timeouts = new Map(), intervals = new Map(), clicks = [];
  let now = 0, serial = 0, changed, current = { ...snapshot, context: 'analysis', active: false, side: null }, board;
  class Element {
    constructor() { this.isConnected = true; this.style = {}; this.picker = null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 800 }; }
    getAttribute() { return null; }
    setAttribute() {}
    remove() { this.removed = true; }
    querySelector() { return this.picker; }
  }
  board = new Element();
  const document = { activeElement: null, visibilityState: 'visible', body: { append() {} },
    querySelector: selector => selector.startsWith('wc-') ? board : null,
    createElement: () => new Element(), addEventListener: (type, fn) => { docListeners[type] = fn; } };
  const c = vm.createContext({ document, location: { pathname: '/analysis' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', pointerEvents: 'auto' }),
    performance: { now: () => now },
    setTimeout: (fn, delay) => { const id = ++serial; timeouts.set(id, { fn, due: now + delay }); return id; },
    clearTimeout: id => timeouts.delete(id), setInterval: fn => { const id = ++serial; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    chrome: { storage: { local: { get: async () => ({ boardAssistPreferences: { keyboard: true } }) }, onChanged: { addListener: fn => { changed = fn; } } } },
    ChessBoardAssist: { read: () => current, clickSquare: (b, square) => { clicks.push(square); return true; }, clickPromotion: p => { clicks.push(p.piece); return true; } },
  });
  run(c, 'settings.js'); run(c, 'assist-content.js');
  function dispatch(type, event = {}) { for (const fn of listeners[type] || []) fn(event); }
  return { document, clicks, listeners, docListeners,
    key(key, extra = {}) { const e = { key, code: key === 'Escape' ? 'Escape' : '', target: {}, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...extra }; dispatch('keydown', e); return e; },
    dispatch, advance(ms) { now += ms; for (const [id, t] of timeouts) if (t.due <= now) { timeouts.delete(id); t.fn(); } },
    poll() { for (const fn of intervals.values()) fn(); },
    state(value) { current = value; }, replace() { board = new Element(); },
    change(value, area = 'local') { changed({ boardAssistPreferences: { newValue: value } }, area); },
    picker(piece) { const p = new Element(); p.piece = piece; const picker = new Element(); picker.querySelectorAll = () => [p]; board.picker = picker; },
  };
}

test('keyboard buffer lasts five seconds, accepts replacement letters and clears on lifecycle changes', async () => {
  const app = harness(); await flush();
  assert.equal(app.key('b').prevented, true); app.advance(4999); app.key('2'); assert.deepEqual(app.clicks, ['b2']);
  app.key('b'); app.advance(5000); app.key('3'); assert.equal(app.clicks.length, 1);
  app.key('a'); app.key('c'); app.key('4'); assert.equal(app.clicks.at(-1), 'c4');
  for (const reset of ['blur', 'focusin', 'resize', 'scroll', 'pagehide']) { app.key('b'); app.dispatch(reset); app.key('2'); assert.equal(app.clicks.length, 2); }
  app.dispatch('pageshow'); app.key('b'); app.key('Escape'); app.key('2'); assert.equal(app.clicks.length, 2);
  app.key('b'); app.replace(); app.poll(); app.key('2'); assert.equal(app.clicks.length, 2);
});

test('focus, guards, unsupported state and preference changes prevent coordinate actions', async () => {
  const app = harness(); await flush();
  app.key('b'); app.document.activeElement = { isContentEditable: true }; app.key('2');
  app.document.activeElement = null; app.key('2'); assert.equal(app.clicks.length, 0);
  for (const flag of ['repeat', 'metaKey', 'ctrlKey', 'altKey', 'shiftKey']) assert.equal(app.key('b', { [flag]: true }).prevented, undefined);
  assert.equal(app.key('b', { target: { closest: () => ({}) } }).prevented, undefined);
  app.key('b'); app.state(null); app.poll(); app.key('2'); assert.equal(app.clicks.length, 0);
  app.state(snapshot); app.change({ keyboard: false }); assert.equal(app.key('b').prevented, undefined);
  app.change({ keyboard: true }); app.key('b'); app.document.visibilityState = 'hidden'; app.docListeners.visibilitychange(); app.key('2'); assert.equal(app.clicks.length, 0);
});

test('promotion keys select host pieces and suspend coordinate input', async () => {
  for (const key of ['q', 'r', 'b', 'n']) {
    const app = harness(); await flush(); app.picker(key);
    app.key('a'); app.key('8'); assert.equal(app.clicks.length, 0);
    assert.equal(app.key(key).prevented, true); assert.deepEqual(app.clicks, [key]);
  }
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function popupHarness() {
  const load = deferred(), save = deferred(), writes = [], elements = {};
  let changed;
  for (const id of ['keyboard-enabled', 'assist-save-status']) {
    elements['#' + id] = { disabled: true, checked: false, addEventListener(type, fn) { this[type] = fn; } };
  }
  const c = vm.createContext({ document: { querySelector: id => elements[id] }, chrome: { storage: {
    local: { get: () => load.promise, set: async value => { await save.promise; writes.push(plain(value)); } },
    onChanged: { addListener: fn => { changed = fn; } },
  } } });
  run(c, 'settings.js'); run(c, 'assist-popup.js');
  return { load, save, writes, keyboard: elements['#keyboard-enabled'], status: elements['#assist-save-status'],
    change: (value, area = 'local') => changed({ boardAssistPreferences: { newValue: value } }, area) };
}

test('helper popup protects delayed reads/saves and keeps separate local preferences', async () => {
  const app = popupHarness(); assert.equal(app.keyboard.disabled, true);
  app.change({ keyboard: true, ticking: true });
  app.load.resolve({ boardAssistPreferences: {} }); await flush();
  assert.equal(app.keyboard.checked, true);
  app.keyboard.checked = false;
  const pending = app.keyboard.change(); assert.equal(app.keyboard.disabled, true);
  await app.keyboard.change(); assert.equal(app.writes.length, 0);
  app.change({ keyboard: true, ticking: false });
  app.save.resolve(); await pending;
  assert.equal(app.keyboard.checked, true);
  assert.deepEqual(app.writes, [{ boardAssistPreferences: { keyboard: false } }]);
  app.change({ keyboard: false, ticking: true }, 'sync'); assert.equal(app.keyboard.checked, true);
});

test('helper popup recovers from load and save failures', async () => {
  const app = popupHarness(); app.load.reject(Error('Read failed')); await flush();
  assert.equal(app.keyboard.disabled, false); assert.equal(app.keyboard.checked, false);
  app.keyboard.checked = true; const pending = app.keyboard.change();
  app.save.reject(Error('Save failed')); await pending;
  assert.equal(app.keyboard.checked, false); assert.match(app.status.textContent, /Could not save/);
});

test('bridge snapshots are read-only, identify game replacement and reject unsupported modes', () => {
  let listener, result, game = {
    getMode: () => ({ name: 'playing' }), getPlayingAs: () => 2, getVariant: () => 'chess',
    getFEN: () => snapshot.fen, getOptions: () => ({ flipped: true }), getResult: () => '*',
    isAtEndOfLine: () => true, isDragging: () => false, isAnimating: () => false,
  };
  class Element { constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-single'; } get game() { return game; } dispatchEvent(event) { result = JSON.parse(event.detail); } }
  const location = { pathname: '/play/online' };
  const c = vm.createContext({ HTMLElement: Element, location,
    document: { addEventListener: (type, fn) => { listener = fn; } },
    CustomEvent: class { constructor(type, options) { Object.assign(this, options); } },
  });
  run(c, 'assist-bridge.js'); const board = new Element(); listener({ target: board });
  assert.equal(result.context, 'human'); assert.equal(result.side, 'black'); assert.equal(result.active, true);
  const first = result.session; listener({ target: board }); assert.equal(result.session, first);
  game = { ...game }; listener({ target: board }); assert.notEqual(result.session, first);
  game.getMode = () => ({ name: 'observing' }); listener({ target: board }); assert.equal(result, null);
  game.getMode = () => ({ name: 'playing' }); game.getVariant = () => 'crazyhouse'; listener({ target: board }); assert.equal(result, null);
  game.getVariant = () => 'chess'; location.pathname = '/analysis/classroom'; listener({ target: board }); assert.equal(result, null);
});

test('coordinate and promotion actions use host pointer events without calling game.move', () => {
  const events = [], docEvents = [];
  const c = vm.createContext({ document: { dispatchEvent: e => docEvents.push(e) }, PointerEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
  run(c, 'assist-board.js');
  const element = { isConnected: true, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }), dispatchEvent: e => events.push(e) };
  assert.equal(c.ChessBoardAssist.clickSquare(element, 'b2', snapshot), true);
  assert.equal(events[0].type, 'pointerdown'); assert.equal(events[0].clientX, 150); assert.equal(events[0].clientY, 650);
  assert.equal(docEvents[0].type, 'pointerup'); assert.equal(docEvents[0].buttons, 0);
  assert.equal(c.ChessBoardAssist.clickPromotion(element), true);
  assert.equal(events[1].clientX, 400);
  element.isConnected = false; assert.equal(c.ChessBoardAssist.clickPromotion(element), false);
});
