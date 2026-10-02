(() => {
  "use strict";

  const {
    ALLOWED_KEYS,
    KEYBINDING_STORAGE_KEY,
    normalizeKeybindings,
  } = globalThis.ChessConfirmMoveSettings;

  const confirmSelect = document.querySelector("#confirm-key");
  const cancelSelect = document.querySelector("#cancel-key");
  const statusElement = document.querySelector("#status");
  let savedKeybindings = normalizeKeybindings(null);
  let statusTimer = null;

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
    for (const key of ALLOWED_KEYS) {
      confirmSelect.append(createOption(key));
      cancelSelect.append(createOption(key));
    }
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
  }

  async function loadKeybindings() {
    try {
      const data = await chrome.storage.sync.get(KEYBINDING_STORAGE_KEY);
      savedKeybindings = normalizeKeybindings(data[KEYBINDING_STORAGE_KEY]);
      renderKeybindings(savedKeybindings);
    } catch (error) {
      savedKeybindings = normalizeKeybindings(null);
      renderKeybindings(savedKeybindings);
      setStatus("Settings unavailable. Using defaults.", "error");
    } finally {
      confirmSelect.disabled = false;
      cancelSelect.disabled = false;
    }
  }

  async function saveKeybindings() {
    if (confirmSelect.value === cancelSelect.value) {
      restoreSavedKeybindings();
      setStatus("Choose different keys.", "error");
      return;
    }

    const nextKeybindings = getSelectedKeybindings();
    confirmSelect.disabled = true;
    cancelSelect.disabled = true;

    try {
      await chrome.storage.sync.set({
        [KEYBINDING_STORAGE_KEY]: nextKeybindings,
      });
      savedKeybindings = nextKeybindings;
      setStatus("Saved.", "success");
    } catch (error) {
      restoreSavedKeybindings();
      setStatus("Could not save settings.", "error");
    } finally {
      confirmSelect.disabled = false;
      cancelSelect.disabled = false;
    }
  }

  populateSelects();
  loadKeybindings();

  confirmSelect.addEventListener("change", saveKeybindings);
  cancelSelect.addEventListener("change", saveKeybindings);
})();
