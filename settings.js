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
    FOG_STORAGE_KEY,
    DEFAULT_FOG,
    normalizeFog,
    KEYBINDING_STORAGE_KEY,
    DEFAULT_KEYBINDINGS,
    ALLOWED_KEYS,
    normalizeKeybindings,
  });
})();
