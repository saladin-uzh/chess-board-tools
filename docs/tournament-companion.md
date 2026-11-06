# Tournament companion preview

The companion addresses [issue #25](https://github.com/saladin-uzh/chess-board-tools/issues/25)
by keeping the main Play tab available while a separate native tournament page
provides its own chat and standings. Open it from the selected event's native
Share dialog. The URL is validated independently of the possibly stale address
bar. Close the current companion before choosing a different event.

## Integration

The optional same-origin iframe loads an ordinary Chess.com page. It selects
only that child page's native Arena/Swiss tab and shows its original tournament
header and content. Chat reading, sending, permissions, data refresh and
reconnection stay with Chess.com's app. The extension does not construct private
requests, poll an API, replay a protocol or copy a removed chat/standings DOM.
It does not independently confirm server freshness or message delivery.
Only Standings/Games/Chat tab selection and Chat interactions remain active.
Standings and Games are read-only and scrollable. Verified member links and native
username components open profiles in a separate browser tab with no opener access;
game icons and other detached popover actions remain blocked. Tournament header/footer actions are inactive.
The global Chess.com header, board and navigation are hidden. Their normal page
resources still load as part of the native app; this feature does not block those
network requests or remove the host app's own game code.

The frame is hidden while loading or if its tournament component disappears or
loses selection. One selection is attempted per mounted native tab; the extension
does not repeatedly fight a host-initiated switch. **Show tournament** explicitly
selects the child tab again without replacing the iframe.
Native error dialogs remain
available. Close, pagehide, host removal or departure from Play/game disposes
the iframe and its observer. No tournament/chat data or geometry is persisted.
Page loading and subsequent native-view initialization each have a 15-second
local UI deadline before reporting unavailable. It does not issue retries or data requests;
later native rendering can still restore the view while the companion is open.

This mode uses another normal Play app and therefore additional resources and
connections. Loading a same-origin page is not a security boundary between two
Chess.com documents. No extension privileges or credentials are passed to it.

## Evidence and remaining release gate

Live Safari screenshots on 6 November 2026 established that a same-origin
tournament page renders, and a console prototype can show its native tournament
sidebar without the duplicate board/menu alongside the main Play view. These
are prototype observations, not installed-candidate validation. The prototype
used Play 2026.11.2 / chessboard 1.190.0 according to the supplied console log;
the Safari browser version was not recorded.

The candidate's browser fixture uses local simulated native pages and the actual
runtime files. It covers native Share launch/close, one-frame ownership, native
input/handlers, native dialogs, bounds, parent SPA retention, child unavailable
state, route cleanup and pagehide. Node tests cover URL validation, child view
selection/disposal and pointer completion/cancellation with an iframe shield.

Before release, verify the installed candidate in supported browsers with live
Arena and Swiss events: main Play confirmation buttons for a prepared move;
live chat and standings updates; permitted native sending and its failure/
confirmation behavior; reconnects; changing events; close/reopen; SPA navigation;
and input focus. In particular, prototype rendering does not establish that a
second Play session preserves the active game's confirmation controls.
One live diagnostic found an enabled native confirmation button with the
companion visible and Play selected. The tester identified the disappearance
after clicking Close as Chess.com's normal outside-click cancellation of a
prepared move. Retaining a prepared move after that click is not a companion
requirement; that observation is not treated as a companion defect. Installed
candidate validation must still verify normal game input while the panel is open.
A companion opened before matchmaking was reported unavailable when a new game
started; live validation of the manual recovery control is still required.
