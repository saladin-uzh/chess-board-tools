# Store submission kit

Prepared for candidate **1.1.2**. This kit is not a submitted or published listing.
PR #12, which implements issue #11, was merged into main at `7c9d4b1`.
The earlier signed/published GitHub release 1.1.1 remains unchanged.

## Text and destinations

- Chrome: `chrome.en.md` and `chrome.uk.md`.
- macOS App Store: `app-store.en.md` and `app-store.uk.md`.
- Reviewer instructions: `review-notes.en.md` and `review-notes.uk.md`.
- Static GitHub Pages source: `../../site/`; deployment workflow: `../../.github/workflows/pages.yml`.
- Safari packaging/enablement screen: `../../safari/README.md`.
- Ordered owner/Codex actions: `../manual-release-steps.uk.md`.
- Actual validation and remaining gates: `../store-preparation-validation.md`.

The descriptions and public documentation are localized; the extension popup
remains English. Do not advertise full Ukrainian UI localization.

## Assets

| File under assets/ | Use | Dimensions |
| --- | --- | --- |
| chrome-icon-128.png | Existing extension artwork, Chrome listing | 128×128 |
| chrome-promo-440x280.png | Locale-neutral promotional artwork | 440×280 |
| chrome-analysis-keyboard-fog.png | Actual signed-out disposable analysis board with keyboard selection and fog | 1280×800 |
| chrome-popup-light.png | Actual installed extension popup document, light appearance | 1280×800 |
| chrome-popup-dark.png | Actual installed extension popup document, dark appearance | 1280×800 |
| app-icon-1024.png | Existing source artwork resized for the macOS icon asset catalog | 1024×1024 |
| AppIcon.appiconset/ | Complete macOS asset catalog from existing artwork | Ten size/scale slots |
| chrome-promo.html | Editable local source of promotional artwork | 440×280 |

Use the same three Chrome screenshots for both listing locales: they accurately
show the English UI. Screenshots were taken with Chrome for Testing 154.0.8037.0
from the unpacked candidate ZIP. Popup captures show its real extension document
in a tab, not the browser toolbar frame. No screenshot uses private account data,
active human games, fabricated board overlays, or a fabricated Ukrainian UI.
The promotional image is separately designed artwork, not a screenshot.

The complete app icon set still needs adding to the target's Xcode asset catalog.
Actual macOS/Safari screenshots, including the containing-app screen, must be
captured after signed-build testing; Chrome assets are not Safari screenshots.

## Package

Run `python3 scripts/package-extension.py` at the repository root. The candidate
and checksum/provenance files are generated under ignored `build/`.
Run with `--ref v1.1.2` only after owner signing: final packaging reads the signed
Git snapshot, verifies both tag and target commit signatures, and requires the
manifest version to match the tag. Git signatures do not replace store signing.

## Official requirements checked

- [Chrome images](https://developer.chrome.com/docs/webstore/images)
- [Chrome submission and deferred publishing](https://developer.chrome.com/docs/webstore/publish)
- [Google account registration](https://developer.chrome.com/docs/webstore/register/)
- [Apple enrollment](https://developer.apple.com/programs/enroll/)
- [Safari extension distribution](https://developer.apple.com/safari/extensions/)
- [macOS screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)

Public URLs in the metadata must be checked after deployment; they are currently
planned destinations. No payment, store enrollment, Xcode installation,
App Store signing, or store submission happened during this preparation.
