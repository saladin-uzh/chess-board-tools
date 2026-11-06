(() => {
  "use strict";
  function parseUrl(value) {
    if (typeof value !== "string" || value.length > 200) return null;
    try {
      const url = new URL(value);
      const match = /^\/play\/(arena|tournament)\/([1-9]\d*)$/.exec(url.pathname);
      if (url.origin !== "https://www.chess.com" || url.username || url.password || url.search || url.hash || !match) return null;
      return Object.freeze({ url: url.href, kind: match[1] });
    } catch { return null; }
  }

  function profileUrl(value) {
    if (typeof value !== "string" || value.length > 200) return null;
    try {
      const url = new URL(value, "https://www.chess.com/");
      if (url.origin !== "https://www.chess.com" || url.username || url.password || url.search || url.hash ||
        !/^\/member\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return null;
      return url.href;
    } catch { return null; }
  }
  function profileTarget(target) {
    const link = target?.closest?.("a[href]");
    if (link) return profileUrl(link.getAttribute("href"));
    // The native username component keeps the full username in textContent even
    // when its visual box is ellipsized. Reject actually shortened/invalid text.
    const username = target?.closest?.('.cc-user-username-component[data-test-element="user-tagline-username"]')?.textContent.trim();
    return username && /^[a-z0-9_-]+$/i.test(username)
      ? profileUrl(`https://www.chess.com/member/${username.toLowerCase()}`) : null;
  }

  function mount(doc, kind, onState) {
    if (!["arena", "tournament"].includes(kind) || !doc?.documentElement) throw new Error("Unavailable tournament document");
    const tabSelector = `.board-layout-sidebar .tabs-component [role="tab"][data-tab="${kind}"]`;
    const panelSelector = kind === "arena" ? ".arena-tab-container" : ".tournament-tab-container";
    const sheet = doc.createElement("style");
    sheet.textContent = `
      html, body { overflow: hidden !important; }
      .board-layout-main, .board-layout-nav, #sidebar-main-menu, .sidebar-ad, .board-layout-ad,
      #mobile-toolbar, #mobile-top-section, .mobile-toolbar,
      .floating-modal-component, .opened-chats-container { display: none !important; }
      .board-layout-sidebar {
        box-sizing: border-box !important; position: fixed !important; inset: 0 !important;
        width: 100vw !important; height: 100vh !important; min-width: 0 !important;
        max-width: none !important; margin: 0 !important; padding: 0 !important;
        z-index: 1 !important; display: flex !important; flex-direction: column !important;
        background: var(--color-bg-opaque, #262421);
      }
      .board-layout-sidebar .sidebar-component, .board-layout-sidebar .sidebar-content {
        flex: 1 1 0 !important; min-height: 0 !important; height: 100% !important;
        display: flex !important; flex-direction: column !important;
      }
      .board-layout-sidebar .tabs-component { display: none !important; }
      ${panelSelector} > .underlined-tabs-component [role="tab"] * { pointer-events: none !important; }
      ${panelSelector} { flex: 1 1 0 !important; min-height: 0 !important; height: 100% !important; overflow: auto !important; }
      ${panelSelector} > .${kind}-header-component, ${panelSelector} > .${kind}-header-component *,
      ${panelSelector} > .${kind}-footer-component, ${panelSelector} > .${kind}-footer-component * {
        pointer-events: none !important;
      }
      [data-chess-tournament-readonly], [data-chess-tournament-readonly] * { cursor: default !important; }
      [data-chess-tournament-readonly] .cc-user-username-component[data-test-element="user-tagline-username"],
      [data-chess-tournament-readonly] .cc-user-username-component[data-test-element="user-tagline-username"] *,
      [data-chess-tournament-readonly] a[href^="/member/"], [data-chess-tournament-readonly] a[href^="/member/"] *,
      [data-chess-tournament-readonly] a[href^="https://www.chess.com/member/"], [data-chess-tournament-readonly] a[href^="https://www.chess.com/member/"] * {
        cursor: pointer !important;
      }
    `;
    doc.documentElement.append(sheet);
    const attempted = new WeakSet();
    const readOnlyRoots = new Set();
    const activationEvents = ["click", "dblclick", "auxclick", "contextmenu", "keydown"];
    let chatActive = false, selectingNativeTab = false;
    function guardActivation(event) {
      if (selectingNativeTab) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      const panel = doc.querySelector(panelSelector);
      const tabBar = panel?.querySelector?.(".underlined-tabs-component");
      const tab = event.target?.closest?.('[role="tab"][data-tab]');
      const interactive = event.target?.closest?.('a, button, [role="button"], [tabindex]');
      if (tabBar?.contains(event.target) && tab && ["Standings", "Games", "Chat"].some(name => tab.getAttribute("data-tab") === kind + name)
        && (!interactive || interactive === tab)) return;
      const profile = profileTarget(event.target);
      const openProfile = (event.type === "click" && event.button === 0) || (event.type === "auxclick" && event.button === 1) || event.type === "keydown";
      if (profile && openProfile) {
        event.preventDefault();
        event.stopImmediatePropagation();
        doc.defaultView.open(profile, "_blank", "noopener,noreferrer");
        return;
      }
      if (chatActive && !Array.from(readOnlyRoots).some(element => element.contains(event.target))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    function removeReadOnly(element) {
      element.removeAttribute("data-chess-tournament-readonly");
      readOnlyRoots.delete(element);
    }
    function syncReadOnly(panel) {
      const activeTab = panel?.querySelector?.('.underlined-tabs-component .underlined-tabs-active, .underlined-tabs-component [aria-selected="true"]');
      const chat = activeTab?.getAttribute("data-tab") === `${kind}Chat`;
      chatActive = chat;
      const desired = new Set(Array.from(panel?.children || []).filter(element => {
        if (element.classList.contains("underlined-tabs-component")) return false;
        return !chat || element.classList.contains(`${kind}-header-component`) || element.classList.contains(`${kind}-footer-component`);
      }));
      for (const element of readOnlyRoots) if (!desired.has(element)) removeReadOnly(element);
      for (const element of desired) {
        if (readOnlyRoots.has(element)) continue;
        element.setAttribute("data-chess-tournament-readonly", "");
        readOnlyRoots.add(element);
      }
    }
    function selectNativeTab(tab) {
      selectingNativeTab = true;
      try { tab.click(); } finally { selectingNativeTab = false; }
    }
    let disposed = false, lastState = null, wasReady = false;
    function state(value) {
      if (disposed || value === lastState) return;
      lastState = value;
      onState(value);
    }
    function inspect() {
      if (disposed) return;
      const tab = doc.querySelector(tabSelector);
      const selected = () => tab?.classList.contains("tabs-active") || tab?.getAttribute("aria-selected") === "true";
      if (selected()) attempted.add(tab);
      else if (tab && !attempted.has(tab)) {
        attempted.add(tab);
        // This native click changes the child page's view, never the parent Play tab.
        selectNativeTab(tab);
      }
      const panel = doc.querySelector(panelSelector);
      syncReadOnly(panel);
      const ready = Boolean(panel && selected());
      if (ready) { wasReady = true; state("ready"); }
      else state(wasReady ? "unavailable" : "loading");
    }
    const observer = new MutationObserver(inspect);
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected"] });
    const leaving = () => state("unavailable");
    for (const type of activationEvents) doc.addEventListener(type, guardActivation, true);
    doc.defaultView?.addEventListener("pagehide", leaving);
    inspect();
    return Object.freeze({
      showTournament() {
        if (disposed) return false;
        const tab = doc.querySelector(tabSelector);
        if (!tab) return false;
        attempted.add(tab);
        if (!tab.classList.contains("tabs-active") && tab.getAttribute("aria-selected") !== "true") selectNativeTab(tab);
        inspect();
        return true;
      },
      dispose() {
        disposed = true;
        observer.disconnect();
        for (const type of activationEvents) doc.removeEventListener(type, guardActivation, true);
        for (const element of readOnlyRoots) removeReadOnly(element);
        doc.defaultView?.removeEventListener("pagehide", leaving);
        sheet.remove();
      },
    });
  }
  globalThis.ChessTournamentCompanionView = Object.freeze({ parseUrl, profileUrl, profileTarget, mount });
})();
