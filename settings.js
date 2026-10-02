(() => {
  "use strict";

  const KEYBINDING_STORAGE_KEY = "keybindings";
  const DEFAULT_KEYBINDINGS = {
    confirmKeyCode: "Space",
    cancelKeyCode: "Escape",
  };
  const ALLOWED_KEYS = [
    { code: "Space", label: "Space" },
    { code: "Enter", label: "Enter" },
    { code: "Escape", label: "Escape" },
    { code: "KeyA", label: "A" },
    { code: "KeyS", label: "S" },
    { code: "KeyD", label: "D" },
    { code: "KeyF", label: "F" },
  ];

  function isAllowedKeyCode(code) {
    return ALLOWED_KEYS.some((key) => key.code === code);
  }

  function normalizeKeybindings(value) {
    if (value === null || typeof value !== "object") {
      return { ...DEFAULT_KEYBINDINGS };
    }

    const confirmKeyCode = isAllowedKeyCode(value.confirmKeyCode)
      ? value.confirmKeyCode
      : DEFAULT_KEYBINDINGS.confirmKeyCode;
    const cancelKeyCode = isAllowedKeyCode(value.cancelKeyCode)
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

  globalThis.ChessConfirmMoveSettings = Object.freeze({
    KEYBINDING_STORAGE_KEY,
    DEFAULT_KEYBINDINGS,
    ALLOWED_KEYS,
    normalizeKeybindings,
  });
})();
