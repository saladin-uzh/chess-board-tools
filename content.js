(() => {
  "use strict";

  const CONFIRM_BUTTON_SELECTOR =
    "div.confirm-move-buttons .cc-button-primary";
  const BUTTONS_ROOT_SELECTOR = "div.confirm-move-buttons";
  const CANCEL_CANDIDATE_SELECTOR = "button, .cc-button, a";
  const {
    hasInputFocus,
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

  let controlPress = null;

  function act(event, code) {
    if (hasInputFocus(event)) return;
    const button = code === keybindings.confirmKeyCode ? findConfirmButton()
      : code === keybindings.cancelKeyCode ? findCancelButton() : null;
    if (!button) return;
    globalThis.ChessAssistInput?.clear();
    button.click();
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleKeydown(event) {
    if (controlPress && event.code !== controlPress) controlPress = null;
    if (event.code === "ControlLeft" || event.code === "ControlRight") {
      if (!event.repeat && !event.metaKey && !event.altKey && !event.shiftKey && !hasInputFocus(event)) {
        controlPress = event.code;
      }
      return;
    }
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    act(event, event.code);
  }

  function handleKeyup(event) {
    if (event.code !== "ControlLeft" && event.code !== "ControlRight") return;
    const standalone = controlPress === event.code;
    controlPress = null;
    if (standalone && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) act(event, "Control");
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
    window.addEventListener("keyup", handleKeyup, true);
    window.addEventListener("blur", () => { controlPress = null; });
    window.addEventListener("focusin", () => { controlPress = null; }, true);
    window.addEventListener("pagehide", () => { controlPress = null; });
    console.info("[Chess.com Confirm Move Hotkeys] Initialized.");
  });
})();
