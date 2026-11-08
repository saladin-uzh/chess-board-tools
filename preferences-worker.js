"use strict";

importScripts("settings.js");

const { FOG_STORAGE_KEY, ASSIST_STORAGE_KEY, ARROW_STORAGE_KEY,
  normalizeFog, normalizeAssist, normalizeArrows } = globalThis.ChessConfirmMoveSettings;
const normalizers = new Map([
  [FOG_STORAGE_KEY, normalizeFog], [ASSIST_STORAGE_KEY, normalizeAssist], [ARROW_STORAGE_KEY, normalizeArrows],
]);
const queues = new Map();

function enqueue(key, operation) {
  const pending = (queues.get(key) || Promise.resolve()).catch(() => {}).then(operation);
  queues.set(key, pending);
  pending.finally(() => { if (queues.get(key) === pending) queues.delete(key); }).catch(() => {});
  return pending;
}

async function removeLegacy(key) {
  try { await chrome.storage.local.remove(key); } catch { /* Retry cleanup on the next load. */ }
}

async function load(key) {
  let latestChange = null;
  const onChanged = (changes, area) => {
    if (area === "sync" && changes[key]) latestChange = { [key]: changes[key].newValue };
  };
  chrome.storage.onChanged.addListener(onChanged);
  try {
    const synced = await chrome.storage.sync.get(key);
    if (latestChange || synced[key] !== undefined) {
      await removeLegacy(key);
      return (latestChange || synced)[key];
    }
    const legacy = await chrome.storage.local.get(key);
    if (latestChange) {
      await removeLegacy(key);
      return latestChange[key];
    }
    if (legacy[key] === undefined) return undefined;
    // Also respect Sync changes from other devices while a read is pending.
    const latest = await chrome.storage.sync.get(key);
    if (latestChange || latest[key] !== undefined) {
      await removeLegacy(key);
      return (latestChange || latest)[key];
    }
    const migrated = normalizers.get(key)(legacy[key]);
    try {
      await chrome.storage.sync.set({ [key]: migrated });
      await removeLegacy(key);
    } catch {
      // Failed writes retain the legacy value for the current load and a later retry.
    }
    return latestChange ? latestChange[key] : migrated;
  } finally {
    chrome.storage.onChanged.removeListener(onChanged);
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !normalizers.has(message?.key) ||
      !["chess-preferences-load", "chess-preferences-save"].includes(message?.type)) return false;
  const { key } = message;
  enqueue(key, async () => {
    if (message.type === "chess-preferences-load") return load(key);
    const value = normalizers.get(key)(message.value);
    await chrome.storage.sync.set({ [key]: value });
    await removeLegacy(key);
    return value;
  }).then(value => respond({ ok: true, value }), () => respond({ ok: false }));
  return true;
});
