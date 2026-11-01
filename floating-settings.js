(() => {
  "use strict";
  if (globalThis.ChessFloatingSettings) return;
  const { STORAGE_KEY, geometry } = globalThis.ChessFloatingSettingsGeometry;
  const host = document.createElement("div");
  host.setAttribute("data-chess-settings-ui", "");
  const root = host.attachShadow({ mode: "open" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    :host { all: initial; position: fixed; inset: 0; z-index: 10090; pointer-events: none;
      font: 14px/1.4 system-ui, sans-serif; color-scheme: light dark; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button, select, input { font: inherit; }
    button { cursor: pointer; }
    button:disabled { cursor: default; }
    button:focus-visible, input:focus-visible, select:focus-visible, [role=dialog]:focus-visible {
      outline: 3px solid var(--color-text-brand, #81b64c); outline-offset: 2px; }
    .launcher, .panel { pointer-events: auto; color: var(--color-text-default, light-dark(#25303b, #f0f3f6));
      background: var(--color-bg-opaque, light-dark(#fff, #262421)); border: 1px solid var(--color-text-brand, #81b64c); }
    .launcher { position: absolute; right: 12px; bottom: 12px; padding: 6px 10px; border-radius: 18px;
      max-width: calc(100% - 24px); box-shadow: 0 2px 8px #0003; }
    .panel { position: absolute; display: flex; flex-direction: column; border-radius: 12px;
      box-shadow: 0 8px 30px #0005; overflow: hidden; }
    .header { display: flex; flex-shrink: 0; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid #8886; }
    .move { flex: 1; min-width: 0; text-align: left; cursor: move; touch-action: none; font-weight: 700;
      border: 0; padding: 4px; background: none; color: inherit; }
    .mark { width: 24px; height: 24px; margin-right: 6px; vertical-align: middle; border-radius: 4px; }
    .close { border: 0; background: none; color: inherit; padding: 4px 8px; font-size: 20px; }
    .content { flex: 1; min-height: 0; overflow: auto; padding: 12px; overscroll-behavior: contain; }
    p { margin: 0; font-size: 12px; }
    h2 { margin: 0; font-size: 15px; }
    .settings, .assist-settings, .fog-settings { display: grid; gap: 8px; }
    .assist-settings, .fog-settings { border-top: 1px solid #8886; margin-top: 12px; padding-top: 12px; }
    .field { display: grid; gap: 4px; font-weight: 600; }
    .fog-toggle { display: flex; align-items: center; justify-content: space-between; }
    select { width: 100%; min-height: 32px; border: 1px solid #888; border-radius: 6px; padding: 4px;
      background: var(--color-bg-input, light-dark(#f3f5f7, #34312e)); color: inherit; }
    option { color: var(--color-text-default, light-dark(#25303b, #f0f3f6)); background: var(--color-bg-opaque, light-dark(#fff, #262421)); }
    input { accent-color: var(--color-text-brand, #81b64c); }
    input[type=range] { width: 100%; }
    .tick-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .status:empty { display: none; }
    .status--error { color: light-dark(#b42318, #ffb4ab); }
    .status--success { color: light-dark(#137333, #8ddb9f); }
    .footer { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 4px; padding: 4px 8px; font-size: 11px; }
    .resize { touch-action: none; cursor: nwse-resize; border: 0; background: none; color: inherit;
      min-width: 28px; min-height: 28px; }
  `);
  root.adoptedStyleSheets = [sheet];
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "launcher";
  launcher.textContent = "Chess Board Tools";
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-expanded", "false");
  root.append(launcher);
  let observedBody = null;
  const hostObserver = new MutationObserver(ensureHost);
  function ensureHost() {
    if (observedBody !== document.body) {
      observedBody = document.body;
      hostObserver.disconnect();
      hostObserver.observe(document.documentElement, { childList: true });
      if (observedBody) hostObserver.observe(observedBody, { childList: true });
    }
    if (observedBody && host.parentNode !== observedBody) observedBody.append(host);
  }
  ensureHost();

  let panel = null, move = null, resize = null, refreshStatus = null;
  let savedGeometry = null, currentGeometry = null, revision = 0, drag = null;
  let returnFocus = null, persistQueue = Promise.resolve();
  const viewport = () => ({ width: innerWidth, height: innerHeight });
  function layout(value) {
    currentGeometry = geometry(value, viewport());
    if (panel) {
      for (const name of ["left", "top", "width", "height"]) panel.style[name] = `${currentGeometry[name]}px`;
    }
  }
  function persist() {
    revision++;
    savedGeometry = { ...currentGeometry };
    const next = savedGeometry;
    // Serialize writes so a slower previous drag cannot replace a later resize.
    persistQueue = persistQueue.catch(() => {}).then(() => chrome.storage.local.set({ [STORAGE_KEY]: next }));
    persistQueue.then(() => {
      root.querySelector(".geometry-status").textContent = "";
    }, () => {
      root.querySelector(".geometry-status").textContent = "Window position could not be saved.";
    });
  }
  function close() {
    if (!panel || panel.hidden) return;
    drag = null;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    if (returnFocus?.isConnected && returnFocus !== document.body && returnFocus !== document.documentElement && typeof returnFocus.focus === "function") returnFocus.focus({ preventScroll: true });
    else launcher.focus({ preventScroll: true });
  }
  function startPointer(event) {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    revision++;
    drag = { id: event.pointerId, target: event.currentTarget, x: event.clientX, y: event.clientY,
      geometry: { ...currentGeometry }, resizing: event.currentTarget === resize };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePointer(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    const initial = drag.geometry;
    layout(drag.resizing ? { ...initial, width: initial.width + dx, height: initial.height + dy }
      : { ...initial, left: initial.left + dx, top: initial.top + dy });
  }
  function endPointer(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const initial = drag.geometry;
    const completed = event.type === "pointerup";
    drag = null;
    if (completed) persist();
    else layout(initial);
  }
  function keyboardGeometry(event) {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const [dx, dy] = delta.map(value => value * (event.shiftKey ? 40 : 10));
    const initial = currentGeometry;
    layout(event.currentTarget === resize ? { ...initial, width: initial.width + dx, height: initial.height + dy }
      : { ...initial, left: initial.left + dx, top: initial.top + dy });
    persist();
  }
  function createPanel() {
    panel = document.createElement("section");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chess Board Tools settings");
    panel.tabIndex = -1;
    // Only static extension-owned markup is inserted here.
    panel.innerHTML = `<header class="header">
      <button type="button" class="move" title="Move settings with arrow keys or drag"><img class="mark" alt="">Chess Board Tools</button>
      <button type="button" class="close" aria-label="Close settings">×</button>
    </header><div class="content"></div><footer class="footer">
      <span>Independent extension</span><span class="geometry-status" role="status"></span>
      <button type="button" class="resize" aria-label="Resize settings with arrow keys or drag">↘</button>
    </footer>`;
    root.append(panel);
    root.querySelector(".mark").src = chrome.runtime.getURL("icons/icon-32.png");
    move = root.querySelector(".move");
    resize = root.querySelector(".resize");
    refreshStatus = globalThis.ChessSettingsView.mount(root.querySelector(".content"), {
      readBoardStatus: () => ({ status: globalThis.ChessFogStatus?.read() || "Overlay unavailable. Reload this tab after updating the extension." }),
      subscribeBoardStatus: listener => globalThis.ChessFogStatus?.subscribe(listener),
    });
    root.querySelector(".close").addEventListener("click", close);
    for (const control of [move, resize]) {
      control.addEventListener("pointerdown", startPointer);
      control.addEventListener("pointermove", movePointer);
      control.addEventListener("pointerup", endPointer);
      control.addEventListener("pointercancel", endPointer);
      control.addEventListener("lostpointercapture", endPointer);
      control.addEventListener("keydown", keyboardGeometry);
    }
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      event.stopPropagation();
    });
  }
  function open() {
    if (!panel || panel.hidden) {
      returnFocus = root.activeElement || document.activeElement;
      if (!panel) createPanel();
      panel.hidden = false;
      layout(savedGeometry);
      launcher.setAttribute("aria-expanded", "true");
    }
    refreshStatus();
    move.focus({ preventScroll: true });
  }
  launcher.addEventListener("click", open);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== "chess-open-settings") return;
    open();
    respond({ opened: true });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    revision++;
    savedGeometry = changes[STORAGE_KEY].newValue || null;
  });
  const loadRevision = revision;
  chrome.storage.local.get(STORAGE_KEY).then(data => {
    if (revision !== loadRevision) return;
    savedGeometry = data[STORAGE_KEY] || null;
    if (panel && !panel.hidden) layout(savedGeometry);
  }).catch(() => {});
  addEventListener("resize", () => { if (panel && !panel.hidden) layout(currentGeometry); });
  addEventListener("pageshow", () => { if (panel && !panel.hidden) { layout(currentGeometry); refreshStatus(); } });
  globalThis.ChessFloatingSettings = Object.freeze({ open });
})();
