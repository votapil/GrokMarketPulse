# PLAN.md — Market Pulse, план на двоих

Репозиторий: `GrokMarketPulse`. Ветка работы: `main`. Два разработчика, два Claude Code, одна общая `main`.

**Дорожка A — слой общения с нейросетью и динамический интерфейс.** Владелец: **votapil**.
Grok-клиент и reasoning-промпты, Detect / Assess / Recommend, выбор блоков моделью, чат и UI events,
реестр блоков и все блоки, экран Pulse с фидом и панелью объяснения.

**Дорожка B — источники данных и итоговые артефакты.** Владелец: **напарник**.
Правила генерации и сам Act, landing page / offer / battlecard, экраны Artifact и Sources,
Firecrawl / Exa / snapshots / seed / оркестратор скана, Fal.ai, деплой, app shell и дизайн-система.

`T-01`, `T-02` — общие точки синхронизации. Дальше дорожки не встречаются в файлах.

**Как это делит ТЗ.** Дорожка A забирает §12–16 (Detect, Verify-reasoning, Assess, Threat scoring,
Recommend) и §20–28 + §41 (AI-native интерфейс, Dynamic UI Protocol, каталог блоков, UI events,
chat-first управление). Дорожка B забирает §17 и §42–43 (Act, Action Artifact, preview, Fal.ai),
§9–11 (Monitor, baseline), §44 (статусы ошибок пайплайна) и §5 (runtime, деплой).

**Деление идёт по домену, а не по слою.** Обе дорожки пишут и в `convex/`, и в `src/`: у каждой
своя вертикаль от внешнего API до экрана. Поэтому правило непересекающегося владения файлами
работает как раньше, а вертикальный срез сохраняется — после каждой задачи приложение
запускается и что-то показывает.

**Дорожки вызывают функции друг друга** через контракт §3.2 — это не нарушение владения.
A дёргает `api.scan.run` (файл дорожки B), B дёргает `api.recommend` (файл дорожки A).
Запрещено только писать в один файл.

## Допущения

- **Допущение:** дедлайн жёстко не задан — план идёт волнами P0 → P1 → P2, каждая волна самодостаточна и показуема. Контрольные точки (§8) привязаны к состоянию продукта, а не к часам.
- **Допущение:** интерфейс и весь текст в UI — **на английском** (жюри международное), комментарии в коде и `PLAN.md` — на русском.
- **Решение (не допущение — это ломается само, если сделать иначе):** **три деплоймента Convex** —
  свой dev у каждого разработчика плюс один общий prod. Два `npx convex dev` в один деплоймент
  затирают функции друг друга: пушит последний, и незакоммиченный код одного перезаписывает
  рабочий код другого. 3 из 40 бесплатных деплойментов. Prod никто не пушит руками — его
  собирает Render на каждый коммит в `main`.
- **Следствие:** URL мок-сайта у каждого свой (`*.convex.site` привязан к деплойменту). Поэтому
  `sources.url` **вычисляется из `process.env.CONVEX_SITE_URL`** в seed, а не хардкодится.
  Иначе локально у напарника Firecrawl будет скрейпить чужую базу, а на prod — ничего.
- **Допущение:** хостинг — только **Render Static Site** + `npx convex deploy --cmd 'npm run build'`. Web service не поднимаем: он спит 15 минут и холодно стартует ~минуту, это убьёт демо.
- **Допущение:** авторизации нет вообще. Один предзаполненный demo-workspace, доступный по корневому URL.
- **Допущение:** мок-сайт конкурента отдаёт **Convex HTTP action** (`*.convex.site/mock/acmeflow/pricing`). Цена лежит в таблице `mockSite` и переключается мутацией — Firecrawl скрейпит настоящий публичный URL оба раза, Detect работает на живом API, а изменение управляемо со сцены.
- **Допущение:** Fal.ai — только hero-картинка для landing page, строго P2, вне критического пути демо.
- **Допущение:** тесты — только smoke (`npm run build` + ручной клик-путь). Юнит-тестов на день нет.
- **Допущение:** `longp.json` в корне — мусор от разведки xAI, удаляется в `T-01`.

---

## 1. Демо-сценарий (90 секунд, по шагам)

Три экрана: **Pulse** (`/`), **Artifact** (`/artifact/:id`), **Sources** (`/sources`). Демо целиком проходит на Pulse → Artifact.

| Время | Что делает человек | Что на экране |
|---|---|---|
| 0:00–0:10 | Ничего. Открыт `/`. | Экран **не пустой**: слева фид из 2 сигналов (один `resolved` — «AcmeFlow added Slack integration», один свежий), сверху плашка «Helpdesk AI · Pro $45 · SMB». Одна заметная кнопка **Run Scan**. Ценность читается сразу: *Your competitor moved.* |
| 0:10–0:15 | Говорит «конкурент только что поправил прайсинг» и жмёт **Run Scan**. | (за 10 секунд до этого — тумблер `Simulate competitor edit` на `/sources`, он переключил мок-сайт v1 → v2). |
| 0:15–0:35 | Ждёт. | Пошаговый прогресс, не спиннер: `Firecrawl: fetching pricing page` → `Diffing snapshots` → `Grok: filtering noise` → `Signal created`. Каждый шаг зажигается отдельно. |
| 0:35–0:45 | Ничего. | Новый Signal **сам** появляется в фиде (Convex realtime, без перезагрузки). Центр: `SignalCard` + **`DiffView` $49 → $39** + `EvidenceCard` (URL, timestamp, фрагмент) + `MetricCards` (Threat **High**, score 82, confidence 91%, Price −20%). |
| 0:45–0:55 | Жмёт **Verify with external sources**. | `SourceList` от Exa: 2 внешних ссылки с цитатами. Тезис вслух: «мы не верим одной странице». |
| 0:55–1:10 | Ничего. | Правая панель: Grok-объяснение разделено на **Fact / Evidence / AI analysis** — «на 13% дешевле вашего Pro, пересекается с вашим основным SMB-сегментом». Ниже — **3 рекомендации** с rationale / impact / effort / risk. |
| 1:10–1:25 | Жмёт **Generate** на третьей рекомендации. | Экран **Artifact**: готовая landing page внутри приложения — headline, offer, benefits, таблица Us vs AcmeFlow, CTA. (P2: hero-картинка от Fal.ai.) |
| 1:25–1:30 | Финальная фраза. | Внизу бейдж живого расхода: `Grok $0.04 · Firecrawl 6 credits · Exa $0.01`. Всё вживую, ничего не подделано. |

Кликов до результата: **3** (Run Scan → Verify → Generate). Обязательных полей ввода на пути демо: **0**.

---

## 2. Что не делаем (с причинами)

| Не делаем | Причина |
|---|---|
| Авторизация, регистрация, профиль, команды | ТЗ не требует, ломает «нулевой онбординг», съедает час |
| Мультиворкспейс, переключатель воркспейсов | На демо один воркспейс, селектор — лишний клик |
| Многошаговый онбординг-визард, туры, модалки подтверждения | Прямой запрет в правилах UX. Онбординг — один экран, предзаполненный, одна кнопка |
| Настройки, админка, боковое меню | Не двигают демо-сценарий |
| Render Web Service, Postgres, Key Value | Free web service спит 15 мин → холодный старт минуту. Состояние живёт в Convex |
| `@convex-dev/agent`, `workflow`, `persistent-text-streaming`, `rag` | 45–90 минут на первый рабочий стрим. Один action + `internalMutation` + `useQuery` дают почти-стриминговый UX бесплатно |
| AI Gateway (`@convex-dev/ai-sdk-provider`) | На Free выключен (`AiGatewayDisabled`). Только `fetch` из action |
| Inline editing в DataGrid, редактируемый прайсинг | P2 из ТЗ, не в сценарии |
| Рекламные креативы, email, автопубликация, автоизменение цен | Прямо исключено в ТЗ §18/§37 |
| Юнит-тесты, e2e, CI | На один день дешевле `npm run build` + ручной клик-путь |
| Мобильная вёрстка, тёмная/светлая тема тумблером | Демо на одном ноутбуке, одна тема |
| GeoMap, Exa competitor discovery, Fal.ai | P2. Входят только после КТ-3, каждый — отдельная задача в хвосте |
| Свободная генерация JSX от LLM | ТЗ §41: только реестр зарегистрированных блоков |

---

## 3. Замороженные контракты

Зафиксированы в `T-02`. Менять только через sync-задачу `S-1` (§6). До этого обе машины пишут код против этих типов.

### 3.1 `convex/schema.ts`

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vLevel = v.union(
  v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"),
);

export const vSignalStatus = v.union(
  v.literal("detected"), v.literal("verifying"), v.literal("verified"),
  v.literal("assessed"), v.literal("recommendations_ready"),
  v.literal("action_selected"), v.literal("artifact_generated"),
  v.literal("resolved"), v.literal("low_confidence"), v.literal("error"),
);

export const vBlockType = v.union(
  v.literal("SignalCard"), v.literal("DiffView"), v.literal("EvidenceCard"),
  v.literal("MetricCards"), v.literal("RecommendationCards"), v.literal("SourceList"),
  v.literal("Timeline"), v.literal("Chart"), v.literal("FeatureMatrix"),
  v.literal("ActionPreview"), v.literal("DataGrid"), v.literal("GeoMap"),
);

// Блок несёт ТОЛЬКО тип и ссылки-идентификаторы. Данные фронт берёт из Convex
// реактивно. Grok решает "что показать", но не "какими данными" — это и есть
// защита из ТЗ §41: ни одной строки разметки от модели.
export const vBlock = v.object({
  id: v.string(),
  type: vBlockType,
  props: v.record(v.string(), v.string()),
});

export const vPlan = v.object({
  name: v.string(),
  usd: v.union(v.number(), v.null()),
  period: v.string(),          // "month" | "year" | "one-time"
  limits: v.string(),
  features: v.array(v.string()),
});

export const vCompanyContext = v.object({
  businessType: v.string(),
  category: v.string(),
  targetSegments: v.array(v.string()),
  pricingModel: v.string(),
  keyProducts: v.array(v.string()),
  keyFeatures: v.array(v.string()),
  positioning: v.string(),
  competitiveDimensions: v.array(v.string()),
  plans: v.array(vPlan),
});

export const vRecommendation = v.object({
  id: v.string(),                                  // "rec_1" | "rec_2" | "rec_3"
  title: v.string(),
  action: v.string(),
  rationale: v.string(),
  expectedImpact: v.string(),
  effort: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  risk: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  priority: v.number(),                            // 1..3
  artifactType: v.union(v.literal("battlecard"), v.literal("offer"), v.literal("landing")),
});

export const vAssessment = v.object({
  why: v.string(),
  positionChange: v.string(),
  affectedAreas: v.array(v.string()),
  affectedSegments: v.array(v.string()),
  reactionSpeed: v.string(),
  scoreExplanation: v.string(),
});

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),                              // демо-воркспейс: "demo"
  }).index("by_slug", ["slug"]),

  companies: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    url: v.string(),
    context: v.union(v.null(), vCompanyContext),
    contextStatus: v.union(
      v.literal("empty"), v.literal("pending"), v.literal("ready"), v.literal("error"),
    ),
    error: v.union(v.null(), v.string()),
  }).index("by_workspace", ["workspaceId"]),

  competitors: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    url: v.string(),
    kind: v.string(),                              // "direct" | "adjacent" | "suspected"
    summary: v.string(),
    origin: v.union(v.literal("manual"), v.literal("grok"), v.literal("exa"), v.literal("seed")),
  }).index("by_workspace", ["workspaceId"]),

  sources: defineTable({
    workspaceId: v.id("workspaces"),
    competitorId: v.id("competitors"),
    url: v.string(),
    kind: v.string(),                              // pricing | product | features | homepage | changelog | landing | news
    label: v.string(),
    lastFetchedAt: v.union(v.null(), v.number()),
    lastStatus: v.union(v.null(), v.number()),     // HTTP-код от Firecrawl
  }).index("by_competitor", ["competitorId"])
    .index("by_workspace", ["workspaceId"]),

  snapshots: defineTable({
    workspaceId: v.id("workspaces"),
    sourceId: v.id("sources"),
    fetchedAt: v.number(),
    isBaseline: v.boolean(),
    hash: v.string(),                              // sha-подобный хеш нормализованного markdown
    markdown: v.string(),                          // усечён до 20 000 символов
    plans: v.array(vPlan),
    features: v.array(v.string()),
    headline: v.string(),
    provider: v.union(v.literal("firecrawl"), v.literal("fixture")),
    httpStatus: v.number(),
  }).index("by_source_and_time", ["sourceId", "fetchedAt"]),

  signals: defineTable({
    workspaceId: v.id("workspaces"),
    competitorId: v.id("competitors"),
    sourceId: v.id("sources"),
    type: v.string(),                              // price_change | new_plan | plan_removed | new_feature | ...
    title: v.string(),
    summary: v.string(),
    previousState: v.string(),                      // "Pro $49/mo"
    currentState: v.string(),                       // "Pro $39/mo"
    detectedAt: v.number(),
    status: vSignalStatus,
    kind: v.union(v.literal("threat"), v.literal("opportunity"), v.literal("neutral")),
    severity: vLevel,
    urgency: vLevel,
    score: v.number(),                             // 0..100
    confidence: v.number(),                        // 0..1
    previousSnapshotId: v.union(v.null(), v.id("snapshots")),
    currentSnapshotId: v.union(v.null(), v.id("snapshots")),
    assessment: v.union(v.null(), vAssessment),
    recommendations: v.array(vRecommendation),
    layout: v.array(vBlock),                       // выбор блоков от Grok; пусто → дефолт на фронте
    selectedRecommendationId: v.union(v.null(), v.string()),
    error: v.union(v.null(), v.string()),
  }).index("by_workspace_and_time", ["workspaceId", "detectedAt"])
    .index("by_competitor", ["competitorId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  evidence: defineTable({
    workspaceId: v.id("workspaces"),
    signalId: v.id("signals"),
    kind: v.union(
      v.literal("previous_snapshot"), v.literal("current_snapshot"),
      v.literal("diff"), v.literal("firecrawl_fragment"), v.literal("exa_source"),
    ),
    provider: v.union(v.literal("firecrawl"), v.literal("exa"), v.literal("internal")),
    url: v.string(),
    title: v.string(),
    fragment: v.string(),
    confidence: v.number(),
    observedAt: v.number(),
  }).index("by_signal", ["signalId"]),

  artifacts: defineTable({
    workspaceId: v.id("workspaces"),
    signalId: v.id("signals"),
    recommendationId: v.string(),
    type: v.union(v.literal("battlecard"), v.literal("offer"), v.literal("landing")),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
    // payload — дискриминированный union, фронт матчит по .type
    payload: v.union(
      v.object({
        type: v.literal("battlecard"),
        competitorChange: v.string(), threat: v.string(),
        competitorStrengths: v.array(v.string()), competitorWeaknesses: v.array(v.string()),
        ourStrengths: v.array(v.string()), positioning: v.string(),
        objections: v.array(v.object({ objection: v.string(), response: v.string() })),
        talkingPoints: v.array(v.string()),
      }),
      v.object({
        type: v.literal("offer"),
        headline: v.string(), proposition: v.string(), value: v.string(),
        conditions: v.array(v.string()), differentiators: v.array(v.string()), cta: v.string(),
      }),
      v.object({
        type: v.literal("landing"),
        headline: v.string(), subheadline: v.string(), offer: v.string(),
        benefits: v.array(v.object({ title: v.string(), body: v.string() })),
        differentiation: v.string(),
        comparison: v.array(v.object({
          feature: v.string(), us: v.string(), them: v.string(),
        })),
        socialProofPlaceholders: v.array(v.string()),
        cta: v.string(),
        sections: v.array(v.object({ title: v.string(), body: v.string() })),
      }),
      v.object({ type: v.literal("empty") }),      // для status pending/error
    ),
    heroImageUrl: v.union(v.null(), v.string()),
    error: v.union(v.null(), v.string()),
  }).index("by_signal", ["signalId"])
    .index("by_workspace", ["workspaceId"]),

  runs: defineTable({
    workspaceId: v.id("workspaces"),
    competitorId: v.union(v.null(), v.id("competitors")),
    kind: v.union(v.literal("scan"), v.literal("onboarding"), v.literal("verify"), v.literal("artifact")),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
    startedAt: v.number(),
    finishedAt: v.union(v.null(), v.number()),
    signalId: v.union(v.null(), v.id("signals")),
    steps: v.array(v.object({
      key: v.string(),                             // "firecrawl" | "diff" | "grok_filter" | "signal"
      label: v.string(),
      status: v.union(
        v.literal("pending"), v.literal("running"), v.literal("done"),
        v.literal("skipped"), v.literal("error"),
      ),
      detail: v.string(),
    })),
    error: v.union(v.null(), v.string()),
  }).index("by_workspace_and_time", ["workspaceId", "startedAt"]),

  chatMessages: defineTable({
    workspaceId: v.id("workspaces"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    text: v.string(),
    blocks: v.array(vBlock),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
    createdAt: v.number(),
  }).index("by_workspace_and_time", ["workspaceId", "createdAt"]),

  apiUsage: defineTable({
    workspaceId: v.id("workspaces"),
    provider: v.union(
      v.literal("xai"), v.literal("firecrawl"), v.literal("exa"), v.literal("fal"),
    ),
    op: v.string(),
    costUsd: v.number(),
    credits: v.number(),
    createdAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  mockSite: defineTable({
    slug: v.string(),                              // "acmeflow"
    variant: v.union(v.literal("v1"), v.literal("v2")),
  }).index("by_slug", ["slug"]),
});
```

### 3.2 Сигнатуры Convex-функций

Меняется только через `S-1`. Все args и returns валидируются — это требование Convex, не стиль.

```ts
// === queries (читает дорожка B) ===
api.workspace.demo      ({})                        -> { workspace, company, competitors, sources } | null
api.signals.list        ({ workspaceId })           -> Signal[]                 // новые сверху
api.signals.get         ({ signalId })              -> { signal, evidence, competitor, source } | null
api.signals.layout      ({ signalId })              -> UiBlock[]                // signal.layout или дефолт
api.artifacts.get       ({ artifactId })            -> Artifact | null
api.artifacts.bySignal  ({ signalId })              -> Artifact[]
api.runs.latest         ({ workspaceId })           -> Run | null               // источник прогресса
api.history.timeline    ({ competitorId })          -> { at: number; label: string; price: number | null; signalId: string | null }[]
api.chat.list           ({ workspaceId })           -> ChatMessage[]
api.usage.summary       ({ workspaceId })           -> { xaiUsd, firecrawlCredits, exaUsd, falUsd, totalUsd }
api.mock.state          ({})                        -> { slug: string; variant: "v1" | "v2" }

// === actions (дёргает дорожка B) ===
api.seed.ensure         ({})                                       -> { workspaceId: Id<"workspaces"> }
api.scan.run            ({ competitorId })                         -> { runId: Id<"runs"> }
api.onboarding.analyze  ({ companyUrl, competitorUrls: string[] }) -> { runId: Id<"runs">, workspaceId }
api.verify.again        ({ signalId })                             -> { runId: Id<"runs"> }
api.act.generate        ({ signalId, recommendationId })           -> { artifactId: Id<"artifacts"> }
api.chat.ask            ({ workspaceId, text })                    -> { messageId: Id<"chatMessages"> }
api.uiEvents.send       ({ workspaceId, blockId, action, payload }) -> { messageId: Id<"chatMessages"> | null }
api.mock.flip           ({ variant: "v1" | "v2" })                 -> null
```

Правила, которые контракт обязывает соблюдать (из `docs/STACK.md`):
- `ctx.db.get("signals", id)` — **имя таблицы первым аргументом**. Старая форма работает, но не используем её нигде.
- `withIndex` обязателен явно. `.filter()` после скана — не оптимизация.
- Никаких `Date.now()` внутри `query`. Время — аргументом или в мутации.
- В actions нет `ctx.db`, только `runQuery`/`runMutation`/`runAction`/`scheduler`.
- `"use node"` не ставим: `fetch` есть в дефолтном рантайме.
- Firecrawl `crawl` — **только с `limit`**. Дефолт 10 000 страниц = весь бюджет.

### 3.3 Типы фронта — `src/lib/types.ts`

```ts
export type Level = "low" | "medium" | "high" | "critical";
export type SignalStatus =
  | "detected" | "verifying" | "verified" | "assessed" | "recommendations_ready"
  | "action_selected" | "artifact_generated" | "resolved" | "low_confidence" | "error";

export type BlockType =
  | "SignalCard" | "DiffView" | "EvidenceCard" | "MetricCards" | "RecommendationCards"
  | "SourceList" | "Timeline" | "Chart" | "FeatureMatrix" | "ActionPreview" | "DataGrid" | "GeoMap";

export type UiBlock = { id: string; type: BlockType; props: Record<string, string> };

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: T };
```

`LoadState` — обязательный контракт UX: каждый блок дорожки B рендерит все четыре ветки. `useQuery` вернул `undefined` → `loading`; пустой массив → `empty`; поле `error` не `null` → `error`.

### 3.4 Фикстуры — `src/lib/fixtures.ts`

Создаются в `T-02` и после этого **read-only для обеих дорожек**. Дорожка B пишет весь UI против них, не дожидаясь бэкенда. Содержат:

- `fixtureWorkspace` — Helpdesk AI, Pro $45/mo, SMB + mid-market, EU/US
- `fixtureCompetitor` — AcmeFlow, `https://<deployment>.convex.site/mock/acmeflow/pricing`
- `fixtureSnapshotV1` / `fixtureSnapshotV2` — прайсинг с Pro **$49** и Pro **$39**
- `fixtureSignal` — price_change, threat/high/82/0.91, полный `assessment` и три `recommendations`
- `fixtureEvidence` — 2 снапшота + diff + 2 Exa-источника
- `fixtureArtifactLanding`, `fixtureArtifactBattlecard`, `fixtureArtifactOffer`
- `fixtureRunSteps` — 4 шага прогресса во всех статусах
- `fixtureTimeline`, `fixtureUsage`

Стабы Convex-функций в `T-02` возвращают ровно эти объекты. Дорожка A потом подменяет внутренности своих файлов, **не меняя сигнатур** — дорожка B ничего не правит.

---

## 4. Таблица задач

Галочка в колонке «✔» ставится **тем же коммитом**, что и задача. Приёмка (`принято` / `возврат`) — в §7.

### Волна 0 — синхронизация (единственное место, где дорожки в одних файлах)

| ID | Дорожка | Задача | Зависит от | Владеет файлами | ~мин | ✔ |
|----|---------|--------|-----------|-----------------|------|---|
| T-01 | общая (A делает, B ждёт) | Бутстрап: Convex + Vite + React + Tailwind + shadcn, env-ключи, `.mcp.json`, чистка мусора | — | всё сгенерированное: `package.json`, `vite.config.ts`, `tailwind.config.*`, `convex/*`, `src/*`, `.gitignore`, `README.md`, `.mcp.json`; удаляет `longp.json` | 30 | [ ] |
| T-02 | общая (A делает, B ждёт) | Замороженные контракты + заглушка на каждый модуль обеих дорожек | T-01 | `convex/schema.ts` + файл-заглушка каждого модуля из §5, `src/lib/types.ts`, `src/lib/fixtures.ts`, `src/components/artifacts/ArtifactBody.tsx` | 55 | [ ] |
| T-03 | B (идёт параллельно T-01/T-02, файлов репо не трогает) | Wonder: общий файл-канвас, токены, артборды Shell / Artifact / Sources / Landing → `docs/DESIGN.md` | — | `docs/DESIGN.md` | 60 | [ ] |

### Волна 1 — P0, полная параллельность

Порядок внутри дорожки — сверху вниз. Пары в одной строке идут одновременно.

| ID | Дорожка | Задача | Зависит от | Владеет файлами | ~мин | ✔ |
|----|---------|--------|-----------|-----------------|------|---|
| T-12 | A | Grok-клиент (`/v1/responses`) + Company Context | T-02 | `convex/grok.ts`, `convex/prompts/reasoning.ts`, `convex/onboarding.ts` | 40 | [ ] |
| T-37 | A | Wonder: артборды блоков Pulse (SignalCard, DiffView, EvidenceCard, MetricCards, RecommendationCards, ChatPanel) → `docs/DESIGN-BLOCKS.md` | T-03 | `docs/DESIGN-BLOCKS.md` | 35 | [ ] |
| T-05 | B | App shell: 3-панельный layout, роуты, токены, примитивы состояний | T-02, T-03 | `src/App.tsx`, `src/main.tsx`, `src/index.css`, `tailwind.config.*`, `index.html`, `src/components/shell/**`, `src/components/state/**` | 40 | [ ] |
| T-09 | A | Реестр блоков + `BlockRenderer` + `SignalCard` + `MetricCards` + обёртка `ActionPreview` | T-05 | `src/components/blocks/registry.tsx`, `src/components/blocks/BlockRenderer.tsx`, `src/components/blocks/SignalCard.tsx`, `src/components/blocks/MetricCards.tsx`, `src/components/blocks/ActionPreview.tsx` | 45 | [ ] |
| T-06 | B | Мок-сайт конкурента: Convex HTTP action + `mock.flip` | T-02 | `convex/http.ts`, `convex/mock.ts`, `convex/mockHtml.ts` | 35 | [ ] |
| T-11 | A | `DiffView` + `EvidenceCard` — Fact и Evidence разделены | T-09 | `src/components/blocks/DiffView.tsx`, `src/components/blocks/EvidenceCard.tsx` | 40 | [ ] |
| T-08 | B | Firecrawl: scrape → snapshot, кэш, дедуп, обработка ошибок | T-06 | `convex/firecrawl.ts`, `convex/snapshots.ts` | 40 | [ ] |
| T-07 | A | `SignalsFeed` — левая колонка на `useQuery` | T-09 | `src/components/SignalsFeed.tsx`, `src/components/SignalRow.tsx` | 35 | [ ] |
| T-10 | B | Seed demo-воркспейса + baseline (идемпотентно) | T-08 | `convex/seed.ts`, `convex/seedData.ts`, `convex/workspace.ts` | 35 | [ ] |
| T-13 | A | Панель объяснения: Assessment (Fact/Evidence/Analysis) + `RecommendationCards` | T-09 | `src/components/ActionPanel.tsx`, `src/components/blocks/RecommendationCards.tsx` | 40 | [ ] |
| T-04 | B | Деплой на Render: static site + autodeploy + прод Convex | T-05 | `render.yaml`, `docs/DEPLOY.md`, `.env.local.example` | 30 | [ ] |
| T-14 | A | Detect: структурный diff + Grok-фильтр шума → Signal | T-08, T-12 | `convex/detect.ts`, `convex/diff.ts`, `convex/signals.ts` | 45 | [ ] |
| T-17 | B | Экран Artifact: shell + рендер `battlecard` и `offer` | T-05 | `src/screens/ArtifactScreen.tsx`, `src/components/artifacts/Battlecard.tsx`, `src/components/artifacts/OfferCard.tsx` | 40 | [ ] |
| T-15 | A | Экран Pulse: Run Scan, пошаговый прогресс, realtime-вставка сигнала | T-07, T-13 | `src/screens/PulseScreen.tsx`, `src/components/RunScanButton.tsx`, `src/components/ScanProgress.tsx` | 40 | [ ] |
| T-19 | B | Landing page preview из JSON-схемы + `ArtifactBody` | T-17 | `src/components/artifacts/LandingPreview.tsx`, `src/components/artifacts/ArtifactBody.tsx` | 45 | [ ] |
| T-18 | A | Assess: threat/opportunity, severity, score, confidence, urgency + объяснение | T-14 | `convex/assess.ts` | 40 | [ ] |
| T-16 | B | Оркестратор `scan.run` + таблица `runs` | T-08, T-14 | `convex/scan.ts`, `convex/runs.ts` | 40 | [ ] |
| T-20 | A | Recommend: три контрмеры с rationale / impact / effort / risk | T-18 | `convex/recommend.ts` | 35 | [ ] |
| T-21 | B | Act: правила генерации + создание артефакта | T-20 | `convex/act.ts`, `convex/prompts/artifacts.ts`, `convex/artifacts.ts` | 45 | [ ] |
| T-22 | B | Экран Sources: предзаполненный онбординг + тумблер `Simulate competitor edit` | T-05, T-10 | `src/screens/SourcesScreen.tsx`, `src/components/SourceRow.tsx`, `src/components/DemoToggle.tsx` | 35 | [ ] |

**После T-22 демо-сценарий §1 проходится целиком.** Всё дальше — усиление, не спасение.

Итог волны 1: дорожка A — 11 задач (~435 мин) плюс `T-01`+`T-02` (85). Дорожка B — 10 задач (~385 мин) плюс `T-03` (60). Разница ~35 минут в пользу B — она уходит на приёмку чужих задач по §7, которых у B больше.

### Волна 2 — P1

| ID | Дорожка | Задача | Зависит от | Владеет файлами | ~мин | ✔ |
|----|---------|--------|-----------|-----------------|------|---|
| T-27 | A | Grok выбирает layout: заполнение `signal.layout` блоками по типу бизнеса | T-18 | `convex/layout.ts` | 35 | [ ] |
| T-23 | B | Exa verify: внешнее подтверждение → evidence + пересчёт confidence | T-14 | `convex/exa.ts`, `convex/verify.ts` | 40 | [ ] |
| T-24 | A | `SourceList` + кнопка `Verify with external sources` | T-11, T-23 | `src/components/blocks/SourceList.tsx` | 30 | [ ] |
| T-25 | B | Лог расхода: `cost_in_usd_ticks`, кредиты Firecrawl, доллары Exa | T-12 | `convex/usage.ts`, `convex/costs.ts` | 30 | [ ] |
| T-29 | A | Chat: `chat.ask` → `response_text` + blocks; `uiEvents.send` | T-27 | `convex/chat.ts`, `convex/uiEvents.ts`, `convex/history.ts` | 45 | [ ] |
| T-26 | B | Бейдж живого расхода спонсорских API | T-05, T-25 | `src/components/UsageBadge.tsx` | 25 | [ ] |
| T-30 | A | Chat-панель: ввод, история, скелетон, отправка UI events | T-13, T-29 | `src/components/ChatPanel.tsx` | 40 | [ ] |
| T-31 | B | Crons: периодический мониторинг + rate-limit guard + budget stop | T-16 | `convex/crons.ts`, `convex/budget.ts` | 30 | [ ] |
| T-28 | A | `Timeline` + `Chart` (история цены конкурента) | T-09 | `src/components/blocks/Timeline.tsx`, `src/components/blocks/PriceChart.tsx` | 40 | [ ] |
| T-32 | A | `FeatureMatrix` + `DataGrid` для прайсинга | T-09 | `src/components/blocks/FeatureMatrix.tsx`, `src/components/blocks/DataGrid.tsx` | 40 | [ ] |

### Волна 3 — P2 (только если КТ-3 пройдена)

| ID | Дорожка | Задача | Зависит от | Владеет файлами | ~мин | ✔ |
|----|---------|--------|-----------|-----------------|------|---|
| T-33 | B | Fal.ai: hero-картинка для landing page | T-21 | `convex/fal.ts` | 35 | [ ] |
| T-34 | B | Hero-картинка в `LandingPreview` + регенерация и правка артефакта | T-19, T-33 | `src/components/artifacts/RegenerateBar.tsx` | 30 | [ ] |
| T-35 | B | Exa discovery: поиск потенциальных конкурентов | T-23 | `convex/discovery.ts` | 40 | [ ] |
| T-36 | A | `GeoMap` для локального бизнеса + событие `update_radius` | T-30, T-32 | `src/components/blocks/GeoMap.tsx` | 45 | [ ] |

### Диаграмма: что идёт параллельно, где обе дорожки стоят

```
ВРЕМЯ ──────────────────────────────────────────────────────────────────────────▶

СТОП ОБЕИМ ДОРОЖКАМ (единственная точка синхронизации в плане)
┌──────────────────────────────┐
│ A: T-01 бутстрап (25)        │   B в это время: T-03 Wonder (40) — файлов репо не трогает
│ A: T-02 контракты+стабы (55) │   B ждёт push перед T-05
└──────────────────────────────┘
            │  git push  → B делает git pull --rebase
            ▼
ДАЛЬШЕ ДОРОЖКИ НЕ ВСТРЕЧАЮТСЯ В ФАЙЛАХ

A (Grok + динамический UI):
  T-12 ─ T-37 ─ T-09 ─ T-11 ─ T-07 ─ T-13 ─ T-14 ─ T-15 ─ T-18 ─ T-20 ───▶ [КТ-2]
  grok  wonder блоки   diff   feed  панель detect  Pulse  assess  recommend
                  │                   ▲                      │
                [КТ-1]                │                      │
B (данные + артефакты):               │                      ▼
  T-05 ─ T-06 ─ T-08 ─ T-10 ─ T-04 ─ T-17 ─ T-19 ─ T-16 ─ T-21 ─ T-22 ───▶ [КТ-2]
  shell  mock  firecrawl seed deploy artifact landing scan   act   sources
                  │                                    ▲
                  └── snapshots нужны A для T-14 ───────┘  detect нужен B для T-16

Две межтрековые зависимости на всю волну 1, обе в середине и обе закрываются push'ем:
  B:T-08 (snapshots) → A:T-14      A:T-20 (recommend) → B:T-21
Пока их нет — работа идёт против фикстур из T-02, простоя не возникает.

A: T-27 ─ T-24 ─ T-29 ─ T-30 ─ T-28 ─ T-32 ──▶ [КТ-3]
B: T-23 ─ T-25 ─ T-26 ─ T-31 ──▶ [КТ-3]

A: T-36 ──▶            B: T-33 ─ T-34 ─ T-35 ──▶   (P2, по остатку)
```

Пересечений владения нет ни в одной паре одновременно идущих задач. Каждый файл из `convex/` и `src/`
принадлежит ровно одной дорожке на всё время проекта — список владения смотреть в карточке задачи.

## 5. Карточки задач

### T-01 · общая (делает A) · Бутстрап проекта

```
Зачем в демо: без этого нет приложения. Первый зелёный build и первый запуск.
Владеет:    package.json, package-lock.json, vite.config.ts, tsconfig*.json,
            tailwind.config.*, postcss.config.*, index.html, .gitignore, README.md,
            .mcp.json, convex/** (сгенерированное), src/** (сгенерированное),
            AGENTS.md (управляемые секции)
Читает:     docs/STACK.md, .env.local
Не трогать: docs/DESIGN.md (дорожка B)
Скиллы/MCP: mcp__convex__status (первым делом), mcp__convex__envSet, mcp__convex__tables;
            context7 query-docs при расхождении с доками Convex
```

Готово, когда:
- [ ] `npm create convex@latest . -- -t react-vite-shadcn` выполнен, `npx convex ai-files install` поставил `convex/_generated/ai/guidelines.md`
- [ ] доустановлены зависимости на весь план одним коммитом: `react-router-dom`, `recharts`, `clsx`, `lucide-react` — **package.json после этого не трогается никем без sync-задачи**
- [ ] `npx convex env set XAI_API_KEY` / `FIRECRAWL_API_KEY` / `EXA_API_KEY` выполнены, `npx convex env list` показывает три ключа
- [ ] `.mcp.json` закоммичен с серверами без секретов: firecrawl (keyless), exa, convex (stdio),
      wonder, context7 — чтобы вторая машина получила их одним `git pull` (см. §10.4).
      Render-MCP в него **не** попадает: он несёт ключ в заголовке, только `--scope user`
- [ ] `longp.json` удалён, `.gitignore` содержит `.env.local`, `.env*.local`
- [ ] `.env.local.example` перечисляет все четыре переменные и ни одного значения
- [ ] `npm run build` проходит, `npx convex dev` поднимается без ошибок схемы
- [ ] в диффе нет ни одного значения ключа (проверить `git diff --cached | grep -iE 'xai-|fc-|sk-'`)

Проверка: `npm run build && npx convex dev --once`
Демо-чек:  локально открывается стартовая страница шаблона.
Откат:     `git revert <коммит>` — сносит проект целиком, состояние «только доки».

---

### T-02 · общая (делает A) · Замороженные контракты + стабы на фикстурах

```
Зачем в демо: обе дорожки перестают ждать друг друга. B пишет UI против живого
              api.* с первой минуты, A подменяет внутренности позже.
Владеет:    convex/schema.ts + файл-заглушку КАЖДОГО модуля из §4 обеих дорожек:
            workspace, signals, artifacts, runs, history, chat, usage, costs, mock, scan,
            onboarding, verify, act, seed, uiEvents, layout, detect, assess, recommend,
            firecrawl, snapshots, exa, prompts/reasoning, prompts/artifacts;
            src/lib/types.ts, src/lib/fixtures.ts, src/components/artifacts/ArtifactBody.tsx
Читает:     PLAN.md §3, docs/STACK.md (раздел Convex)
Не трогать: src/components/**, src/screens/**, docs/DESIGN.md
Скиллы/MCP: mcp__convex__functionSpec (сверить, что все функции видны),
            mcp__convex__runOneoffQuery, mcp__convex__tables;
            context7 query-docs "convex validators v.record v.union"
```

Готово, когда:
- [ ] `convex/schema.ts` ровно как в §3.1, `npx convex dev` создал все индексы без ошибок
- [ ] каждая функция из §3.2 существует, имеет `args` **и** `returns`-валидатор и возвращает фикстуру
- [ ] `api.seed.ensure`, `api.scan.run`, `api.act.generate` — стабы: пишут запись в `runs` и возвращают id, ничего внешнего не дёргают
- [ ] `src/lib/types.ts` и `src/lib/fixtures.ts` покрывают весь §3.3–3.4; `fixtures.ts` не импортирует ничего из `convex/`
- [ ] нигде нет `ctx.db.get(id)` в односоставной форме; нигде нет `Date.now()` внутри `query`
- [ ] у **каждого** модуля из §4 есть файл-заглушка с нужными экспортами — ни один импорт между
      дорожками не ждёт своего автора (`internal.costs.log` из дорожки B вызывается дорожкой A
      с первого коммита и до T-25 просто ничего не пишет)
- [ ] `src/components/artifacts/ArtifactBody.tsx` — заглушка, рендерит «Artifact preview»;
      дорожка A регистрирует на неё блок `ActionPreview`, дорожка B наполняет её в T-19
- [ ] `mcp__convex__functionSpec` показывает 11 queries + 8 actions
- [ ] `npm run build` проходит

Проверка: `npx convex run signals:list '{"workspaceId":"<id>"}'` возвращает фикстурный сигнал
Демо-чек:  ничего визуально; бэкенд отвечает фикстурами на все запросы фронта.
Откат:     `git revert <коммит>` — ломает всё, что после. Ревертить только вместе с последующими.

---

### T-03 · Дорожка B · Wonder: общий файл, токены, артборды экранов

```
Зачем в демо: задаёт визуальный язык до первой строки вёрстки. Демо судят глазами
              в первые 10 секунд.
Владеет:    docs/DESIGN.md
Читает:     PLAN.md §1 (демо-сценарий), docs/STACK.md (раздел Wonder)
Не трогать: ничего в src/**, convex/** — задача идёт параллельно бутстрапу
Скиллы/MCP: ОБЯЗАТЕЛЬНО — mcp__wonder__get_design_context (первым вызовом, без pageId),
            mcp__wonder__get_design_guidelines, mcp__wonder__create_artboard,
            mcp__wonder__update_elements, mcp__wonder__take_screenshot,
            mcp__wonder__get_element_code (забрать React+Tailwind);
            скиллы: ui-ux-pro-max (выбор палитры и типографики),
            frontend-design (аутентичная визуальная линия, не шаблон),
            design-system (токены)
```

Готово, когда:
- [ ] **один общий файл-канвас Wonder на команду**, подключён к GitHub-репо (header файла → GitHub →
      Wonder GitHub App → этот репозиторий); ссылка на файл — первой строкой `docs/DESIGN.md`
- [ ] артборды: `Shell` (три панели, шапка, пустые слоты под блоки), `Artifact`, `Landing`, `Sources`.
      Артборд `Pulse` — только каркас: блоки внутри него рисует дорожка A в T-37
- [ ] на `Shell` видно всё из §1 строки 0:00–0:10 как слоты: фид, центр, правая панель, одна кнопка Run Scan
- [ ] `docs/DESIGN.md` содержит: ссылки на артборды, значения токенов (цвета, шрифты, радиусы, spacing), шкалу severity (low/medium/high/critical), правила скелетонов
- [ ] в `docs/DESIGN.md` явно записаны три состояния для каждого экрана: loading / empty / error — как они выглядят
- [ ] цвет severity читается и в тёмном фоне, контраст текста ≥ 4.5:1
- [ ] артборд `Landing` — самый проработанный: это финальный кадр демо и главный экран дорожки B

Проверка: скриншоты артбордов приложены ссылками в `docs/DESIGN.md`
Демо-чек:  ничего в приложении; дальше вся вёрстка идёт по этому документу.
Откат:     `git revert <коммит>` — ломает только документ, код не затронут.

---

### T-37 · Дорожка A · Wonder: артборды блоков Pulse и чата

```
Зачем в демо: главный кадр демо (0:35) собран из блоков — их вид решает, читается ли
              «$49 → $39, Threat High» с трёх метров. Динамический UI — зона A, значит
              и его дизайн — зона A.
Владеет:    docs/DESIGN-BLOCKS.md
Читает:     docs/DESIGN.md (токены и Shell — не переопределять), PLAN.md §1, §3.3
Не трогать: docs/DESIGN.md, артборды дорожки B на канвасе (Shell, Artifact, Landing, Sources)
Скиллы/MCP: mcp__wonder__get_design_context (первым вызовом, без pageId — увидеть
            токены и артборды B), mcp__wonder__create_artboard (свои артборды: по одному
            на блок), mcp__wonder__update_elements, mcp__wonder__take_screenshot,
            mcp__wonder__get_element_code; скиллы: ui-ux-pro-max (стиль и палитра
            severity), frontend-design, design-system
```

Готово, когда:
- [ ] на **том же** файле-канвасе, что и у B, появились артборды: `Block/SignalCard`, `Block/DiffView`,
      `Block/EvidenceCard`, `Block/MetricCards`, `Block/RecommendationCards`, `Panel/Chat`
- [ ] токены взяты из `docs/DESIGN.md` через `get_design_context`, ни один цвет не придуман заново
- [ ] у каждого блока нарисованы четыре состояния: loading / empty / error / ready
- [ ] Fact / Evidence / AI analysis визуально различимы без чтения подписей (ТЗ §33)
- [ ] `docs/DESIGN-BLOCKS.md`: ссылки на артборды, правила severity-цвета, размеры DiffView
      «Before → After» (это самый крупный текст на экране)

Проверка: скриншоты артбордов в `docs/DESIGN-BLOCKS.md`; `get_element_code` отдаёт React+Tailwind
Демо-чек:  ничего в приложении; T-09/T-11/T-13 верстаются по этим артбордам.
Откат:     `git revert <коммит>` — ломает только документ.

---

### T-04 · Дорожка B · Деплой на Render

```
Зачем в демо: судья должен открыть публичную ссылку и увидеть работающий продукт.
              Делается рано, чтобы каждый следующий коммит уезжал автоматически.
Владеет:    render.yaml, docs/DEPLOY.md, .env.local.example
Читает:     package.json, docs/STACK.md (раздел Render)
Не трогать: src/**, convex/** (кроме чтения)
Скиллы/MCP: mcp__render__select_workspace (первым), mcp__render__create_static_site,
            mcp__render__update_environment_variables, mcp__render__trigger_deploy,
            mcp__render__list_logs, mcp__render__get_deploy
```

Готово, когда:
- [ ] `render.yaml` описывает **static site** (не web service): `buildCommand: npx convex deploy --cmd 'npm run build'`, `staticPublishPath: ./dist`, SPA-rewrite `/* → /index.html`, `autoDeployTrigger: commit`
- [ ] в Render выставлен `CONVEX_DEPLOY_KEY` (право `deployment:deploy`), `sync: false` в yaml
- [ ] публичный `*.onrender.com` открывается и показывает приложение; `VITE_CONVEX_URL` проставлен автоматически, руками нигде не прописан
- [ ] `docs/DEPLOY.md`: URL демо, как перевыпустить ключ, как посмотреть логи, что регион иммутабелен
- [ ] ни одного секрета в `render.yaml`

Проверка: `curl -sI https://<app>.onrender.com | head -1` → `HTTP/2 200`, затем открыть в браузере
Демо-чек:  публичная ссылка живая, не спит (static site не засыпает).
Откат:     `git revert <коммит>` + удалить сервис в Render — ломает только деплой, локальная разработка цела.

---

### T-05 · Дорожка B · App shell: layout, роуты, токены, примитивы состояний

```
Зачем в демо: каркас всех трёх экранов. После задачи приложение уже показывает
              предзаполненный Pulse на фикстурах.
Владеет:    src/App.tsx, src/main.tsx, src/index.css, tailwind.config.*, index.html,
            src/components/shell/**, src/components/state/**
Читает:     docs/DESIGN.md, src/lib/types.ts, src/lib/fixtures.ts, convex/_generated/api.d.ts
Не трогать: convex/**, src/lib/** (заморожено в T-02), src/components/blocks/**,
            src/screens/PulseScreen.tsx, src/components/ActionPanel.tsx (зона дорожки A)
Скиллы/MCP: mcp__wonder__get_element_code (забрать код shell из артборда Pulse),
            mcp__wonder__take_screenshot (сверить результат с макетом);
            скиллы: ui-styling, frontend-design,
            frontend-a11y; в конце /react-review по своему диффу
```

Готово, когда:
- [ ] три роута: `/` (Pulse), `/artifact/:artifactId` (Artifact), `/sources` (Sources). Никакого бокового меню — переход по ссылке в шапке
- [ ] трёхпанельный layout Pulse: слева Signals Feed, центр Intelligence Workspace, справа AI/Action Panel
- [ ] `src/components/state/` содержит `Skeleton`, `EmptyState`, `ErrorState` — используются всеми последующими задачами B
- [ ] `ConvexProvider` подключён, `api.workspace.demo` реально вызывается и рисует шапку с названием компании
- [ ] экран при первом открытии **не пустой**: видны компания, конкурент и фид (пока из стабов)
- [ ] токены из `docs/DESIGN.md` перенесены в `tailwind.config`
- [ ] `npm run build` проходит

Проверка: `npm run dev` → `/`, `/sources`, `/artifact/x` открываются без белого экрана
Демо-чек:  три экрана, предзаполненный Pulse, одна заметная кнопка Run Scan (пока неактивная).
Откат:     `git revert <коммит>` — ломает только фронт, бэкенд отвечает как раньше.

---

### T-06 · Дорожка B · Мок-сайт конкурента + переключатель

```
Зачем в демо: шаг 0:10 — «конкурент поправил прайсинг». Даёт настоящий публичный
              URL, который Firecrawl честно скрейпит, и управляемое изменение цены.
Владеет:    convex/http.ts, convex/mock.ts, convex/mockHtml.ts
Читает:     convex/schema.ts
Не трогать: src/**
Скиллы/MCP: mcp__firecrawl__firecrawl_scrape (проверить, что страница скрейпится),
            mcp__convex__run (дёрнуть mock:flip), mcp__convex__data (посмотреть mockSite)
```

Готово, когда:
- [ ] `GET https://<deployment>.convex.site/mock/acmeflow/pricing` отдаёт валидный HTML с тремя тарифами
- [ ] вариант `v1`: Starter $19, **Pro $49**, Business $99. Вариант `v2`: Starter $19, **Pro $39** + строка «Free migration from any helpdesk», Business $99
- [ ] цена берётся из таблицы `mockSite` по slug, а не из константы в HTML
- [ ] путь и URL страницы нигде не хардкодятся в виде полного адреса: базой служит
      `process.env.CONVEX_SITE_URL` — у каждого разработчика свой деплоймент, и на prod он третий
- [ ] `api.mock.flip({variant})` меняет вариант, `api.mock.state({})` его возвращает
- [ ] страница статична (без JS) — Firecrawl берёт её с первого запроса
- [ ] HTML честно помечен `<!-- demo fixture site for Market Pulse -->` и заголовком на странице: это не выдаётся за чужой продукт
- [ ] `mcp__firecrawl__firecrawl_scrape` на этом URL возвращает markdown с «$49» в v1 и «$39» в v2

Проверка: `npx convex run mock:flip '{"variant":"v2"}'` затем `curl -s <url> | grep 39`
Демо-чек:  ничего в приложении; появился управляемый источник данных.
Откат:     `git revert <коммит>` — ломает Run Scan (нет источника), остальное цело.

---

### T-07 · Дорожка A · SignalsFeed

```
Зачем в демо: шаги 0:00 и 0:35 — непустой фид и realtime-появление нового сигнала.
Владеет:    src/components/SignalsFeed.tsx, src/components/SignalRow.tsx
Читает:     src/lib/types.ts, src/lib/fixtures.ts, convex/_generated/api.d.ts, docs/DESIGN.md
Не трогать: convex/** кроме чтения, src/components/shell/**, src/components/state/**,
            src/screens/ArtifactScreen.tsx, src/screens/SourcesScreen.tsx (зона дорожки B)
Скиллы/MCP: mcp__wonder__get_element_code (фид из артборда Pulse);
            скиллы: ui-styling, frontend-a11y
```

Готово, когда:
- [ ] `useQuery(api.signals.list, { workspaceId })`; выбранный сигнал — локальный state, не роут
- [ ] группировка: `New` / `High threat` / `Opportunities` / `Resolved`; severity видна цветом и словом (не только цветом)
- [ ] есть **loading** (3 скелетон-строки), **empty** («No signals yet — run a scan»), **error** (текст + кнопка Retry)
- [ ] новый элемент в списке подсвечивается 2 секунды — видно, что он приехал сам
- [ ] клавиатурная навигация: строки фокусируемы, Enter выбирает
- [ ] `npm run build` проходит

Проверка: `npm run dev` → `/`; затем `npx convex run seed:ensure '{}'` в другом терминале — строка появляется без перезагрузки
Демо-чек:  слева живой фид, сигнал подсвечивается при появлении.
Откат:     `git revert <коммит>` — левая колонка пустеет, центр и правая панель работают.

---

### T-08 · Дорожка B · Firecrawl → snapshots

```
Зачем в демо: слой Monitor. Шаг 0:15 — «Firecrawl: fetching pricing page».
Владеет:    convex/firecrawl.ts, convex/snapshots.ts
Читает:     convex/schema.ts, docs/STACK.md (раздел Firecrawl)
Не трогать: src/**
Скиллы/MCP: mcp__firecrawl__firecrawl_scrape (отладить формат до кода),
            mcp__convex__logs (смотреть ошибки action), mcp__convex__data (снапшоты);
            context7 query-docs при расхождении с v2 API
```

Готово, когда:
- [ ] `internalAction` дёргает `POST https://api.firecrawl.dev/v2/scrape` с `formats:["markdown"]`, `onlyMainContent:true`, `maxAge: 86400000`, `timeout: 60000`
- [ ] `json`-формат Firecrawl **не используется** (+4 кредита/стр) — план и цены парсит наш Grok из markdown
- [ ] markdown усечён до 20 000 символов перед записью (документ Convex 1 MiB, и long-context Grok дороже вдвое после 200k токенов)
- [ ] `hash` нормализованного markdown: если совпал с предыдущим — снапшот не дублируется, возвращается прежний id
- [ ] ошибки разложены по кейсам: `402` (кредиты кончились), `403/404` (`metadata.statusCode`), таймаут, пустой markdown — каждый пишет понятный `detail` в шаг `runs`, а не бросает исключение наружу
- [ ] `crawl` нигде не вызывается без `limit`
- [ ] в `apiUsage` пишется 1 кредит на страницу (даже на 403 — Firecrawl списывает)

Проверка: `npx convex run firecrawl:scrapeSource '{"sourceId":"<id>"}'` → в `mcp__convex__data` новый snapshot с планами
Демо-чек:  ничего визуально; в таблице snapshots появляется живой скрейп мок-сайта.
Откат:     `git revert <коммит>` — Run Scan перестаёт получать данные, seed-фикстуры остаются.

---

### T-09 · Дорожка A · Реестр блоков + SignalCard + MetricCards + ActionPreview

```
Зачем в демо: ТЗ §21/§41 — AI управляет интерфейсом, но только через реестр.
              Шаг 0:35: центр собирается из блоков.
Владеет:    src/components/blocks/registry.tsx, src/components/blocks/BlockRenderer.tsx,
            src/components/blocks/SignalCard.tsx, src/components/blocks/MetricCards.tsx,
            src/components/blocks/ActionPreview.tsx (тонкая обёртка над ArtifactBody дорожки B)
Читает:     src/lib/types.ts, src/lib/fixtures.ts, api.signals.layout, docs/DESIGN.md
Не трогать: convex/**, src/lib/**
Скиллы/MCP: mcp__wonder__get_element_code (карточки из артборда),
            mcp__wonder__take_screenshot (сверка);
            скиллы: design-system, frontend-design
```

Готово, когда:
- [ ] `registry` — `Record<BlockType, Component>`; `BlockRenderer` рендерит **только** известные типы, неизвестный тип даёт видимую заглушку `Unsupported block: X`, а не падение
- [ ] ни `dangerouslySetInnerHTML`, ни `eval`, ни динамического импорта по строке от LLM
- [ ] `BlockRenderer` читает `useQuery(api.signals.layout, { signalId })`; пустой массив → дефолтный набор `[SignalCard, DiffView, EvidenceCard, MetricCards]`
- [ ] `MetricCards` показывает Threat/severity, score 0–100, confidence %, urgency, дельту цены
- [ ] `ActionPreview` — обёртка на 10 строк: берёт `api.artifacts.get` и отдаёт всё внутрь
      `ArtifactBody` дорожки B. Разметку артефакта дорожка A не пишет никогда
- [ ] каждый блок сам рендерит loading / empty / error
- [ ] `npm run build` проходит

Проверка: `npm run dev` → выбрать сигнал в фиде → центр собран из блоков; подсунуть в `layout` тип `"Nonsense"` через `npx convex run` → видна заглушка, приложение живо
Демо-чек:  центр экрана — карточка сигнала и четыре метрики.
Откат:     `git revert <коммит>` — центр пустеет, фид и панель работают.

---

### T-10 · Дорожка B · Seed demo-воркспейса + baseline

```
Зачем в демо: шаг 0:00 — нулевой онбординг. Приложение открывается уже наполненным.
Владеет:    convex/seed.ts (передан из T-02), convex/seedData.ts, convex/workspace.ts
Читает:     convex/schema.ts, convex/firecrawl.ts, src/lib/fixtures.ts (как источник цифр)
Не трогать: src/**
Скиллы/MCP: mcp__convex__run (seed:ensure), mcp__convex__data (сверить записи),
            mcp__convex__tables
```

Готово, когда:
- [ ] `api.seed.ensure({})` идемпотентна: второй вызов не создаёт дублей (поиск воркспейса по `slug: "demo"` через `withIndex`)
- [ ] создаёт: workspace `demo`, company `Helpdesk AI` с готовым `context` (Pro $45, SMB + mid-market), competitor `AcmeFlow`, source `pricing` на URL мок-сайта
- [ ] URL источника собирается как `process.env.CONVEX_SITE_URL + "/mock/acmeflow/pricing"`.
      Хардкод полного адреса запрещён: он сломает и машину напарника, и prod
- [ ] ставит мок-сайт в `v1` и снимает **baseline-снапшот живым Firecrawl** (`isBaseline: true`) — baseline не создаёт сигнала
- [ ] создаёт один исторический сигнал `resolved` («AcmeFlow added Slack integration») с evidence — чтобы фид не был пустым
- [ ] вызывается автоматически при первом открытии приложения, если воркспейса нет (иначе no-op)
- [ ] если Firecrawl недоступен — baseline берётся из `seedData.ts` с `provider: "fixture"`, и это видно в EvidenceCard

Проверка: `npx convex run seed:ensure '{}'` дважды → в `mcp__convex__data` по одной записи каждой сущности
Демо-чек:  `/` открывается с компанией, конкурентом и одним историческим сигналом.
Откат:     `git revert <коммит>` — пустая база, экран уходит в empty state (но не ломается).

---

### T-11 · Дорожка A · DiffView + EvidenceCard

```
Зачем в демо: шаг 0:35 — главный кадр всего демо: $49 → $39 и доказательство рядом.
              ТЗ §33: Fact и Evidence не смешиваются.
Владеет:    src/components/blocks/DiffView.tsx, src/components/blocks/EvidenceCard.tsx
Читает:     src/lib/types.ts, src/lib/fixtures.ts, api.signals.get, docs/DESIGN.md
Не трогать: convex/**, src/screens/**
            (registry.tsx правит та же дорожка B последовательно — регистрация нового
             блока это одна строка, конфликта между машинами не возникает)
Скиллы/MCP: mcp__wonder__get_element_code (DiffView из артборда),
            mcp__wonder__take_screenshot; скиллы: ui-styling, frontend-a11y
```

Готово, когда:
- [ ] `DiffView` показывает **Before → After** крупно: `Pro $49/mo` → `Pro $39/mo`, дельта `−20%`, направление читается без цвета (стрелка + знак)
- [ ] под ним — построчный diff фрагмента прайсинга (добавлено/удалено), не весь markdown
- [ ] `EvidenceCard`: источник, **кликабельный URL**, timestamp обнаружения, фрагмент, confidence, бейдж провайдера (`Firecrawl` / `Exa` / `fixture`)
- [ ] визуально разделены три зоны: **Fact** (что нашли) / **Evidence** (откуда) / место под **AI analysis** (заполняет T-13)
- [ ] есть loading / empty / error; при `provider: "fixture"` стоит честная плашка `cached snapshot`
- [ ] `npm run build` проходит

Проверка: `npm run dev` → выбрать price_change-сигнал → виден $49 → $39 и рабочая ссылка на мок-сайт
Демо-чек:  ключевой кадр демо готов.
Откат:     `git revert <коммит>` — из центра исчезают diff и evidence, метрики остаются.

---

### T-12 · Дорожка A · Grok-клиент + Company Context

```
Зачем в демо: мозг продукта. Без Company Context assessment в шаге 0:55 невозможен.
Владеет:    convex/grok.ts, convex/prompts/reasoning.ts, convex/onboarding.ts (передан из T-02)
Читает:     convex/schema.ts, docs/STACK.md (раздел x.ai)
Не трогать: src/**
Скиллы/MCP: mcp__convex__logs (ответы Grok), mcp__convex__envGet (проверить ключ),
            mcp__convex__run; context7 при расхождении с докой x.ai
```

Готово, когда:
- [ ] один клиент `callGrok({ model, input, schema? })` на `POST https://api.x.ai/v1/responses` — **не** chat/completions
- [ ] текст достаётся из `output[]` по `type === "message"` (`content[0].text`), а не из `choices[0]`
- [ ] модель по умолчанию `grok-4.3` (1 M контекст, $1.25/$2.50); для генерации артефактов — `grok-4.6`
- [ ] в контекст никогда не уходит сырой скрейп целиком: markdown усечён, чтобы не перейти `long_context_threshold` 200 000 токенов (после него цена удваивается)
- [ ] JSON-ответ валидируется; на невалидном JSON — один повтор, потом понятная ошибка в `runs`, не исключение
- [ ] `api.onboarding.analyze` работает end-to-end: Firecrawl по URL компании → Grok → `companies.context` + `contextStatus: "ready"`
- [ ] `usage.cost_in_usd_ticks` каждого вызова передан в лог расхода (таблица заполнится в T-25, интерфейс уже вызывается)
- [ ] ключ не логируется нигде

Проверка: `npx convex run onboarding:analyze '{"companyUrl":"https://...","competitorUrls":[]}'` → в `mcp__convex__data` заполненный `context`
Демо-чек:  на `/sources` появляется распознанный тип бизнеса и тарифы компании.
Откат:     `git revert <коммит>` — Detect/Assess/Recommend теряют мозг, seed-контекст остаётся.

---

### T-13 · Дорожка A · Правая панель: Assessment + RecommendationCards

```
Зачем в демо: шаг 0:55–1:10 — «почему это важно» и три варианта реакции.
Владеет:    src/components/ActionPanel.tsx, src/components/blocks/RecommendationCards.tsx
Читает:     src/lib/types.ts, src/lib/fixtures.ts, api.signals.get, docs/DESIGN.md
Не трогать: convex/** кроме чтения, src/screens/ArtifactScreen.tsx,
            src/screens/SourcesScreen.tsx, src/components/artifacts/** (зона дорожки B)
Скиллы/MCP: mcp__wonder__get_element_code (правая панель артборда Pulse);
            скиллы: ui-styling, frontend-design, frontend-a11y
```

Готово, когда:
- [ ] блок **AI analysis** визуально отделён от Fact/Evidence и подписан как вывод модели, а не факт (ТЗ §33)
- [ ] показаны: why, что изменилось в позиции, затронутые сегменты, скорость реакции, объяснение score
- [ ] три `RecommendationCards` с title, action, rationale, expected impact, effort, risk, priority и кнопкой **Generate**
- [ ] кнопка Generate вызывает `api.act.generate` и ведёт на `/artifact/:id`; пока `status: pending` — скелетон, а не спиннер в пустоте
- [ ] состояния: сигнал без assessment → «Assessing…» со скелетоном; `status: "low_confidence"` → честная плашка; `error` → текст + Retry
- [ ] `npm run build` проходит

Проверка: `npm run dev` → выбрать сигнал → три карточки, клик по Generate уводит на экран артефакта
Демо-чек:  правая панель с объяснением и тремя кнопками.
Откат:     `git revert <коммит>` — пропадает правая панель, центр цел.

---

### T-14 · Дорожка A · Detect: diff + Grok-фильтр шума

```
Зачем в демо: шаг 0:15–0:35. Ядро продукта: изменение становится Signal только
              если у него есть бизнес-смысл.
Владеет:    convex/detect.ts, convex/diff.ts, convex/signals.ts (передан из T-02)
Читает:     convex/snapshots.ts, convex/grok.ts, convex/prompts/reasoning.ts, convex/schema.ts
Не трогать: src/**
Скиллы/MCP: mcp__convex__run (detect:compare), mcp__convex__logs, mcp__convex__data;
            скилл silent-failure-hunter по своему диффу (проглоченные ошибки — главный риск слоя)
```

Готово, когда:
- [ ] структурный diff сначала: планы и цены из двух снапшотов сравниваются как данные, не как текст
- [ ] Grok вызывается **только** на остатке (текстовые изменения), с прямым требованием отбросить HTML, меню, timestamp, счётчики, случайные тексты
- [ ] baseline-снапшот сигнала не создаёт (ТЗ §10)
- [ ] `$49 → $39` даёт `type: "price_change"`, `previousState: "Pro $49/mo"`, `currentState: "Pro $39/mo"`, `status: "detected"`
- [ ] косметическое изменение (пробел, порядок пунктов меню) сигнала **не** создаёт — проверено вторым прогоном без flip
- [ ] evidence пишется сразу: `previous_snapshot`, `current_snapshot`, `diff` — со ссылками и фрагментами
- [ ] одинаковый сигнал не дублируется при повторном скане (дедуп по competitorId + type + currentState)

Проверка: `mock:flip v2` → `detect:compare` → создан 1 сигнал; повторный `detect:compare` → 0 новых
Демо-чек:  после Run Scan в фиде появляется настоящий price_change.
Откат:     `git revert <коммит>` — Run Scan доходит до снапшота и останавливается, старые сигналы целы.

---

### T-15 · Дорожка A · Экран Pulse: Run Scan, прогресс, realtime

```
Зачем в демо: шаги 0:10–0:45. Единственное действие пользователя на экране Pulse.
Владеет:    src/components/RunScanButton.tsx, src/components/ScanProgress.tsx,
            src/screens/PulseScreen.tsx
Читает:     api.runs.latest, api.scan.run, src/lib/fixtures.ts, docs/DESIGN.md
Не трогать: convex/** кроме чтения, src/components/shell/**,
            src/screens/ArtifactScreen.tsx, src/screens/SourcesScreen.tsx (зона дорожки B)
Скиллы/MCP: mcp__wonder__take_screenshot (сверить прогресс с макетом);
            скиллы: ui-styling, frontend-a11y
```

Готово, когда:
- [ ] одна заметная кнопка **Run Scan** на Pulse; во время скана она disabled с текстом `Scanning…`
- [ ] прогресс — пошаговый список из `api.runs.latest().steps`, каждый шаг со своим статусом; **не** одиночный спиннер
- [ ] новый сигнал из фида выбирается автоматически по завершении скана — пользователю не надо искать его глазами
- [ ] `status: "error"` рисует, **на каком шаге** упало, и предлагает Retry
- [ ] если скан идёт дольше 45 секунд — подсказка «still working», без зависшего интерфейса
- [ ] `npm run build` проходит

Проверка: `npm run dev` → Run Scan → шаги зажигаются по одному, в конце выбран новый сигнал
Демо-чек:  главный клик демо работает от начала до конца.
Откат:     `git revert <коммит>` — скан можно запустить только через `npx convex run`, экран остаётся рабочим.

---

### T-16 · Дорожка B · Оркестратор scan.run + runs

```
Зачем в демо: связывает Firecrawl → diff → Grok → signal и отдаёт фронту прогресс.
Владеет:    convex/scan.ts (передан из T-02), convex/runs.ts (передан из T-02)
Читает:     convex/firecrawl.ts, convex/detect.ts, convex/assess.ts (когда появится)
Не трогать: src/**
Скиллы/MCP: mcp__convex__run, mcp__convex__logs, mcp__convex__insights (OCC-конфликты)
```

Готово, когда:
- [ ] `api.scan.run({competitorId})` создаёт `runs`-запись с 4 шагами и сразу возвращает `runId` — фронт не ждёт завершения
- [ ] шаги обновляются по ходу: `firecrawl` → `diff` → `grok_filter` → `signal`; каждый переход — отдельная мутация
- [ ] число `runQuery`/`runMutation` минимизировано: шаг = один вызов, без дробления (каждый вызов — отдельная транзакция и потенциальная гонка)
- [ ] любая ошибка внутри пишется в шаг и в `runs.error`, статус `error`; исключение наружу не летит
- [ ] после создания сигнала — `ctx.scheduler.runAfter(0, internal.assess...)`: assessment не блокирует ответ
- [ ] два одновременных скана одного конкурента не создают двух сигналов (проверка активного run)

Проверка: `npx convex run scan:run '{"competitorId":"<id>"}'` → `runs.latest` показывает 4 шага `done`
Демо-чек:  кнопка Run Scan даёт видимый пошаговый прогресс.
Откат:     `git revert <коммит>` — кнопка перестаёт работать, `detect` можно дёрнуть вручную.

---

### T-17 · Дорожка B · Экран Artifact: Battlecard + Offer

```
Зачем в демо: шаг 1:10 — готовый результат внутри Market Pulse, без выхода в другой сервис.
Владеет:    src/screens/ArtifactScreen.tsx, src/components/artifacts/Battlecard.tsx,
            src/components/artifacts/OfferCard.tsx
Читает:     api.artifacts.get, src/lib/fixtures.ts, docs/DESIGN.md
Не трогать: convex/**, src/screens/PulseScreen.tsx (владелец T-15)
Скиллы/MCP: mcp__wonder__get_element_code (артборд Artifact),
            mcp__wonder__take_screenshot; скиллы: ui-ux-pro-max, frontend-design
```

Готово, когда:
- [ ] экран `/artifact/:artifactId` рендерит по `payload.type`; `empty` → скелетон
- [ ] `Battlecard` показывает все поля ТЗ §17: competitor change, threat, их сильные и слабые стороны, наши сильные, positioning, objections → responses, talking points
- [ ] `OfferCard`: headline, proposition, value, conditions, differentiators, CTA
- [ ] вверху — обратная трассировка: `Signal → Recommendation → Artifact` со ссылкой назад на сигнал (ТЗ §42)
- [ ] кнопка **Copy** копирует артефакт как markdown
- [ ] состояния: pending → скелетон по структуре документа; error → текст + Retry; несуществующий id → понятный empty, не белый экран
- [ ] `npm run build` проходит

Проверка: `npm run dev` → `/artifact/<id из фикстур>` → документ читается целиком
Демо-чек:  экран артефакта готов для battlecard и offer.
Откат:     `git revert <коммит>` — Generate ведёт в пустоту, Pulse цел.

---

### T-18 · Дорожка A · Assess: threat scoring + объяснение

```
Зачем в демо: шаг 0:55. «Высокая угроза: на 13% дешевле вашего Pro, тот же SMB-сегмент.»
Владеет:    convex/assess.ts
Читает:     convex/grok.ts, convex/prompts/reasoning.ts, convex/detect.ts, convex/schema.ts
Не трогать: src/**
Скиллы/MCP: mcp__convex__run, mcp__convex__logs, mcp__convex__data
```

Готово, когда:
- [ ] в промпт уходит полный контекст ТЗ §40: company context + competitor + previous state + current state + evidence + предыдущие релевантные сигналы
- [ ] Grok возвращает `kind` (threat/opportunity/neutral), `severity`, `score` 0–100, `confidence` 0–1, `urgency` и `assessment` из §3.1
- [ ] `scoreExplanation` обязателен — score без объяснения считается невалидным ответом и уходит на повтор
- [ ] `confidence < 0.5` → `status: "low_confidence"`, интерфейс это показывает, а не прячет
- [ ] сравнение идёт с **нашими** цифрами из company context (Pro $45), а не абстрактно
- [ ] статус сигнала переходит `detected|verified → assessed`
- [ ] стоимость вызова передана в лог расхода

Проверка: `npx convex run assess:run '{"signalId":"<id>"}'` → в данных `severity: "high"`, score 70–90, непустой `why`
Демо-чек:  правая панель заполняется объяснением и метриками.
Откат:     `git revert <коммит>` — сигнал остаётся `detected`, панель показывает «Assessing…».

---

### T-19 · Дорожка B · Landing page preview + ArtifactBody

```
Зачем в демо: шаг 1:10–1:25, финальный кадр. Landing page отображается внутри продукта.
Владеет:    src/components/artifacts/LandingPreview.tsx,
            src/components/artifacts/ArtifactBody.tsx (передан из T-02)
Читает:     api.artifacts.get, src/lib/fixtures.ts, docs/DESIGN.md
Не трогать: convex/**
Скиллы/MCP: mcp__wonder__get_element_code + mcp__wonder__create_artboard
            (отдельный артборд под landing — это самый «продающий» экран демо),
            mcp__wonder__take_screenshot; скиллы: ui-ux-pro-max,
            frontend-design, brand
```

Готово, когда:
- [ ] landing собирается **из полей JSON**, никакого HTML от модели: headline, subheadline, offer, benefits, differentiation, comparison-таблица, social proof placeholders, CTA, sections
- [ ] comparison-таблица `Us vs AcmeFlow` читается с 3 метров — это кадр, который увидит жюри
- [ ] `ArtifactBody` — единственная точка рендера артефакта: её же переиспользует блок
      `ActionPreview` дорожки A в центре Pulse (`compact`-пропс для уменьшенного вида)
- [ ] место под hero-картинку зарезервировано: `heroImageUrl === null` → аккуратный градиент-плейсхолдер, не дыра (T-33/T-34 его заполнят)
- [ ] состояния: pending → скелетон секций; error → текст + Retry
- [ ] на мобильной ширине не разваливается (одна колонка), горизонтального скролла нет
- [ ] `npm run build` проходит

Проверка: `npm run dev` → сгенерировать landing → страница читается целиком без скролла в бок
Демо-чек:  финальный кадр демо готов.
Откат:     `git revert <коммит>` — landing не рисуется, battlecard и offer работают.

---

### T-20 · Дорожка A · Recommend: три контрмеры

```
Зачем в демо: шаг 1:00–1:10. Три варианта реакции — то, чем продукт отличается от мониторинга.
Владеет:    convex/recommend.ts
Читает:     convex/grok.ts, convex/prompts/reasoning.ts, convex/assess.ts
Не трогать: src/**
Скиллы/MCP: mcp__convex__run, mcp__convex__logs
```

Готово, когда:
- [ ] ровно три рекомендации, каждая с id `rec_1..rec_3`, всеми полями `vRecommendation` и `artifactType`
- [ ] в промпте прямой запрет на общие формулировки: «Улучшить маркетинг» — невалидный ответ; каждая рекомендация называет конкретное действие с цифрой или условием
- [ ] `priority` 1..3 без дублей; варианты различны по стратегии (держать цену / migration offer / конкурентная landing)
- [ ] статус сигнала → `recommendations_ready`
- [ ] `artifactType` третьей рекомендации — `landing` (это путь демо)
- [ ] стоимость вызова передана в лог расхода

Проверка: `npx convex run recommend:run '{"signalId":"<id>"}'` → три рекомендации, ни одной без rationale
Демо-чек:  три кнопки в правой панели.
Откат:     `git revert <коммит>` — панель остаётся на assessment, Generate недоступен.

---

### T-21 · Дорожка B · Act: правила генерации + создание артефакта

```
Зачем в демо: шаг 1:10. Последний шаг цепочки Monitor→…→Act.
Владеет:    convex/act.ts (передан из T-02), convex/prompts/artifacts.ts,
            convex/artifacts.ts (передан из T-02)
Читает:     convex/grok.ts, convex/recommend.ts, convex/schema.ts (всё — дорожка A, только чтение)
Не трогать: src/**
Скиллы/MCP: mcp__convex__run, mcp__convex__logs, mcp__convex__data
```

Готово, когда:
- [ ] `api.act.generate({signalId, recommendationId})` создаёт `artifacts` со `status: "pending"` и **сразу** возвращает `artifactId` — фронт уходит на экран артефакта и ждёт там со скелетоном
- [ ] генерация идёт через `scheduler`, результат дописывается мутацией → `status: "ready"`
- [ ] тип артефакта берётся из `artifactType` выбранной рекомендации; поддержаны все три схемы §3.1
- [ ] сохраняется связь `signalId` + `recommendationId`; `signals.selectedRecommendationId` заполняется, статус → `artifact_generated`
- [ ] **правила генерации живут в `convex/prompts/artifacts.ts`** и только там: по одному промпту
      на тип артефакта, с явным перечнем обязательных полей и запретом общих формулировок
      («growth», «synergy», «innovative solution» — невалидный ответ)
- [ ] промпт получает контекст §40 ТЗ: company context, сигнал, evidence, выбранную рекомендацию —
      landing page должна спорить с конкретной ценой конкурента, а не быть шаблоном
- [ ] модель `grok-4.6`; JSON валидируется по схеме, невалидный → один повтор → `status: "error"` с текстом
- [ ] повторный вызов на той же рекомендации перегенерирует существующий артефакт, а не плодит копии
- [ ] стоимость вызова передана в лог расхода

Проверка: `npx convex run act:generate '{"signalId":"<id>","recommendationId":"rec_3"}'` → артефакт `ready` с непустой comparison-таблицей
Демо-чек:  клик Generate приводит к готовой landing page за 10–20 секунд.
Откат:     `git revert <коммит>` — Generate создаёт pending-артефакт и не заполняет его.

---

### T-22 · Дорожка B · Экран Sources: онбординг + демо-тумблер

```
Зачем в демо: закрывает MVP-пункты 1–3 ТЗ и даёт управление шагом 0:10.
Владеет:    src/screens/SourcesScreen.tsx, src/components/SourceRow.tsx,
            src/components/DemoToggle.tsx
Читает:     api.workspace.demo, api.onboarding.analyze, api.mock.flip, api.mock.state
Не трогать: convex/detect.ts, convex/assess.ts, convex/recommend.ts, convex/grok.ts,
            src/screens/PulseScreen.tsx, src/components/blocks/** (зона дорожки A)
Скиллы/MCP: mcp__wonder__get_element_code (артборд Sources); скиллы: ui-styling, frontend-a11y
```

Готово, когда:
- [ ] два поля **предзаполнены** (URL нашей компании и URL конкурента) и одна кнопка `Analyze & set baseline` — ни одного обязательного к заполнению поля
- [ ] один экран, без шагов и визарда; результат анализа (распознанный тип бизнеса, сегменты, тарифы) показывается тут же
- [ ] список источников конкурента с типом, датой последнего скрейпа и HTTP-статусом
- [ ] `DemoToggle` — честно подписанный `Simulate competitor edit (demo fixture)`, переключает v1/v2 через `api.mock.flip`, показывает текущий вариант
- [ ] состояния: анализ идёт → пошаговый прогресс из `runs`; ошибка Firecrawl → понятный текст, а не пустой экран
- [ ] `npm run build` проходит

Проверка: `npm run dev` → `/sources` → Analyze проходит; тумблер меняет вариант, `curl` мок-сайта подтверждает
Демо-чек:  экран, с которого ведущий переключает цену конкурента перед Run Scan.
Откат:     `git revert <коммит>` — переключать вариант придётся через `npx convex run mock:flip`.

---

### T-23 · Дорожка B · Exa verify

```
Зачем в демо: шаг 0:45 — «мы не верим одной странице». Второй спонсорский API в кадре.
Владеет:    convex/exa.ts, convex/verify.ts (передан из T-02)
Читает:     convex/grok.ts, convex/schema.ts, docs/STACK.md (раздел Exa)
Не трогать: src/**
Скиллы/MCP: mcp__exa__* (отладить запрос до кода), скилл exa-search;
            mcp__convex__logs, mcp__convex__data
```

Готово, когда:
- [ ] `POST https://api.exa.ai/search`, `type: "auto"`, `numResults: 8`, `contents: { highlights: true }` — контент первых 10 включён в цену поиска, отдельный `/contents` не вызываем
- [ ] запрос строится Grok'ом из сигнала (название конкурента + суть изменения), а не шаблоном с подстановкой
- [ ] каждый результат пишется в `evidence` как `exa_source` с url, title, фрагментом-highlight и confidence
- [ ] пустой результат — законный исход: статус сигнала не ломается, в UI видно `no external confirmation found`
- [ ] confidence сигнала пересчитывается: есть внешнее подтверждение → выше, конфликтующее → ниже с пометкой
- [ ] статус `verifying → verified`; `api.verify.again` идемпотентна, дубли evidence не плодятся
- [ ] стоимость ($0.007 за поиск) передана в лог расхода

Проверка: `npx convex run verify:again '{"signalId":"<id>"}'` → 1–3 новых evidence с рабочими ссылками
Демо-чек:  кнопка Verify наполняет SourceList внешними ссылками.
Откат:     `git revert <коммит>` — остаётся внутреннее доказательство из снапшотов.

---

### T-24 · Дорожка A · SourceList + кнопка Verify

```
Зачем в демо: шаг 0:45. Показывает, что подтверждение внешнее, а не самоподтверждение.
Владеет:    src/components/blocks/SourceList.tsx
Читает:     api.signals.get, api.verify.again, docs/DESIGN.md
Не трогать: convex/**
Скиллы/MCP: mcp__wonder__take_screenshot; скиллы: ui-styling, frontend-a11y
```

Готово, когда:
- [ ] кнопка `Verify with external sources` вызывает `api.verify.again` и показывает прогресс
- [ ] список источников с бейджем провайдера, кликабельным URL, датой и confidence
- [ ] empty-состояние формулируется честно: `No external confirmation found` — не «ошибка»
- [ ] `npm run build` проходит

Проверка: `npm run dev` → Verify → появляются внешние ссылки, они открываются
Демо-чек:  блок Exa-источников в центре экрана.
Откат:     `git revert <коммит>` — evidence остаётся, но без внешнего списка.

---

### T-25 · Дорожка B · Лог расхода спонсорских API

```
Зачем в демо: шаг 1:25. Доказательство, что все три API работают вживую, прямо цифрами.
Владеет:    convex/usage.ts, convex/costs.ts (оба переданы из T-02)
Читает:     convex/grok.ts, convex/firecrawl.ts, convex/exa.ts
Не трогать: src/**
Скиллы/MCP: mcp__convex__data, mcp__convex__runOneoffQuery (сверить суммы)
```

Готово, когда:
- [ ] Grok: `usage.cost_in_usd_ticks / 10_000_000_000` → `costUsd` (формула из `docs/STACK.md`, проверена арифметически)
- [ ] Firecrawl: 1 кредит за страницу, +надбавки если появятся; Exa: $0.007 за поиск
- [ ] `api.usage.summary` возвращает суммы по провайдерам без `.collect().length` (COUNT в Convex нет — считаем по индексу `by_workspace` или храним денормализованно)
- [ ] в query нет `Date.now()`

Проверка: `npx convex run usage:summary '{"workspaceId":"<id>"}'` → ненулевые суммы после одного скана
Демо-чек:  ничего визуально; цифры готовы для бейджа.
Откат:     `git revert <коммит>` — бейдж показывает нули, остальное работает.

---

### T-26 · Дорожка B · Бейдж живого расхода

```
Зачем в демо: шаг 1:25, закрывающий кадр.
Владеет:    src/components/UsageBadge.tsx
Читает:     api.usage.summary, docs/DESIGN.md
Не трогать: convex/**
Скиллы/MCP: скиллы ui-styling, dataviz (если решите показывать мини-диаграмму)
```

Готово, когда:
- [ ] одна строка внизу Pulse: `Grok $X · Firecrawl N credits · Exa $Y`, обновляется реактивно
- [ ] нули не выглядят как ошибка; loading — тонкий скелетон, не спиннер
- [ ] бейдж не перетягивает внимание с главного кадра
- [ ] `npm run build` проходит

Проверка: `npm run dev` → Run Scan → цифры растут на глазах
Демо-чек:  доказательство живых вызовов на экране.
Откат:     `git revert <коммит>` — исчезает только бейдж.

---

### T-27 · Дорожка A · Grok выбирает layout

```
Зачем в демо: закрывает ТЗ §20/§23 — AI-driven UI, безопасно. Модель выбирает блоки,
              а не рисует разметку.
Владеет:    convex/layout.ts
Читает:     convex/grok.ts, convex/prompts/reasoning.ts, convex/schema.ts
Не трогать: src/**
Скиллы/MCP: mcp__convex__run, mcp__convex__data
```

Готово, когда:
- [ ] Grok заполняет `signals.layout` массивом `vBlock`; список допустимых типов передан в промпт как закрытый перечень
- [ ] неизвестный тип отфильтровывается **на сервере** до записи — фронт не должен получать мусор
- [ ] приоритеты по типу бизнеса из ТЗ §23: SaaS → DiffView, FeatureMatrix, DataGrid, Timeline, RecommendationCards
- [ ] `props` содержит только идентификаторы (`signalId`, `competitorId`, `artifactId`) — никаких данных внутри блока
- [ ] пустой или невалидный ответ → `layout: []`, фронт берёт дефолт (деградация, а не поломка)

Проверка: `npx convex run layout:build '{"signalId":"<id>"}'` → `api.signals.layout` отдаёт 4–6 блоков
Демо-чек:  состав центра меняется под сигнал, а не фиксирован в коде.
Откат:     `git revert <коммит>` — фронт рисует дефолтный набор блоков.

---

### T-28 · Дорожка A · Timeline + Chart

```
Зачем в демо: конкурентная память (ТЗ §32) — «вот как менялась их цена».
Владеет:    src/components/blocks/Timeline.tsx, src/components/blocks/PriceChart.tsx
Читает:     api.history.timeline, docs/DESIGN.md
Не трогать: convex/**
Скиллы/MCP: скилл dataviz ОБЯЗАТЕЛЬНО прочитать до первой строки кода графика
            (палитра, оси, подписи); ui-styling; recharts уже установлен в T-01
```

Готово, когда:
- [ ] `Timeline` — вертикальная лента событий конкурента, клик ведёт на сигнал
- [ ] `PriceChart` — история цены Pro с точкой перелома $49 → $39, подписанной значением
- [ ] одна-две точки данных не ломают график (осмысленный empty/degenerate state)
- [ ] цвета из токенов `docs/DESIGN.md`, читаемо в обеих темах, не только цветом (подписи значений)
- [ ] `npm run build` проходит

Проверка: `npm run dev` → выбрать конкурента → график и лента с датами
Демо-чек:  дополнительный кадр «у продукта есть память».
Откат:     `git revert <коммит>` — исчезают два блока, реестр деградирует штатно.

---

### T-29 · Дорожка A · Chat: chat.ask + UI events

```
Зачем в демо: ТЗ §28 — управление естественным языком. Не обязателен для 90 секунд,
              но отвечает на вопрос жюри «а можно спросить?».
Владеет:    convex/chat.ts, convex/uiEvents.ts, convex/history.ts (все переданы из T-02)
Читает:     convex/grok.ts, convex/layout.ts, convex/schema.ts
Не трогать: src/**
Скиллы/MCP: mcp__convex__run, mcp__convex__logs
```

Готово, когда:
- [ ] `api.chat.ask` пишет сообщение пользователя, сразу возвращает `messageId`, ответ дописывается через `scheduler` (фронт показывает скелетон, не спиннер)
- [ ] ответ Grok = `{ response_text, blocks[] }`; blocks валидируются по закрытому перечню на сервере
- [ ] в контекст уходит: company context + последние сигналы + текущий сигнал + история переписки (усечённая)
- [ ] `api.uiEvents.send({blockId, action, payload})` принимает события ТЗ §25 и превращает их в сообщение/действие
- [ ] вопрос «Why is this signal High?» даёт текст со ссылкой на evidence, а не пересказ
- [ ] ошибка модели → сообщение `status: "error"` с текстом, история не рушится

Проверка: `npx convex run chat:ask '{"workspaceId":"<id>","text":"What changed today?"}'` → ответ с блоками
Демо-чек:  чат отвечает и подставляет блоки в центр.
Откат:     `git revert <коммит>` — чат-панель показывает error-состояние, остальное цело.

---

### T-30 · Дорожка A · Chat-панель

```
Зачем в демо: ответ на вопрос жюри вживую.
Владеет:    src/components/ChatPanel.tsx
Читает:     api.chat.list, api.chat.ask, api.uiEvents.send, docs/DESIGN.md
Не трогать: convex/** кроме чтения, src/components/artifacts/**,
            src/screens/ArtifactScreen.tsx, src/screens/SourcesScreen.tsx (зона дорожки B)
Скиллы/MCP: mcp__wonder__take_screenshot; скиллы ui-styling, frontend-a11y
```

Готово, когда:
- [ ] поле ввода внизу правой панели, три готовых подсказки-чипа (`What changed today?`, `Why is this High?`, `What should we do?`) — чтобы не пришлось придумывать вопрос на сцене
- [ ] сообщения ассистента рендерят blocks через существующий `BlockRenderer`
- [ ] ответ дольше секунды → скелетон сообщения, не спиннер в пустоте
- [ ] empty: подсказки видны сразу; error: сообщение с Retry
- [ ] `npm run build` проходит

Проверка: `npm run dev` → чип `Why is this High?` → ответ с блоками
Демо-чек:  живой диалог поверх того же интерфейса.
Откат:     `git revert <коммит>` — исчезает панель чата.

---

### T-31 · Дорожка B · Crons + бюджетные предохранители

```
Зачем в демо: доказывает проактивность (ТЗ §11) и защищает ключи на публичном демо.
Владеет:    convex/crons.ts, convex/budget.ts
Читает:     convex/scan.ts, convex/usage.ts
Не трогать: src/**
Скиллы/MCP: mcp__convex__logs, mcp__convex__insights
```

Готово, когда:
- [ ] `crons.interval("monitor", { minutes: 30 }, internal.scan.scanAll, {})`; наложения Convex пропускает сам
- [ ] `budget.ts` даёт жёсткий стоп: суточный лимит на Firecrawl-кредиты, Exa-доллары и Grok-доллары; при превышении скан не запускается и пишет причину в `runs`
- [ ] cron не переключает мок-сайт и не портит демо-состояние
- [ ] на время демо интервал легко увеличить одной правкой (закомментированная строка с пояснением)

Проверка: `mcp__convex__logs` показывает запуск cron; `budget:check` возвращает остатки
Демо-чек:  можно честно сказать «система работает и без нажатия кнопки».
Откат:     `git revert <коммит>` — остаётся ручной Run Scan.

---

### T-32 · Дорожка A · FeatureMatrix + DataGrid

```
Зачем в демо: ТЗ §22/§23, приоритетные блоки для SaaS.
Владеет:    src/components/blocks/FeatureMatrix.tsx, src/components/blocks/DataGrid.tsx
Читает:     api.workspace.demo, api.signals.get, docs/DESIGN.md
Не трогать: convex/**
Скиллы/MCP: скиллы design-system, frontend-a11y (таблицы — частый провал по a11y)
```

Готово, когда:
- [ ] `FeatureMatrix`: строки — features/limits, колонки — `Us` / `AcmeFlow`; различия подсвечены
- [ ] `DataGrid` — универсальная таблица прайсинга с сортировкой; inline-editing **не** делаем (P2, вне сценария)
- [ ] таблица в контейнере с `overflow-x: auto`, страница не скроллится в бок
- [ ] `<th scope>` и подписи на месте; состояния loading/empty/error
- [ ] `npm run build` проходит

Проверка: `npm run dev` → блок сравнения виден и читается
Демо-чек:  наглядное «мы vs они» рядом с сигналом.
Откат:     `git revert <коммит>` — исчезают два блока.

---

### T-33 · Дорожка B · Fal.ai: hero-картинка (P2)

```
Зачем в демо: усиливает финальный кадр landing page. Вне критического пути.
Владеет:    convex/fal.ts
Читает:     convex/act.ts, convex/schema.ts
Не трогать: src/**
Скиллы/MCP: скилл fal-ai-media; mcp__convex__logs, mcp__convex__envSet (FAL_KEY)
```

Готово, когда:
- [ ] промпт картинки собирается из headline и позиционирования landing page
- [ ] URL пишется в `artifacts.heroImageUrl`; при любой ошибке остаётся `null` — **основной поток не ломается ни при каких условиях**
- [ ] вызов идёт через `scheduler` после `status: "ready"`, генерация не задерживает показ артефакта
- [ ] `FAL_KEY` добавлен в `.env.local.example` и через `npx convex env set`
- [ ] стоимость передана в лог расхода

Проверка: `npx convex run fal:hero '{"artifactId":"<id>"}'` → `heroImageUrl` заполнен
Демо-чек:  на landing page появляется картинка.
Откат:     `git revert <коммит>` — плейсхолдер вместо картинки, всё остальное цело.

---

### T-34 · Дорожка B · Hero-картинка + регенерация артефакта (P2)

```
Зачем в демо: ТЗ §42 — артефакт редактируемый/регенерируемый.
Владеет:    src/components/artifacts/RegenerateBar.tsx
            (+ уже принадлежащий ей src/components/artifacts/LandingPreview.tsx)
Читает:     api.act.generate, api.artifacts.get
Не трогать: convex/**
Скиллы/MCP: mcp__wonder__take_screenshot; скилл ui-ux-pro-max
```

Готово, когда:
- [ ] `heroImageUrl` рисуется с корректным `alt`; `null` → прежний плейсхолдер
- [ ] кнопка `Regenerate` перевызывает `api.act.generate` на той же рекомендации, во время генерации — скелетон
- [ ] заголовок и CTA правятся на месте (contentEditable или input), правка видна сразу (сохранение в Convex — только если `S-1` расширит контракт; иначе правка локальная и это честно подписано)
- [ ] `npm run build` проходит

Проверка: `npm run dev` → Regenerate → новый текст без перезагрузки страницы
Демо-чек:  артефакт выглядит живым документом, а не картинкой.
Откат:     `git revert <коммит>` — артефакт остаётся статичным.

---

### T-35 · Дорожка B · Exa discovery: поиск конкурентов (P2)

```
Зачем в демо: ТЗ §24 — Exa как инструмент обнаружения, не только подтверждения.
Владеет:    convex/discovery.ts
Читает:     convex/exa.ts, convex/grok.ts, convex/schema.ts
Не трогать: src/**
Скиллы/MCP: mcp__exa__*, скилл exa-search; mcp__convex__run
```

Готово, когда:
- [ ] `discovery.suggest({workspaceId})` находит 3–5 кандидатов через Exa `category: "company"` и записывает их с `origin: "exa"`
- [ ] дубли по нормализованному домену не создаются; наша собственная компания не предлагается
- [ ] каждый кандидат несёт url, краткое обоснование от Grok и источник
- [ ] бюджетный предохранитель из T-31 учитывается

Проверка: `npx convex run discovery:suggest '{"workspaceId":"<id>"}'` → 3–5 новых конкурентов
Демо-чек:  на `/sources` появляется список предложенных конкурентов.
Откат:     `git revert <коммит>` — конкуренты только вручную и из seed.

---

### T-36 · Дорожка A · GeoMap (P2)

```
Зачем в демо: ТЗ §24 — карта как инструмент управления агентом. Только если всё
              остальное принято и время осталось.
Владеет:    src/components/blocks/GeoMap.tsx
Читает:     api.uiEvents.send, api.workspace.demo, docs/DESIGN.md
Не трогать: convex/**
Скиллы/MCP: mcp__wonder__generate_svg (схематичная карта без внешних тайлов —
            не тянем зависимость и не зависим от сети на сцене);
            скиллы ui-ux-pro-max, dataviz
```

Готово, когда:
- [ ] схематичная карта с нашей точкой, точками конкурентов и радиусом
- [ ] изменение радиуса отправляет `api.uiEvents.send({action:"update_radius", payload:{radius_km}})`
- [ ] новых npm-зависимостей **не добавлено** (иначе это sync-задача на `package.json`)
- [ ] loading/empty/error на месте; без данных карта показывает только нашу точку и подсказку
- [ ] `npm run build` проходит

Проверка: `npm run dev` → сменить радиус → в `chatMessages` появляется событие
Демо-чек:  карта отвечает на действие пользователя.
Откат:     `git revert <коммит>` — исчезает блок карты.

---

### S-1 · sync-задача · Изменение замороженного контракта (шаблон)

Нужна, только если схема, сигнатура или тип из §3 обязаны поменяться.

```
Порядок:
1. Написать напарнику: «S-1: меняю <что> потому что <причина>. Стоп на 15 минут.»
2. Обе дорожки: закоммитить и запушить текущее, довести main до зелёного build.
3. ОДИН человек правит convex/schema.ts + src/lib/types.ts + src/lib/fixtures.ts +
   затронутые сигнатуры одним коммитом с сообщением "S-1: <что изменилось>".
4. Обновить §3 в PLAN.md тем же коммитом.
5. Второй делает git pull --rebase, npm run build, и только потом продолжает.
```

Правка контракта «по ходу», внутри другой задачи, запрещена: именно так получается конфликт при rebase.

---

## 6. Git-протокол

Работаем в `main` короткими коммитами, без PR — на день это быстрее и безопаснее,
чем ветки, ПРИ условии непересекающегося владения файлами.

```bash
# перед стартом задачи
git pull --rebase origin main

# после задачи — сначала проверка, потом коммит
npm run build && git add -A && git commit -m "T-07: ..."
git pull --rebase origin main && git push origin main
```

- Один коммит = одна задача, в сообщении ID задачи.
- Не начинать задачу, не сделав pull.
- Конфликт при rebase = нарушение владения файлами: остановиться, написать напарнику,
  не разрешать конфликт «на глаз».
- `.env.local` и ключи не коммитим никогда; новые переменные — только в `.env.local.example`.
- Отметку о выполнении ставить в `PLAN.md` тем же коммитом (галочка в таблице).

Дополнения к протоколу для этого проекта:

- Первые два коммита (`T-01`, `T-02`) делает дорожка A. Дорожка B до их push'а работает только над `docs/DESIGN.md` (`T-03`) и не запускает `npm install`.
- `package.json` после `T-01` не трогает никто. Нужна новая зависимость — это `S-1` (§5), а не правка по ходу.
- У каждого **свой** dev-деплоймент Convex (см. §10). Схема и функции синхронизируются через git, не через базу. **Схему меняет только дорожка A**; после её push'а дорожка B делает `git pull --rebase` — иначе её `convex/_generated` устареет и типы разойдутся.
- Данные не синхронизируются между dev-деплойментами. Свежие данные у себя — `npx convex run seed:ensure '{}'` (идемпотентно).
- Вызывать функции чужой дорожки — нормально и ожидаемо. Запрещено только **писать в чужой файл**.
- `npx convex deploy` **удаляет индексы, которых нет в схеме**. Прежде чем деплоить, убедиться, что `convex/schema.ts` актуален (`git pull --rebase`).
- Если `git status` показывает изменение в файле, которым ты не владеешь по таблице §4 — не коммить его. Верни: `git checkout -- <файл>`.
- Правила работы с фичами — §11. Подключение второй машины — §10.

---

## 7. Приёмка «как жюри» — что делает тот, кто принял `git pull`

После каждого pull чужой работы — 3 минуты, не больше:

```bash
git pull --rebase origin main
git log --oneline -5
/code-review           # ревью входящего диффа
npm run build && npm run dev   # руками пройти демо-сценарий целиком
```

Рубрика жюри (та же, по которой судят проект — отметить да/нет):
- [ ] **Работает вживую.** Демо-сценарий проходится целиком, без перезапуска и без консоли.
- [ ] **Просто.** Путь до результата — не больше 3 кликов, ни одного объяснения вслух.
- [ ] **Видно ценность** за первые 10 секунд на экране.
- [ ] **Спонсорские API реально задействованы** и это видно в интерфейсе.
- [ ] **Не сломано ранее работавшее** (регрессия по предыдущим шагам сценария).
- [ ] Секретов в диффе нет, сборка зелёная.

Любое «нет» → чинит автор задачи, не принимающий. Принимающий пишет одну строку в
`PLAN.md`: `T-07 принято` или `T-07 возврат: <что именно не так>`.

### Журнал приёмки

<!-- дописывать строки сюда, тем же коммитом, которым принимаешь -->

---

## 8. Контрольные точки

Привязаны к состоянию продукта, а не к часам. На каждой — состояние, которое уже можно показать жюри.

### КТ-1 — «Monitor → Detect → Evidence»
Достигается после: A `T-12, T-37, T-09, T-11, T-07` · B `T-05, T-06, T-08, T-10`. Ориентировочно ~2,5–3 часа работы каждой дорожки.

**Что показываем, если время кончится прямо сейчас:**
публичная ссылка на Render открывается, экран Pulse наполнен без единого действия пользователя, слева фид сигналов, в центре **$49 → $39** с кликабельным URL источника, timestamp'ом и фрагментом страницы. Говорим: «Firecrawl снимает состояние сайтов конкурентов, мы храним историю в Convex и показываем, что именно изменилось, со ссылкой на доказательство». Это уже законченная мысль — мониторинг с доказательствами.

**Чего ещё нет и как об этом сказать:** оценки угрозы и рекомендаций. Формулировка: «дальше это оценивает Grok — вот следующий шаг».

### КТ-2 — «полная цепочка до готового артефакта» (главная)
Достигается после: A `T-13, T-14, T-15, T-18, T-20` · B `T-04, T-17, T-19, T-16, T-21, T-22`. Ориентировочно ~6–7 часов.

**Что показываем:** демо-сценарий §1 целиком, кроме шага 0:45 (Exa) и бейджа расхода. Monitor → Detect → Evidence → Assess → Recommend → Act, с готовой landing page внутри приложения. **Это минимум, ради которого делается проект.** Если план придётся резать — резать всё, кроме пути к КТ-2.

**Репетиция обязательна здесь:** прогнать 90 секунд три раза подряд с нуля (`mock:flip v1` → перезагрузка → flip v2 → Run Scan). Если хоть один прогон сорвался — следующая задача не берётся, чинится прогон.

### КТ-3 — «живые спонсорские API в кадре + проактивность»
Достигается после: A `T-27, T-24, T-29, T-30, T-28, T-32` · B `T-23, T-25, T-26, T-31`. Ориентировочно ~9–10 часов.

**Что показываем:** сценарий целиком, включая внешнее подтверждение от Exa, бейдж живого расхода по трём API, историю цены конкурента, ответ на вопрос в чате и фразу «система сканирует сама по расписанию, кнопка — только для демо».

**После КТ-3** берётся волна 3 (P2) по одной задаче, и после каждой — заново прогон демо. Любая P2-задача, которая ломает прогон, ревертится, а не дочинивается.

---

## 9. Что остаётся сделать руками (не код)

- Чек-ин на хакатоне, клейм кредитов: x.ai (Billing → Redeem promo code), Firecrawl, Exa, Render, Wonder Pro.
- Convex Dashboard → Deployment Settings → Production Deploy Key с правом `deployment:deploy` → в Render как `CONVEX_DEPLOY_KEY`.
- Открыть публичную ссылку Render за 10 минут до выхода на сцену и прогнать демо один раз — на всякий случай.
- Мок-сайт оставить в `v1` перед началом демо. Переключение на `v2` — часть сценария.

---

## 10. Вторая машина: как подхватиться

План рассчитан на две машины, но «просто `git clone`» недостаточно: часть окружения живёт вне репозитория — ключи, деплоймент Convex, плагины и MCP-серверы Claude Code. Ниже — всё, что нужно второй машине, чтобы войти в общий план и начать с `T-03`.

### 10.1 Что синхронизируется через git, а что нет

| Через git (само) | Руками на каждой машине |
|---|---|
| код, схема Convex, `PLAN.md`, `docs/**` | API-ключи (`.env.local`) |
| `.claude/settings.json` — список включённых плагинов | сами плагины и marketplace'ы |
| `.mcp.json` — определения MCP без секретов | OAuth-вход в Wonder / Exa / Render |
| `render.yaml` | `CONVEX_DEPLOY_KEY` в дашборде Render |
| `.env.local.example` | свой dev-деплоймент Convex и `npx convex env set` в нём |

Ключи передаются **не через git и не в чате задачи** — личным сообщением или из дашбордов спонсоров по своему аккаунту. В `.env.local.example` только имена.

### 10.2 Порядок на второй машине (~20 минут)

```bash
# 1. код
git clone <repo> GrokMarketPulse && cd GrokMarketPulse
node -v          # нужен 22.x
npm ci

# 2. ключи
cp .env.local.example .env.local   # заполнить XAI_API_KEY, FIRECRAWL_API_KEY, EXA_API_KEY

# 3. СВОЙ dev-деплоймент Convex в ОБЩЕМ проекте
#    (перед этим владелец проекта приглашает напарника: Convex Dashboard → Team → Members)
npx convex dev --configure        # выбрать существующий проект, создать свой dev-деплоймент
npx convex env set XAI_API_KEY
npx convex env set FIRECRAWL_API_KEY
npx convex env set EXA_API_KEY
npx convex env list               # три ключа, свой деплоймент

# 4. свои данные
npx convex run seed:ensure '{}'   # идемпотентно, поднимает demo-воркспейс и baseline

# 5. проверка
npm run build && npm run dev
```

### 10.3 Плагины и скиллы — уже в репозитории

Всё, на что ссылаются карточки задач, **лежит в репо** и приезжает с `git clone`, ставить ничего не нужно:

| Где в репо | Что | Откуда |
|---|---|---|
| `.claude/skills/ui-ux-pro-max`, `ui-styling`, `design-system`, `brand` | дизайн-интеллект: стили, палитры, шрифты, UX-правила (BM25-поиск по локальной базе) | ui-ux-pro-max 2.13.0 |
| `.claude/skills/frontend-design` | аутентичная визуальная линия, не шаблон | claude-plugins-official |
| `.claude/skills/exa-search`, `fal-ai-media`, `frontend-a11y`, `react-patterns` | Exa, Fal.ai, доступность, React | ECC |
| `.claude/skills/brainstorming`, `writing-plans`, `verification-before-completion`, `systematic-debugging`, `test-driven-development`, … | процесс: думать → план → проверка перед «готово» | superpowers 6.3.0 |
| `.claude/agents/code-reviewer`, `react-reviewer`, `typescript-reviewer`, `silent-failure-hunter`, `security-reviewer`, `a11y-architect` | ревьюеры для §7 | ECC |
| `.claude/commands/code-review`, `react-review`, `build-fix`, `react-build` | `/code-review`, `/react-review`, `/build-fix`, `/react-build` | ECC |

Имена — **без префиксов** (`/code-review`, а не `/ecc:code-review`; `ui-ux-pro-max`, а не `ui-ux-pro-max:design`). Так они и записаны в карточках.

Скиллы `ui-ux-pro-max*` зовут `python3 .claude/skills/ui-ux-pro-max/scripts/search.py` — путь относительно корня репо, поэтому Claude Code запускать **из корня**. Python 3 нужен на машине (без пакетов, только стандартная библиотека).

Полные плагины (весь ECC, весь superpowers с хуками) ставить **не обязательно**. Если хочется полный набор — `/plugin marketplace add affaan-m/ECC` + `/plugin install ecc@ecc`, но тогда в списке будут дубли с префиксом `ecc:`; карточки всё равно ссылаются на вендоренные имена.

Wonder, Convex, Render — это MCP, не скиллы; см. 10.4.

Обновление вендоренного скилла — правка общего файла, то есть `S-1` (§5).

### 10.4 MCP-серверы

Project-scope MCP пишется в `.mcp.json` в корне и **коммитится** — так обе машины получают одинаковый набор одним `git pull`. В этот файл попадает только то, что не требует секрета в открытом виде:

```bash
claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp          # keyless
claude mcp add --transport http exa "https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,agent_run,web_search_advanced_exa"
claude mcp add convex --scope project -- npx -y convex@latest mcp start
claude mcp add --transport http wonder https://mcp.wonder.so/mcp
claude mcp add --transport http context7 https://mcp.context7.com/mcp
```

Остальное — **только с флагом `--scope user`, вне репозитория**, потому что несёт ключ в заголовке:

```bash
claude mcp add --transport http render https://mcp.render.com/mcp --scope user \
  --header "Authorization: Bearer <RENDER_API_KEY>"
```

OAuth (Wonder, Exa, Render через плагин) проходится по одному разу на машину через браузер. Wonder: открыть файл-канвас в браузере → отправить промпт в Claude Code → пройти по напечатанной ссылке → **повторить тот же промпт**.

`.mcp.json` ведёт дорожка A в `T-01`. Добавление сервера позже — это правка общего файла, то есть `S-1` из §5, а не правка по ходу.

### 10.5 Чек-лист «машина готова»

- [ ] `npm run build` зелёный
- [ ] `npx convex env list` показывает три ключа в **своём** dev-деплойменте
- [ ] `npx convex run seed:ensure '{}'` прошёл, `/` открывается непустым
- [ ] мок-сайт отвечает: `curl -s $(npx convex env get CONVEX_SITE_URL)/mock/acmeflow/pricing | head -5`
- [ ] `/help` показывает скиллы `ui-ux-pro-max`, `frontend-design`, `brainstorming` и команду `/code-review` (из `.claude/` репо)
- [ ] `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard" --max-results 1` выдаёт результат
- [ ] `/mcp` показывает `convex`, `firecrawl`, `exa`, `wonder` без ошибок
- [ ] `git log --oneline -5` совпадает с тем, что у напарника

---

## 11. Правила работы с фичами

Фича = одна задача из §4. Других фич не существует: **сначала строка в таблице, потом код.**

### 11.1 Как берётся фича

1. `git pull --rebase origin main`.
2. Проверить, что все задачи из колонки «Зависит от» отмечены `[x]`. Если зависимость чужой дорожки ещё не пришла — работать против фикстур `src/lib/fixtures.ts`, а не ждать.
3. Поставить в таблице §4 метку `[~]` (взял) и запушить эту строку сразу — напарник видит, что занято.
4. Прочитать карточку задачи целиком. **Вызвать скиллы и MCP из строки `Скиллы/MCP:` до первой строки кода**, не после: дизайн — `ui-ux-pro-max:*` + `frontend-design` + Wonder MCP; данные и схема — Convex MCP; поиск и скрейп — Exa / Firecrawl MCP; графики — скилл `dataviz`; доки библиотек — Context7.
5. Работать только в файлах из строки `Владеет:`.

Состояния галочки: `[ ]` свободна → `[~]` взял → `[x]` сделана и принята напарником.

### 11.1a Wonder — один файл на команду, свои артборды у каждого

- **Файл-канвас один**, создан в T-03, подключён к GitHub-репо. Второй файл не заводится: токены и
  компоненты должны быть общими, иначе Pulse и Artifact будут выглядеть как два продукта.
- **Артборды — по владению.** Дорожка A рисует блоки и чат (`Block/*`, `Panel/*`), дорожка B — экраны,
  landing и артефакты (`Shell`, `Artifact`, `Landing`, `Sources`). Чужой артборд не редактируем —
  то же правило, что и для файлов.
- **Токены — только у B** (`docs/DESIGN.md`). A берёт их через `get_design_context` и не придумывает
  свои. Новый токен нужен → сказать B, B добавляет.
- **Сессия Wonder начинается с одного `get_design_context` без `pageId`** — он отдаёт файл, страницу,
  токены и все артборды. Отдельные `get_basic_info` / `get_artboards` в начале не нужны.
- **Код забираем через `get_element_code`** и кладём в свой файл по владению. Wonder-экспорт через
  GitHub App (PR в ветку `wonder/*`) не используем: он идёт мимо протокола §6.
- Wonder нужен **обеим** дорожкам, не только «дизайнерской»: блоки динамического UI — это интерфейс,
  и рисуются они там же.

### 11.1b ECC и вендоренные скиллы — когда что

| Ситуация | Что вызвать |
|---|---|
| Берёшь любую задачу | `brainstorming` только если карточка неясна; иначе сразу карточка → код |
| Верстаешь блок, экран, панель | `ui-ux-pro-max` (стиль/палитра) → `frontend-design` → Wonder MCP → `frontend-a11y` |
| Пишешь action с внешним API (Firecrawl / Exa / Grok / Fal) | Convex MCP `logs` открытым во втором окне; после — агент `silent-failure-hunter` по своему диффу |
| Работаешь с Exa | скилл `exa-search` |
| Работаешь с Fal.ai | скилл `fal-ai-media` |
| График или метрика | скилл `dataviz` до первой строки кода |
| Красный `npm run build` | `/build-fix` (или `/react-build` для JSX-ошибок) |
| Перед тем как сказать «готово» | `verification-before-completion` — команда из строки «Проверка» реально запущена |
| Принял чужой pull | `/code-review` (+ `/react-review`, если в диффе `.tsx`) — §7 |
| Что-то работает не так, как ожидал | `systematic-debugging`, не «попробую ещё раз» |
| Доки Convex / Firecrawl / Exa расходятся с памятью | Context7 MCP `query-docs`, не гадать |

### 11.2 Границы фичи

- **Не больше 45 минут.** Признаки, что пора делить: в «Готово, когда» больше семи пунктов; фича трогает два экрана; фича трогает и `convex/`, и `src/` в разных доменах.
- **Вертикальный срез обязателен.** «Добавить таблицу в схему» или «написать хелпер» отдельной фичей не бывает — только как часть фичи, которая что-то показывает на экране.
- **Чужой файл — стоп.** Если фича требует записи в файл другой дорожки, это две задачи или `S-1` (§5). Никогда не один коммит в четыре руки.
- **Новая зависимость в `package.json` — это `S-1`**, а не часть фичи.

### 11.3 Готово одинаково для всех

- [ ] каждое проверяемое утверждение из «Готово, когда» действительно проверено командой или кликом, а не «вроде работает»
- [ ] три состояния на экране: loading / empty / error — часть фичи, не «потом»
- [ ] ответ модели дольше секунды → скелетон или стриминг, не спиннер в пустоте
- [ ] `npm run build` зелёный
- [ ] демо-сценарий §1 проходится целиком от начала до конца (не только новый кусок)
- [ ] секретов в диффе нет
- [ ] галочка `[x]` в §4 — **тем же коммитом**
- [ ] коммит: `T-NN: короткое описание`

### 11.4 Идея по ходу, которой нет в плане

Записать одной строкой в §12 и **не начинать**. Решение — на ближайшей контрольной точке. Причина простая: любая незапланированная фича, взятая до КТ-2, отодвигает КТ-2, а КТ-2 — единственное, что обязательно должно существовать к демо.

Исключение одно: фича ломает демо-сценарий. Тогда это не фича, а баг, и он важнее любой задачи в очереди.

### 11.5 Приоритет

Пока путь к **КТ-2** (§8) не пройден целиком и не отрепетирован трижды — ни одна задача из волны 2 или 3 не начинается. Ни одна. Даже на десять минут.

### 11.6 Баги в чужой фиче

- Однострочная опечатка — чинить самому и написать напарнику одной строкой.
- Всё остальное — возврат автору через §7: `T-NN возврат: <что именно не так>`. Владение файлами важнее скорости: два человека, чинящие один файл, дают конфликт при rebase, а конфликт при rebase на хакатоне стоит дороже любого бага.
- Если демо горит прямо сейчас — чинить немедленно, но тем же сообщением предупредить напарника, что зашёл в его файл, и дальше он продолжает уже после `pull`.

### 11.7 Флагов фич не заводим

Рискованная фича должна отключаться **ревертом одного коммита** — для этого и нужны правила «одна фича = один коммит» и «непересекающееся владение». Конструкции `if (FEATURE_X)` в общих файлах запрещены: это тот самый общий файл, из-за которого обе дорожки встают.

---

## 12. Идеи вне плана

<!-- одна строка на идею: кто предложил, что это, почему не сейчас. Решение — на контрольной точке. -->
