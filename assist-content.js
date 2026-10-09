(() => {
  "use strict";
  const { ASSIST_STORAGE_KEY, normalizeAssist, hasInputFocus } = globalThis.ChessConfirmMoveSettings;
  const { read, clickSquare, clickPromotion } = globalThis.ChessBoardAssist;
  const { createTurnTimer, createAudio } = globalThis.ChessAssistTimer;
  const turnTimer = createTurnTimer(), audio = createAudio();
  let preferences = normalizeAssist(null), revision = 0;
  let lastVisibility = document.visibilityState;
  let board = null, identity = null, file = null, bufferTimer = null, pollTimer = null, indicator = null;
  function clear() {
    file = null;
    clearTimeout(bufferTimer); bufferTimer = null;
    indicator?.remove(); indicator = null;
  }
  globalThis.ChessAssistInput = Object.freeze({ clear });
  function clickable(element) {
    const rect = element?.getBoundingClientRect();
    const style = element && getComputedStyle(element);
    return Boolean(rect?.width && rect?.height && style.display !== "none" && style.visibility !== "hidden" &&
      style.pointerEvents !== "none" && !element.disabled && element.getAttribute("aria-disabled") !== "true");
  }
  function promotion() {
    const picker = board?.querySelector(".promotion-window--visible");
    return clickable(picker) ? picker : null;
  }
  function update() {
    const next = document.querySelector("wc-chess-board#board-play-computer, wc-chess-board#board-analysis-board, wc-chess-board#board-single");
    if (next !== board) { clear(); turnTimer.reset(); identity = null; board = next; }
    const rect = board?.getBoundingClientRect();
    const geometryValid = rect?.width > 0 && rect?.height > 0 && Math.abs(rect.width - rect.height) <= 1;
    const snapshot = board && geometryValid ? read(board) : null;
    const nextIdentity = snapshot ? `${location.pathname}:${snapshot.session}:${snapshot.fen}:${snapshot.flipped}` : null;
    if (!snapshot?.stable) clear();
    if (nextIdentity !== identity) { clear(); identity = nextIdentity; }
    const pending = clickable(document.querySelector("div.confirm-move-buttons .cc-button-primary"));
    const visible = document.visibilityState === "visible";
    const resumed = lastVisibility !== "visible" && visible;
    lastVisibility = document.visibilityState;
    if (preferences.ticking && turnTimer.update(snapshot, performance.now(), visible && !resumed, pending)) audio.tick();
    return snapshot;
  }
  function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
  function handleKeydown(event) {
    if (!preferences.keyboard) return;
    if (hasInputFocus(event)) { clear(); return; }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.code === "Escape") { clear(); return; }
    const snapshot = update();
    if (!snapshot?.stable || (snapshot.context !== "analysis" && !snapshot.active)) { clear(); return; }
    const picker = promotion();
    const key = event.key?.toLowerCase();
    if (picker) {
      clear();
      if (!/^[qrbn]$/.test(key || "")) return;
      const candidates = [...picker.querySelectorAll(`.promotion-piece.w${key}, .promotion-piece.b${key}`)].filter(clickable);
      if (candidates.length === 1) { if (clickPromotion(candidates[0])) consume(event); }
      return;
    }
    if (/^[a-h]$/.test(key || "")) {
      clear(); file = key;
      const rect = board.getBoundingClientRect();
      indicator = document.createElement("div");
      indicator.className = "chess-assist-coordinate";
      indicator.setAttribute("role", "status");
      indicator.textContent = `${file}…`;
      indicator.style.left = `${rect.left + 4}px`; indicator.style.top = `${rect.top + 4}px`;
      document.body.append(indicator);
      bufferTimer = setTimeout(clear, 5000);
      consume(event);
    } else if (/^[1-8]$/.test(key || "") && file) {
      const square = `${file}${key}`;
      clear();
      if (clickSquare(board, square, snapshot)) consume(event);
    }
  }
  function apply(value) {
    const next = normalizeAssist(value);
    if (next.ticking !== preferences.ticking) turnTimer.reset();
    preferences = next;
    clear();
    clearInterval(pollTimer); pollTimer = null;
    if (!preferences.ticking) audio.close();
    if (preferences.keyboard || preferences.ticking) {
      update(); pollTimer = setInterval(update, 100);
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[ASSIST_STORAGE_KEY]) return;
    revision++; apply(changes[ASSIST_STORAGE_KEY].newValue);
  });
  const loadRevision = revision;
  chrome.storage.local.get(ASSIST_STORAGE_KEY).then(data => {
    if (revision === loadRevision) apply(data[ASSIST_STORAGE_KEY]);
  }).catch(() => { if (revision === loadRevision) apply(null); });
  const unlock = event => {
    if (preferences.ticking && event.isTrusted && document.visibilityState === "visible") audio.unlock();
  };
  addEventListener("pointerdown", unlock, true);
  addEventListener("keydown", unlock, true);
  addEventListener("keydown", handleKeydown, true);
  addEventListener("focusin", clear, true);
  addEventListener("blur", clear);
  addEventListener("scroll", clear, true);
  addEventListener("resize", clear);
  document.addEventListener("visibilitychange", () => {
    clear(); if (preferences.keyboard || preferences.ticking) update();
  });
  addEventListener("pagehide", () => {
    clear(); clearInterval(pollTimer); pollTimer = null; turnTimer.reset(); audio.close();
  });
  addEventListener("pageshow", () => apply(preferences));
})();
