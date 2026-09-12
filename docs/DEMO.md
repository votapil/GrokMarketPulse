# Демо — шпаргалка ведущего (1 час)

## Деплой

Деплой: `pleasant-bandicoot-600`. Фронт: `npx vite --port 5173` (после `git pull`).

**Никогда:** `npm run dev` / `convex dev` watch — заливают чужое дерево на общий деплой.
Функции: только `npx convex dev --once` после зелёного `npm run typecheck`.

## Воркспейс

| сущность | id |
|---|---|
| workspace | `kh70vcfgzydzbcnzbzgxzrp6cd8e9xk6` |
| company | `jh7cnbfcjfwjdbkm65v594earx8e8tkp` |
| competitor AcmeFlow | `jn72r1zt7a2j9kr8a7tkv1fzd98e8vwn` |
| source pricing | `kd7d8vf68042ynjqdga84db7gd8e9285` |

Если id сменились: `npx convex run workspace:demo '{}'`

## Сброс (перед каждым прогоном)

```bash
npx convex run onboarding:restoreDemoContext '{}'
npx convex run mock:flip '{"variant":"v1"}'
npx convex run signals:purgeBySource '{"sourceId":"kd7d8vf68042ynjqdga84db7gd8e9285"}'
npx convex run firecrawl:scrapeSource '{"sourceId":"kd7d8vf68042ynjqdga84db7gd8e9285","isBaseline":true}'
npx convex run mock:flip '{"variant":"v2"}'
```

## GOLDEN PATH (сцена)

1. **Scan** — второй Run Scan **под** CompanyBar (не шапочный)
2. Ждать шаги → сигнал `Pro 49 → 39`
3. Assess → **3 рекомендации справа** (ActionPanel)
4. Чип «Why is this High?» — опционально; если тормозит — skip
5. DataGrid: Pro **$45 → $42**
6. Холст переложился → **FeatureMatrix ОБЯЗАН появиться**
7. Generate landing на `rec_3`
8. Артефакт спорит с AcmeFlow $39 vs наш Pro $45

## НЕ жать / не показывать

- CompanyBar **Analyze** (затирает Helpdesk Pro $45)
- Шапочный **Run Scan** (disabled, кнопка B)
- Verify / SourceList как опора
- CompetitorScope
- Timeline

## Gotchas (макс. 5)

- `Already reported` → забыли `purgeBySource`
- `fetch failed` на scrape → повторить; мок на `*.convex.site` моргает
- После purge в чате старые «Signal not found» — игнор
- Рекомендации только **справа**; слот на холсте — заглушка
- FeatureMatrix после правки цены закреплён сервером — без него петля не демо

История: assess→recommend, restoreDemoContext, pinDemoLoopBlocks — закрыты; детали в `docs/progress/`.
