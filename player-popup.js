(() => {
  "use strict";
  globalThis.ChessSettingsControllers ||= {};
  globalThis.ChessSettingsControllers.players = function (root = document) {
    const { PLAYER_STORAGE_KEY, normalizePlayers } = globalThis.ChessConfirmMoveSettings;
    const toggle = root.querySelector("#hide-player-info");
    const status = root.querySelector("#player-save-status");
    let saved = normalizePlayers(null);
    let revision = 0;
    let loading = true;
    let saving = false;
    function render() {
      toggle.checked = saved.enabled;
      toggle.disabled = loading || saving;
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes[PLAYER_STORAGE_KEY]) return;
      revision++;
      saved = normalizePlayers(changes[PLAYER_STORAGE_KEY].newValue);
      status.textContent = "";
      render();
    });
    const loadRevision = revision;
    chrome.storage.sync.get(PLAYER_STORAGE_KEY).then(data => {
      if (revision === loadRevision) saved = normalizePlayers(data[PLAYER_STORAGE_KEY]);
    }).catch(() => { status.textContent = "Player privacy settings unavailable. Using defaults."; }).finally(() => {
      loading = false;
      render();
    });
    toggle.addEventListener("change", async () => {
      if (loading || saving) return;
      const next = normalizePlayers({ enabled: toggle.checked });
      const saveRevision = revision;
      saving = true;
      render();
      try {
        await chrome.storage.sync.set({ [PLAYER_STORAGE_KEY]: next });
        if (revision === saveRevision) saved = next;
        status.textContent = "Saved.";
      } catch { status.textContent = "Could not save player privacy settings."; }
      finally { saving = false; render(); }
    });
  };
})();
