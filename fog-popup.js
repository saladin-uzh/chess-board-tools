(() => {
  "use strict";
  const { FOG_STORAGE_KEY, normalizeFog } = globalThis.ChessConfirmMoveSettings;
  const enabled = document.querySelector("#fog-enabled");
  const opacity = document.querySelector("#fog-opacity");
  const opacityValue = document.querySelector("#fog-opacity-value");
  const perspective = document.querySelector("#fog-perspective");
  const status = document.querySelector("#fog-save-status");
  const boardStatus = document.querySelector("#fog-board-status");
  const controls = [enabled, opacity, perspective];
  let saved = normalizeFog(null);
  let revision = 0;
  let loading = true;
  let saving = false;

  function render() {
    enabled.checked = saved.enabled;
    opacity.value = String(Math.round(saved.opacity * 100));
    opacityValue.textContent = `${opacity.value}%`;
    perspective.value = saved.perspective;
    controls.forEach(control => { control.disabled = loading || saving; });
  }

  async function showBoardStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = tab?.id === undefined ? null : await chrome.tabs.sendMessage(tab.id, { type: "chess-fog-status" });
      boardStatus.textContent = response?.status || "Fog unavailable. Open a bot or analysis board and reload the page.";
    } catch { boardStatus.textContent = "Fog unavailable. Open a bot or analysis board and reload the page."; }
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
  showBoardStatus();
})();
