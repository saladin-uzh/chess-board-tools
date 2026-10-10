# Store preparation validation — 2026-10-09

Historical evidence for candidate 1.1.2. The current target is **v1.1.2**
after merged PR #13/#14; see [release-plan-v1.1.2.uk.md](release-plan-v1.1.2.uk.md)
for current checks, the Pages failure diagnosis, and pending gates. The release
status below describes the original preparation date.

## Source and release status

- PR #10 was already merged when implementation began. Existing release commit `d8ec72b` and tag `v1.1.1` both passed Git signature verification. GitHub Release 1.1.1 already has its original ZIP; neither tag nor asset was replaced.
- Reviewed PR #12 at exact head `9d68af9bc90132033437a0f01a70f52d2f992da6`. Its CSS implementation was reused, not reimplemented. GitGuardian passed. After local checks, the owner-authorized merge completed at `7c9d4b1475b96bd25d6913fe38d5462f9df5311b`; issue #11 is closed.
- Local main is synchronized with that merge. Remaining preparation changes are uncommitted for owner signing. Manifest candidate version is 1.1.2 because 1.1.1 has already been released.
- No new release commit/tag, push of preparation files, GitHub Release 1.1.2, Pages deployment, developer enrollment/payment, or store submission was performed.

## Automated checks performed

- `node --test tests/*.test.cjs`: 67 passed, 0 failed (rerun after PR #12 merge).
- `node --check` for every top-level JavaScript file: passed.
- `git diff --check`: passed.
- `python3 scripts/package-extension.py`: ZIP membership, runtime references, byte-for-byte round trip and CRC integrity passed. Manifest is at ZIP root; package contains 22 explicit runtime files, excluding docs, source icon, site, tests, tooling, Git data, and native app material.
- Repeated candidate packaging yielded the same SHA-256: `4faf0d74689e1323cf9e5a330858b4b78d7c394d6b4a353faf446f47fe9d7703`.
- Negative packaging checks rejected a missing referenced icon and an external popup URL.
- Manifest description length is 120 characters. Store screenshots are 1280×800; promo is 440×280; Chrome icon is 128×128; macOS source icon is 1024×1024. The macOS AppIcon catalog contains all ten size/scale slots.
- All five static HTML pages returned HTTP 200 from a loopback preview. Local links exist; no scripts or analytics were added. The Ukrainian privacy page and promotional artwork were visually inspected. A preview-only favicon 404 does not affect page content or assets.
- Pages workflow uses official actions releases checked via the GitHub API: checkout 7.0.1, configure-pages 6.0.0, upload-pages-artifact 5.0.0, deploy-pages 5.0.1. YAML syntax, upload path and contents-read permission passed Ruby YAML parsing. Permissions are scoped to contents read and deployment pages/id-token write; only `site/` is uploaded. Remote workflow execution remains pending signing/push/Pages setup.

## Chrome runtime checks performed

Used Chrome for Testing 154.0.8037.0 on macOS 27.0.1, headless, in disposable browser profiles. The packaged candidate ZIP was extracted outside the repository and loaded as an unpacked extension. This establishes package contents/runtime, not Chrome Web Store installation.

- The extensions page recognized Chess Board Tools with the new description. The real extension-context popup loaded all settings controls.
- Real `chrome.storage.sync` stored Enter/Control shortcuts; real `chrome.storage.local` stored keyboard=true, ticking=false and enabled 55% White fog. Popup reload restored the shortcut selection. Local storage remained separate from sync storage. No storage mock was used for these checks.
- Playwright keyboard input changed the opacity slider, and the real stored value survived reload. Light → dark → light media emulation updated the same open popup document. Width stayed 360px. Light/dark screenshots were visually inspected.
- Palette luminance checks reproduced PR #12's minima: normal text 5.95:1 light / 8.72:1 dark; border/focus/accent against surface 3.66:1 light / 5.16:1 dark; disabled select text 5.69:1 light / 7.04:1 dark. Native control internals require platform checks.
- On signed-out disposable `/analysis?fen=…`, keyboard b2 → b3 produced `rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR b KQkq - 0 1`; fog remained present.
- A disposable a7 → a8 promotion opened the visible native picker above fog at z-index 9. Keyboard q produced `Q6k/8/8/8/8/8/8/7K b - - 0 1`.
- Same-ID unpacked update test: installed runtime files from signed tag 1.1.1 in a fresh persistent profile, saved Enter/Control shortcuts and keyboard=true, ticking=false, 80% Black fog, closed the browser, replaced those files with the candidate ZIP and reopened. The extension reported version 1.1.2 and restored both storage areas and visible controls correctly. This does not establish Chrome Web Store update delivery.
- Three actual 1280×800 Chrome screenshots were captured without account data or active human games. Popup screenshots show the extension document in a tab rather than a toolbar frame. Promotional artwork is separately designed vector/HTML artwork rendered to PNG.

## Remaining gates

- Actual two-profile/device Chrome Sync, toolbar popup native menu rendering, loading/error/success integration, screen-reader announcements and Chrome Web Store update delivery remain unverified in this preparation. Historical tests are in `issues-and-review-validation.md` and `popup-appearance-validation.md`; they are not presented as new runs.
- Browser appearance was emulated per page; the user's global system appearance was not changed. Safari native popup/theme/menu checks were not performed in this preparation.
- Full Xcode is absent (`xcode-select` points to CommandLineTools), and the local keychain reports zero valid code-signing identities. No generated Xcode project, signed app, archive, TestFlight installation, upgrade test, or macOS/Safari store screenshot exists.
- GitHub Pages is not configured; metadata URLs are planned destinations. Public HTTP checks are required after deployment.
- Final ZIP must be built from a manually signed 1.1.2 commit/tag. Git signing, Web Store signing and Apple app signing are distinct.

The exact ordered owner/Codex handoff is `manual-release-steps.uk.md`. Store and Safari release gates must pass before submission, and publication remains manual after approval.
