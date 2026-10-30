(() => {
  "use strict";
  globalThis.ChessSettingsView.mount(document.querySelector("#settings-content"));
  const open = document.querySelector("#open-floating-settings");
  const status = document.querySelector("#floating-open-status");
  open.addEventListener("click", async () => {
    open.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error("No active tab");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "chess-open-settings" });
      if (response?.opened !== true) throw new Error("Settings unavailable");
      window.close();
    } catch {
      status.textContent = "Open a Chess.com tab and reload it after updating the extension.";
    } finally {
      open.disabled = false;
    }
  });
})();
