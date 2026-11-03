(() => {
  "use strict";
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    .settings { grid-template-columns: 1fr 1fr; }
    .settings .status { grid-column: 1 / -1; }
    .fog-settings { grid-template-columns: 1fr 1fr; column-gap: 8px; }
    .fog-settings > :not(.settings-pair) { grid-column: 1 / -1; }
    .tick-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `);
  globalThis.ChessSettingsLayout = sheet;
})();
