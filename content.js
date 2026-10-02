(() => {
  "use strict";

  const INTERACTIVE_TARGET_SELECTOR =
    'input, textarea, select, button, [contenteditable="true"], [role="textbox"]';
  const CONFIRM_BUTTON_SELECTOR =
    "div.confirm-move-buttons .cc-button-primary";
  const BUTTONS_ROOT_SELECTOR = "div.confirm-move-buttons";
  const CANCEL_CANDIDATE_SELECTOR = "button, .cc-button, a";
  const {
    KEYBINDING_STORAGE_KEY,
    normalizeKeybindings,
  } = globalThis.ChessConfirmMoveSettings;
  let keybindings = normalizeKeybindings(null);

  function isClickable(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.pointerEvents !== "none" &&
      !element.disabled &&
      element.getAttribute("aria-disabled") !== "true"
    );
  }

  function findConfirmButton() {
    const button = document.querySelector(CONFIRM_BUTTON_SELECTOR);
    return isClickable(button) ? button : null;
  }

  function findCancelButton() {
    const root = document.querySelector(BUTTONS_ROOT_SELECTOR);
    if (!(root instanceof HTMLElement)) {
      return null;
    }

    const candidates = root.querySelectorAll(CANCEL_CANDIDATE_SELECTOR);
    return (
      Array.from(candidates).find(
        (candidate) =>
          !candidate.classList.contains("cc-button-primary") &&
          isClickable(candidate),
      ) ?? null
    );
  }

  function isInteractiveTarget(target) {
    return (
      target !== null &&
      typeof target.closest === "function" &&
      target.closest(INTERACTIVE_TARGET_SELECTOR) !== null
    );
  }

  function handleKeydown(event) {
    if (
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }

    let button = null;

    if (matchesKeybinding(event, keybindings.confirmKeyCode)) {
      button = findConfirmButton();
    } else if (matchesKeybinding(event, keybindings.cancelKeyCode)) {
      button = findCancelButton();
    }

    if (button === null) {
      return;
    }

    button.click();
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function matchesKeybinding(event, keyCode) {
    if (keyCode.startsWith("Key")) {
      return event.key.toUpperCase() === keyCode.slice(3);
    }

    return event.code === keyCode;
  }

  async function loadKeybindings() {
    try {
      const data = await chrome.storage.sync.get(KEYBINDING_STORAGE_KEY);
      keybindings = normalizeKeybindings(data[KEYBINDING_STORAGE_KEY]);
    } catch (error) {
      keybindings = normalizeKeybindings(null);
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || changes[KEYBINDING_STORAGE_KEY] === undefined) {
      return;
    }

    keybindings = normalizeKeybindings(changes[KEYBINDING_STORAGE_KEY].newValue);
  });

  loadKeybindings().then(() => {
    window.addEventListener("keydown", handleKeydown, true);
    console.info("[Chess.com Confirm Move Hotkeys] Initialized.");
  });
})();
