(() => {
  "use strict";
  const { PLAYER_STORAGE_KEY, normalizePlayers } = globalThis.ChessConfirmMoveSettings;
  const panels = "#board-layout-player-top, #board-layout-player-bottom, #player-top, #player-bottom";
  const username = '[data-test-element="user-tagline-username"]';
  const gameItem = ".floating-modal-component > .open-games-list-floating > .open-games-item-active.open-games-item-broadcaster";
  const summary = ".game-start-message-component.moves-tab-rating-info-ratingInfo";
  const observedAreas = `${panels}, .open-games-list-floating, ${summary}`;
  const privateBlock = "data-chess-private-player-block";
  const maskedText = new Map();
  let markedBlocks = new Set();
  const labelClass = "chess-player-label";
  let enabled = false;
  let revision = 0;
  let frame = null;
  let timer = null;

  // Keep native links, event handlers and text nodes in place. A host update
  // to a reused node supersedes our saved value, including during cleanup.
  function nativeText(node) {
    const edit = maskedText.get(node);
    return edit && node.data === edit.mask ? edit.original : node.data;
  }
  function applyMasks(texts, blocks) {
    for (const [node, edit] of maskedText) {
      if (texts.has(node)) continue;
      if (node.data === edit.mask) node.data = edit.original;
      maskedText.delete(node);
    }
    for (const [node, mask] of texts) {
      const original = nativeText(node);
      maskedText.set(node, { original, mask });
      if (node.data !== mask) node.data = mask;
    }
    for (const block of markedBlocks) {
      if (!blocks.has(block)) block.removeAttribute(privateBlock);
    }
    for (const block of blocks) {
      if (!markedBlocks.has(block)) block.setAttribute(privateBlock, "");
    }
    markedBlocks = blocks;
  }
  function maskPair(names, colors, texts) {
    if (names.length !== 2) return false;
    const nodes = Array.from(names, el => el.childNodes.length === 1 && el.firstChild.nodeType === 3 ? el.firstChild : null);
    const sides = nodes.map(node => node && colors.get(nativeText(node).trim().toLowerCase()));
    if (!sides[0] || !sides[1] || sides[0] === sides[1]) return false;
    nodes.forEach((node, i) => texts.set(node, sides[i]));
    return true;
  }
  function maskSummaryTail(name, texts) {
    const siblings = [];
    for (let node = name.nextSibling; node?.nodeType === 3; node = node.nextSibling) {
      siblings.push({ node, original: nativeText(node) });
    }
    const firstLine = siblings.map(({ original }) => original).join("").split("\n", 1)[0];
    const ratingLength = firstLine.match(/^[ \t]*\(\d+\??\)(?=[^\n]*\S)/u)?.[0].length ?? 0;
    let offset = 0;
    for (const { node, original } of siblings) {
      const cleaned = original.slice(Math.max(0, ratingLength - offset), Math.max(0, firstLine.length - offset));
      if (original !== cleaned) texts.set(node, cleaned);
      offset += original.length;
    }
  }
  function updateGameDetails(colors) {
    const texts = new Map(), blocks = new Set();
    if (colors.size === 2) {
      for (const item of document.querySelectorAll(gameItem)) {
        const names = item.querySelectorAll(`:scope > .open-games-item-players > .open-games-player-component > .open-games-player-tagline > ${username}`);
        if (maskPair(names, colors, texts)) {
          for (const name of names) blocks.add(name.parentElement);
        }
      }
      for (const info of document.querySelectorAll(summary)) {
        const names = info.querySelectorAll(":scope > a.user-username.username");
        if (!maskPair(names, colors, texts)) continue;
        blocks.add(info);
        // The move tab renders a rating as plain text after each profile
        // link. The time control ends the first line, and projections follow
        // a literal newline in every locale. Scores and separators stay native.
        for (const name of names) maskSummaryTail(name, texts);
      }
    }
    applyMasks(texts, blocks);
  }
  function schedule() {
    if (enabled && frame === null) frame = requestAnimationFrame(update);
  }
  function update() {
    frame = null;
    if (!enabled) return;
    const board = document.querySelector("wc-chess-board#board-single, wc-chess-board#board-analysis-board, wc-chess-board#board-play-computer");
    const coordinates = board && globalThis.ChessBoardAssist?.readCoordinates(board);
    const gameLayout = board?.id === "board-single" ? board.closest("#board-layout-main") : null;
    const colors = new Map();
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
        if (gameLayout && panel.closest("#board-layout-main") === gameLayout) {
          const name = block.querySelector(username)?.textContent.trim().toLowerCase();
          if (name && color) colors.set(name, color);
        }
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
    updateGameDetails(colors);
  }
  const observer = new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === 3 ? record.target.parentElement : record.target;
      if (target?.closest?.(observedAreas)) return true;
      return record.type === "childList" && [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === 1 && (node.matches?.(observedAreas) || node.querySelector?.(observedAreas)));
    })) schedule();
  });
  function stop() {
    observer.disconnect();
    clearInterval(timer);
    timer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    document.documentElement.removeAttribute("data-chess-hide-players");
    applyMasks(new Map(), new Set());
    for (const label of document.querySelectorAll(`.${labelClass}`)) label.remove();
  }
  function start() {
    stop();
    if (!enabled) return;
    document.documentElement.setAttribute("data-chess-hide-players", "");
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true,
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
