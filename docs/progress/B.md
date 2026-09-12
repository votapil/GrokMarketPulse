# Дорожка B — прогресс

Правило: B пишет статусы только сюда, галочки в `PLAN.md` не трогает.
Приёмка чужих задач — строкой `T-xx принято` в этом же файле.

## Статусы

| Задача | Статус | Коммит | Комментарий |
|--------|--------|--------|-------------|
| T-03 | готово | `660c82f` | канвас + токены зафиксированы в `docs/DESIGN.md` |
| T-05 | готово | `3f9c60c` | shell, роуты, токены в `index.css`/`tailwind`, EmptyState/ErrorState/Skeleton |
| T-06 | в работе | — | `convex/mock.ts` (state/flip) есть из T-02; нет `convex/http.ts`, `convex/mockHtml.ts` |
| T-08 | не начато | — | `convex/firecrawl.ts`, `convex/snapshots.ts` — стабы-заглушки. Блокирует A:T-14 |
| T-10 | частично | — | `seed.ensureDemo`/`seed.ensure` + `workspace.demo` есть из T-02; baseline-снапшот ждёт T-08 |
| T-04 | не начато | — | `render.yaml` отсутствует |

## Приёмка

- T-02 принято
- T-09 / T-11 / T-07 / T-13 — приняты по сборке: `npm run build` зелёный после rebase на `6fae8ca`

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
