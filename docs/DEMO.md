# Шпаргалка ведущего — сценарий §1

Деплой: `pleasant-bandicoot-600`. Фронт: `npx vite --port 5173` (после `git pull`).
**`npm run dev` не запускать**: он поднимает `convex dev` в watch-режиме и заливает рабочее
дерево на общий деплой при каждом сохранении — старые копии файлов B перетирают свежие.
Функции деплоятся только `npx convex dev --once` после зелёного `npm run typecheck`.
Шапка Run Scan всегда disabled — это кнопка B. Живой CTA — **второй** Run Scan под CompanyBar.

## Рецепт сброса (перед каждым прогоном)

Идентификаторы демо-воркспейса (если сменились — `npx convex run workspace:demo '{}'`):

| сущность | id |
|---|---|
| workspace | `kh70vcfgzydzbcnzbzgxzrp6cd8e9xk6` |
| company | `jh7cnbfcjfwjdbkm65v594earx8e8tkp` |
| competitor AcmeFlow | `jn72r1zt7a2j9kr8a7tkv1fzd98e8vwn` |
| source pricing | `kd7d8vf68042ynjqdga84db7gd8e9285` |

```bash
npx convex run onboarding:restoreDemoContext '{}'
npx convex run mock:flip '{"variant":"v1"}'
npx convex run signals:purgeBySource '{"sourceId":"kd7d8vf68042ynjqdga84db7gd8e9285"}'
npx convex run firecrawl:scrapeSource '{"sourceId":"kd7d8vf68042ynjqdga84db7gd8e9285","isBaseline":true}'
npx convex run mock:flip '{"variant":"v2"}'
```

Потом на Pulse нажать **Run Scan** (не шапочный). Ждать шаги → сигнал `Pro 49 → 39` → assess → три рекомендации.

Если CompanyBar.Analyze кормил чужой URL, контекст Helpdesk Pro $45 пропадает — без `restoreDemoContext` кадр 0:45 играть нечем.

Если скан пишет `Already reported` — забыли `purgeBySource`.

## Три прогона КТ-2

| Кадр | Прогон 1 | Прогон 2 | Прогон 3 |
|---|---|---|---|
| сброс flip v1 → purge → baseline → flip v2 | ок | ок | ок |
| Run Scan | CLI, затем браузер живой после фикса краша | браузер | браузер |
| сигнал в фиде `Pro 49 → 39` | ок | ок | ок |
| assess (score ~68, medium) | ок | ок | ок |
| три рекомендации | ок (после `assess→recommend`) | ок | ок |
| чип «Why is this High?» | ответ есть; блоки — после фикса chat | ок с блоками | ок с блоками |
| DataGrid: Pro $45 → $42 | ок | ок | ок |
| системное событие + холст переложился | ок: FeatureMatrix на холсте | ок | ок |

Если `firecrawl:scrapeSource` отвечает `fetch failed` — повторить команду, мок на `*.convex.site` иногда моргает.

Ведущему:

- Три рекомендации смотреть **справа** в ActionPanel. Слот RecommendationCards на холсте пока заглушка реестра.
- После purge в чате остаются старые ответы со «Signal not found» — не пугаться, новые реплики живые.
- Холст после правки цены обязан **переложиться**. FeatureMatrix был в прогонах 1 и 3; в прогоне 2 модель поставила Timeline — петля всё равно сработала.

## Что чинили по дороге (один коммит на разрыв)

1. `assess` не вызывал `recommend.run` — справа пусто.
2. Analyze затирал Helpdesk Pro $45 — `restoreDemoContext` в рецепте.
3. После connect Pulse пустел: фид выбирал `fixture_signal`, `signals.get` падал на `v.id`.
4. Grok ставил Chart без истории — править Pro было негде; `pinDemoLoopBlocks` держит DataGrid.
5. Чип отвечал текстом без блоков и без фокуса сигнала.

## T-21 вживую

Generate на `rec_3` (landing) → `/artifact/j97841kcjt206vrj7sdtq4e1zn8e8eby`, страница спорит с AcmeFlow $39 vs наш Pro $45. Принято в `docs/progress/A.md`.


## Известные ограничения (сцена)

- SourceList на холсте появляется только если модель/layout выбрали блок; иначе Verify — через ActionPanel Retry / отдельный кадр.
- Exa verify иногда возвращает чужие продукты (Akiflow vs AcmeFlow) — ведущий не опирается на чужие URL как на «доказательство».
- Шапочный Run Scan disabled — живой CTA под CompanyBar.
- На сцене **не** жать CompanyBar Analyze до финального кадра — переписывает demo-контекст.
- `npm run dev` / `convex dev` watch на общем деплое — запрещены; только `npx convex dev --once`.
- FeatureMatrix после правки цены закреплён сервером (`pinPricingEditBlocks`) — модель может не выбрать его сама.
