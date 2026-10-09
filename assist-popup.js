(() => {
  "use strict";
  const { ASSIST_STORAGE_KEY, normalizeAssist } = globalThis.ChessConfirmMoveSettings;
  const keyboard = document.querySelector("#keyboard-enabled");
  const status = document.querySelector("#assist-save-status");
  let saved = normalizeAssist(null);
  let revision = 0;
  let loading = true;
  let saving = false;
  function render() {
    keyboard.checked = saved.keyboard;
    keyboard.disabled = loading || saving;
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[ASSIST_STORAGE_KEY]) return;
    revision++;
    saved = normalizeAssist(changes[ASSIST_STORAGE_KEY].newValue);
    render();
  });
  const loadRevision = revision;
  chrome.storage.local.get(ASSIST_STORAGE_KEY).then(data => {
    if (revision === loadRevision) saved = normalizeAssist(data[ASSIST_STORAGE_KEY]);
  }).catch(() => { status.textContent = "Board helper settings unavailable. Using defaults."; })
    .finally(() => { loading = false; render(); });
  async function save() {
    if (loading || saving) return;
    const next = normalizeAssist({ keyboard: keyboard.checked });
    const saveRevision = revision;
    saving = true;
    keyboard.disabled = true;
    try {
      await chrome.storage.local.set({ [ASSIST_STORAGE_KEY]: next });
      if (revision === saveRevision) saved = next;
      status.textContent = "Saved.";
    } catch { status.textContent = "Could not save board helper settings."; }
    finally { saving = false; render(); }
  }
  keyboard.addEventListener("change", save);
})();
