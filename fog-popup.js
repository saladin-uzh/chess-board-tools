(() => {
  "use strict";
  globalThis.ChessSettingsControllers ||= {};
  globalThis.ChessSettingsControllers.fog = function (root = document, options = {}) {
    const { FOG_STORAGE_KEY, normalizeFog } = globalThis.ChessConfirmMoveSettings;
    const enabled = root.querySelector("#fog-enabled");
    const opacity = root.querySelector("#fog-opacity");
    const opacityValue = root.querySelector("#fog-opacity-value");
    const perspective = root.querySelector("#fog-perspective");
    const status = root.querySelector("#fog-save-status");
    const boardStatus = root.querySelector("#fog-board-status");
    const controls = [enabled, opacity, perspective];
    let saved = normalizeFog(null);
    let revision = 0;
    let loading = true;
    let saving = false;
    let statusRevision = 0;

    function render() {
      enabled.checked = saved.enabled;
      opacity.value = String(Math.round(saved.opacity * 100));
      opacityValue.textContent = `${opacity.value}%`;
      perspective.value = saved.perspective;
      controls.forEach(control => { control.disabled = loading || saving; });
    }

    async function showBoardStatus() {
      const requestRevision = ++statusRevision;
      try {
        const response = await (options.readBoardStatus || (async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          return tab?.id === undefined ? null : chrome.tabs.sendMessage(tab.id, { type: "chess-fog-status" });
        }))();
        if (statusRevision === requestRevision) boardStatus.textContent = response?.status || "Overlay unavailable. Open a supported board and reload.";
      } catch {
        if (statusRevision === requestRevision) boardStatus.textContent = "Overlay unavailable. Open a supported board and reload.";
      }
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[FOG_STORAGE_KEY]) return;
      revision++;
      saved = normalizeFog(changes[FOG_STORAGE_KEY].newValue);
      render();
      showBoardStatus();
    });
    const loadRevision = revision;
    chrome.storage.local.get(FOG_STORAGE_KEY).then(data => {
      if (revision === loadRevision) saved = normalizeFog(data[FOG_STORAGE_KEY]);
    }).catch(() => { status.textContent = "Fog settings unavailable. Using defaults."; }).finally(() => {
      loading = false;
      render();
    });

    async function save() {
      if (loading || saving) return;
      const next = normalizeFog({ enabled: enabled.checked, opacity: Number(opacity.value) / 100, perspective: perspective.value });
      const saveRevision = revision;
      saving = true;
      controls.forEach(control => { control.disabled = true; });
      try {
        await chrome.storage.local.set({ [FOG_STORAGE_KEY]: next });
        if (revision === saveRevision) saved = next;
        status.textContent = "Saved.";
      } catch { status.textContent = "Could not save fog settings."; }
      finally { saving = false; render(); showBoardStatus(); }
    }
    controls.forEach(control => control.addEventListener("change", save));
    opacity.addEventListener("input", () => { opacityValue.textContent = `${opacity.value}%`; });
    options.subscribeBoardStatus?.(showBoardStatus);
    showBoardStatus();
    return showBoardStatus;
  };
})();
