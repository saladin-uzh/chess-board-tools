(() => {
  "use strict";

  const KEYBINDING_STORAGE_KEY = "keybindings";
  const FOG_STORAGE_KEY = "fogPreferences";
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
  function normalizeAssist(value) {
    return { keyboard: value?.keyboard === true };
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

  function isInteractiveTarget(target) {
    return Boolean(target?.isContentEditable || target?.closest?.(
      'input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    ));
  }

  function hasInputFocus(event) {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return isInteractiveTarget(active) || isInteractiveTarget(event.target) ||
      Boolean(event.composedPath?.().some(isInteractiveTarget));
  }

  globalThis.ChessConfirmMoveSettings = Object.freeze({
    hasInputFocus,
    FOG_STORAGE_KEY,
    DEFAULT_FOG,
    normalizeFog,
    KEYBINDING_STORAGE_KEY,
    DEFAULT_KEYBINDINGS,
    CONFIRM_KEYS,
    CANCEL_KEYS,
    ASSIST_STORAGE_KEY,
    normalizeAssist,
    normalizeKeybindings,
  });
})();
