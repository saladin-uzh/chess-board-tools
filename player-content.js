(() => {
  "use strict";
  const { PLAYER_STORAGE_KEY, normalizePlayers } = globalThis.ChessConfirmMoveSettings;
  const panels = "#board-layout-player-top, #board-layout-player-bottom, #player-top, #player-bottom";
  const labelClass = "chess-player-label";
  let enabled = false;
  let revision = 0;
  let frame = null;
  let timer = null;

  function schedule() {
    if (enabled && frame === null) frame = requestAnimationFrame(update);
  }
  function update() {
    frame = null;
    if (!enabled) return;
    const board = document.querySelector("wc-chess-board#board-single, wc-chess-board#board-analysis-board, wc-chess-board#board-play-computer");
    const coordinates = board && globalThis.ChessBoardAssist?.readCoordinates(board);
    for (const panel of document.querySelectorAll(panels)) {
      // Computer pages nest #player-top/bottom inside the layout panels.
      if (panel.parentElement?.closest(panels)) continue;
      const clock = panel.querySelector(".clock-white, .clock-black");
      const captured = panel.querySelector("wc-captured-pieces[player-color]");
      let color = clock ? (clock.classList.contains("clock-white") ? "White" : "Black")
        : captured?.getAttribute("player-color") === "1" ? "White"
        : captured?.getAttribute("player-color") === "2" ? "Black" : null;
      if (!color && coordinates) {
        const top = panel.id === "player-top" || panel.id === "board-layout-player-top";
        color = top === coordinates.flipped ? "White" : "Black";
      }
      for (const block of panel.querySelectorAll(".cc-user-block-component")) {
        let label = block.previousElementSibling;
        if (!label?.classList.contains(labelClass)) {
          label = document.createElement("span");
          label.className = labelClass;
          block.before(label);
        }
        const text = color || "";
        if (label.textContent !== text) label.textContent = text;
      }
    }
  }
  const observer = new MutationObserver(records => {
    if (records.some(record => {
      if (record.target.closest?.(panels)) return true;
      return record.type === "childList" && [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === 1 && (node.matches?.(panels) || node.querySelector?.(panels)));
    })) schedule();
  });
  function stop() {
    observer.disconnect();
    clearInterval(timer);
    timer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    document.documentElement.removeAttribute("data-chess-hide-players");
    for (const label of document.querySelectorAll(`.${labelClass}`)) label.remove();
  }
  function start() {
    stop();
    if (!enabled) return;
    document.documentElement.setAttribute("data-chess-hide-players", "");
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "player-color"] });
    // The existing read-only board bridge supplies orientation on clockless bot boards.
    timer = setInterval(schedule, 500);
    schedule();
  }
  function apply(value) {
    enabled = normalizePlayers(value).enabled;
    start();
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[PLAYER_STORAGE_KEY]) {
      revision++;
      apply(changes[PLAYER_STORAGE_KEY].newValue);
    }
  });
  const loadRevision = revision;
  chrome.storage.sync.get(PLAYER_STORAGE_KEY).then(data => {
    if (revision === loadRevision) apply(data[PLAYER_STORAGE_KEY]);
  }).catch(() => { if (revision === loadRevision) apply(null); });
  addEventListener("pagehide", stop);
  addEventListener("pageshow", start);
})();
