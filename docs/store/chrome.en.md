# Chrome Web Store — English

Name: Chess Board Tools

Short description (manifest): Keyboard controls, move confirmation shortcuts, turn sound cues, and optional fog of war for supported Chess.com boards.

## Full description

Use your keyboard on supported Chess.com boards and customize optional board helpers.

• Confirm or cancel pending moves with configurable shortcuts (Space/Escape by default). Shortcuts act only when the matching Chess.com button is visible and enabled.
• Enable keyboard board control and enter coordinates one character at a time: b, 2, then b, 3. Select promotion pieces with q/r/b/n. Keyboard actions pause in input fields and interactive controls.
• Enable a quiet tick every 10 seconds of your turn. Sound requires interaction with the game tab, stays silent in hidden tabs, and is disabled in analysis.
• Practice with semi-transparent fog of war against bots, in standalone analysis, and in completed standard-game reviews. Choose opacity from 20–80% and Auto, White, or Black perspective. Fog is unavailable in active human games, variants, and unsupported or incomplete board states. Visibility is based on piece movement and does not guarantee legal moves.
• The settings popup follows your browser/system light or dark appearance.

Optional helpers start disabled. Chess.com remains responsible for move validation and its confirmation flow. The extension provides no engine evaluations, recommended moves, or automated play. Its keyboard clicks use the site's normal pointer path; it does not hide synthetic events or bypass checks.

Privacy: the extension code makes no external network requests, collects no telemetry, and stores no positions or game history. Confirmation/cancellation settings use Chrome Sync when enabled. Fog and board-helper preferences stay in local browser storage. Current board state is processed only in memory.

Free. No ads, subscriptions, or in-app purchases. Independent project; not affiliated with or endorsed by Chess.com.

## Dashboard fields

Single purpose: Provide user-controlled keyboard interaction and optional visual/audio board helpers on supported Chess.com boards.

storage justification: Save user-selected confirmation/cancellation keys using chrome.storage.sync, and fog/keyboard/tick preferences using chrome.storage.local. No positions, move history, or account/game identifiers are persisted.

Site access justification: Content scripts run only on the listed https://www.chess.com play, game, and analysis routes to detect available controls, interact with the board at the user's direction, and render optional helpers. No access to unrelated websites is requested.

Remote code: None. All JavaScript and styles are bundled; there is no remote code download or execution.

Privacy declarations: The developer does not collect, transmit, sell, or share user data. Current board state is processed locally and transiently. Settings may be handled by Chrome Sync; do not describe all settings as strictly local. Complete the dashboard certifications according to these facts and the final package.

Support URL: https://saladin-uzh.github.io/chess-board-tools/support.html
Privacy URL: https://saladin-uzh.github.io/chess-board-tools/privacy.html
Homepage: https://saladin-uzh.github.io/chess-board-tools/

These URLs are planned; confirm they return HTTP 200 before submission.
Testing instructions: review-notes.en.md.
Distribution: Free, public, all available territories permitted by the publisher account; deferred/manual publishing.
