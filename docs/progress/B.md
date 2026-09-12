# Дорожка B — прогресс

Правило: B пишет статусы только сюда, галочки в `PLAN.md` не трогает.
Приёмка чужих задач — строкой `T-xx принято` в этом же файле.

## Статусы

| Задача | Статус | Коммит | Комментарий |
|--------|--------|--------|-------------|
| T-03 | готово | `660c82f` | канвас + токены зафиксированы в `docs/DESIGN.md` |
| T-05 | готово | `6ed03cc` / `f6f42c3` | `/` → `PulseScreen`; `/artifact/:id`; `/sources` |
| T-06 | готово | `f65f536` | GET /mock/acmeflow/pricing + flip/state, URL из CONVEX_SITE_URL |
| T-08 | готово | `a2f6219` | Firecrawl scrape → snapshots, hash-дедуп, 402/timeout/empty |
| T-10 | готово | `1c62f2c` | seed.ensure: slug demo, URL из CONVEX_SITE_URL, live baseline / fixture Slack |
| T-04 | готово | `03b7f34` | static site blueprint; CONVEX_DEPLOY_KEY sync:false; URL после Render |
| T-17 | готово | `3c48b82` | ArtifactScreen: battlecard/offer, trail, Copy, pending/error/empty |
| T-19 | готово | `7dd6731` | ArtifactBody единая точка рендера; landing из JSON, Us vs AcmeFlow |
| T-16 | готово | — | `scan.run` отдаёт `runId` сразу, пайплайн в `scheduler`; 4 шага, assess отдельно |
| T-21 | готово | `ab17c90` / `421d127` | `act.generate` → pending + artifactId сразу; scheduler → ready; grok-4.6; 3 схемы; 1 retry → error; costs.log в `e42e31d` |

## Приёмка

- T-02 принято
- T-09 / T-11 / T-07 / T-13 — приняты по сборке: `npm run build` зелёный после rebase на `6fae8ca`
- T-14 принято (`4c1ad1a`) — snapshot-контракт B цел; замечания A (public `purgeBySource`, leftover `$`, concurrent insert) не блок
- T-18 принято (`dac887a`) — только `assess.ts`; Pro $45, scoreExplanation, low_confidence
- T-15 App `/` принято (`8f8461f`) — A сама повесила `PulseScreen`
- T-15 Run Scan принято (`13c0460`) — CTA/progress; B-файлы не тронуты
- T-15 `PulseScreen` возврат: двойные `<aside>` вокруг `SignalsFeed` и `ActionPanel` всё ещё на месте
- T-20 принято (`781bde0`) — только `recommend.ts`

## S-1 от B — `api.workspace.setupWatchlist` (**подтверждён A**, `d5fd674`)

A подтвердил и попросил: `internalMutation` с той же логикой для вызова из `onboarding.analyze`,
идемпотентность по нормализованному URL, возврат `competitorId`/`sourceId`, `origin` от вызывающего,
валидация URL, пустой список — no-op. Один писатель в `competitors`/`sources` остаётся у B,
`discovery.ts` (`T-35`) придёт туда же. Условия перенесены в карточку `T-22`.

Отдельная просьба A: публичный `api.snapshots.latest` — заведён как `T-42` (~15 мин), без него
`FeatureMatrix` держит фичи конкурента на фикстуре.


Схема **не меняется**, существующие сигнатуры **не меняются** — добавляется одна строка в `PLAN.md` §3.2
и новая функция в `convex/workspace.ts` (файл B). Останавливаться A не нужно, достаточно `git pull --rebase`.

Причина: `api.onboarding.analyze` (файл A) принимает `competitorUrls: string[]`, но использует только
`companyUrl` — массив уходит в текст шага `runs` (`${competitorUrls.length} competitor URLs noted`)
и теряется. Строк в `competitors` и `sources` не создаётся, baseline не снимается, сканировать после
intake нечего. Это ломает продуктовый путь `PLAN.md` §1.1.

B берёт это на себя в `T-22`: `setupWatchlist` создаёт конкурентов, источники и baseline через
`convex/firecrawl.ts` + `convex/snapshots.ts`, а контекст компании получает **вызовом**
`api.onboarding.analyze`. В файл A никто не пишет.

Просьба к A: подтвердить строкой `S-1 setupWatchlist принято` — или сказать, что хочешь закрыть дыру
у себя в `onboarding.analyze`, тогда B из `T-22` этот кусок убирает. **Отправлено напарнику.**

## Изменения в плане под MVP-видение (сделаны B, коммит `docs:`)

- `PLAN.md` §1.1 — новый раздел: два входа в продукт (демо-путь с нулевым вводом остаётся как был,
  продуктовый путь начинается с intake). §2 уточнён: запрет на визард ≠ запрет на ввод.
- `T-22` переписана: `Экран Sources` → `Экран Setup`, intake из двух контролов первым экраном,
  `/setup` + редирект с `/` при пустом контексте, `setupWatchlist`. ~35 → ~45 мин.
- `T-41` добавлена (B, волна 3 рядом с артефактами, ~30 мин): Summary на 2–3 строки над артефактом
  + кнопка `Generate landing page`, работающая от любой рекомендации. Расширяет `T-17`/`T-19`,
  новых полей в схеме и новых вызовов Grok не требует. Номер `T-38` занят задачей A про общий
  деплоймент, поэтому взят следующий свободный после `T-40`.
- КТ-2 теперь включает прогон продуктового пути от `/setup` до саммари, а не только демо от сида.

## Разногласия после ревизии плана от A (`ed3b431`, `32c2750`)

1. **Лендинг понижен до опционального.** Артефакты уехали в волну 3, в плане прямым текстом:
   «если её не будет, демо всё равно проходится». По §1.1 landing page — не усиление финала, а сам
   выход продукта: пользователь вводит сайты и получает саммари **и** готовую страницу. Отметил
   открытым вопросом в §1.1, решать на КТ-2. Структуру волн A не трогал.
2. **Две точки входа на один шаг — снято, оставляем обе.** `T-39` (A, `CompanyBar` на Pulse) —
   быстрая смена своей компании в контексте дашборда. `T-22` (B, `/setup`) — полный вход со
   своим сайтом **и сайтами конкурентов**, watchlist и baseline. Роли разведены в §1.1 и в
   примечании под таблицей волны 1. Ничего переделывать не нужно, задачи идут параллельно.
   Единственное условие: поле конкурентов остаётся на `/setup` и не дублируется в `CompanyBar` —
   один писатель в `competitors`/`sources`, как ты сам просил в ответе на S-1.
- §12: публичный HTML лендинга по `*.convex.site/landing/:artifactId` — идея, не берётся до КТ-2.
- Wonder: артборд `hop` переименован `Page - Sources` → **`Page - Setup`**, на нём дорисована форма
  intake (`hop.los`) над watchlist, `Setup` первым в наве, `Run Scan` в шапке приглушён. Токены не
  трогал, новых не заводил. Артборды A (`Block/*`, `Panel/Chat`) не затронуты. Узлы и правила
  вёрстки — в `docs/DESIGN.md`.

## Занятые файлы (замок, §6.1)

Волна T-21. Пока строка здесь — файл чужим агентам и дорожке A не трогать.

| Файл | Кто держит | Задача |
|------|-----------|--------|
| `convex/act.ts` | B | T-21 закрыта — не трогать без регенерации |
| `convex/prompts/artifacts.ts` | B | T-21 закрыта |
| `convex/artifacts.ts` | B | T-21 закрыта (только get/bySignal) |
| `convex/costs.ts` | B | кусок T-25 уже в `e42e31d`; остаток — `usage.summary` |
| `convex/snapshots.ts` | B, агент | T-42 |
| `convex/exa.ts`, `convex/verify.ts` | B, агент | T-23 черновик |

**Замок на деплой.** Общий `pleasant-bandicoot-600`: `npx convex dev` пушит всё рабочее
дерево целиком, поэтому пушит только оркестратор и только `--once` после зелёного
`npm run build`. Агенты пишут код и не запускают `convex dev`.

## Точки стыка с A

- `src/components/shell/PulsePage.tsx` — мои три панели с заглушками feed/центра/панели.
  Слоты под A: левая колонка → `SignalsFeed`, центр → `BlockRenderer`, правая → `ActionPanel`.
  На время T-15 файл передаётся A, B его не трогает.
- `src/components/shell/ArtifactPage.tsx` — маршрут `/artifact/:artifactId` уже живой,
  кнопка Generate из `RecommendationCards` ведёт сюда.
- CSS-токены — в `src/index.css` (`--color-*`, `--severity-*`, `--space-*`, `--size-feed/action/header`).

## Блокеры

Оба сняты (дорожка A, общий деплой):

1. ~~Разные Convex deployment.~~ B переключён на общий `dev:pleasant-bandicoot-600`
   (team `votapil`, project `grokmarketpulse`). Свой `hidden-viper-502` больше не используется.
2. ~~У B нет API-ключей.~~ `XAI_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY` уже стоят
   на общем деплое. Ротация — только через A, локально в git ключи не кладём.

Открыт: Wonder у B висит на старом канвасе («Welcome to Wonder», org `nikita-khitiaev`).
Файл GrokMarketPulse в аккаунте виден, но хост держит один файл за раз — нужно открыть вручную.

## Репетиция демо (прогнана на `pleasant-bandicoot-600`)

`mock:flip v1` → `signals:purgeBySource` → baseline scrape → `mock:flip v2` → `scan:run`:

- шаги: `firecrawl` HTTP 200 → `diff` 1 structural change → `grok_filter` skipped → `signal` done
- ровно **один** сигнал `Pro 49 → 39`; assess догнал асинхронно (score 68, severity medium)
- два скана подряд → второй пишет `signal: skipped / Already reported`, дубля нет

Две находки по ходу репетиции (обе починены):

1. **Firecrawl отдавал кэш.** В T-08 стоял `maxAge: 86_400_000`, и скан после
   «Simulate competitor edit» видел **дофлипную** страницу — получался сигнал
   `Pro 39 → 49`, то есть демо наизнанку. Теперь `maxAge: 0`.
2. **Один скан может создать несколько сигналов.** `run.signalId` брал `signalIds[0]`,
   и PulseScreen мог выбрать «Demo fixture disclaimer added» вместо $49 → $39.
   Теперь главный сигнал выбирается по приоритету `price_change → new_plan → packaging`,
   остальные тоже уходят в assess (не более 5 за прогон).
