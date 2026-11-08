(() => {
  "use strict";
  globalThis.ChessSettingsControllers ||= {};
  globalThis.ChessSettingsControllers.arrows = function (root = document) {
    const { ARROW_STORAGE_KEY, normalizeArrows } = globalThis.ChessConfirmMoveSettings;
    const toggle = root.querySelector("#number-arrows");
    const status = root.querySelector("#arrow-save-status");
    let saved = normalizeArrows(null);
    let revision = 0;
    let loading = true;
    let saving = false;
    function render() {
      toggle.checked = saved.enabled;
      toggle.disabled = loading || saving;
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[ARROW_STORAGE_KEY]) return;
      revision++;
      saved = normalizeArrows(changes[ARROW_STORAGE_KEY].newValue);
      status.textContent = "";
      render();
    });
    const loadRevision = revision;
    chrome.storage.local.get(ARROW_STORAGE_KEY).then(data => {
      if (revision === loadRevision) saved = normalizeArrows(data[ARROW_STORAGE_KEY]);
    }).catch(() => { status.textContent = "Arrow settings unavailable. Using defaults."; }).finally(() => {
      loading = false;
      render();
    });
    toggle.addEventListener("change", async () => {
      if (loading || saving) return;
      const next = normalizeArrows({ enabled: toggle.checked });
      const saveRevision = revision;
      saving = true;
      render();
      try {
        await chrome.storage.local.set({ [ARROW_STORAGE_KEY]: next });
        if (revision === saveRevision) saved = next;
        status.textContent = "Saved.";
      } catch { status.textContent = "Could not save arrow settings."; }
      finally { saving = false; render(); }
    });
  };
})();
