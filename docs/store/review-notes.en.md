# Review instructions — Chess Board Tools

Use a disposable standard position at https://www.chess.com/analysis. No active human game, purchase, or extension account is required. Start with a signed-out analysis page; if Chess.com requires authentication in your region, use your own test account. No developer account or private game access is required.

1. Install the submitted package. Safari: open the containing app, enable Chess Board Tools in Safari Settings → Extensions, allow access to Chess.com, and open a fresh analysis tab.
2. Open the toolbar popup. Verify the name and enabled controls after settings load. Optional helpers start disabled. Change Confirm from Space to Enter and Cancel from Esc to Ctrl; close/reopen the popup to verify persistence. Keys must differ.
3. Enable Keyboard board control. Close the popup and click outside text inputs to focus the page. With a Latin keyboard layout, type b, 2: the file and selected square are marked. Type b, 3: the site moves the pawn on the disposable board. Flip the board and repeat from a reset position; coordinates remain algebraic.
4. Enable Semi-transparent Fog of War; use White perspective. Change opacity between 20% and 80%, then switch White/Black/Auto. The board mask changes without obstructing normal moves. Disable fog and verify removal. Reload the tab and reopen the popup: settings persist.
5. On a disposable promotion analysis position (for example https://www.chess.com/analysis?fen=7k/P7/8/8/8/8/8/7K%20w%20-%20-%200%201), move a7 to a8 and choose q/r/b/n in the native picker. Picker choices and cancellation remain visible above fog. Reset the position between choices.
6. Focus a text input and verify that coordinate entry and shortcuts do not interfere with typing. Switch system/browser light/dark appearance while the popup is open: appearance updates without changing settings.

Expected limitations:

- Confirm/cancel keys act only on visible enabled Chess.com confirmation/cancellation buttons. Those buttons may be absent in analysis; absence is not a failure.
- Turn ticking is deliberately disabled in analysis. Do not start an active human game to test it. Optional testing can use a disposable bot game at /play/computer: interact to unlock audio, enable ticks, and wait during your own turn. Hidden tabs stay silent.
- Fog is supported against bots, in standalone analysis, and in completed standard-game reviews. It is unavailable in active human games, variants, and unsupported/incomplete states.
- The extension offers no engine evaluations or move recommendations. Chess.com handles legal moves and confirmation; synthetic pointer events are not concealed.
- Chrome synchronizes shortcut preferences only when Chrome Sync is enabled. Fog and board-helper preferences stay local. Safari stores all these preferences locally.

Permission: storage saves these preferences only. Current board state is read in memory; no telemetry, external extension requests, or game-history persistence.
