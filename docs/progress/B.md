# Дорожка B — прогресс

Правило: B пишет статусы только сюда, галочки в `PLAN.md` не трогает.
Приёмка чужих задач — строкой `T-xx принято` в этом же файле.

## Статусы

| Задача | Статус | Коммит | Комментарий |
|--------|--------|--------|-------------|
| T-03 | готово | `660c82f` | канвас + токены зафиксированы в `docs/DESIGN.md` |
| T-05 | готово | `6ed03cc` + mount | `/` → `PulseScreen` (импорт A); `/artifact/:id`; `/sources` |
| T-06 | готово | `f65f536` | GET /mock/acmeflow/pricing + flip/state, URL из CONVEX_SITE_URL |
| T-08 | готово | `a2f6219` | Firecrawl scrape → snapshots, hash-дедуп, 402/timeout/empty |
| T-10 | готово | push | seed.ensure: slug demo, URL из CONVEX_SITE_URL, live baseline / fixture Slack |
| T-04 | готово | push | static site blueprint; CONVEX_DEPLOY_KEY sync:false; URL после Render |
| T-17 | в работе | — | ArtifactScreen + Battlecard + OfferCard |
| T-19 | в работе | — | LandingPreview + ArtifactBody |

## Приёмка

- T-02 принято
- T-09 / T-11 / T-07 / T-13 — приняты по сборке: `npm run build` зелёный после rebase на `6fae8ca`
- T-15 возврат: `PulseScreen` двойные `<aside>` вокруг `SignalsFeed` и `ActionPanel` (заголовки + ширина/скролл). Импорт на `/` всё равно включён — файл A, правит A.

## Точки стыка с A

- `src/components/shell/PulsePage.tsx` — мои три панели с заглушками feed/центра/панели.
  Слоты под A: левая колонка → `SignalsFeed`, центр → `BlockRenderer`, правая → `ActionPanel`.
  На время T-15 файл передаётся A, B его не трогает.
- `src/components/shell/ArtifactPage.tsx` — маршрут `/artifact/:artifactId` уже живой,
  кнопка Generate из `RecommendationCards` ведёт сюда.
- CSS-токены — в `src/index.css` (`--color-*`, `--severity-*`, `--space-*`, `--size-feed/action/header`).

## Блокеры

1. **Разные Convex deployment.** У B `dev:hidden-viper-502`, у A `pleasant-bandicoot-600`
   (проект `grokmarketpulse`, команда `votapil` — общая). Нужен один общий dev-деплой.
2. **У B нет ни одного API-ключа** — `.env.local` пустой, на `hidden-viper-502`
   ноль env-переменных. Без `FIRECRAWL_API_KEY` T-08 не прогнать вживую.
