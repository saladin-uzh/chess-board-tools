# macOS Safari packaging handoff

Status: preparation only. No Xcode project, signed app, provisioning profile, archive, or TestFlight build has been produced. The host currently has Command Line Tools, not full Xcode, and no valid local code-signing identities.

Use Xcode's Safari Web Extension converter on the extracted, verified release ZIP. Keep the canonical web sources at the repository root; regenerate/copy target resources from that ZIP before each archive, and compare them with its provenance hashes. Do not maintain independent web behavior in the native project.

- Product: Chess Board Tools; macOS only; deployment target 27.0.
- Version: 1.1.3; initial build number 1, monotonically increasing on uploads.
- App ID: io.github.saladin-uzh.ChessBoardTools.
- Extension ID: io.github.saladin-uzh.ChessBoardTools.Extension.
- Team: publisher's enrolled personal Apple Developer account; select in Xcode rather than committing a team ID or secrets.
- Containing-app icon: copy `docs/store/assets/AppIcon.appiconset` into the host target's asset catalog; it includes all ten macOS size/scale slots from the existing artwork.
- Use generated Safari Web Extension entitlements and minimum containing-app configuration. No analytics, accounts, network service, native messaging, or new extension permissions.
- Keep the extension's storage keys unchanged. Safari does not provide cross-device synchronization for storage.sync.

## Minimal containing-app screen

Use Xcode's generated host-app enablement/settings-opening mechanism with these EN/UK strings. Keep the app localized independently of the currently English extension popup.

| Element | English | Українська |
| --- | --- | --- |
| Title | Chess Board Tools | Chess Board Tools |
| Introduction | Enable keyboard controls and optional board helpers on Chess.com in Safari. | Увімкніть клавіатуру та допоміжні функції для дошок Chess.com у Safari. |
| Step 1 | Open Safari Settings → Extensions and enable Chess Board Tools. | Відкрийте Safari Settings → Extensions та увімкніть Chess Board Tools. |
| Step 2 | Allow access to Chess.com, then reload the tab. | Дозвольте доступ до Chess.com та перезавантажте вкладку. |
| Step 3 | Open the toolbar popup to choose your settings. Optional helpers start disabled. | Відкрийте popup у toolbar для налаштування. Допоміжні функції спочатку вимкнені. |
| Primary button | Open Safari Extension Settings | Відкрити налаштування Safari Extensions |
| Support link | Support | Підтримка |
| Privacy link | Privacy | Приватність |
| Footer | Free. No telemetry or game-history storage. Independent of Chess.com. | Безкоштовно. Без телеметрії та збереження історії партій. Незалежний від Chess.com проєкт. |

Support/privacy links use the locale-specific GitHub Pages URLs from `docs/store/app-store.*.md`. If opening Safari settings fails, show the manual steps already on screen. Do not display “enabled” or “access granted” without checking the generated Safari extension-state API; activation and website access are separate.

## Signed-build gate

Archive and upload through App Store Connect, install the delivered TestFlight build, and complete `docs/manual-release-steps.uk.md`. Verify installation, enablement, grant/deny access, popup, real persistence, native keyboard/promotion, fog, light/dark switching, and upgrade with preserved preferences. Capture macOS/Safari screenshots from that build. Temporary-extension evidence does not satisfy this gate.

References: [Safari extensions](https://developer.apple.com/safari/extensions/), [App Store screenshots](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).
