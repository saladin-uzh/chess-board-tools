(() => {
  "use strict";

  const KEYBINDING_STORAGE_KEY = "keybindings";
  const PRIMARY_BUTTON_SELECTOR =
    ':is(.cc-button-primary, [class^="cc-button-primary_"], [class*=" cc-button-primary_"])';
  const CONFIRM_BUTTON_SELECTOR = `div.confirm-move-buttons ${PRIMARY_BUTTON_SELECTOR}`;
  const FOG_STORAGE_KEY = "fogPreferences";
  const ARROW_STORAGE_KEY = "arrowNumberPreferences";
  const normalizeArrows = value => ({ enabled: value?.enabled === true });
  const DEFAULT_FOG = Object.freeze({ enabled: false, opacity: 0.55, perspective: "auto" });

  function normalizeFog(value) {
    const input = value && typeof value === "object" ? value : {};
    return {
      enabled: input.enabled === true,
      opacity: typeof input.opacity === "number" && Number.isFinite(input.opacity) && input.opacity >= 0.20 && input.opacity <= 0.80
        ? input.opacity : DEFAULT_FOG.opacity,
      perspective: ["auto", "white", "black"].includes(input.perspective) ? input.perspective : "auto",
    };
  }
  const DEFAULT_KEYBINDINGS = {
    confirmKeyCode: "Space",
    cancelKeyCode: "Escape",
  };
  const CONFIRM_KEYS = [
    { code: "Enter", label: "Enter" },
    { code: "Space", label: "Space" },
    { code: "Control", label: "Ctrl" },
  ];
  const CANCEL_KEYS = [
    { code: "Escape", label: "Esc" },
    { code: "Space", label: "Space" },
    { code: "Control", label: "Ctrl" },
  ];
  const ASSIST_STORAGE_KEY = "boardAssistPreferences";
  const TICK_FREQUENCIES = Object.freeze([2, 5, 10, 15, 20, 30]);
  function normalizeAssist(value) {
    const tickMode = ["auto", "increment", "amount"].includes(value?.tickMode) ? value.tickMode : "auto";
    return {
      keyboard: value?.keyboard === true,
      ticking: value?.ticking === true,
      tickMode,
      tickFrequency: tickMode === "amount" && TICK_FREQUENCIES.includes(value?.tickFrequency) ? value.tickFrequency : 10,
      tickVolume: typeof value?.tickVolume === "number" && Number.isFinite(value.tickVolume) &&
        value.tickVolume >= 0 && value.tickVolume <= 100 ? value.tickVolume : 50,
    };
  }

  function normalizeKeybindings(value) {
    if (value === null || typeof value !== "object") {
      return { ...DEFAULT_KEYBINDINGS };
    }

    const confirmKeyCode = CONFIRM_KEYS.some(key => key.code === value.confirmKeyCode)
      ? value.confirmKeyCode
      : DEFAULT_KEYBINDINGS.confirmKeyCode;
    const cancelKeyCode = CANCEL_KEYS.some(key => key.code === value.cancelKeyCode)
      ? value.cancelKeyCode
      : DEFAULT_KEYBINDINGS.cancelKeyCode;

    if (confirmKeyCode === cancelKeyCode) {
      return { ...DEFAULT_KEYBINDINGS };
    }

    return {
      confirmKeyCode,
      cancelKeyCode,
    };
  }

  const preferenceLoads = new Map();
  async function removeLegacyPreferences(key) {
    try { await chrome.storage.local.remove(key); } catch { /* Retry cleanup on the next load. */ }
  }
  function loadSyncedPreferences(key) {
    if (preferenceLoads.has(key)) return preferenceLoads.get(key);
    const loading = (async () => {
      const synced = await chrome.storage.sync.get(key);
      if (synced[key] !== undefined) {
        await removeLegacyPreferences(key);
        return synced;
      }
      const legacy = await chrome.storage.local.get(key);
      if (legacy[key] === undefined) return synced;
      // Another settings surface or device may have saved while local storage loaded.
      const latest = await chrome.storage.sync.get(key);
      if (latest[key] !== undefined) {
        await removeLegacyPreferences(key);
        return latest;
      }
      const normalize = key === FOG_STORAGE_KEY ? normalizeFog
        : key === ASSIST_STORAGE_KEY ? normalizeAssist : normalizeArrows;
      const migrated = { [key]: normalize(legacy[key]) };
      try {
        await chrome.storage.sync.set(migrated);
        await chrome.storage.local.remove(key);
      } catch {
        // Retain the local backup and current behavior if migration cannot complete.
      }
      return migrated;
    })();
    preferenceLoads.set(key, loading);
    loading.finally(() => preferenceLoads.delete(key)).catch(() => {});
    return loading;
  }

  function isInteractiveTarget(target) {
    return Boolean(target?.isContentEditable || target?.closest?.(
      'input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="button"], [role="link"], [data-chess-settings-ui]',
    ));
  }

  function hasInputFocus(event) {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return isInteractiveTarget(active) || isInteractiveTarget(event.target) ||
      Boolean(event.composedPath?.().some(isInteractiveTarget));
  }

  globalThis.ChessConfirmMoveSettings = Object.freeze({
    PRIMARY_BUTTON_SELECTOR,
    CONFIRM_BUTTON_SELECTOR,
    hasInputFocus,
    FOG_STORAGE_KEY,
    ARROW_STORAGE_KEY,
    normalizeArrows,
    DEFAULT_FOG,
    normalizeFog,
    KEYBINDING_STORAGE_KEY,
    DEFAULT_KEYBINDINGS,
    CONFIRM_KEYS,
    CANCEL_KEYS,
    ASSIST_STORAGE_KEY,
    TICK_FREQUENCIES,
    normalizeAssist,
    normalizeKeybindings,
    loadSyncedPreferences,
  });
})();
