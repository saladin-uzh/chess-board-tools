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
const snapshot = { session: 1, context: 'bot', fen: '7k/8/8/8/8/8/P7/7K w - - 0 1', side: 'white', turn: 'white', active: true, stable: true, flipped: false, initialSeconds: 1200 };

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
  assert.deepEqual(plain(s.normalizeAssist({ keyboard: 'true', ticking: 1 })), { keyboard: false, ticking: false, tickMode: 'auto', tickFrequency: 10, tickVolume: 50 });
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

test('human game routes accept numeric IDs without requiring a live or daily prefix', () => {
  const board = { id: 'board-single', isConnected: true };
  const validate = (route, b = board) => context.ChessBoardAssist.validate(JSON.stringify({ ...snapshot, context: 'human' }), b, route);
  for (const route of ['/game/123', '/game/123/', '/game/live/123', '/game/daily/123', '/play/online', '/play/daily']) {
    assert.equal(validate(route)?.context, 'human', route);
  }
  for (const route of ['/game/', '/game/live', '/game/abc', '/game/123/analysis', '/game/computer/123', '/games/123']) {
    assert.equal(validate(route), null, route);
  }
  assert.equal(validate('/game/123', { ...board, id: 'board-analysis-board' }), null);
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
  let candidates = null;
  const clickedBoards = [], cancelledBoards = [];
  let now = 0, serial = 0, changed, current = { ...snapshot, context: 'analysis', active: false, side: null }, board, confirmation;
  class Element {
    constructor() { this.tagName = "WC-CHESS-BOARD"; this.isConnected = true; this.style = {}; this.picker = null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 800 }; }
    append(child) { (this.children ??= []).push(child); }
    getAttribute() { return null; }
    setAttribute() {}
    remove() { this.removed = true; }
    querySelector() { return this.picker; }
  }
  board = new Element(); board.id = 'board-single';
  const document = { activeElement: null, visibilityState: 'visible', body: { append() {} },
    querySelectorAll: () => candidates || [board],
    querySelector: selector => selector.startsWith('wc-') ? board : selector.startsWith('div.confirm-') ? confirmation : null,
    createElement: () => new Element(), addEventListener: (type, fn) => { docListeners[type] = fn; } };
  const c = vm.createContext({ document, navigator: { userActivation: { isActive: true } }, location: { pathname: '/analysis' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', pointerEvents: 'auto' }),
    performance: { now: () => now },
    setTimeout: (fn, delay) => { const id = ++serial; timeouts.set(id, { fn, due: now + delay }); return id; },
    clearTimeout: id => timeouts.delete(id), setInterval: fn => { const id = ++serial; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    chrome: { storage: { local: { get: async () => ({ boardAssistPreferences: { keyboard: true } }) }, onChanged: { addListener: fn => { changed = fn; } } } },
    ChessBoardAssist: { cancelPremoves: (b, state) => { if (!state?.active || !state?.stable || !state?.premoveCount) return false; cancelledBoards.push(b); return true; }, read: b => b.id === 'secondary' ? null : current, readCoordinates: () => current, clickSquare: (b, square) => { clickedBoards.push(b); clicks.push(square); return true; }, clickPromotion: p => { clicks.push(p.piece); return true; } },
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
  return { document, get board() { return board; }, clickedBoards, cancelledBoards, cancelPremoves: () => c.ChessAssistInput.cancelPremoves(), boards(value) { candidates = value; }, clicks, ticks, unlocks, navigator: c.navigator, timerCalls, timerResets, listeners, docListeners,
    key(key, extra = {}) { const e = { key, code: key === 'Escape' ? 'Escape' : '', target: {}, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...extra }; dispatch('keydown', e); return e; },
    activation(value) { c.navigator = value; },
    dispatch, advance(ms) { now += ms; for (const [id, t] of timeouts) if (t.due <= now) { timeouts.delete(id); t.fn(); } },
    poll() { for (const fn of intervals.values()) fn(); },
    confirm(value = true) { confirmation = value ? new Element() : null; },
    state(value) { current = value; }, replace() { board = new Element(); board.id = 'board-single'; },
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

test('a repeated file key cancels only the file buffer and keeps the selected piece', async () => {
  const app = harness(); await flush();
  app.key('b'); app.key('2');
  const selected = app.board.children.find(child => child.className === 'chess-assist-square');
  app.key('c'); assert.equal(app.key('c').prevented, true); app.key('4');
  assert.deepEqual(app.clicks, ['b2']); assert.equal(selected.removed, undefined);
  app.key('c'); app.key('d'); app.key('4');
  assert.deepEqual(app.clicks, ['b2', 'd4']);
  app.key('b'); app.key('b', { repeat: true }); app.key('3');
  assert.equal(app.clicks.at(-1), 'b3');
});

test('tick settings migrate old records and reject invalid values', () => {
  const normalize = value => plain(context.ChessConfirmMoveSettings.normalizeAssist(value));
  assert.deepEqual(normalize({ keyboard: true, ticking: true }), {
    keyboard: true, ticking: true, tickMode: 'auto', tickFrequency: 10, tickVolume: 50,
  });
  for (const input of [{ tickMode: 'bad', tickVolume: NaN }, { tickVolume: -1 }, { tickVolume: 101 }, { tickVolume: '50' }]) {
    assert.equal(normalize(input).tickVolume, 50);
  }
  for (const seconds of [2, 5, 10, 15, 20, 30]) assert.equal(normalize({ tickMode: 'amount', tickFrequency: seconds }).tickFrequency, seconds);
  assert.equal(normalize({ tickMode: 'amount', tickFrequency: 3 }).tickFrequency, 10);
  assert.equal(normalize({ tickVolume: 0 }).tickVolume, 0);
});

test('tick frequency uses initial time, ceil, increment fallback and fixed amounts', () => {
  const { frequency } = context.ChessAssistTimer;
  for (const [initialSeconds, expected] of [[60, 2], [300, 3], [1800, 15], [5400, 30]]) {
    assert.equal(frequency({ initialSeconds, incrementSeconds: 10 }, { tickMode: 'auto' }), expected);
  }
  assert.equal(frequency({ initialSeconds: 300, incrementSeconds: 2 }, { tickMode: 'increment' }), 2);
  assert.equal(frequency({ initialSeconds: 300, incrementSeconds: 0 }, { tickMode: 'increment' }), 3);
  assert.equal(frequency({ initialSeconds: 300 }, { tickMode: 'increment' }), 3);
  assert.equal(frequency({ incrementSeconds: 45 }, { tickMode: 'increment' }), 45);
  assert.equal(frequency(null, { tickMode: 'auto' }), null);
  assert.equal(frequency({ initialSeconds: null, incrementSeconds: 0 }, { tickMode: 'increment' }), null);
  for (const tickFrequency of [2, 5, 10, 15, 20, 30]) assert.equal(frequency(null, { tickMode: 'amount', tickFrequency }), tickFrequency);
});

test('frequency changes restart deadlines while volume changes preserve the current turn', () => {
  const timer = context.ChessAssistTimer.createTurnTimer();
  const state = { ...snapshot, initialSeconds: 300, incrementSeconds: 2 };
  const auto = { tickMode: 'auto', tickVolume: 50 };
  assert.equal(timer.update(state, 0, true, false, auto), false);
  assert.equal(timer.update(state, 2999, true, false, auto), false);
  assert.equal(timer.update(state, 3000, true, false, { ...auto, tickVolume: 0 }), true);
  assert.equal(timer.update(state, 4000, true, false, { tickMode: 'increment' }), false);
  assert.equal(timer.update(state, 5999, true, false, { tickMode: 'increment' }), false);
  assert.equal(timer.update(state, 6000, true, false, { tickMode: 'increment' }), true);
  assert.equal(timer.update(state, 20000, false, false, { tickMode: 'increment' }), false);
  assert.equal(timer.update(state, 20001, true, false, { tickMode: 'increment' }), false);
  assert.equal(timer.update(state, 22000, true, false, { tickMode: 'increment' }), true);
});

test('Auto stays silent without initial time and resumes with a fresh interval when time becomes available', () => {
  const timer = context.ChessAssistTimer.createTurnTimer();
  const unknown = { ...snapshot, initialSeconds: null, incrementSeconds: null };
  const auto = { tickMode: 'auto' };
  assert.equal(timer.update(unknown, 0, true, false, auto), false);
  assert.equal(timer.update(unknown, 30000, true, true, auto), false);
  assert.equal(timer.update(snapshot, 31000, true, false, auto), false);
  assert.equal(timer.update(snapshot, 41000, true, false, auto), true);
  assert.equal(timer.update(unknown, 42000, true, false, auto), false);
  assert.equal(timer.update(snapshot, 100000, true, false, auto), false);
  assert.equal(timer.update(snapshot, 110000, true, false, auto), true);
  const amount = { tickMode: 'amount', tickFrequency: 2 };
  assert.equal(timer.update(unknown, 120000, true, false, amount), false);
  assert.equal(timer.update(unknown, 122000, true, false, amount), true);
});

test('audio volume defaults to 50 percent, supports mute and bounds peak gain', () => {
  const peaks = []; let nodes = 0;
  class Audio {
    constructor() { this.state = 'running'; this.currentTime = 0; }
    createOscillator() { nodes++; return { frequency: {}, connect() {}, disconnect() {}, start() {}, stop() { this.onended(); } }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime(value) { peaks.push(value); }, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const c = vm.createContext({ AudioContext: Audio }); run(c, 'assist-timer.js');
  const audio = c.ChessAssistTimer.createAudio(); audio.unlock();
  audio.tick(); audio.tick(100); audio.tick(0); audio.tick(-1); audio.tick(NaN);
  assert.deepEqual(peaks, [0.1, 0.2]); assert.equal(nodes, 2);
});

test('premove cancellation dispatches native right pointer events only for owned active games with a queue', () => {
  const events = [];
  const c = vm.createContext({ document: { dispatchEvent: e => events.push(e) },
    PointerEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
  run(c, 'assist-board.js');
  const board = { isConnected: true, getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 800 }),
    dispatchEvent: e => events.push(e) };
  const queued = { ...snapshot, context: 'human', turn: 'black', premoveCount: 3 };
  assert.equal(c.ChessBoardAssist.cancelPremoves(board, queued), true);
  assert.deepEqual(events.map(e => [e.type, e.button, e.buttons]), [['pointerdown', 2, 2], ['pointerup', 2, 0]]);
  assert.equal(events[0].clientX, 410); assert.equal(events[0].clientY, 420);
  for (const change of [{ premoveCount: 0 }, { side: null }, { active: false }, { stable: false }, { context: 'puzzle' }, { context: 'analysis' }]) {
    assert.equal(c.ChessBoardAssist.cancelPremoves(board, { ...queued, ...change }), false);
  }
  assert.equal(events.length, 2);
});

test('bridge reads clock milliseconds and premove count without mutating game state', () => {
  let listener, raw;
  const game = { getMode: () => ({ name: 'playing' }), getVariant: () => 'chess', getPlayingAs: () => 1,
    getFEN: () => snapshot.fen, getOptions: () => ({ flipped: false }), getResult: () => '*',
    isAtEndOfLine: () => true, isDragging: () => false, isAnimating: () => false,
    timeControl: { get: () => ({ baseTime: 300000, increment: 2000 }) }, premoves: { getQueue: () => [{}, {}] } };
  class Element { constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-single'; this.game = game; this.isConnected = true; } dispatchEvent(e) { raw = e.detail; } }
  const c = vm.createContext({ HTMLElement: Element, location: { pathname: '/play/online' },
    document: { addEventListener: (type, fn) => { if (type === 'chess-assist-request') listener = fn; } },
    CustomEvent: class { constructor(type, options) { Object.assign(this, options); } } });
  run(c, 'assist-bridge.js'); run(c, 'assist-board.js'); const board = new Element();
  listener({ type: 'chess-assist-request', target: board });
  let result = c.ChessBoardAssist.validate(raw, board, '/play/online');
  assert.equal(result.initialSeconds, 300); assert.equal(result.incrementSeconds, 2); assert.equal(result.premoveCount, 2);
  game.timeControl.get = () => { throw Error('Unavailable'); };
  listener({ type: 'chess-assist-request', target: board });
  result = c.ChessBoardAssist.validate(raw, board, '/play/online');
  assert.equal(result.initialSeconds, null); assert.equal(result.premoveCount, 2);
  for (const change of [{ initialSeconds: -1 }, { incrementSeconds: '2' }, { premoveCount: 1.5 }]) {
    assert.equal(c.ChessBoardAssist.validate(JSON.stringify({ ...result, ...change }), board, '/play/online'), null);
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
  for (const id of ['keyboard-enabled', 'ticking-enabled', 'tick-frequency', 'tick-volume', 'tick-volume-value', 'assist-save-status']) {
    elements['#' + id] = { disabled: true, checked: false, addEventListener(type, fn) { this[type] = fn; } };
  }
  const c = vm.createContext({ document: { querySelector: id => elements[id] }, chrome: { storage: {
    local: { get: () => load.promise, set: async value => { await save.promise; writes.push(plain(value)); } },
    onChanged: { addListener: fn => { changed = fn; } },
  } } });
  run(c, 'settings.js'); run(c, 'assist-popup.js'); c.ChessSettingsControllers.assist(c.document);
  return { load, save, writes, keyboard: elements['#keyboard-enabled'], ticking: elements['#ticking-enabled'], status: elements['#assist-save-status'], frequency: elements['#tick-frequency'], volume: elements['#tick-volume'], volumeValue: elements['#tick-volume-value'],
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
  assert.deepEqual(app.writes, [{ boardAssistPreferences: { keyboard: false, ticking: true, tickMode: 'auto', tickFrequency: 10, tickVolume: 50 } }]);
  app.change({ keyboard: false, ticking: true }, 'sync'); assert.equal(app.keyboard.checked, true);
});

test('helper popup recovers from load and save failures', async () => {
  const app = popupHarness(); app.load.reject(Error('Read failed')); await flush();
  assert.equal(app.keyboard.disabled, false); assert.equal(app.keyboard.checked, false);
  app.keyboard.checked = true; const pending = app.keyboard.change();
  app.save.reject(Error('Save failed')); await pending;
  assert.equal(app.keyboard.checked, false); assert.match(app.status.textContent, /Could not save/);
});

test('single frequency select and volume slider persist local tick preferences', async () => {
  const app = popupHarness(); app.load.resolve({ boardAssistPreferences: { ticking: true } }); await flush();
  assert.equal(app.frequency.value, 'auto'); assert.equal(app.volume.value, '50');
  app.frequency.value = '5'; app.volume.value = '0'; app.volume.input();
  assert.equal(app.volumeValue.textContent, '0%');
  const pending = app.frequency.change(); assert.equal(app.volume.disabled, true);
  app.save.resolve(); await pending;
  assert.deepEqual(app.writes[0].boardAssistPreferences, { keyboard: false, ticking: true, tickMode: 'amount', tickFrequency: 5, tickVolume: 0 });
  app.change({ ticking: true, tickMode: 'increment', tickVolume: 100 });
  assert.equal(app.frequency.value, 'increment'); assert.equal(app.volumeValue.textContent, '100%');
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

test('bridge and adapter recognize direct human game URLs and keep live-state guards', () => {
  let listener, result;
  const game = {
    getMode: () => ({ name: 'playing' }), getPlayingAs: () => 1, getVariant: () => 'chess',
    getFEN: () => snapshot.fen, getOptions: () => ({ flipped: false }), getResult: () => '*',
    isAtEndOfLine: () => true, isDragging: () => false, isAnimating: () => false,
  };
  class Element {
    constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-single'; this.isConnected = true; this.game = game; }
    dispatchEvent(event) { result = event.detail; }
  }
  const location = { pathname: '/game/123' };
  const c = vm.createContext({ HTMLElement: Element, location,
    document: { addEventListener: (type, fn) => { listener = fn; } },
    CustomEvent: class { constructor(type, options) { Object.assign(this, options); } },
  });
  run(c, 'assist-bridge.js'); run(c, 'assist-board.js');
  const board = new Element();
  const read = () => { listener({ target: board }); return c.ChessBoardAssist.validate(result, board, location.pathname); };
  for (const route of ['/game/123', '/game/123/', '/game/live/123', '/game/daily/123']) {
    location.pathname = route;
    assert.equal(read()?.context, 'human', route);
    assert.equal(read().active, true);
  }
  location.pathname = '/game/123';
  game.isAtEndOfLine = () => false; assert.equal(read().active, false);
  game.isAtEndOfLine = () => true;
  game.getResult = () => '1-0'; assert.equal(read().active, false);
  game.getResult = () => '*';
  game.isDragging = () => true; assert.equal(read().stable, false);
  game.isDragging = () => false;
  game.isAnimating = () => true; assert.equal(read().stable, false);
  game.isAnimating = () => false;
  game.getMode = () => ({ name: 'observing' }); assert.equal(read(), null);
  game.getMode = () => ({ name: 'playing' });
  game.getVariant = () => 'crazyhouse'; assert.equal(read(), null);
  game.getVariant = () => 'chess';
  location.pathname = '/game/123/analysis'; assert.equal(read(), null);
});

test('human keyboard actions require a stable snapshot regardless of active state', async () => {
  const app = harness(); await flush();
  app.state({ ...snapshot, context: 'human' });
  app.key('b'); app.key('2'); assert.deepEqual(app.clicks, ['b2']);
  for (const change of [{ stable: false }]) {
    app.state({ ...snapshot, context: 'human', ...change });
    assert.equal(app.key('b').prevented, undefined);
    app.key('3'); assert.deepEqual(app.clicks, ['b2']);
  }
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


test('daily in-page analysis uses keyboard input without own-turn ticks', async () => {
  let handler, raw, mode = 'analysis', variant = 'chess';
  const location = { pathname: '/game/daily/123' };
  class Element {
    constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-single'; this.isConnected = true; }
    dispatchEvent(event) { raw = event.detail; }
  }
  const board = new Element(); board.game = {
    getMode: () => ({ name: mode }), getResult: () => '*', getVariant: () => variant,
    getFEN: () => snapshot.fen, getPlayingAs: () => 1, getOptions: () => ({ flipped: true }),
    isDragging: () => false, isAnimating: () => false, isAtEndOfLine: () => false,
  };
  const c = vm.createContext({ HTMLElement: Element, location,
    document: { addEventListener: (type, fn) => { handler = fn; } },
    CustomEvent: class { constructor(type, options) { Object.assign(this, options); } } });
  run(c, 'assist-bridge.js'); run(c, 'assist-board.js');
  const read = () => { handler({ target: board }); return c.ChessBoardAssist.validate(raw, board, location.pathname); };
  const analysis = read();
  assert.equal(analysis?.context, 'analysis'); assert.equal(analysis.active, false);
  const app = harness({ realTimer: true }); await flush();
  app.state(analysis); app.change({ keyboard: true, ticking: true });
  app.key('b'); app.key('2'); assert.deepEqual(app.clicks, ['b2']);
  app.advance(10000); app.poll(); assert.deepEqual(app.ticks, []);
  location.pathname = '/game/daily/123/'; assert.equal(read().context, 'analysis');
  for (const route of ['/game/live/123', '/game/123', '/play/online', '/game/daily/abc', '/game/daily/123/other']) {
    location.pathname = route; assert.equal(read(), null, route);
  }
  location.pathname = '/game/daily/123';
  mode = 'observing'; assert.equal(read(), null);
  mode = 'unknown'; assert.equal(read(), null);
  mode = 'analysis'; variant = 'crazyhouse'; assert.equal(read(), null);
  variant = 'chess'; board.id = 'board-other'; assert.equal(read(), null);
  const forgedActive = { ...analysis, active: true };
  board.id = 'board-single'; assert.equal(c.ChessBoardAssist.validate(JSON.stringify(forgedActive), board, location.pathname), null);
});


test('completed direct-game analysis and review allow keyboard input but never ticks', async () => {
  let handler, raw, mode = 'playing', result = '*';
  const location = { pathname: '/game/123' };
  class Element {
    constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-single'; this.isConnected = true; }
    dispatchEvent(event) { raw = event.detail; }
  }
  const board = new Element(); board.game = {
    getMode: () => ({ name: mode }), getResult: () => result, getVariant: () => 'chess',
    getFEN: () => snapshot.fen, getPlayingAs: () => 1, getOptions: () => ({ flipped: false }),
    isDragging: () => false, isAnimating: () => false, isAtEndOfLine: () => true,
  };
  const c = vm.createContext({ HTMLElement: Element, location,
    document: { addEventListener: (type, fn) => { handler = fn; } },
    CustomEvent: class { constructor(type, options) { Object.assign(this, options); } } });
  run(c, 'assist-bridge.js'); run(c, 'assist-board.js');
  const read = () => { handler({ target: board }); return c.ChessBoardAssist.validate(raw, board, location.pathname); };
  const app = harness({ realTimer: true }); await flush();
  app.change({ keyboard: true, ticking: true }); app.state(read()); app.key('b');
  for (const route of ['/game/123', '/game/123/', '/game/live/123']) {
    location.pathname = route;
    for (const nextMode of ['analysis', 'observing']) {
      mode = nextMode; result = '*'; assert.equal(read(), null);
      for (const completed of ['1-0', '0-1', '1/2-1/2']) {
        result = completed; const state = read();
        assert.equal(state.context, mode === 'analysis' ? 'analysis' : 'review');
        assert.equal(state.active, false);
        app.state(state); app.poll(); app.key('b'); app.key('2'); app.key('b'); app.key('3');
        assert.deepEqual(app.clicks.slice(-2), ['b2', 'b3']);
        app.advance(10000); app.poll(); assert.deepEqual(app.ticks, []);
        assert.equal(c.ChessBoardAssist.validate(JSON.stringify({ ...state, active: true }), board, route), null);
      }
    }
  }
  for (const route of ['/game/abc', '/game/123/other', '/play/online']) {
    location.pathname = route; assert.equal(read(), null);
  }
});


test('mode and active-state transitions clear buffered files and square indicators', async () => {
  const analysis = { ...snapshot, context: 'analysis', active: false };
  const human = { ...snapshot, context: 'human', active: true };
  for (const [before, after] of [[analysis, human], [human, analysis],
    [human, { ...human, active: false }], [{ ...human, active: false }, human]]) {
    const app = harness(); await flush(); app.state(before);
    if (before.active || before.context === 'analysis') {
      app.key('b'); app.key('2');
      const square = app.board.children.at(-1);
      app.key('c'); const file = app.board.children.at(-1);
      const count = app.clicks.length;
      app.state(after); app.key('3');
      assert.equal(app.clicks.length, count);
      assert.equal(file.removed, true); assert.equal(square.removed, true);
    } else {
      app.state(human); app.key('b');
      app.state(before); app.poll(); app.state(after); app.key('2');
      assert.deepEqual(app.clicks, []);
    }
  }
});

test('coordinate input works across routes, modes and variants without enabling spectator ticks', async () => {
  const handlers = {}; let raw, flipped = false, stable = true;
  class Element {
    constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-other'; this.isConnected = true; }
    dispatchEvent(event) { raw = event.detail; }
  }
  const board = new Element();
  // Coordinate input does not require playing mode, ownership or standard-chess APIs.
  board.game = { getFEN: () => 'variant position', getOptions: () => ({ flipped }),
    isDragging: () => !stable, isAnimating: () => false };
  const location = { pathname: '/game/186049589091' };
  const c = vm.createContext({ HTMLElement: Element, location,
    document: { addEventListener: (type, fn) => { handlers[type] = fn; } },
    CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
  run(c, 'assist-bridge.js'); run(c, 'assist-board.js');
  const app = harness({ realTimer: true }); await flush(); app.change({ keyboard: true, ticking: true });
  for (const route of ['/game/186049589091', '/live/game/123', '/analysis/classroom', '/puzzles/rush', '/puzzles/battle', '/puzzles/rated', '/daily', '/puzzles/learning', '/variants', '/']) {
    location.pathname = route;
    for (flipped of [false, true]) {
      handlers['chess-coordinate-request']({ type: 'chess-coordinate-request', target: board });
      const coordinates = c.ChessBoardAssist.validateCoordinates(raw, board);
      assert.equal(coordinates.flipped, flipped);
      app.state(coordinates); app.key('b'); app.key('2'); app.key('b'); app.key('3');
      assert.deepEqual(app.clicks.slice(-2), ['b2', 'b3']);
      app.advance(10000); app.poll(); assert.deepEqual(app.ticks, []);
    }
  }
  const count = app.clicks.length;
  app.document.activeElement = { isContentEditable: true }; app.key('a'); app.key('1');
  assert.equal(app.clicks.length, count);
  app.document.activeElement = null; app.change({ keyboard: false }); app.key('a'); app.key('1');
  assert.equal(app.clicks.length, count);
  stable = false; handlers['chess-coordinate-request']({ type: 'chess-coordinate-request', target: board });
  assert.equal(c.ChessBoardAssist.validateCoordinates(raw, board).stable, false);
  for (const value of [null, { session: 0 }, { session: 1, fen: '', stable: true, flipped: false },
    { session: 1, fen: 'position', stable: true, flipped: 'false' }]) {
    assert.equal(c.ChessBoardAssist.validateCoordinates(JSON.stringify(value), board), null);
  }
  board.isConnected = false; assert.equal(c.ChessBoardAssist.validateCoordinates(raw, board), null);
});

test('coordinate and fog scripts load before SPA navigation on Chess.com', () => {
  const manifest = JSON.parse(source('manifest.json'));
  for (const file of ['assist-bridge.js', 'assist-content.js']) {
    assert.deepEqual(manifest.content_scripts.find(entry => entry.js.includes(file)).matches, ['https://www.chess.com/*']);
  }
  assert.deepEqual(manifest.content_scripts.find(entry => entry.js.includes('fog-bridge.js')).matches, ['https://www.chess.com/*']);
});

test('coordinate control skips hidden boards and follows the interacted or focused board', async () => {
  const app = harness(); await flush();
  const primary = app.board; primary.id = 'board-single';
  const secondary = Object.assign(Object.create(Object.getPrototypeOf(primary)), primary, { id: 'secondary', style: {} });
  const hidden = Object.assign(Object.create(Object.getPrototypeOf(primary)), primary, { id: 'hidden', style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
  app.boards([hidden, secondary, primary]);
  app.key('b'); app.key('2'); assert.equal(app.clickedBoards.at(-1), primary);
  app.dispatch('pointerdown', { composedPath: () => [secondary] });
  app.key('b'); app.key('3'); assert.equal(app.clickedBoards.at(-1), secondary);
  app.document.activeElement = { closest: selector => selector === 'wc-chess-board' ? primary : null };
  app.key('c'); app.key('4'); assert.equal(app.clickedBoards.at(-1), primary);
  app.document.activeElement = null;
  app.boards([hidden, primary]); app.key('d'); app.key('5'); assert.equal(app.clickedBoards.at(-1), primary);
});

test('secondary coordinate board selection preserves primary own-turn ticks', async () => {
  const app = harness({ realTimer: true }); await flush();
  const primary = app.board;
  const secondary = Object.assign(Object.create(Object.getPrototypeOf(primary)), primary, { id: 'secondary', style: {} });
  app.boards([secondary, primary]); app.state(snapshot); app.change({ keyboard: true, ticking: true });
  app.advance(9000); app.dispatch('pointerdown', { composedPath: () => [secondary] });
  app.key('b'); app.key('2'); assert.equal(app.clickedBoards.at(-1), secondary);
  app.advance(1000); app.poll(); assert.deepEqual(app.ticks, [10000]);
  app.document.activeElement = { closest: selector => selector === 'wc-chess-board' ? secondary : null };
  app.advance(10000); app.poll(); assert.deepEqual(app.ticks, [10000, 20000]);
});


test('changing frequency choices with equal durations starts a fresh interval', async () => {
  const app = harness({ realTimer: true }); await flush();
  app.state({ ...snapshot, initialSeconds: 60, incrementSeconds: 2 });
  app.change({ ticking: true, tickMode: 'auto' });
  app.advance(1999);
  app.change({ ticking: true, tickMode: 'amount', tickFrequency: 2 });
  app.advance(1); app.poll(); assert.deepEqual(app.ticks, []);
  app.advance(1999); app.poll(); assert.deepEqual(app.ticks, [3999]);
  app.advance(1999);
  app.change({ ticking: true, tickMode: 'increment' });
  app.advance(1); app.poll(); assert.deepEqual(app.ticks, [3999]);
  app.advance(1999); app.poll(); assert.deepEqual(app.ticks, [3999, 7998]);
  app.advance(1999);
  app.change({ ticking: true, tickMode: 'increment', tickVolume: 100 });
  app.advance(1); app.poll(); assert.deepEqual(app.ticks, [3999, 7998, 9998]);
});

test('premove cancellation follows the primary game while coordinates follow a secondary board', async () => {
  const app = harness(); await flush();
  const primary = app.board;
  const secondary = Object.assign(Object.create(Object.getPrototypeOf(primary)), primary, { id: 'secondary', style: {} });
  app.boards([secondary, primary]);
  app.state({ ...snapshot, context: 'human', turn: 'black', premoveCount: 2 });
  app.dispatch('pointerdown', { composedPath: () => [secondary] });
  app.key('b'); app.key('2'); assert.equal(app.clickedBoards.at(-1), secondary);
  app.document.activeElement = { closest: () => secondary };
  assert.equal(app.cancelPremoves(), true);
  assert.deepEqual(app.cancelledBoards, [primary]);
  app.state({ ...snapshot, active: false, premoveCount: 2 });
  assert.equal(app.cancelPremoves(), false);
  app.boards([secondary]);
  assert.equal(app.cancelPremoves(), false);
  assert.deepEqual(app.cancelledBoards, [primary]);
});


test('bot bridges and adapters support named bot routes while retaining board and mode guards', () => {
  const routes = ['/play/computer', '/play/computer/', '/play/computer/Loch-Chess-Monster-BOT', '/play/computer/Loch-Chess-Monster-BOT/'];
  for (const prefix of ['assist', 'fog']) {
    let listener, raw, mode = 'playing';
    class Element {
      constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-play-computer'; this.isConnected = true; }
      dispatchEvent(event) { raw = event.detail; }
      querySelector() { return null; }
    }
    const board = new Element();
    board.game = {
      getMode: () => ({ name: mode }), getPlayingAs: () => 1, getVariant: () => 'chess',
      getFEN: () => snapshot.fen, getOptions: () => ({ flipped: false }), getResult: () => '*',
      isAtEndOfLine: () => true, isDragging: () => false, isAnimating: () => false,
    };
    const location = { pathname: routes[0] };
    const c = vm.createContext({ HTMLElement: Element, location,
      document: { addEventListener: (type, fn) => { listener = fn; } },
      CustomEvent: class { constructor(type, options) { Object.assign(this, options); } } });
    if (prefix === 'fog') run(c, 'fog-visibility.js');
    run(c, prefix + '-bridge.js'); run(c, prefix + '-board.js');
    const validate = () => prefix === 'fog'
      ? c.ChessFogBoard.validateSnapshot(raw, board, location.pathname, 'auto')
      : c.ChessBoardAssist.validate(raw, board, location.pathname);
    for (const route of routes) {
      location.pathname = route; listener({ target: board });
      assert.equal(JSON.parse(raw).context, 'bot'); assert.ok(validate(), prefix + ': ' + route);
    }
    mode = 'observing'; listener({ target: board }); assert.equal(raw, 'null');
    mode = 'playing'; board.id = 'secondary'; listener({ target: board }); assert.equal(raw, 'null');
    board.id = 'board-play-computer';
    for (const route of ['/play/computer-other', '/play/computer/bot/other', '/play/online']) {
      location.pathname = route; listener({ target: board }); assert.equal(raw, 'null');
    }
  }
  const manifest = JSON.parse(source('manifest.json'));
  for (const entry of manifest.content_scripts.filter(entry => entry.js.includes('fog-bridge.js') || entry.js.includes('fog-content.js'))) {
    assert.deepEqual(entry.matches, ['https://www.chess.com/*']);
  }
});


test('completed Game Review routes support read-only board snapshots without enabling ticks', () => {
  for (const prefix of ['assist', 'fog']) {
    let listener, raw, result = '1-0';
    class Element {
      constructor() { this.tagName = 'WC-CHESS-BOARD'; this.id = 'board-analysis-board'; this.isConnected = true; }
      dispatchEvent(event) { raw = event.detail; }
      querySelector() { return null; }
    }
    const board = new Element();
    board.game = {
      getMode: () => ({ name: 'analysis' }), getPlayingAs: () => null, getVariant: () => 'chess',
      getFEN: () => snapshot.fen, getOptions: () => ({ flipped: false }), getResult: () => result,
      isAtEndOfLine: () => true, isDragging: () => false, isAnimating: () => false,
    };
    const location = { pathname: '/analysis/game/computer/2328646154/review' };
    const c = vm.createContext({ HTMLElement: Element, location,
      document: { addEventListener: (type, fn) => { listener = fn; } },
      CustomEvent: class { constructor(type, options) { Object.assign(this, options); } } });
    if (prefix === 'fog') run(c, 'fog-visibility.js');
    run(c, prefix + '-bridge.js'); run(c, prefix + '-board.js');
    for (const kind of ['computer', 'live', 'daily']) {
      location.pathname = '/analysis/game/' + kind + '/2328646154/review';
      listener({ target: board });
      assert.equal(JSON.parse(raw).context, 'analysis');
      if (prefix === 'fog') assert.ok(c.ChessFogBoard.validateSnapshot(raw, board, location.pathname, 'auto'));
      else {
        const state = c.ChessBoardAssist.validate(raw, board, location.pathname);
        assert.equal(state.active, false);
        assert.equal(context.ChessAssistTimer.createTurnTimer().update(state, 10000, true), false);
      }
    }
    location.pathname = '/analysis/game/computer/2328646154/review/other';
    listener({ target: board }); assert.equal(raw, 'null');
    if (prefix === 'fog') {
      location.pathname = '/analysis/game/computer/2328646154/review'; result = '*';
      listener({ target: board }); assert.equal(raw, 'null');
    }
  }
});
