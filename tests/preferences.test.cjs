const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
function setup({ local = {}, sync = {}, failRead = false, failWrite = false, beforeLocalRead } = {}) {
  const writes = [], removed = [];
  const context = vm.createContext({ chrome: { storage: {
    sync: {
      get: async key => { if (failRead) throw new Error('read'); return { [key]: sync[key] }; },
      set: async data => { if (failWrite) throw new Error('quota'); writes.push(plain(data)); Object.assign(sync, plain(data)); },
    },
    local: {
      get: async key => { await beforeLocalRead?.(); return { [key]: local[key] }; },
      remove: async key => { removed.push(key); delete local[key]; },
    },
  } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8'), context);
  return { settings: context.ChessConfirmMoveSettings, writes, removed, local, sync };
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
  await assert.rejects(app.settings.loadSyncedPreferences('fogPreferences'), /read/);
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
