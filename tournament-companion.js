(() => {
  "use strict";
  if (globalThis.ChessTournamentCompanion) return;
  const { parseUrl, mount } = globalThis.ChessTournamentCompanionView;
  const { geometry } = globalThis.ChessFloatingSettingsGeometry;
  const marker = "data-chess-tournament-companion";
  let host = null, root = null, frame = null, frameUrl = null, view = null, cancelLoad = null;
  let bounds = null, drag = null, returnFocus = null;
  const viewport = () => ({ width: innerWidth, height: innerHeight });
  function layout(value) {
    bounds = geometry(value, viewport());
    for (const name of ["left", "top", "width", "height"]) host.style[name] = `${bounds[name]}px`;
  }
  function cancelDrag(restore = true) {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (restore) layout(previous.bounds);
    if (previous.target.hasPointerCapture(previous.id)) previous.target.releasePointerCapture(previous.id);
    root.querySelector(".shield").hidden = true;
  }
  function close(focus = true) {
    if (!host) return;
    cancelDrag(false);
    cancelLoad?.(); cancelLoad = null;
    view?.dispose(); view = null;
    frame.remove(); frame = null; frameUrl = null;
    host.remove(); host = null; root = null;
    if (focus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
  function open(value, source) {
    const target = parseUrl(value);
    if (!target) return false;
    if (host) {
      if (frameUrl !== target.url) return false;
      root.querySelector(".move").focus({ preventScroll: true });
      return true;
    }
    returnFocus = source || document.activeElement;
    host = document.createElement("section");
    host.setAttribute(marker, "");
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-label", "Tournament companion");
    host.style.cssText = "position:fixed;z-index:10080;box-sizing:border-box";
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host { color: var(--color-text-default, #eee); font: 14px/1.4 system-ui, sans-serif; }
      * { box-sizing: border-box; }
      .panel { height:100%; display:flex; flex-direction:column; overflow:hidden; border:1px solid #888;
        border-radius:8px; background:var(--color-bg-opaque, #262421); box-shadow:0 8px 30px #0005; }
      header { display:flex; gap:6px; padding:6px; flex:0 0 auto; }
      button { font:inherit; color:inherit; background:transparent; border:1px solid #888; border-radius:4px; padding:4px 8px; cursor:pointer; }
      button:focus-visible { outline:3px solid #81b64c; outline-offset:1px; }
      .move { flex:1; min-width:0; text-align:left; cursor:move; touch-action:none; font-weight:700; }
      .resize { cursor:nwse-resize; touch-action:none; }
      .status { margin:0; padding:8px; font-size:12px; }
      [hidden] { display:none !important; }
      .content { position:relative; flex:1; min-height:0; display:flex; }
      iframe { flex:1; min-width:0; min-height:0; width:100%; border:0; visibility:hidden; }
      .shield { position:absolute; inset:0; }
    </style><div class="panel"><header>
      <button type="button" class="move" title="Drag or use arrow keys">Tournament companion</button>
      <button type="button" class="resize" aria-label="Resize tournament companion" title="Drag or use arrow keys">↘</button>
      <button type="button" class="close" aria-label="Close tournament companion">×</button>
    </header><div class="availability"><p class="status" role="status">Loading tournament…</p>
      <button type="button" class="restore" hidden>Show tournament</button></div><div class="content"><div class="shield" hidden></div></div></div>`;
    const currentRoot = root;
    frame = document.createElement("iframe");
    frame.title = "Native tournament chat and standings";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
    const currentFrame = frame;
    frameUrl = target.url;
    let loadTimer = null;
    cancelLoad = () => { clearTimeout(loadTimer); loadTimer = null; };
    function state(value) {
      if (frame !== currentFrame) return;
      if (value !== "loading") cancelLoad?.();
      const ready = value === "ready";
      currentFrame.style.visibility = ready ? "visible" : "hidden";
      const status = currentRoot.querySelector(".status");
      currentRoot.querySelector(".availability").hidden = ready;
      currentRoot.querySelector(".restore").hidden = value !== "unavailable" || !view;
      status.textContent = value === "loading" ? "Loading tournament…"
        : view ? "Tournament view unavailable. Select Show tournament to return, or close and reopen it from Share."
          : "Tournament view unavailable. Close and reopen it from the tournament's Share dialog.";
    }
    function loading() {
      cancelLoad?.();
      state("loading");
      // A local UI deadline, not a retry or a request to the service.
      loadTimer = setTimeout(() => state("unavailable"), 15000);
    }
    frame.addEventListener("load", () => {
      if (frame !== currentFrame) return;
      view?.dispose(); view = null;
      loading();
      try { view = mount(currentFrame.contentDocument, target.kind, state); }
      catch { state("unavailable"); }
    });
    root.querySelector(".restore").addEventListener("click", () => {
      loading();
      if (!view?.showTournament()) state("unavailable");
    });
    loading();
    frame.src = target.url;
    root.querySelector(".content").prepend(frame);
    root.querySelector(".close").addEventListener("click", () => close());
    // Header controls and the drag shield must not bubble game input to the host page.
    for (const type of ["pointerdown", "pointermove", "pointerup", "mousedown", "mousemove", "mouseup", "click", "dblclick", "contextmenu"]) {
      root.addEventListener(type, event => event.stopPropagation());
    }
    root.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); close(); }
    });
    for (const button of [root.querySelector(".move"), root.querySelector(".resize")]) {
      const resizing = button.className === "resize";
      button.addEventListener("keydown", event => {
        const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!vector || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const [dx, dy] = vector.map(n => n * (event.shiftKey ? 40 : 10));
        layout(resizing ? { ...bounds, width: bounds.width + dx, height: bounds.height + dy }
          : { ...bounds, left: bounds.left + dx, top: bounds.top + dy });
      });
      button.addEventListener("pointerdown", event => {
        if (event.button !== 0 || drag) return;
        event.preventDefault(); button.focus({ preventScroll: true });
        drag = { id: event.pointerId, target: button, x: event.clientX, y: event.clientY, bounds: { ...bounds } };
        root.querySelector(".shield").hidden = false;
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener("pointermove", event => {
        if (drag?.id !== event.pointerId) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        layout(resizing ? { ...drag.bounds, width: drag.bounds.width + dx, height: drag.bounds.height + dy }
          : { ...drag.bounds, left: drag.bounds.left + dx, top: drag.bounds.top + dy });
      });
      button.addEventListener("pointerup", event => { if (drag?.id === event.pointerId) cancelDrag(false); });
      for (const type of ["pointercancel", "lostpointercapture"]) button.addEventListener(type, event => { if (drag?.id === event.pointerId) cancelDrag(); });
    }
    document.body.append(host);
    layout(null);
    root.querySelector(".move").focus({ preventScroll: true });
    return true;
  }
  function refresh() {
    if (host && (!host.isConnected || !/^\/(?:play|game)(?:\/|$)/.test(location.pathname))) close(false);
    for (const input of document.querySelectorAll("input.share-event-modal-input")) {
      const content = input.closest(".share-event-modal-content");
      if (!content || content.querySelector("[data-chess-tournament-launcher]")) continue;
      if (!parseUrl(input.value) || !/^\/(?:play|game)(?:\/|$)/.test(location.pathname)) continue;
      const launcher = document.createElement("div");
      launcher.setAttribute("data-chess-tournament-launcher", "");
      const shadow = launcher.attachShadow({ mode: "open" });
      shadow.innerHTML = `<style>button { font:14px system-ui; padding:8px; margin-top:8px; cursor:pointer; }</style>
        <button type="button" title="Open a second native tournament page while keeping Play selected here">Open tournament companion</button><p role="status"></p>`;
      const button = shadow.querySelector("button");
      button.addEventListener("click", event => {
        event.stopPropagation();
        if (open(input.value, button)) content.closest("dialog")?.querySelector(".cc-modal-close-component")?.click();
        else shadow.querySelector("p").textContent = "Close the current companion before opening another tournament, and use the original Share link.";
      });
      content.append(launcher);
    }
  }
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("resize", () => { if (host) { cancelDrag(); layout(bounds); } });
  addEventListener("popstate", refresh);
  addEventListener("pagehide", () => close(false));
  addEventListener("pageshow", refresh);
  refresh();
  globalThis.ChessTournamentCompanion = Object.freeze({ open, close });
})();
