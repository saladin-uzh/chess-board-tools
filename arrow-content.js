(() => {
  "use strict";
  const { ARROW_STORAGE_KEY, normalizeArrows } = globalThis.ChessConfirmMoveSettings;
  let enabled = false;
  let revision = 0;
  let frame = null;
  const observers = new Map();
  const sizes = new Map();
  function schedule() {
    if (frame === null) frame = requestAnimationFrame(update);
  }
  function detach(board) {
    observers.get(board)?.disconnect();
    observers.delete(board);
    sizes.get(board)?.disconnect();
    sizes.delete(board);
    board.querySelector(":scope > .chess-arrow-numbers")?.remove();
  }
  function update() {
    frame = null;
    const boards = enabled ? [...document.querySelectorAll("wc-chess-board")] : [];
    for (const board of observers.keys()) if (!boards.includes(board)) detach(board);
    for (const board of boards) {
      if (!observers.has(board)) {
        const observer = new MutationObserver(records => {
          if (records.some(record => !record.target.closest?.(".chess-arrow-numbers, .chess-fog-overlay") &&
              !(record.type === "childList" && [...record.addedNodes, ...record.removedNodes].every(node =>
                node.classList?.contains("chess-arrow-numbers") || node.classList?.contains("chess-fog-overlay"))))) schedule();
        });
        observer.observe(board, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "points", "transform", "fill", "stroke"] });
        observers.set(board, observer);
        const size = new ResizeObserver(schedule);
        size.observe(board);
        sizes.set(board, size);
      }
      const rect = board.getBoundingClientRect();
      const arrows = globalThis.ChessArrowBoard.read(board);
      let overlay = board.querySelector(":scope > .chess-arrow-numbers");
      if (!arrows.length || !rect.width || !rect.height) { overlay?.remove(); continue; }
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "chess-arrow-numbers";
        overlay.setAttribute("aria-hidden", "true");
        board.append(overlay);
      }
      const labels = globalThis.ChessArrowBoard.number(arrows, rect.width, rect.height);
      overlay.replaceChildren(...labels.map(label => {
        const badge = document.createElement("span");
        badge.textContent = String(label.ordinal);
        badge.style.left = `${label.x}px`;
        badge.style.top = `${label.y}px`;
        badge.style.borderColor = label.color;
        return badge;
      }));
    }
  }
  const resize = new ResizeObserver(schedule);
  resize.observe(document.documentElement);
  const pageObserver = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches?.("wc-chess-board") || node.querySelector?.("wc-chess-board"))))) schedule();
  });
  pageObserver.observe(document.documentElement, { subtree: true, childList: true });
  function apply(value) { enabled = normalizeArrows(value).enabled; schedule(); }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[ARROW_STORAGE_KEY]) { revision++; apply(changes[ARROW_STORAGE_KEY].newValue); }
  });
  const loadingRevision = revision;
  chrome.storage.local.get(ARROW_STORAGE_KEY).then(data => {
    if (revision === loadingRevision) apply(data[ARROW_STORAGE_KEY]);
  }).catch(() => { if (revision === loadingRevision) apply(null); });
  addEventListener("resize", schedule);
  addEventListener("pageshow", schedule);
  addEventListener("pagehide", () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const board of observers.keys()) detach(board);
  });
})();
