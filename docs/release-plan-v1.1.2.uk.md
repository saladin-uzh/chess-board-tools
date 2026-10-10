# План релізу v1.1.2 — 2026-10-10

Наступна версія після перевірених власником фіксів — **v1.1.2**. Цей документ оновлює план; manifest уже має 1.1.2, Pages опубліковано; підписання commit/tag та GitHub Release ще не виконані. Ручні кроки у порядку виконання збережені окремо в [manual-release-steps.uk.md](manual-release-steps.uk.md).

## Підтверджений стан

- [PR #13](https://github.com/saladin-uzh/chess-board-tools/pull/13): fog враховує діагоналі взяття пішаків; merge `986b1ebd149d41e6e76f125aa33463aeafddaefd`.
- [PR #14](https://github.com/saladin-uzh/chess-board-tools/pull/14): keyboard adapter і bridge приймають прямий `/game/<numeric-id>`; merge `223e5fe7125b88fff5fa09b0c1b0dc80eebb9885`.
- Поточний `main`: `6394e91`; manifest — 1.1.2. Після обох merges додано лише README badges. GitHub має лише tags/releases до v1.1.1 включно; наступний підписаний реліз — **v1.1.2**, що включає обидва фікси.
- Issue #11 вже реалізовано в PR #12. Повторна реалізація dark popup не потрібна.
- Store kit, icons, EN/UK descriptions, support/privacy source та Safari handoff підготовлені. Accounts, signed Safari app і store submissions не підтверджені.

## Pages run: початкова помилка усунута

У поточній історії GitHub Actions знайдено один run: [Support and privacy pages #37970530778](https://github.com/saladin-uzh/chess-board-tools/actions/runs/37970530778), push `5626b2f` від 2026-10-09. Перша спроба передує обом фіксам; повторна спроба №2 успішна 2026-10-10 о 18:37 за Києвом.

Падіння на `actions/configure-pages@v6.0.0`:

```text
enablement: false
Get Pages site failed. Please verify that the repository has Pages enabled
and configured to build using GitHub Actions
HttpError: Not Found
```

На момент первинної діагностики Pages API повертав HTTP 404. Тепер Pages налаштовано з `build_type: workflow`; configure/upload/deploy завершилися успішно. Публічні `/`, `/support.html`, `/support.uk.html`, `/privacy.html`, `/privacy.uk.html` повернули HTTP 200; кожна сторінка містить Chess Board Tools. Deployment побудовано з `5626b2f`, де source `site/` той самий, що й у поточному main.
Workflow має `push.paths: site/**, .github/workflows/pages.yml` і `workflow_dispatch`. Фікси #13/#14 не змінювали ці шляхи, тому їхні merges не запустили Pages заново. Цей workflow не запускає Node tests та не будує extension ZIP; падіння не є доказом помилки фіксів.

Налаштування source **GitHub Actions** та повторний запуск уже виконані. [Офіційна інструкція GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Зміна workflow для усунення цього падіння не потрібна. Поточний run history більше не має failed runs; перша невдала спроба залишається історією цього самого run.
## Перевірки виконані на merged main

В ізольованому worktree, без зміни встановленої Safari копії чи активної партії:

- `node --test tests/*.test.cjs`: **72 passed, 0 failed**.
- `node --check` для всіх top-level JavaScript: passed.
- `python3 scripts/package-extension.py`: 22 runtime-файли, manifest у корені, references, CRC і byte-for-byte round trip пройшли.
- Перепакований ZIP має версію **1.1.2-candidate** і SHA-256 `1535623fbb3ae7ee60b78b03d6b6ca2f1c50ec1604c794ebde68642b58469b94`. Це перевірка merged-коду, не фінальний артефакт 1.1.2.

Попередній [store-preparation-validation.md](store-preparation-validation.md) описує історичний candidate 1.1.2. Його browser screenshots, update test та старий checksum не переносити як нову валідацію пакета після #13/#14. Актуальні installed-candidate перевірки й screenshots: [v1.1.2-validation.md](v1.1.2-validation.md). Власник уточнив, що human-game сценарії раніше не перевірені; candidate передано у видимому ізольованому Chrome for Testing для login та одноразової unrated партії.

## Порядок подальшої роботи

1. **Pages — виконано:** source та deployment успішні; п’ять URL перевірені. Перед поданням повторно перевірити metadata links.
2. **Release preparation:** в окремому checkout актуального main підтвердити manifest/Safari version 1.1.2; release notes тепер містять store preparation, #11, #13, #14. Без нових permissions чи storage migrations.
3. **Candidate acceptance:** повторити автоматичні перевірки та deterministic packaging для 1.1.2. Fog перевірити на одноразовій `/analysis` для білих/чорних пішаків, країв і порожніх діагоналей. Keyboard перевірити в одноразовій unrated людській партії `/game/<id>`: source/destination, flip, focus guards, promotion, native confirmation. Зберегти точні OS/browser/package version та результати. Активну турнірну партію не використовувати.
4. **Assets та upgrade — виконано:** analysis/fog та light/dark popup screenshots оновлені й візуально перевірені. Same-ID unpacked upgrade 1.1.1 → 1.1.2 зі збереженням Sync/local settings пройшов. Реальна cross-profile Chrome Sync, native toolbar popup і VoiceOver залишаються окремими gates.
5. **Signed GitHub release:** власник підписує release commit і tag v1.1.2 на актуальному main з обома фіксами. Пакувальник перевіряє підписи обох. Побудувати final ZIP з tag, порівняти з прийнятим candidate, push без force, опублікувати release з ZIP/checksum/provenance.
6. **Chrome Web Store:** account/payment власника; тільки перевірений final ZIP, metadata/privacy/review notes і screenshots; review з ручною публікацією після схвалення. Store review instructions залишаються на одноразовій `/analysis`, без активної партії; власна human-game регресія з кроку 3 — окрема acceptance-перевірка.
7. **macOS App Store:** Apple account/Xcode/signing власника; Safari wrapper з enablement screen, version 1.1.2; signed-build installation/permissions/popup/settings/keyboard/fog/update, справжні Safari screenshots; лише потім submission і manual release.

Спочатку завершити Chrome, потім macOS. Історичні підписані tags/assets не переписувати. Публікація в магазинах, Git-підпис і Apple distribution signing — різні кроки.


## Додатковий gate перед релізом: daily analysis

Safari перевірка власника підтвердила keyboard input на `/game/<id>`, але виявила
відмову у вбудованому аналізі `/game/daily/<id>`. Окремий [PR #15](https://github.com/saladin-uzh/chess-board-tools/pull/15),
commits `5e15b5a` і `45368a1`, додає analysis-контекст та очищує input state при зміні режиму/активності. Повторне Codex review `45368a1` не знайшло major issues; дискусію закрито, GitGuardian пройшов. PR merged як `1721d15`; 74 тести на merged main пройшли. Після merge власник повідомив «Все, наче, працює» у контексті Safari. Попередній runtime acceptance зафіксовано; наступний крок — підпис release commit/tag. Детальні Chrome/Safari store gates зберігаються. Пакет candidate
перепакований: SHA-256 `33da3b8d1ce1a70243f8c7c50bff4c79d8dd33b99c886d0c73d01f4be572770e`.
Попередній checksum і Chrome runtime evidence описують candidate до #15;
повторити відповідні acceptance checks після merge. Встановлену Safari копію
автоматично не оновлювали.
