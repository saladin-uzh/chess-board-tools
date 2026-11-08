const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const attachPreferencesWorker = require('./preferences-harness.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
function setup({ local = {}, sync = {}, failRead = false, failWrite = false, beforeLocalRead, getSync } = {}) {
  const writes = [], removed = [], listeners = new Set();
  const chrome = { storage: {
    onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    sync: {
      get: async key => { if (failRead) throw new Error('read'); return getSync ? getSync(key, sync) : { [key]: sync[key] }; },
      set: async data => { if (failWrite) throw new Error('quota'); writes.push(plain(data)); Object.assign(sync, plain(data));
        for (const fn of [...listeners]) fn(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { newValue: value }])), 'sync'); },
    },
    local: {
      get: async key => { await beforeLocalRead?.(); return { [key]: local[key] }; },
      remove: async key => { removed.push(key); delete local[key]; },
    },
  } };
  const send = attachPreferencesWorker(chrome);
  const context = vm.createContext({ chrome });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8'), context);
  return { settings: context.ChessConfirmMoveSettings, writes, removed, local, sync, listeners, send,
    client() {
      const client = vm.createContext({ chrome: { runtime: { sendMessage: send } } });
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8'), client);
      return client.ChessConfirmMoveSettings;
    },
    emit(key, value) {
      if (value === undefined) delete sync[key]; else sync[key] = value;
      for (const fn of [...listeners]) fn({ [key]: { newValue: value } }, 'sync');
    },
  };
}

for (const [key, value, expected] of [
  ['fogPreferences', { enabled: true, opacity: 0.3, perspective: 'black' }, { enabled: true, opacity: 0.3, perspective: 'black' }],
  ['boardAssistPreferences', { keyboard: true, ticking: true, tickMode: 'amount', tickFrequency: 5, tickVolume: 25 }, { keyboard: true, ticking: true, tickMode: 'amount', tickFrequency: 5, tickVolume: 25 }],
  ['arrowNumberPreferences', { enabled: true }, { enabled: true }],
]) {
  test(`${key} migrates normalized local values once and keeps unrelated local geometry`, async () => {
    const app = setup({ local: { [key]: value, floatingSettingsPreferences: { left: 42 } } });
    const first = app.settings.loadSyncedPreferences(key);
    assert.equal(first, app.settings.loadSyncedPreferences(key));
    assert.deepEqual(plain(await first), { [key]: expected });
    assert.deepEqual(app.writes, [{ [key]: expected }]);
    assert.equal(app.local[key], undefined);
    assert.deepEqual(app.local.floatingSettingsPreferences, { left: 42 });
    await app.settings.loadSyncedPreferences(key);
    assert.equal(app.writes.length, 1);
    delete app.sync[key];
    assert.equal((await app.settings.loadSyncedPreferences(key))[key], undefined);
  });
}

test('existing sync values including disabled features win over legacy local preferences', async () => {
  const app = setup({ local: { arrowNumberPreferences: { enabled: true } }, sync: { arrowNumberPreferences: { enabled: false } } });
  assert.deepEqual(plain(await app.settings.loadSyncedPreferences('arrowNumberPreferences')), { arrowNumberPreferences: { enabled: false } });
  assert.equal(app.writes.length, 0);
  assert.equal(app.local.arrowNumberPreferences, undefined);
});

test('sync changes arriving during the local read win over migration', async () => {
  const sync = {};
  const app = setup({ local: { fogPreferences: { enabled: true } }, sync,
    beforeLocalRead: () => { sync.fogPreferences = { enabled: false, opacity: 0.8 }; } });
  assert.deepEqual(plain(await app.settings.loadSyncedPreferences('fogPreferences')), { fogPreferences: { enabled: false, opacity: 0.8 } });
  assert.equal(app.writes.length, 0);
});

test('migration write failures retain legacy settings and retry on the next load', async () => {
  const app = setup({ local: { arrowNumberPreferences: { enabled: true } }, failWrite: true });
  assert.deepEqual(plain(await app.settings.loadSyncedPreferences('arrowNumberPreferences')), { arrowNumberPreferences: { enabled: true } });
  assert.deepEqual(app.local.arrowNumberPreferences, { enabled: true });
  assert.equal(app.removed.length, 0);
});

test('sync read failure never writes or deletes legacy settings', async () => {
  const app = setup({ local: { fogPreferences: { enabled: true } }, failRead: true });
  await assert.rejects(app.settings.loadSyncedPreferences('fogPreferences'), /unavailable/);
  assert.equal(app.writes.length, 0);
  assert.equal(app.removed.length, 0);
});

test('new installations do not write default preferences or geometry to sync', async () => {
  const app = setup();
  await app.settings.loadSyncedPreferences('fogPreferences');
  assert.equal(app.writes.length, 0);
});

test('migration normalizes malformed legacy values before syncing', async () => {
  const app = setup({ local: { fogPreferences: { enabled: 'true', opacity: 100, perspective: 'unknown', position: 'private' } } });
  await app.settings.loadSyncedPreferences('fogPreferences');
  assert.deepEqual(app.writes, [{ fogPreferences: { enabled: false, opacity: 0.55, perspective: 'auto' } }]);
});



function delayedMigration() {
  let finish, started, reads = 0;
  const waiting = new Promise(resolve => { started = resolve; });
  const app = setup({ local: { arrowNumberPreferences: { enabled: true } },
    getSync: async (key, sync) => {
      const snapshot = { [key]: sync[key] };
      if (++reads === 2) {
        started();
        await new Promise(resolve => { finish = resolve; });
      }
      return snapshot;
    },
  });
  return { ...app, waiting, finish: () => finish() };
}

test('a cross-context save waits for a pending migration and remains the final stored value', async () => {
  const app = delayedMigration(), other = app.client();
  const pending = app.settings.loadSyncedPreferences('arrowNumberPreferences');
  await app.waiting;
  const saving = other.saveSyncedPreferences('arrowNumberPreferences', { enabled: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.writes.length, 0);
  app.finish();
  await Promise.all([pending, saving]);
  assert.deepEqual(app.sync.arrowNumberPreferences, { enabled: false });
  assert.deepEqual(app.writes, [
    { arrowNumberPreferences: { enabled: true } },
    { arrowNumberPreferences: { enabled: false } },
  ]);
  assert.equal(app.listeners.size, 0);
});

test('two contexts cannot run migrations concurrently or undo a subsequent save', async () => {
  const app = delayedMigration(), other = app.client();
  const first = app.settings.loadSyncedPreferences('arrowNumberPreferences');
  await app.waiting;
  let secondLoaded = false;
  const second = other.loadSyncedPreferences('arrowNumberPreferences').then(() => { secondLoaded = true; });
  const saving = other.saveSyncedPreferences('arrowNumberPreferences', { enabled: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(secondLoaded, false);
  app.finish();
  await Promise.all([first, second, saving]);
  assert.deepEqual(app.sync.arrowNumberPreferences, { enabled: false });
  assert.equal(app.writes.length, 2);
  assert.equal(app.listeners.size, 0);
});

test('an incoming Sync change invalidates a stale migration read', async () => {
  const app = delayedMigration();
  const pending = app.settings.loadSyncedPreferences('arrowNumberPreferences');
  await app.waiting;
  app.emit('arrowNumberPreferences', { enabled: false });
  app.finish();
  assert.deepEqual(plain(await pending), { arrowNumberPreferences: { enabled: false } });
  assert.equal(app.writes.length, 0);
  assert.equal(app.listeners.size, 0);
});

test('a failed operation does not poison the per-key queue', async () => {
  let reads = 0;
  const app = setup({ getSync: async () => { if (++reads === 1) throw Error('read'); return {}; } });
  const pending = app.settings.loadSyncedPreferences('arrowNumberPreferences');
  const save = app.client().saveSyncedPreferences('arrowNumberPreferences', { enabled: false });
  await assert.rejects(pending, /unavailable/);
  await save;
  assert.deepEqual(app.sync.arrowNumberPreferences, { enabled: false });
});

test('blocked migration of one helper key does not block another key', async () => {
  const app = delayedMigration();
  const pending = app.settings.loadSyncedPreferences('arrowNumberPreferences');
  await app.waiting;
  await app.client().saveSyncedPreferences('fogPreferences', { enabled: true });
  assert.equal(app.sync.fogPreferences.enabled, true);
  app.finish(); await pending;
});

test('worker rejects unknown keys, unrelated messages and other extension senders', async () => {
  const app = setup();
  for (const [message, sender] of [
    [{ type: 'chess-preferences-save', key: 'keybindings', value: {} }, { id: 'test-extension' }],
    [{ type: 'other', key: 'fogPreferences' }, { id: 'test-extension' }],
    [{ type: 'chess-preferences-save', key: 'fogPreferences', value: {} }, { id: 'other-extension' }],
  ]) assert.equal(await app.send(message, sender), undefined);
  assert.equal(app.writes.length, 0);
});

test('worker normalizes saves and keeps local backups when saving fails', async () => {
  const app = setup({ local: { fogPreferences: { enabled: true } }, failWrite: true });
  await assert.rejects(app.settings.saveSyncedPreferences('fogPreferences', { enabled: false }), /unavailable/);
  assert.deepEqual(app.local.fogPreferences, { enabled: true });
  assert.equal(app.removed.length, 0);
  assert.equal(app.listeners.size, 0);
  const good = setup();
  await good.settings.saveSyncedPreferences('fogPreferences', { enabled: 'true', opacity: 100, perspective: 'unknown' });
  assert.deepEqual(good.sync.fogPreferences, { enabled: false, opacity: 0.55, perspective: 'auto' });
});
