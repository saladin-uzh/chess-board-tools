# Ручні кроки релізу — у порядку виконання

Стан на 2026-10-10: PR #13 і #14 перевірені власником та merged у `main` (`986b1eb` і `223e5fe`). Наступний реліз — **v1.1.2**, включно з підготовкою магазинів, #11 та обома фіксами. Manifest уже має 1.1.2; tag і GitHub Release v1.1.2 ще не створені. Pages опубліковано й перевірено. Підписаний реліз 1.1.1 зберігається без змін. Актуальна діагностика та план: [release-plan-v1.1.2.uk.md](release-plan-v1.1.2.uk.md).

Цей файл відрізняє дії власника від тих, які може виконати Codex після отримання доступу. Галочки ставити лише після фактичного виконання. Порядок — спочатку Chrome, потім macOS. Обидві версії безкоштовні; видавець — фізична особа.

## 1. Увімкнути Pages та перевірити support/privacy — власник + Codex

- [x] У [Settings → Pages](https://github.com/saladin-uzh/chess-board-tools/settings/pages) вибрати source **GitHub Actions**. Це усуває підтверджену причину падіння run `37970530778`: сайт Pages раніше не був налаштований. Обліковий запис має admin access; зміна workflow не потрібна для цього виправлення.
- [x] Повторна спроба №2 run `37970530778` успішна. Якщо source сайту зміниться, запустити актуальний workflow на `main`:

```bash
gh workflow run pages.yml --repo saladin-uzh/chess-board-tools --ref main
```

- [x] Deployment успішний; HTTP 200 та наявність Chess Board Tools перевірені для `/`, `/support.html`, `/support.uk.html`, `/privacy.html`, `/privacy.uk.html` на `https://saladin-uzh.github.io/chess-board-tools/`.
- [x] Внутрішні EN/UK посилання сайту перевірені: HTTP 200. Перед store submission повторно перевірити всі URL із metadata.

## 2. Підготувати й підписати release commit та tag — Codex + власник

- [x] PR #15 (daily in-page analysis) перевірений повторно та merged `1721d15`; 74 тести пройшли.
- [x] Власник після merge повідомив «Все, наче, працює» у контексті Safari daily analysis; це попередній runtime feedback. Candidate checks пройшли, 74 тести. Детальний Chrome store checklist залишається окремим gate. Попередній candidate checksum уже не актуальний; див. `release-plan-v1.1.2.uk.md`.

- [ ] В окремому release checkout від актуального `main` підтвердити manifest/Safari version **1.1.2**; release notes уже оновлено у `docs/v1.1.2-release-notes.md`. Не змінювати встановлену Safari копію.
- [ ] Повторити 72 регресійні тести, JavaScript syntax checks, package validation. Побудувати candidate 1.1.2, перевірити fog capture diagonals на одноразовій `/analysis`, клавіатуру в одноразовій unrated людській партії `/game/<id>` та перенесення налаштувань 1.1.1 → 1.1.2. Факт перевірки PR власником не підміняє результати встановленого фінального пакета.
- [x] Оновлені analysis/fog та light/dark popup screenshots після #13/#14; перевірені 1280×800. Runtime evidence і candidate SHA-256: `docs/v1.1.2-validation.md`.
- [x] Same-ID unpacked upgrade 1.1.1 → 1.1.2 повторно пройшов; shortcuts і локальні preferences збережені.
- [ ] Власник перевіряє candidate у видимому ізольованому Chrome for Testing: одноразова unrated людська партія `/game/<id>`, координати, flip, focus guards і native confirmation. Профіль не має Chess.com login; увійти самостійно. До результату не підписувати/публікувати реліз.
- [ ] Переглянути diff та підписати лише підготовлені release-файли. PIN/passphrase вводить власник.

Наведені команди виконувати **лише в підготовленому release checkout**, після перевірок candidate і підготовки release diff. Якщо release preparation йде через PR, підписаний tag створювати після merge на окремому підписаному release commit в актуальному `main`: пакувальник перевіряє також підпис target commit.

```bash
node --test tests/*.test.cjs
git diff --check
git add manifest.json docs/v1.1.2-release-notes.md safari/README.md
git diff --cached --check
git commit -S -m "Prepare Chess Board Tools v1.1.2"
git verify-commit HEAD
git tag -s v1.1.2 -m "Release v1.1.2"
git verify-tag v1.1.2
```

- [ ] Підпис commit/tag перевірений; tag включає обидва merge-коміти. Tag має відповідати manifest 1.1.2; не переписувати існуючі tags.

## 3. Фінальний ZIP, push і GitHub Release — може виконати Codex

```bash
python3 scripts/package-extension.py --ref v1.1.2
```

Пакувальник перевіряє підпис tag і цільового commit, відповідність версії, 22 runtime-файли, manifest/HTML/CSS references та цілісність ZIP. Видає ZIP, `.sha256` і `.provenance.json` у `build/`. Final ZIP має збігатися з перевіреним **1.1.2 candidate** за SHA-256; старий candidate до #13/#14 не використовувати.

- [ ] Push release commit у `main` і `v1.1.2`; не force-push. За потреби HTTPS з наявним `gh auth git-credential`, без зміни глобальної конфігурації Git.
- [ ] Створити GitHub Release з `docs/v1.1.2-release-notes.md` та трьома фінальними артефактами. Перевірити version, provenance і завантажений checksum.

## 4. Chrome developer account — власник

- [ ] [Зареєструвати особистий developer account](https://developer.chrome.com/docs/webstore/register/), сплатити одноразовий внесок, завершити актуальні account/contact/security/identity вимоги Google. Суму перевірити перед оплатою.
- [ ] Надати доступ до dashboard через авторизовану сесію браузера. Паролі, платіжні дані й коди підтвердження вводити самостійно.

## 5. Реальна Sync і фінальна Chrome перевірка — власник + Codex

- [ ] У двох профілях Chrome з тим самим обліковим записом, ввімкненою синхронізацією extensions/settings і встановленим **тим самим extension ID**, змінити shortcuts та підтвердити появу в другому профілі. Різні IDs unpacked/store extension не доводять Sync.
- [ ] Переконатися, що fog/keyboard/tick preferences не синхронізуються. Перевірити поведінку з вимкненим Sync і після відновлення мережі.
- [ ] У справжньому toolbar popup Chrome перевірити light/dark, перемикання з відкритим popup, Tab/Shift+Tab, expanded selects, checked/unchecked checkboxes, slider endpoints, loading/error/success і VoiceOver announcements. Headless extension-document перевірки не замінюють нативні меню чи screen reader.
- [ ] Після встановлення фінального пакета повторити `/analysis` за `docs/store/review-notes.en.md`. Історично перевірене лише unpacked оновлення 1.1.1 → 1.1.2; для 1.1.2 повторити перевірку зі збереженням параметрів; доставку оновлення через Web Store перевірити під час першого наступного магазинного релізу. Timer окремо перевірити проти одноразового бота, без активної людської партії.

## 6. Chrome подання — може виконати Codex після кроків 1–5

- [ ] Завантажити `build/chess-board-tools-v1.1.2.zip` із manifest у корені.
- [ ] Заповнити EN/UK listing з `docs/store/chrome.*.md`, single purpose, storage/site access justification, remote-code та privacy declarations.
- [ ] Додати `docs/store/assets/chrome-icon-128.png`, `chrome-promo-440x280.png` і перевірені 1280×800 screenshots. Popup англійський; не заявляти повну локалізацію UI.
- [ ] Додати test instructions, public/free distribution і доступні видавцю території.
- [ ] Подати на review з вимкненим automatic publishing. Зафіксувати item ID, package version і статус.

## 7. Chrome публікація — власник

- [ ] Після схвалення вручну натиснути Publish. [Google наразі дає до 30 днів](https://developer.chrome.com/docs/webstore/publish) для staged submission; після спливу строку потрібне повторне подання.
- [ ] Після публікації Codex може перевірити listing/install/update і додати реальне магазинне посилання до README та сайту. Не оголошувати публікацію до її підтвердження.

## 8. Apple account, Xcode і signing — власник

- [ ] [Оформити Apple Developer Program](https://developer.apple.com/programs/enroll/) як фізична особа; Apple показуватиме юридичне ім’я видавця. Перевірити річну ціну й умови під час реєстрації.
- [ ] Завершити App Store Connect agreements і contact/trader/compliance fields, які вимагає обліковий запис; приватні дані вводити лише в dashboard.
- [ ] Встановити повний сумісний Xcode, пройти first launch/license/components, увійти в Apple Account і вибрати personal Team. Налаштувати distribution signing/profiles без передачі секретів у репозиторій.

## 9. Safari застосунок — може виконати Codex після кроку 8

- [ ] Конвертувати витягнутий фінальний ZIP через Xcode Safari Web Extension converter. Інструкції та точні EN/UK strings: `safari/README.md`.
- [ ] macOS target 27.0; app ID `io.github.saladin-uzh.ChessBoardTools`; extension ID з суфіксом `.Extension`; версія 1.1.2, початковий build 1. Team вибрати з реального account; не вигадувати Team ID.
- [ ] Додати мінімальний EN/UK екран увімкнення, відкриття Safari settings та support/privacy. Не додавати native messaging, tracking, акаунти або нові permissions.
- [ ] Додати готовий `docs/store/assets/AppIcon.appiconset` до asset catalog host target. Зіставити extension resources із SHA-256 provenance фінального ZIP.
- [ ] Archive, signing verification і upload до App Store Connect/TestFlight; кожне нове завантаження отримує більший build number.

## 10. Підписана Safari збірка — власник + Codex

- [ ] Встановити TestFlight build; перевірити macOS 27, увімкнення, grant/deny Chess.com access, popup і збереження після закриття браузера.
- [ ] Перевірити координати, обидві орієнтації, promotion q/r/b/n і cancel над fog, opacity/perspective, виключення unsupported states та оновлення зі збереженням preferences.
- [ ] Повторити native popup/theme/menu/VoiceOver перевірки з кроку 5 у Safari. Тимчасова Safari extension цього не замінює.
- [ ] Зняти справжні Safari/macOS screenshots 1280×800 у світлій і темній темах плюс enablement screen; не використовувати Chrome screenshots як Safari screenshots.
- [ ] Записати version/build/OS/browser, результати й відомі обмеження. До проходження цього gate не подавати застосунок.

## 11. App Store подання — власник + Codex

- [ ] Заповнити `docs/store/app-store.*.md`, support/privacy URLs, actual signed screenshots, review notes, age-rating questionnaire та publisher review contact.
- [ ] Підтвердити **Data Not Collected** лише після перевірки всього containing app/extension; не додавати SDK, що змінюють декларацію.
- [ ] Вибрати **Manually release this version** і подати перевірений build. Записати App Store Connect app/build ID і статус.

## 12. App Store публікація — власник

- [ ] Після схвалення вручну випустити застосунок. Codex може потім перевірити listing/install і оновити документацію реальними посиланнями.

## Офіційні специфікації

- [Chrome images](https://developer.chrome.com/docs/webstore/images): PNG icon 128×128, promo 440×280, screenshot 1280×800 або 640×400.
- [Safari packaging](https://developer.apple.com/safari/extensions/): обрано Xcode; web packaging залишається альтернативою.
- [macOS screenshots](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications): 16:10, серед допустимих розмірів 1280×800.
- [Safari compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility): не обіцяти cross-device storage.sync.
