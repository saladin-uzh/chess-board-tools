const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const run = (context, file) => vm.runInContext(source(file), context, { filename: file });
const context = vm.createContext({});
run(context, 'fog-visibility.js');
run(context, 'settings.js');
run(context, 'fog-board.js');
const { parseFEN, visibility, squareIndex } = context.ChessFogVisibility;
const { normalizeFog } = context.ChessConfirmMoveSettings;
const plain = value => JSON.parse(JSON.stringify(value));
const index = squareIndex;
function fen(pieces, turn = 'w', rights = '-', ep = '-') {
  const board = Array(64).fill(null);
  for (const [square, piece] of Object.entries({ h1: 'K', h8: 'k', ...pieces })) board[index(square)] = piece;
  const ranks = [];
  for (let y = 7; y >= 0; y--) {
    let rank = '', empty = 0;
    for (let x = 0; x < 8; x++) {
      const piece = board[y * 8 + x];
      if (!piece) empty++;
      else { if (empty) rank += empty; rank += piece; empty = 0; }
    }
    if (empty) rank += empty;
    ranks.push(rank);
  }
  return `${ranks.join('/')} ${turn} ${rights} ${ep} 0 1`;
}
function mask(pieces, from, side = 'white', turn = 'w', rights = '-', ep = '-') {
  const position = parseFEN(fen(pieces, turn, rights, ep));
  assert.ok(position);
  return visibility(position, side, index(from)).selected;
}
const seen = (mask, square) => mask[index(square)];

test('FEN parser requires complete bounded state and valid kings, ranks and en passant', () => {
  const good = 'r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1';
  assert.ok(parseFEN(good));
  for (const bad of [null, {}, good.split(' ').slice(0, 4).join(' '), good.replace('KQkq', 'KK'), good.replace('d6', 'd3'), good.replace('d6', 'a6'), good.replace('w ', 'x '), good.replace('0 1', '-1 1'), good.replace('0 1', '0 0'), good.replace('3pP3', '9'), good.replace('R3K2R', 'R6R'), 'x'.repeat(161)]) assert.equal(parseFEN(bad), null);
  assert.equal(index('a1'), 0);
  assert.equal(index('h8'), 63);
  assert.equal(index('i2'), null);
});

test('pawns reveal capture diagonals, not forward moves, for both colors and edges', () => {
  for (const [side, pawn, start, single, double, diagonals] of [
    ['white', 'P', 'a2', 'a3', 'a4', ['b3']],
    ['black', 'p', 'h7', 'h6', 'h5', ['g6']],
  ]) {
    const result = mask({ [start]: pawn }, start, side);
    assert.equal(seen(result, start), true);
    assert.equal(seen(result, single), false);
    assert.equal(seen(result, double), false);
    for (const square of diagonals) assert.equal(seen(result, square), true);
    assert.equal(result.filter(Boolean).length, 1 + diagonals.length);
    const blocked = mask({ [start]: pawn, [single]: side === 'white' ? 'n' : 'N' }, start, side);
    assert.equal(seen(blocked, single), false);
    assert.equal(seen(blocked, double), false);
  }
  const capture = mask({ d4: 'P', c5: 'p', e5: 'N' }, 'd4');
  assert.equal(seen(capture, 'c5'), true);
  assert.equal(seen(capture, 'e5'), true);
  assert.equal(seen(capture, 'd5'), false);
  assert.equal(seen(capture, 'd6'), false);
});

test('pawn capture visibility ignores occupancy, blockers and side to move', () => {
  for (const [side, pawn, from, forward, left, right] of [
    ['white', 'P', 'd4', 'd5', 'c5', 'e5'],
    ['black', 'p', 'd5', 'd4', 'c4', 'e4'],
  ]) {
    for (const occupant of [null, side === 'white' ? 'N' : 'n', side === 'white' ? 'n' : 'N']) {
      for (const turn of ['w', 'b']) {
        const result = mask({ [from]: pawn, [forward]: 'n', [left]: occupant, [right]: occupant }, from, side, turn);
        assert.equal(seen(result, left), true);
        assert.equal(seen(result, right), true);
        assert.equal(seen(result, forward), false);
        assert.equal(result.filter(Boolean).length, 3);
      }
    }
  }
  for (const [side, pawn, from, diagonal] of [
    ['white', 'P', 'h2', 'g3'], ['black', 'p', 'a7', 'b6'],
  ]) {
    const result = mask({ [from]: pawn }, from, side);
    assert.equal(seen(result, diagonal), true);
    assert.equal(result.filter(Boolean).length, 2);
  }
  for (const [side, pawn, from] of [['white', 'P', 'a8'], ['black', 'p', 'a1']]) {
    assert.equal(mask({ [from]: pawn }, from, side).filter(Boolean).length, 1);
  }
});

test('pawn capture diagonals enter the union and selected mask without revealing forward squares', () => {
  for (const [side, pieces, from, diagonals, forward] of [
    ['white', { d4: 'P' }, 'd4', ['c5', 'e5'], 'd5'],
    ['black', { d5: 'p' }, 'd5', ['c4', 'e4'], 'd4'],
  ]) {
    const result = visibility(parseFEN(fen(pieces)), side, index(from));
    for (const square of diagonals) {
      assert.equal(seen(result.union, square), true);
      assert.equal(seen(result.selected, square), true);
    }
    assert.equal(seen(result.union, forward), false);
    assert.equal(seen(result.selected, forward), false);
  }
});

test('sliding pieces stop at friendly or enemy blockers in each direction', () => {
  for (const [piece, visible, behind] of [['R', 'd6', 'd7'], ['B', 'f6', 'g7'], ['Q', 'f6', 'g7']]) {
    const enemy = mask({ d4: piece, [visible]: 'p' }, 'd4');
    assert.equal(seen(enemy, visible), true);
    assert.equal(seen(enemy, behind), false);
    const own = mask({ d4: piece, [visible]: 'P' }, 'd4');
    assert.equal(seen(own, visible), false);
    assert.equal(seen(own, behind), false);
    const position = parseFEN(fen({ d4: piece, [visible]: 'P' }));
    assert.equal(seen(visibility(position, 'white').union, visible), true);
  }
  const rook = mask({ a1: 'R' }, 'a1');
  assert.equal(seen(rook, 'a8'), true);
  assert.equal(seen(rook, 'h1'), false); // Friendly king.
  assert.equal(seen(rook, 'b2'), false);
  const bishop = mask({ a1: 'B' }, 'a1');
  assert.equal(seen(bishop, 'g7'), true);
  assert.equal(seen(bishop, 'h8'), true);
});

test('knights jump blockers without wrapping at board edges', () => {
  const knight = mask({ a1: 'N', a2: 'P', b1: 'P', c2: 'p' }, 'a1');
  assert.equal(seen(knight, 'c2'), true);
  assert.equal(seen(knight, 'b3'), true);
  assert.equal(knight.filter(Boolean).length, 3);
  const black = mask({ h8: 'n', a8: 'k', f7: 'p' }, 'h8', 'black');
  assert.equal(seen(black, 'f7'), false);
  assert.equal(seen(black, 'g6'), true);
});

test('pinned pieces and attacked king destinations retain movement visibility', () => {
  const pinned = mask({ h1: null, e1: 'K', e2: 'R', e8: 'r' }, 'e2');
  assert.equal(seen(pinned, 'a2'), true);
  const king = mask({ h1: null, e1: 'K', f8: 'r' }, 'e1');
  assert.equal(seen(king, 'f1'), true);
  assert.equal(seen(king, 'f2'), true);
});

test('castling depends on actual rights, rook and clear path, independently of attacks and turn', () => {
  const pieces = { h1: 'R', a1: 'R', e1: 'K', f8: 'r', h8: 'k' };
  const available = mask(pieces, 'e1', 'white', 'b', 'KQ');
  assert.equal(seen(available, 'g1'), true);
  assert.equal(seen(available, 'c1'), true);
  const absent = mask(pieces, 'e1');
  assert.equal(seen(absent, 'g1'), false);
  assert.equal(seen(absent, 'c1'), false);
  const blocked = mask({ ...pieces, b1: 'N', f1: 'B' }, 'e1', 'white', 'w', 'KQ');
  assert.equal(seen(blocked, 'g1'), false);
  assert.equal(seen(blocked, 'c1'), false);
  const black = mask({ h8: 'r', a8: 'r', e8: 'k' }, 'e8', 'black', 'w', 'kq');
  assert.equal(seen(black, 'g8'), true);
  assert.equal(seen(black, 'c8'), true);
});

test('en passant does not expand pawn visibility beyond capture diagonals', () => {
  for (const [pieces, from, side, turn, target, captured] of [
    [{ e5: 'P', d5: 'p' }, 'e5', 'white', 'w', 'd6', 'd5'],
    [{ e4: 'p', d4: 'P' }, 'e4', 'black', 'b', 'd3', 'd4'],
  ]) {
    const active = mask(pieces, from, side, turn, '-', target);
    assert.equal(seen(active, target), true);
    assert.equal(seen(active, captured), false);
    const expired = mask(pieces, from, side, turn);
    assert.equal(seen(expired, target), true);
    assert.equal(seen(expired, captured), false);
    assert.deepEqual(plain(active), plain(expired));
  }
});

test('promotion uses the committed piece type and selection does not replace the union', () => {
  const pawn = mask({ a7: 'P' }, 'a7');
  assert.equal(seen(pawn, 'a8'), false);
  assert.equal(seen(pawn, 'b8'), true);
  const queen = mask({ a8: 'Q' }, 'a8');
  assert.equal(seen(queen, 'a1'), true);
  const position = parseFEN(fen({ a8: 'Q', b2: 'P' }));
  const first = visibility(position, 'white', index('b2'));
  const second = visibility(position, 'white', index('a8'));
  assert.deepEqual(plain(first.union), plain(second.union));
  assert.equal(visibility(position, 'white', index('h8')).selected, null);
});

test('fog preferences reject malformed values and default to disabled local display', () => {
  assert.deepEqual(plain(normalizeFog(null)), { enabled: false, opacity: 0.55, perspective: 'auto' });
  for (const opacity of [NaN, Infinity, '0.3', 0.19, 0.81]) assert.equal(normalizeFog({ opacity }).opacity, 0.55);
  for (const opacity of [0.2, 0.8]) assert.equal(normalizeFog({ opacity }).opacity, opacity);
  assert.equal(normalizeFog({ enabled: 'true', perspective: 'red' }).enabled, false);
});

test('adapter rejects unsupported, transient, incomplete and disconnected snapshots', () => {
  const board = { id: 'board-play-computer', isConnected: true };
  const snapshot = { context: 'bot', fen: fen({}), stable: true, flipped: false, side: 'white', selected: null };
  const validate = (value, target = board, route = '/play/computer', perspective = 'auto') => context.ChessFogBoard.validateSnapshot(JSON.stringify(value), target, route, perspective);
  assert.equal(validate(snapshot).side, 'white');
  for (const changes of [{ stable: false }, { fen: '8/8/8/8/8/8/8/8' }, { selected: 64 }, { flipped: 0 }, { context: 'human' }]) assert.equal(validate({ ...snapshot, ...changes }), null);
  assert.equal(validate(snapshot, { ...board, isConnected: false }), null);
  assert.equal(validate(snapshot, board, '/play/online'), null);
  assert.equal(validate(snapshot, board, '/analysis/classroom'), null);
  assert.equal(validate({ ...snapshot, side: null }).side, 'white');
  assert.equal(validate({ ...snapshot, side: null, flipped: true }).side, 'black');
  assert.equal(validate({ ...snapshot, side: 'white', flipped: true }).side, 'white');
  const white = validate(snapshot, board, '/play/computer', 'white');
  const flipped = validate({ ...snapshot, flipped: true }, board, '/play/computer', 'white');
  assert.deepEqual(plain(white.position), plain(flipped.position));
  assert.equal(flipped.side, 'white');
  assert.equal(validate({ ...snapshot, side: 'black' }).side, 'black');
  const analysisBoard = { id: 'board-analysis-board', isConnected: true };
  const analysisSnapshot = { ...snapshot, context: 'analysis', side: null };
  assert.equal(validate(analysisSnapshot, analysisBoard, '/analysis/game/computer/123/analysis', 'white').side, 'white');
  assert.equal(validate(analysisSnapshot, analysisBoard, '/analysis/game/computer/123/review', 'white'), null);
  assert.equal(context.ChessFogBoard.validateSnapshot('{', board, '/play/computer', 'white'), null);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function popup() {
  const load = deferred(), write = deferred();
  const elements = {};
  for (const id of ['fog-enabled', 'fog-opacity', 'fog-opacity-value', 'fog-perspective', 'fog-save-status', 'fog-board-status']) {
    elements['#' + id] = { disabled: true, value: '', checked: false, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
  }
  let changed;
  const writes = [];
  const ctx = vm.createContext({
    document: { querySelector: selector => elements[selector] },
    chrome: { tabs: { query: async () => [{ id: 1 }], sendMessage: async () => ({ status: 'Fog active for white.' }) }, storage: {
      local: { get: () => load.promise, set: async value => { writes.push(plain(value)); await write.promise; } },
      onChanged: { addListener: fn => { changed = fn; } },
    } },
  });
  run(ctx, 'settings.js'); run(ctx, 'fog-popup.js');
  return { elements, load, write, writes, change(value, area = 'local') { changed({ fogPreferences: { newValue: value } }, area); } };
}

test('fog popup blocks load/save races and preserves keybinding isolation', async () => {
  const app = popup();
  const enable = app.elements['#fog-enabled'];
  assert.equal(enable.disabled, true);
  app.load.resolve({ fogPreferences: { enabled: false, opacity: 0.2, perspective: 'black' } });
  await flush();
  assert.equal(enable.disabled, false);
  enable.checked = true;
  const saving = enable.handlers.change();
  assert.equal(app.elements['#fog-opacity'].disabled, true);
  await enable.handlers.change();
  assert.equal(app.writes.length, 1);
  assert.deepEqual(app.writes[0], { fogPreferences: { enabled: true, opacity: 0.2, perspective: 'black' } });
  app.change({ enabled: true, opacity: 0.8, perspective: 'white' });
  app.write.resolve(); await saving;
  assert.equal(app.elements['#fog-opacity'].value, '80');
  assert.equal(app.elements['#fog-perspective'].value, 'white');
  assert.equal(enable.disabled, false);
});

test('incoming fog preferences supersede an outdated initial read; sync events are ignored', async () => {
  const app = popup();
  app.change({ enabled: true, opacity: 0.3, perspective: 'white' });
  app.change({ enabled: false }, 'sync');
  app.load.resolve({ fogPreferences: { enabled: false } });
  await flush();
  assert.equal(app.elements['#fog-enabled'].checked, true);
  assert.equal(app.elements['#fog-opacity'].value, '30');
});

test('failed fog read uses disabled defaults; failed save restores the saved preferences', async () => {
  const app = popup();
  app.load.reject(new Error('Read unavailable'));
  await flush();
  assert.equal(app.elements['#fog-enabled'].checked, false);
  assert.equal(app.elements['#fog-enabled'].disabled, false);
  app.elements['#fog-enabled'].checked = true;
  const saving = app.elements['#fog-enabled'].handlers.change();
  app.write.reject(new Error('Write unavailable')); await saving;
  assert.equal(app.elements['#fog-enabled'].checked, false);
  assert.equal(app.elements['#fog-save-status'].textContent, 'Could not save fog settings.');
});

test('MAIN bridge reads full FEN only in verified modes and rejects unfinished imported human games', () => {
  let handler;
  class HTMLElement {}
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  const board = new HTMLElement();
  board.tagName = 'WC-CHESS-BOARD';
  board.id = 'board-play-computer';
  let mode = 'playing', result = '*', variant = 'chess', dragging = false;
  board.game = {
    getMode: () => ({ name: mode }), getResult: () => result,
    getVariant: () => variant, getPlayingAs: () => 2,
    getFEN: () => fen({ e4: 'p', d4: 'P' }, 'b', '-', 'd3'),
    getOptions: () => ({ flipped: true }), isDragging: () => dragging, isAnimating: () => false,
    move: () => assert.fail('The bridge must never execute a move'),
  };
  board.querySelector = () => ({ className: 'highlight growing-circle square-54' });
  let response;
  board.dispatchEvent = event => { response = JSON.parse(event.detail); };
  const ctx = vm.createContext({ document: { addEventListener: (name, fn) => { handler = fn; } }, HTMLElement, CustomEvent, location: { pathname: '/play/computer' } });
  run(ctx, 'fog-bridge.js');
  handler({ target: board });
  assert.equal(response.side, 'black');
  assert.equal(response.selected, index('e4'));
  assert.equal(response.fen.split(' ')[3], 'd3');
  dragging = true; handler({ target: board }); assert.equal(response.stable, false);
  dragging = false;
  variant = 'chess960'; handler({ target: board }); assert.equal(response, null);
  variant = 'chess';
  ctx.location.pathname = '/analysis/game/live/123'; board.id = 'board-analysis-board'; mode = 'analysis';
  handler({ target: board }); assert.equal(response, null);
  result = '1-0'; handler({ target: board }); assert.equal(response.context, 'analysis');
  ctx.location.pathname = '/analysis/game/computer/123/analysis';
  handler({ target: board }); assert.equal(response.context, 'analysis');
  result = '*'; handler({ target: board }); assert.equal(response, null);
  result = '0-1';
  ctx.location.pathname = '/analysis/game/computer/123/review'; handler({ target: board }); assert.equal(response, null);
  ctx.location.pathname = '/analysis/classroom'; handler({ target: board }); assert.equal(response, null);
  ctx.location.pathname = '/game/live/123'; board.id = 'board-single'; mode = 'observing';
  handler({ target: board }); assert.equal(response.context, 'review');
  result = '*'; handler({ target: board }); assert.equal(response, null);
  result = '1-0'; mode = 'playing'; handler({ target: board }); assert.equal(response, null);
  ctx.location.pathname = '/play/online'; mode = 'playing'; handler({ target: board }); assert.equal(response, null);
});

function controller() {
  const loading = deferred();
  let storageChange, messageListener;
  const events = {}, frames = new Map(), timers = new Map(), observers = [];
  let counter = 0;
  class Element {
    constructor() {
      this.children = []; this.className = ''; this.isConnected = true; this.textContent = '';
      this.style = { setProperty() {} };
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        toggle: (name, enabled) => {
          const names = new Set(this.className.split(' ').filter(Boolean));
          if (enabled) names.add(name); else names.delete(name);
          this.className = Array.from(names).join(' ');
        },
      };
    }
    append(child) { child.parent = this; this.children.push(child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.isConnected = false; }
    setAttribute(key, value) { this[key] = value; }
    closest() { return this.className.startsWith('chess-fog-') ? this : this.parent?.closest(); }
    getBoundingClientRect() { return { width: 640, height: 640 }; }
  }
  class Observer {
    constructor(fn) { this.fn = fn; this.connected = false; observers.push(this); }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
  }
  let current = new Element(); current.id = 'board-analysis-board';
  let snapshot = { position: parseFEN(fen({ b2: 'P' })), side: 'white', selected: index('b2'), flipped: false };
  const ctx = vm.createContext({
    document: { querySelector: () => current, createElement: () => new Element() },
    MutationObserver: Observer, ResizeObserver: Observer,
    requestAnimationFrame: fn => { const id = ++counter; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setInterval: fn => { const id = ++counter; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
    addEventListener: (name, fn) => { events[name] = fn; },
    chrome: { runtime: { onMessage: { addListener: fn => { messageListener = fn; } } }, storage: {
      local: { get: () => loading.promise }, onChanged: { addListener: fn => { storageChange = fn; } },
    } },
  });
  run(ctx, 'settings.js'); run(ctx, 'fog-visibility.js');
  ctx.ChessFogBoard = { read: () => snapshot };
  run(ctx, 'fog-content.js');
  const tick = () => {
    timers.forEach(fn => fn());
    const pending = Array.from(frames.values()); frames.clear(); pending.forEach(fn => fn());
  };
  return {
    loading, tick, observers, timers, frames, events,
    get board() { return current; },
    get snapshot() { return snapshot; },
    set snapshot(value) { snapshot = value; },
    replace() { const old = current; old.isConnected = false; current = new Element(); current.id = old.id; return old; },
    change(value) { storageChange({ fogPreferences: { newValue: value } }, 'local'); },
    status() { let value; messageListener({ type: 'chess-fog-status' }, {}, response => { value = response.status; }); return value; },
  };
}

test('overlay rotates logical squares, preserves selection and removes transient masks', async () => {
  const app = controller();
  app.loading.resolve({ fogPreferences: { enabled: true, perspective: 'white' } }); await flush(); app.tick();
  const overlay = app.board.children[0];
  assert.equal(overlay.children.length, 64);
  assert.equal(overlay['aria-hidden'], 'true');
  assert.equal(overlay.children[6 * 8 + 1].classList.contains('chess-fog-selected'), true);
  assert.equal(overlay.children[0].classList.contains('chess-fog-hidden'), true);
  app.snapshot = { ...app.snapshot, flipped: true }; app.tick();
  assert.equal(overlay.children[1 * 8 + 6].classList.contains('chess-fog-selected'), true);
  assert.equal(app.status(), 'Fog active for white.');
  app.snapshot = null; app.tick();
  assert.equal(app.board.children.length, 0);
  assert.match(app.status(), /unavailable/);
});

test('overlay avoids its own observer loop, survives replacement/resize, and cleans up enable and page cycles', async () => {
  const app = controller();
  app.loading.resolve({}); await flush(); app.tick();
  assert.equal(app.timers.size, 0);
  app.change({ enabled: true, perspective: 'white' }); app.tick();
  assert.equal(app.board.children.length, 1);
  const overlay = app.board.children[0];
  const mutation = app.observers[0];
  mutation.fn([{ target: overlay.children[0], type: 'attributes' }]);
  assert.equal(app.frames.size, 0);
  mutation.fn([{ target: app.board, type: 'childList', addedNodes: [overlay], removedNodes: [] }]);
  assert.equal(app.frames.size, 0);
  app.observers[1].fn(); app.observers[1].fn();
  assert.equal(app.frames.size, 1);
  app.tick(); assert.equal(app.board.children.length, 1);
  const old = app.replace(); app.tick();
  assert.equal(old.children.length, 0);
  assert.equal(mutation.connected, false);
  assert.equal(app.observers.filter(observer => observer.connected).length, 2);
  assert.equal(app.board.children.length, 1);
  app.change({ enabled: false }); app.tick();
  assert.equal(app.observers.filter(observer => observer.connected).length, 0);
  assert.equal(app.timers.size, 0);
  assert.equal(app.board.children.length, 0);
  app.change({ enabled: true, perspective: 'white' }); app.tick();
  app.events.pagehide();
  assert.equal(app.timers.size, 0);
  assert.equal(app.frames.size, 0);
  assert.equal(app.board.children.length, 0);
  app.events.pageshow(); app.tick(); assert.equal(app.board.children.length, 1);
});

test('content initialization cannot overwrite newer local preferences', async () => {
  const app = controller();
  app.change({ enabled: true, perspective: 'white' }); app.tick();
  app.loading.resolve({ fogPreferences: { enabled: false } }); await flush(); app.tick();
  assert.equal(app.board.children.length, 1);
  assert.equal(app.timers.size, 1);
});


test('fog adapter accepts completed review and rejects unfinished review or mismatched routes', () => {
  const input = { context: 'review', result: '1-0', stable: true, flipped: false, side: null, selected: null,
    fen: fen({ a7: 'P' }) };
  const board = { id: 'board-single', isConnected: true };
  const validate = (value = input, path = '/game/live/123') => context.ChessFogBoard.validateSnapshot(JSON.stringify(value), board, path, 'white');
  assert.equal(validate().side, 'white');
  assert.equal(validate(input, '/game/daily/123').side, 'white');
  assert.equal(validate({ ...input, result: '*' }), null);
  assert.equal(validate({ ...input, result: undefined }), null);
  assert.equal(validate({ ...input, stable: false }), null);
  assert.equal(validate(input, '/play/online'), null);
});
