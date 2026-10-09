(() => {
  "use strict";

  const {
    CONFIRM_KEYS,
    CANCEL_KEYS,
    KEYBINDING_STORAGE_KEY,
    normalizeKeybindings,
  } = globalThis.ChessConfirmMoveSettings;

  const confirmSelect = document.querySelector("#confirm-key");
  const cancelSelect = document.querySelector("#cancel-key");
  const statusElement = document.querySelector("#status");
  let savedKeybindings = normalizeKeybindings(null);
  let statusTimer = null;
  let revision = 0;
  let loading = true;
  let saving = false;

  function setStatus(message, type = "") {
    window.clearTimeout(statusTimer);
    statusElement.textContent = message;
    statusElement.className = `status${type ? ` status--${type}` : ""}`;

    if (type === "success") {
      statusTimer = window.setTimeout(() => {
        statusElement.textContent = "";
        statusElement.className = "status";
      }, 1800);
    }
  }

  function createOption(key) {
    const option = document.createElement("option");
    option.value = key.code;
    option.textContent = key.label;
    return option;
  }

  function populateSelects() {
    for (const key of CONFIRM_KEYS) confirmSelect.append(createOption(key));
    for (const key of CANCEL_KEYS) cancelSelect.append(createOption(key));
  }

  function renderKeybindings(keybindings) {
    confirmSelect.value = keybindings.confirmKeyCode;
    cancelSelect.value = keybindings.cancelKeyCode;
  }

  function getSelectedKeybindings() {
    return normalizeKeybindings({
      confirmKeyCode: confirmSelect.value,
      cancelKeyCode: cancelSelect.value,
    });
  }

  function restoreSavedKeybindings() {
    renderKeybindings(savedKeybindings);
    confirmSelect.disabled = loading || saving;
    cancelSelect.disabled = loading || saving;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[KEYBINDING_STORAGE_KEY]) return;
    revision++;
    savedKeybindings = normalizeKeybindings(changes[KEYBINDING_STORAGE_KEY].newValue);
    restoreSavedKeybindings();
    setStatus("");
  });

  async function loadKeybindings() {
    const loadRevision = revision;
    try {
      const data = await chrome.storage.sync.get(KEYBINDING_STORAGE_KEY);
      if (revision === loadRevision) {
        savedKeybindings = normalizeKeybindings(data[KEYBINDING_STORAGE_KEY]);
      }
    } catch (error) {
      if (revision === loadRevision) {
        savedKeybindings = normalizeKeybindings(null);
        setStatus("Settings unavailable. Using defaults.", "error");
      }
    } finally {
      loading = false;
      restoreSavedKeybindings();
    }
  }

  async function saveKeybindings() {
    if (loading || saving) return;
    if (confirmSelect.value === cancelSelect.value) {
      restoreSavedKeybindings();
      setStatus("Choose different keys.", "error");
      return;
    }

    const nextKeybindings = getSelectedKeybindings();
    const saveRevision = revision;
    saving = true;
    confirmSelect.disabled = true;
    cancelSelect.disabled = true;

    try {
      await chrome.storage.sync.set({
        [KEYBINDING_STORAGE_KEY]: nextKeybindings,
      });
      if (revision === saveRevision) {
        savedKeybindings = nextKeybindings;
      }
      if (savedKeybindings.confirmKeyCode === nextKeybindings.confirmKeyCode &&
          savedKeybindings.cancelKeyCode === nextKeybindings.cancelKeyCode) {
        setStatus("Saved.", "success");
      }
    } catch (error) {
      restoreSavedKeybindings();
      setStatus("Could not save settings.", "error");
    } finally {
      saving = false;
      restoreSavedKeybindings();
    }
  }

  populateSelects();
  loadKeybindings();

  confirmSelect.addEventListener("change", saveKeybindings);
  cancelSelect.addEventListener("change", saveKeybindings);
})();
