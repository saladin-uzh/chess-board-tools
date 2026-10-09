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
for (const file of ['settings.js', 'assist-board.js', 'assist-timer.js']) run(context, file);
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
  assert.deepEqual(plain(s.normalizeAssist({ keyboard: 'true', ticking: 1 })), { keyboard: false, ticking: false });
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

test('timer signals at 10-second boundaries, skips backlog and resets for new turns and sessions', () => {
  const timer = context.ChessAssistTimer.createTurnTimer();
  assert.equal(timer.update(snapshot, 0, true), false);
  assert.equal(timer.update(snapshot, 9999, true), false);
  assert.equal(timer.update(snapshot, 10000, true), true);
  assert.equal(timer.update(snapshot, 10100, true), false);
  assert.equal(timer.update(snapshot, 35000, true), true);
  assert.equal(timer.update(snapshot, 35100, true), false);
  assert.equal(timer.update(snapshot, 40000, false), false);
  assert.equal(timer.update(snapshot, 40100, true), false);
  assert.equal(timer.update(snapshot, 50000, true), true);
  const opponent = { ...snapshot, turn: 'black' };
  assert.equal(timer.update(opponent, 51000, true), false);
  assert.equal(timer.update(snapshot, 60000, true), false);
  assert.equal(timer.update(snapshot, 70000, true), true);
  assert.equal(timer.update({ ...snapshot, session: 2 }, 71000, true), false);
  assert.equal(timer.update({ ...snapshot, active: false }, 90000, true), false);
  for (const input of [null, { ...snapshot, side: null }, { ...snapshot, context: 'analysis' }]) assert.equal(timer.update(input, 100000, true), false);
});

test('pending confirmation remains part of the same own turn', () => {
  const timer = context.ChessAssistTimer.createTurnTimer();
  timer.update(snapshot, 0, true);
  const pending = { ...snapshot, turn: 'black', fen: snapshot.fen.replace(' w ', ' b ') };
  assert.equal(timer.update(pending, 10000, true, true), true);
  assert.equal(timer.update(pending, 20000, true, true), true);
  assert.equal(timer.update(pending, 21000, true, false), false);
  assert.equal(timer.update(snapshot, 30000, true), false);
});

test('audio waits for gesture, releases nodes and tolerates blocked or missing audio', async () => {
  const events = []; let resumes = 0;
  class Audio {
    constructor() { this.state = 'suspended'; this.currentTime = 1; }
    async resume() { resumes++; this.state = 'running'; }
    createOscillator() { return { frequency: {}, connect() {}, start() { events.push('start'); }, stop() { this.onended(); }, disconnect() { events.push('disconnect'); } }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    async close() { events.push('close'); }
  }
  const c = vm.createContext({ AudioContext: Audio }); run(c, 'assist-timer.js');
  const audio = c.ChessAssistTimer.createAudio(); audio.tick(); assert.equal(events.length, 0);
  audio.unlock(); await flush(); audio.tick(); assert.deepEqual(events, ['start', 'disconnect']);
  audio.close(); await flush(); assert.equal(events.at(-1), 'close');
  const blocked = vm.createContext({ AudioContext: class { constructor() { throw Error('Blocked'); } } }); run(blocked, 'assist-timer.js');
  const failed = blocked.ChessAssistTimer.createAudio(); failed.unlock(); failed.unlock(); failed.tick();
  const rejected = vm.createContext({ AudioContext: class { constructor() { this.state = 'suspended'; } resume() { resumes++; return Promise.reject(Error('Denied')); } } }); run(rejected, 'assist-timer.js');
  const denied = rejected.ChessAssistTimer.createAudio(); denied.unlock(); await flush(); denied.unlock(); denied.tick();
  assert.equal(resumes, 2);
});

function harness({ realTimer = false } = {}) {
  const listeners = {}, docListeners = {}, timeouts = new Map(), intervals = new Map(), clicks = [], timerCalls = [], timerResets = [], ticks = [], unlocks = [];
  let now = 0, serial = 0, changed, current = { ...snapshot, context: 'analysis', active: false, side: null }, board, confirmation;
  class Element {
    constructor() { this.isConnected = true; this.style = {}; this.picker = null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 800 }; }
    append(child) { (this.children ??= []).push(child); }
    getAttribute() { return null; }
    setAttribute() {}
    remove() { this.removed = true; }
    querySelector() { return this.picker; }
  }
  board = new Element();
  const document = { activeElement: null, visibilityState: 'visible', body: { append() {} },
    querySelector: selector => selector.startsWith('wc-') ? board : selector.startsWith('div.confirm-') ? confirmation : null,
    createElement: () => new Element(), addEventListener: (type, fn) => { docListeners[type] = fn; } };
  const c = vm.createContext({ document, navigator: { userActivation: { isActive: true } }, location: { pathname: '/analysis' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', pointerEvents: 'auto' }),
    performance: { now: () => now },
    setTimeout: (fn, delay) => { const id = ++serial; timeouts.set(id, { fn, due: now + delay }); return id; },
    clearTimeout: id => timeouts.delete(id), setInterval: fn => { const id = ++serial; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    chrome: { storage: { local: { get: async () => ({ boardAssistPreferences: { keyboard: true } }) }, onChanged: { addListener: fn => { changed = fn; } } } },
    ChessBoardAssist: { read: () => current, clickSquare: (b, square) => { clicks.push(square); return true; }, clickPromotion: p => { clicks.push(p.piece); return true; } },
    ChessAssistTimer: { createTurnTimer: () => ({ reset() { timerResets.push(true); }, update(...args) { timerCalls.push(args); return false; } }), createAudio: () => ({ unlock() { unlocks.push(now); }, close() {}, tick() { ticks.push(now); } }) },
  });
  run(c, 'settings.js');
  if (realTimer) {
    const createAudio = c.ChessAssistTimer.createAudio;
    run(c, 'assist-timer.js');
    c.ChessAssistTimer = { ...c.ChessAssistTimer, createAudio };
  }
  run(c, 'assist-content.js');
  function dispatch(type, event = {}) { event.type = type; for (const fn of listeners[type] || []) fn(event); }
  return { document, get board() { return board; }, clicks, ticks, unlocks, navigator: c.navigator, timerCalls, timerResets, listeners, docListeners,
    key(key, extra = {}) { const e = { key, code: key === 'Escape' ? 'Escape' : '', target: {}, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...extra }; dispatch('keydown', e); return e; },
    activation(value) { c.navigator = value; },
    dispatch, advance(ms) { now += ms; for (const [id, t] of timeouts) if (t.due <= now) { timeouts.delete(id); t.fn(); } },
    poll() { for (const fn of intervals.values()) fn(); },
    confirm(value = true) { confirmation = value ? new Element() : null; },
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
  for (const id of ['keyboard-enabled', 'ticking-enabled', 'assist-save-status']) {
    elements['#' + id] = { disabled: true, checked: false, addEventListener(type, fn) { this[type] = fn; } };
  }
  const c = vm.createContext({ document: { querySelector: id => elements[id] }, chrome: { storage: {
    local: { get: () => load.promise, set: async value => { await save.promise; writes.push(plain(value)); } },
    onChanged: { addListener: fn => { changed = fn; } },
  } } });
  run(c, 'settings.js'); run(c, 'assist-popup.js');
  return { load, save, writes, keyboard: elements['#keyboard-enabled'], ticking: elements['#ticking-enabled'], status: elements['#assist-save-status'],
    change: (value, area = 'local') => changed({ boardAssistPreferences: { newValue: value } }, area) };
}

test('helper popup protects delayed reads/saves and keeps separate local preferences', async () => {
  const app = popupHarness(); assert.equal(app.keyboard.disabled, true);
  app.change({ keyboard: true, ticking: true });
  app.load.resolve({ boardAssistPreferences: {} }); await flush();
  assert.equal(app.keyboard.checked, true); assert.equal(app.ticking.checked, true);
  app.keyboard.checked = false;
  const pending = app.keyboard.change(); assert.equal(app.ticking.disabled, true);
  await app.ticking.change(); assert.equal(app.writes.length, 0);
  app.change({ keyboard: true, ticking: false });
  app.save.resolve(); await pending;
  assert.equal(app.keyboard.checked, true); assert.equal(app.ticking.checked, false);
  assert.deepEqual(app.writes, [{ boardAssistPreferences: { keyboard: false, ticking: true } }]);
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


test('dragging does not restart the turn timer or accumulate missed ticks', () => {
  const timer = context.ChessAssistTimer.createTurnTimer(); timer.update(snapshot, 0, true);
  assert.equal(timer.update({ ...snapshot, stable: false }, 5000, true), false);
  assert.equal(timer.update({ ...snapshot, stable: false }, 10000, true), false);
  assert.equal(timer.update(snapshot, 11000, true), false);
  assert.equal(timer.update(snapshot, 20000, true), true);
});


test('returning from a throttled background tab consumes missed deadlines silently', async () => {
  const app = harness(); await flush(); app.change({ ticking: true });
  app.document.visibilityState = 'hidden'; app.docListeners.visibilitychange();
  app.advance(35000);
  app.document.visibilityState = 'visible'; app.poll();
  assert.equal(app.timerCalls.at(-1)[2], false);
  app.poll(); assert.equal(app.timerCalls.at(-1)[2], true);
});

test('keyboard preference changes do not restart an enabled turn timer', async () => {
  const app = harness(); await flush(); app.change({ keyboard: true, ticking: true });
  const resets = app.timerResets.length;
  app.change({ keyboard: false, ticking: true });
  assert.equal(app.timerResets.length, resets);
  app.change({ keyboard: false, ticking: false });
  assert.equal(app.timerResets.length, resets + 1);
});

test('black own turns use authoritative color rather than board orientation', () => {
  const timer = context.ChessAssistTimer.createTurnTimer();
  const black = { ...snapshot, side: 'black', turn: 'black', fen: snapshot.fen.replace(' w ', ' b ') };
  assert.equal(timer.update(black, 0, true), false);
  assert.equal(timer.update({ ...black, flipped: true }, 10000, true), true);
  assert.equal(timer.update({ ...black, turn: 'white' }, 20000, true), false);
});

test('real content timer survives board replacement at nine seconds', async () => {
  const app = harness({ realTimer: true }); await flush();
  app.state(snapshot); app.change({ ticking: true });
  app.advance(9000); app.replace(); app.poll();
  app.advance(1000); app.poll(); assert.deepEqual(app.ticks, [10000]);
});

test('missing snapshots keep elapsed time but never replay unavailable deadlines', async () => {
  const app = harness({ realTimer: true }); await flush();
  app.state(snapshot); app.change({ ticking: true });
  app.advance(9000); app.state(null); app.poll();
  app.advance(2500); app.state(snapshot); app.replace(); app.poll();
  assert.deepEqual(app.ticks, []);
  app.advance(8500); app.poll(); assert.deepEqual(app.ticks, [20000]);
  app.state(null); app.advance(10000); app.poll();
  app.state(snapshot); app.poll(); assert.deepEqual(app.ticks, [20000]);
  app.state({ ...snapshot, session: 2 }); app.poll();
  app.advance(9999); app.poll(); assert.deepEqual(app.ticks, [20000]);
  app.advance(1); app.poll(); assert.deepEqual(app.ticks, [20000, 40000]);
});

test('pending confirmation cannot preserve another session or player color', () => {
  for (const change of [{ session: 2 }, { side: 'black', turn: 'black' }]) {
    const timer = context.ChessAssistTimer.createTurnTimer(); timer.update(snapshot, 0, true);
    const next = { ...snapshot, ...change };
    assert.equal(timer.update(next, 9000, true, true), false);
    assert.equal(timer.update(next, 10000, true, true), false);
    assert.equal(timer.update(next, 19000, true, true), true);
  }
  const timer = context.ChessAssistTimer.createTurnTimer(); timer.update(snapshot, 0, true);
  assert.equal(timer.update({ ...snapshot, session: 2, turn: 'black' }, 10000, true, true), false);
});

test('stale audio resume resolve and reject cannot affect a reopened context', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const instances = [], ticks = [];
    class Audio {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.pending = deferred(); this.resumes = 0; instances.push(this); }
      resume() { this.resumes++; return this.pending.promise; }
      close() { this.state = 'closed'; return Promise.resolve(); }
      createOscillator() { return { frequency: {}, connect() {}, disconnect() {}, start() { ticks.push(true); }, stop() { this.onended(); } }; }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    }
    const c = vm.createContext({ AudioContext: Audio }); run(c, 'assist-timer.js');
    const audio = c.ChessAssistTimer.createAudio(); audio.unlock();
    const old = instances[0]; audio.close(); audio.unlock();
    assert.equal(instances.length, 2);
    old.pending[outcome](outcome === 'reject' ? Error('Old context closed') : undefined); await flush();
    audio.unlock(); assert.equal(instances[1].resumes, 1);
    instances[1].state = 'running'; instances[1].pending.resolve(); await flush();
    audio.tick(); assert.deepEqual(ticks, [true]);
    audio.close(); audio.unlock(); assert.equal(instances.length, 3);
  }
});

test('audio unlock accepts only trusted activating input in visible tabs', async () => {
  const app = harness(); await flush(); app.change({ ticking: true });
  const allowed = [['pointerdown', { pointerType: 'mouse' }], ['pointerup', { pointerType: 'touch' }],
    ['pointerup', { pointerType: 'pen' }], ['keydown', { key: 'a' }], ['keydown', { key: 'Enter' }], ['keydown', { key: 'A', shiftKey: true }]];
  for (const [type, event] of allowed) {
    const before = app.unlocks.length; app.dispatch(type, { isTrusted: true, ...event });
    assert.equal(app.unlocks.length, before + 1);
  }
  const denied = [['pointerdown', { pointerType: 'touch' }], ['pointerdown', { pointerType: 'pen' }],
    ['pointerup', { pointerType: 'mouse' }], ['pointerup', {}], ['keydown', { key: 'Escape' }],
    ['keydown', { key: 'a', code: 'Escape' }], ['keydown', { key: 'a', repeat: true }],
    ...['Control', 'Meta', 'Alt', 'Shift', 'AltGraph', 'Fn'].map(key => ['keydown', { key }]),
    ...['ctrlKey', 'metaKey', 'altKey'].map(flag => ['keydown', { key: 'a', [flag]: true }])];
  const count = app.unlocks.length;
  for (const [type, event] of denied) app.dispatch(type, { isTrusted: true, ...event });
  app.dispatch('pointerdown', { pointerType: 'mouse', isTrusted: false });
  app.key('a', { isTrusted: false });
  app.document.visibilityState = 'hidden'; app.key('a', { isTrusted: true });
  app.document.visibilityState = 'visible'; app.navigator.userActivation.isActive = false;
  app.key('a', { isTrusted: true });
  app.activation(undefined); app.dispatch('pointerdown', { pointerType: 'mouse', isTrusted: true });
  app.activation({}); app.key('a', { isTrusted: true });
  assert.equal(app.unlocks.length, count);
  app.activation({ userActivation: { isActive: true } }); app.change({ ticking: false });
  app.key('a', { isTrusted: true }); assert.equal(app.unlocks.length, count);
});

test('audio activation leaves ordinary key and pointer events untouched', async () => {
  const app = harness(); await flush(); app.change({ ticking: true });
  assert.equal(app.key('a', { isTrusted: true }).prevented, undefined);
  app.dispatch('pointerup', { isTrusted: true, pointerType: 'touch', preventDefault() { assert.fail('Consumed pointer event'); }, stopImmediatePropagation() { assert.fail('Stopped pointer event'); } });
  assert.equal(app.unlocks.length, 2);
});

test('enabling or loading ticks during pending confirmation starts a fresh clock', async () => {
  for (const loading of [false, true]) {
    const app = harness({ realTimer: true }); await flush();
    app.state({ ...snapshot, turn: 'black', fen: snapshot.fen.replace(' w ', ' b ') }); app.confirm();
    if (loading) { app.change({ ticking: true }); app.dispatch('pagehide'); app.dispatch('pageshow'); }
    else { app.advance(5000); app.change({ ticking: true }); }
    app.advance(9999); app.poll(); assert.deepEqual(app.ticks, []);
    app.advance(1); app.poll(); assert.deepEqual(app.ticks, [loading ? 10000 : 15000]);
    app.advance(10000); app.poll(); assert.equal(app.ticks.length, 2);
    app.confirm(false); app.poll(); app.advance(10000); app.poll(); assert.equal(app.ticks.length, 2);
  }
});

test('a stale confirmation button cannot start ticking in another session or color', async () => {
  for (const change of [{ session: 2 }, { side: 'black' }]) {
    const app = harness({ realTimer: true }); await flush();
    app.state(snapshot); app.confirm(); app.change({ ticking: true });
    const next = { ...snapshot, ...change, turn: change.side ? 'white' : 'black' };
    app.state(next); app.poll(); app.advance(10000); app.poll(); app.advance(10000); app.poll();
    assert.deepEqual(app.ticks, []);
    app.change({ ticking: false }); app.change({ ticking: true });
    app.advance(10000); app.poll(); assert.deepEqual(app.ticks, []);
    app.confirm(false); app.poll(); app.confirm(); app.poll();
    app.advance(10000); app.poll(); assert.equal(app.ticks.length, 1);
  }
});

test('completed observing review is accepted without enabling own-turn ticks', async () => {
  const review = { ...snapshot, context: 'review', active: false, result: '1-0' };
  const board = { id: 'board-single', isConnected: true };
  for (const path of ['/game/live/123', '/game/daily/123/']) {
    assert.equal(context.ChessBoardAssist.validate(JSON.stringify(review), board, path).context, 'review');
  }
  for (const change of [{ result: '*' }, { result: null }, { active: true }]) {
    assert.equal(context.ChessBoardAssist.validate(JSON.stringify({ ...review, ...change }), board, '/game/live/123'), null);
  }
  assert.equal(context.ChessBoardAssist.validate(JSON.stringify(review), board, '/play/online'), null);
  const app = harness({ realTimer: true }); await flush(); app.state(review); app.change({ keyboard: true, ticking: true });
  app.key('b'); app.key('2'); assert.deepEqual(app.clicks, ['b2']);
  app.advance(10000); app.poll(); assert.deepEqual(app.ticks, []);
});

test('keyboard selection shows the file immediately, then the square, in both orientations', async () => {
  for (const flipped of [false, true]) {
    const app = harness(); await flush(); app.state({ ...snapshot, context: 'analysis', active: false, flipped });
    app.key('b');
    const file = app.board.children.at(-1);
    assert.equal(file.className, 'chess-assist-file'); assert.equal(file.style.left, flipped ? '75%' : '12.5%');
    app.key('2'); assert.equal(file.removed, true);
    const square = app.board.children.at(-1);
    assert.equal(square.className, 'chess-assist-square');
    assert.equal(square.style.left, flipped ? '75%' : '12.5%'); assert.equal(square.style.top, flipped ? '12.5%' : '75%');
    app.key('c'); assert.notEqual(square.removed, true);
    app.key('Escape'); assert.equal(square.removed, true);
    const pendingFile = app.board.children.at(-1); assert.equal(pendingFile.removed, true);
    app.key('a'); const expired = app.board.children.at(-1); app.advance(5000); assert.equal(expired.removed, true);
    app.key('b'); app.key('2'); const selected = app.board.children.at(-1);
    app.state({ ...snapshot, fen: snapshot.fen.replace(' w ', ' b ') }); app.poll(); assert.equal(selected.removed, true);
  }
});

test('assist bridge gates observing review on a completed standard game', () => {
  let handler, response, mode = 'observing', result = '1-0', variant = 'chess';
  class Element { constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-single'; }
    dispatchEvent(event) { response = JSON.parse(event.detail); } }
  const board = new Element(); board.game = {
    getMode: () => ({ name: mode }), getResult: () => result, getVariant: () => variant,
    getFEN: () => snapshot.fen, getPlayingAs: () => undefined, getOptions: () => ({ flipped: false }),
    isDragging: () => false, isAnimating: () => false,
  };
  const c = vm.createContext({ HTMLElement: Element, location: { pathname: '/game/live/123' },
    document: { addEventListener: (type, fn) => { handler = fn; } },
    CustomEvent: class { constructor(type, options) { Object.assign(this, options); } } });
  run(c, 'assist-bridge.js'); handler({ target: board });
  assert.equal(response.context, 'review'); assert.equal(response.active, false); assert.equal(response.result, '1-0');
  result = '*'; handler({ target: board }); assert.equal(response, null);
  result = '1-0'; variant = 'chess960'; handler({ target: board }); assert.equal(response, null);
  variant = 'chess'; mode = 'unknown'; handler({ target: board }); assert.equal(response, null);
});
