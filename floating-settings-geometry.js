(() => {
  "use strict";
  const STORAGE_KEY = "floatingSettingsPreferences";
  function geometry(value, viewport) {
    const maxWidth = Math.max(1, viewport.width - 24);
    const maxHeight = Math.max(1, viewport.height - 24);
    const marginX = Math.min(12, Math.max(0, (viewport.width - maxWidth) / 2));
    const marginY = Math.min(12, Math.max(0, (viewport.height - maxHeight) / 2));
    const number = (input, fallback) => typeof input === "number" && Number.isFinite(input) ? input : fallback;
    const width = Math.min(maxWidth, Math.max(Math.min(300, maxWidth), number(value?.width, 360)));
    const height = Math.min(maxHeight, Math.max(Math.min(280, maxHeight), number(value?.height, 640)));
    return {
      left: Math.min(Math.max(marginX, number(value?.left, viewport.width - width - marginX)), Math.max(marginX, viewport.width - width - marginX)),
      top: Math.min(Math.max(marginY, number(value?.top, marginY)), Math.max(marginY, viewport.height - height - marginY)),
      width,
      height,
    };
  }
  globalThis.ChessFloatingSettingsGeometry = Object.freeze({ STORAGE_KEY, geometry });
})();
