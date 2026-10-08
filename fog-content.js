(() => {
  "use strict";
  const { FOG_STORAGE_KEY, normalizeFog } = globalThis.ChessConfirmMoveSettings;
  const { read } = globalThis.ChessFogBoard;
  const { visibility } = globalThis.ChessFogVisibility;
  let preferences = normalizeFog(null);
  let revision = 0;
  let board = null;
  let overlay = null;
  let notice = null;
  let boardObserver = null;
  let resizeObserver = null;
  let timer = null;
  let frame = null;
  let status = "Fog is disabled.";

  function removeMask() {
    overlay?.remove();
    overlay = null;
  }

  function detach() {
    boardObserver?.disconnect();
    resizeObserver?.disconnect();
    boardObserver = resizeObserver = null;
    removeMask();
    notice?.remove();
    notice = null;
    board = null;
  }

  function attach(next) {
    detach();
    board = next;
    if (!board) return;
    boardObserver = new MutationObserver(records => {
      if (records.some(record => !record.target.closest?.(".chess-fog-overlay, .chess-fog-notice") &&
          !(record.type === "childList" && [...record.addedNodes, ...record.removedNodes].every(node => node === overlay || node === notice || node.classList?.contains("chess-fog-overlay") || node.classList?.contains("chess-fog-notice"))))) schedule();
    });
    boardObserver.observe(board, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(board);
  }

  function update() {
    frame = null;
    if (!preferences.enabled) { detach(); status = "Fog is disabled."; return; }
    const next = document.querySelector("wc-chess-board#board-play-computer, wc-chess-board#board-analysis-board");
    if (next !== board) attach(next);
    const snapshot = board ? read(board, preferences.perspective) : null;
    const rect = board?.getBoundingClientRect();
    if (!snapshot || snapshot.unavailable || !rect?.width || !rect?.height || Math.abs(rect.width - rect.height) > 1) {
      removeMask();
      status = snapshot?.unavailable || "Fog unavailable on this board or while the position is changing.";
      if (snapshot?.unavailable && board) {
        if (!notice) {
          notice = document.createElement("div");
          notice.className = "chess-fog-notice";
          notice.setAttribute("role", "status");
          board.append(notice);
        }
        if (notice.textContent !== status) notice.textContent = status;
      } else { notice?.remove(); notice = null; }
      return;
    }
    notice?.remove(); notice = null;
    const masks = visibility(snapshot.position, snapshot.side, snapshot.selected);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "chess-fog-overlay";
      overlay.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 64; i++) overlay.append(document.createElement("span"));
      board.append(overlay);
    }
    overlay.style.setProperty("--chess-fog-opacity", String(preferences.opacity));
    for (let view = 0; view < 64; view++) {
      const square = snapshot.flipped ? Math.floor(view / 8) * 8 + 7 - view % 8 : (7 - Math.floor(view / 8)) * 8 + view % 8;
      const cell = overlay.children[view];
      cell.classList.toggle("chess-fog-hidden", !masks.union[square]);
      cell.classList.toggle("chess-fog-selected", masks.selected?.[square] === true);
    }
    status = `Fog active for ${snapshot.side}.`;
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(update);
  }

  function apply(value) {
    preferences = normalizeFog(value);
    clearInterval(timer);
    timer = preferences.enabled ? setInterval(schedule, 150) : null;
    schedule();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[FOG_STORAGE_KEY]) {
      revision++;
      apply(changes[FOG_STORAGE_KEY].newValue);
    }
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "chess-fog-status") respond({ status });
  });
  const loadingRevision = revision;
  chrome.storage.local.get(FOG_STORAGE_KEY).then(data => {
    if (revision === loadingRevision) apply(data[FOG_STORAGE_KEY]);
  }).catch(() => { if (revision === loadingRevision) apply(null); });
  addEventListener("pagehide", () => {
    clearInterval(timer);
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    detach();
  });
  addEventListener("pageshow", () => apply(preferences));
})();
