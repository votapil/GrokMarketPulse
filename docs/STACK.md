# Стек хакатона — что можно использовать и как

Источник: карточки спонсоров со Stack-страницы хакатона (Белград, 12 сентября 2026).
Статус: раздел «Из карточек» — дословно от организаторов. Раздел «Как подключить» дополняется по мере разведки.

| Технология | Роль в проекте | Что дают |
|---|---|---|
| x.ai (Grok API) | LLM-мозг: chat, voice, vision, image | ~$35 API-кредитов на команду |
| Firecrawl | Парсинг сайтов → markdown/JSON | 10 000 кредитов каждому участнику |
| Exa | Веб-поиск для агентов через API | $50 кредитов каждому участнику |
| Convex | База данных + бэкенд + realtime | Free tier; призовой трек (судейская панель) |
| Render | Хостинг, публичный HTTPS-URL | Промо-кредиты каждому чекнутому участнику |
| Wonder | Дизайн UI → React + Tailwind | Pro-план каждому участнику |

---

## 1. x.ai / Grok API — `API / MODELS`

**Важно:** ключ берётся в Console API (console.x.ai), это **не** Grok Bot. Кредиты на Grok Bot не работают.

### Из карточки
- **Voice API** — realtime audio-агенты (docs.x.ai, voice capabilities)
- **Chat / Imagine / Grok Build** — модели через Console API
- **Console API key** — вшивается в бэкенд или агента
- Voice landing: https://x.ai/voice

**Ship in a day (идеи организаторов):**
- Голосовой агент-демо поверх x.ai Voice API
- Chat completion или мультимодальные Imagine-вызовы с бэкенда
- Grok Build workflows через Console-ключ
- Всё, что требует моделей x.ai вне Grok Bot

**Кредиты:** ~$35 на команду Console. Клеймить на Stack-странице после чек-ина, погашать: console.x.ai → Billing → Redeem promo code. Действует 12 сентября 2026 (белградское время), 160 погашений, один на команду.

### Как подключить
_(заполняется)_

---

## 2. Firecrawl — `RESEARCH / WEB DATA`

Отдаёт приложению живые веб-страницы как чистый markdown или JSON, а не сырой HTML.

### Из карточки
- **Scrape** — один URL → markdown / HTML / JSON
- **Crawl** — обход по ссылкам от стартового URL
- **Map** — список URL сайта без скрейпа тел страниц
- **Search** — веб-поиск с опциональным полным контентом страниц
- **Extract** — структурированные JSON-поля со страницы
- **Interact** — клики, заполнение форм, пагинация в браузере
- **MCP / CLI / API** — включая keyless-режим для небольшого использования

**Ship in a day:**
- RAG по docs-сайту или блогу
- Research-агент: ищет, скрейпит, ссылается на источники
- Watchlist: извлекает цену / заголовок / дату с известных URL
- «Что нового» — бриф по дереву документации
- Данные за кликами, которые разрешено автоматизировать

**Кредиты:** 10 000 кредитов каждому участнику. Публичный free tier: 1 000 кредитов/мес (keyless или после регистрации) — это не хакатонный подарок, а обычный тариф.

### Как подключить

> ⚠️ **Что ломает старые примеры:** актуальна **API v2**, npm-пакет переименован в **`firecrawl`** (не `@mendable/firecrawl-js`), `/extract` — legacy, вместо него `/scrape` с форматом `json` или новый `/agent`.

| Что | Значение |
|---|---|
| Base URL | `https://api.firecrawl.dev/v2` |
| Auth | `Authorization: Bearer fc-...` |
| Env | **`FIRECRAWL_API_KEY`** (SDK читает автоматически) |
| Ключи | https://www.firecrawl.dev/app/api-keys |

**SDK** (версии на 12.09.2026): npm `firecrawl` 4.39.0 · pip `firecrawl-py` 4.42.0 (import `firecrawl`) · `firecrawl-mcp` 3.24.0

```bash
npm i firecrawl
pip install firecrawl-py
```

```js
import { Firecrawl } from 'firecrawl';
const fc = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

const doc  = await fc.scrape('https://example.com', { formats: ['markdown'] });
const site = await fc.crawl('https://example.com', { limit: 50, scrapeOptions: { formats: ['markdown'] } });
const urls = await fc.map('https://example.com', { search: 'blog', limit: 200 });
const hits = await fc.search('firecrawl changelog', { limit: 5 });
```

`crawl()` синхронный — сам поллит job и склеивает страницы. `startCrawl()` — асинхронный.

#### Эндпоинты

**POST /scrape** — синхронный. Возвращает `{markdown, html, links, screenshot, json, metadata:{statusCode, scrapeId}}`.
Ключевые параметры: `formats` · `onlyMainContent` (true) · **`maxAge`** (172800000 мс = 2 дня, кэш ускоряет ~5x) · `waitFor` · `timeout` (60000, max 300000) · `parsers` (`["pdf"]`) · `actions` · `proxy` (`auto|basic|enhanced`) · `blockAds` · `location`.

`formats` может быть строкой или объектом: `markdown`, `summary`, `html`, `rawHtml`, `links`, `images`, `screenshot{fullPage}`, **`json{schema,prompt}`**, `changeTracking`, `question{question}`, `highlights{query}`.

`actions` (интеракция до снятия контента): `wait`, `click{selector}`, `write{text}`, `press{key}`, `scroll`, `screenshot`, `executeJavascript{script}`, `pdf`.

```bash
curl -X POST https://api.firecrawl.dev/v2/scrape \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/pricing",
       "formats":["markdown",{"type":"json","prompt":"extract plan names and prices",
         "schema":{"type":"object","properties":{"plans":{"type":"array","items":{"type":"object",
           "properties":{"name":{"type":"string"},"usd":{"type":"number"}}}}}}}],
       "maxAge":86400000}'
```

**POST /crawl** — асинхронный. `{id}` → `GET /v2/crawl/{id}` → `{status, total, completed, creditsUsed, next, data}`. Пагинация по `next`, результаты живут 24 часа.
⚠️ **Всегда ставь `limit`** — дефолт **10 000 страниц**, это весь бюджет кредитов за один вызов.
Ещё: `includePaths`/`excludePaths` (regex), `maxDiscoveryDepth`, `sitemap`, `crawlEntireDomain`, `delay`, `maxConcurrency`, `webhook`, `scrapeOptions`.

**POST /map** — синхронный, **1 кредит за вызов** независимо от числа ссылок. Идеальный разведчик перед точечным scrape.

**POST /search** — `{query, limit, sources, categories, includeDomains, tbs, location, scrapeOptions}`. Если задан `scrapeOptions` — контент подтягивается сразу и тарифицируется как scrape каждой страницы.

**POST /agent** — преемник `/extract`. `{prompt, urls?, schema?, model:"spark-2", effort, maxCredits}` → job id. **5 бесплатных запусков в день**. Обязательно ставить `maxCredits`.

**Interact** — живая браузерная сессия: `/scrape` → взять `metadata.scrapeId` → `POST /v2/scrape/{id}/interact` с `prompt` или playwright-`code` → `DELETE`.

#### Кредиты — раскладка наших 10 000

| Операция | Цена |
|---|---|
| Scrape / Crawl | 1 кредит / страница |
| **Map** | **1 кредит / вызов** |
| Search | 2 кредита / 10 результатов |
| Interact | 2 кр./мин (`code`), **7** (`prompt`), минимум 1 мин |
| Agent | dynamic, 5 запусков/день бесплатно |

Надбавки к scrape (стекуются): `json` format **+4/стр** · PDF parsing +1/стр PDF · `checkPromptInjection` +4/стр · Zero Data Retention +1/стр · **x.com/twitter.com = 30 кредитов** (1 базовый + 29 Grok X Query).

| Сценарий | Что влезает в 10 000 |
|---|---|
| Чистый scrape (markdown) | 10 000 страниц |
| Scrape + `json` extraction | 2 000 страниц (5 кр./стр.) |
| Search без скрейпа | 5 000 запросов |
| Search + scrape всех 10 результатов | ~833 запроса |
| Map | 10 000 вызовов |
| Crawl сайта на 500 стр. | 500 кредитов |

Кредит списывается, **если Firecrawl вернул документ** — включая ответы 403/404 (смотри `metadata.statusCode`). Полный провал скрейпа — 0 кредитов. Кончились кредиты → HTTP 402.

**Экономия:** всегда `limit` в crawl · `parsers: []` если PDF не нужны · `maxAge` побольше · `json` только там, где реально нужна структура (иначе markdown + свой LLM дешевле) · `map` вместо crawl для разведки.

#### Rate limits (req/min)

Free: scrape 10 · map 10 · crawl 2 · search 10 · agent 2. Конкурентных браузеров на Free — **2**.
Hobby: 100 / 100 / 20 / 100 / 20, браузеров 5.

#### Keyless режим

Без ключа работают **Scrape, Search, Interact, Parse** (через hosted MCP — ровно `firecrawl_search`, `firecrawl_scrape`, `firecrawl_parse`). **Crawl, map, extract, batch scrape без ключа недоступны.** Лимит per IP per day, точные числа не публикуются, превышение → 429.

#### MCP

```bash
# keyless — работает сразу, три тула
claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp

# со входом через браузер — полный набор тулов и наш план
claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp-oauth
# затем /mcp в Claude Code → завершить sign-in
```

С ключом в заголовке (не в URL):
```json
{"mcpServers":{"firecrawl":{"type":"http","url":"https://mcp.firecrawl.dev/v2/mcp",
  "headers":{"Authorization":"Bearer <FIRECRAWL_API_KEY>"}}}}
```

Tools: `firecrawl_scrape`, `firecrawl_search`, `firecrawl_parse` (keyless); по ключу — `firecrawl_map`, `firecrawl_crawl` + `_check_crawl_status`, `firecrawl_agent` + `_status`, `firecrawl_interact` + `_stop`, `firecrawl_developer_search`, `firecrawl_monitor_*`. **Тула `firecrawl_extract` больше нет.**

---

## 3. Exa — `SEARCH / WEB`

Нейропоиск: агент **находит** источники, а не только читает URL, который вы уже знаете.

### Из карточки
- **Search** — запрос к живому вебу: страницы, люди, компании, код
- **Contents** — токен-эффективные выдержки из найденных URL
- **Research / agent** — многошаговый поиск с цитатами
- **API + MCP** — hosted-сервер на mcp.exa.ai

**Ship in a day:**
- Research-агент, который ищет и потом цитирует использованные страницы
- Поиск доков или репо, которых модель не знает
- Lookup компаний или людей для GTM / lead-демо
- Заземление ответа Convex на живые источники

**Кредиты:** $50 каждому участнику.

### Как подключить

> ⚠️ **Что ломает старые примеры:** `docs.exa.ai` теперь редиректит на `exa.ai/docs`. Типов поиска `neural`/`keyword` **больше нет**, `useAutoprompt` удалён, **`/research` удалён** (заменён на `/agent/runs`), `/findSimilar` deprecated.

| Что | Значение |
|---|---|
| Base URL | `https://api.exa.ai` |
| Auth | `x-api-key: <key>` (или `Authorization: Bearer`) |
| Env | **`EXA_API_KEY`** |
| Доки | `exa.ai/docs`, спека `exa.ai/docs/exa-spec.yaml` v2.0.0 |
| Ключи | https://dashboard.exa.ai/api-keys |

**SDK:** npm `exa-js` 2.19.0 · pip `exa-py` 2.20.0 (import `exa_py`) · `exa-mcp-server` 3.4.1

```ts
import Exa from "exa-js";
const exa = new Exa(process.env.EXA_API_KEY);

const r = await exa.search("latest LLM eval tooling", {
  numResults: 10, includeDomains: ["nasa.gov"], startPublishedDate: "2024-01-01",
  contents: { highlights: true },
});
const { results } = await exa.getContents(["https://exa.ai/docs"], { text: true, summary: true });
const ans = await exa.answer("What caused the 2008 financial crisis?");   // + ans.citations

const events = await exa.agent.runs.create({ query: "Find 5 new AI-agent eval tools.", stream: true });
for await (const e of events) console.log(e.event, e.data);
```

#### Эндпоинты

**POST /search** — `type`: **`instant | fast | auto | deep-lite | deep | deep-reasoning`** (default `auto`).
Параметры: `query` · `numResults` (1–100, def 10) · `category` (`company|publication|news|personal site|financial report|people`) · `includeDomains`/`excludeDomains` (до 1200, вместо `site:` в запросе) · `startPublishedDate`/`endPublishedDate` · `contents` (контент инлайном) · `outputSchema` (structured output, глубина ≤2, ≤10 полей) · `systemPrompt` · `stream` (SSE) · `userLocation`.

**POST /contents** — `urls` (1–100) · `text` (bool или `{maxCharacters, verbosity: compact|standard|full, includeSections/excludeSections}`) · `highlights{query}` · `summary{query, schema}` · `extras{links, imageLinks, codeBlocks}` · `subpages` · **`maxAgeHours`** (-1..720, актуальный контроль свежести; `livecrawl` deprecated).
В ответе `statuses[]` по каждому URL: `{status: success|error, source: cached|crawled, error}`.

**POST /answer** — `{query, stream, text, model: exa|exa-pro|exa-research|exa-fast, outputSchema}` → ответ + **`citations[]`**. `stream:true` → SSE.

**Agent API** (вместо `/research`):

| Метод | Путь |
|---|---|
| POST | `/agent/runs` (JSON или SSE через `Accept: text/event-stream`) |
| GET | `/agent/runs/{id}` (поллинг), `/agent/runs/{id}/events` |
| POST | `/agent/runs/{id}/cancel` (сбросить), `/stop` (сохранить частичное) |

Запрос: `query` · `systemPrompt` · **`effort`: `minimal|low|medium|high|xhigh|auto|max`** (def `auto`) · `outputSchema` · `previousRunId` · `dataSources[]` · **`budget:{maxCostDollars}`** ($1–$100; дефолт $5 для `auto`, $20 для `max`).
Ответ — structured JSON **с цитатами на уровне полей**:
```json
"output": { "text": "...", "structured": {},
  "grounding": [{"field":"structured.companies[0].sourceUrl",
                 "citations":[{"url":"...","title":"..."}], "confidence":"high"}] }
```

#### Цены — раскладка наших $50

| Эндпоинт | Цена |
|---|---|
| `/search` | **$7 / 1000** (до 10 результатов, **контент первых 10 включён**) |
| `/contents` | **$1 / 1000 страниц** за каждый тип контента |
| `/answer` | **$5 / 1000** |
| `deep-lite` / `deep` | $12 / 1000 |
| `deep-reasoning` | $15 / 1000 |
| Agent, фикс. effort | minimal $0.012 · low $0.025 · medium $0.10 · high $0.50 · xhigh $1.00 за запуск |

| Что | Объём на $50 |
|---|---|
| `/search` ≤10 рез. с контентом | **~7 143 поиска** |
| `/contents` (один тип) | **50 000 страниц** |
| `/answer` | **10 000 ответов** |
| Agent low / medium / high | 2 000 / 500 / 100 запусков |

Плюс обычный free tier: $20 при регистрации + $10 каждый месяц, карта не нужна.

**Rate limits:** `/search` 10 QPS · `/contents` 100 QPS · `/answer` 10 QPS.

#### MCP

```bash
# базовое подключение (2 тула по умолчанию)
claude mcp add --transport http exa https://mcp.exa.ai/mcp

# все четыре тула (список заменяет дефолт — перечислять всё нужное)
claude mcp add --transport http exa "https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,agent_run,web_search_advanced_exa"

# либо официальный плагин
claude plugin install exa@claude-plugins-official
```

Ключ: OAuth (`https://mcp.exa.ai/mcp?login`), либо `?exaApiKey=...`, либо заголовок. Анонимно работает с пониженными лимитами; `agent_run` всегда требует авторизации.

Tools: `web_search_exa` (вкл.), `web_fetch_exa` (вкл.), `agent_run` (opt-in), `web_search_advanced_exa` (opt-in: фильтры доменов/дат, highlights, summaries).

---

## Exa + Firecrawl: как связывать в агенте

Разделение ролей: **Exa — «где искать»** (discovery, свежесть, семантика, цитаты). **Firecrawl — «достать всё и точно»** (полный текст, JS-страницы, PDF, логин, обход сайта, структурный экстракт).

**Базовый пайплайн:**
1. `exa /search` `type:"auto"`, `numResults: 10–20`, `contents:{highlights:true}` — контент первых 10 включён в $0.007. Часто этого уже хватает → выходим.
2. Отбираем 3–5 URL, где нужен полный/структурированный текст.
3. `firecrawl /scrape` c `formats:["markdown"]` (+`json`-схема при необходимости) и `maxAge: 86400000`.
4. Нужен весь раздел сайта: `firecrawl /map` (1 кредит) → фильтр URL по regex → `batch/scrape` только по нужным. **Crawl без `limit` не запускать.**
5. Контент за логином/пагинацией — `/scrape` + `actions`; живую сессию `/interact` (2–7 кр./мин) только если inline-actions не хватило.

| Задача | Инструмент |
|---|---|
| «Найди источники по теме / что нового» | Exa `/search` (`fast` для латентности, `deep` для сложного) |
| Ответ с цитатами прямо сейчас | Exa `/answer` ($0.005) — дешевле, чем собирать самому |
| Многошаговое исследование со схемой и grounding | Exa `/agent/runs`, `effort:"low"/"medium"` + `budget.maxCostDollars` |
| Полный текст URL, JS/PDF, скриншот | Firecrawl `/scrape` |
| Обойти весь сайт/раздел | Firecrawl `/map` → `/batch/scrape` |
| Структурные поля с известной страницы | Firecrawl `/scrape` + `json` (5 кр.) |

**Правила, экономящие бюджет:**
- **Дедуп до скрейпа.** Нормализовать URL (убрать utm/фрагменты), держать `Set`. Повторный скрейп одной страницы — самый частый слив кредитов.
- **Кэш на обоих слоях.** Firecrawl `maxAge`, Exa `maxAgeHours`, плюс свой локальный кэш `url → markdown` (Convex-таблица подойдёт) — иначе агент на ретраях платит дважды.
- **Не платить за extraction дважды.** `json`-format Firecrawl это +4 кр./стр. На объёме дешевле забрать markdown (1 кр.) и распарсить своим LLM.
- **Бюджет-гварды в коде.** Счётчик кредитов Firecrawl (`GET /v2/team/credit-usage`, `creditsUsed` в статусе crawl) и `budget.maxCostDollars` / фиксированный `effort` у Exa Agent. Жёсткий стоп-лимит на задачу.
- **Бутылочное горлышко — Firecrawl** (Free: 10 req/min, 2 браузера) против Exa `/contents` 100 QPS. Батчить через `/batch/scrape`, а не N параллельных `/scrape`.
- **Fallback-цепочка на один URL:** Exa `/contents` (быстро, $0.001) → если `statuses[].status == "error"` или текст пуст → Firecrawl `/scrape` (`proxy:"auto"`, при 403 → `proxy:"enhanced"`) → всё ещё пусто → `actions`/`/interact`.
- **Правило для агента в системном промпте:** поиск и «что почитать» → Exa; «дай полный текст этой страницы / обойди сайт» → Firecrawl.

---

## 4. Convex — `BACKEND / STATE`

TypeScript-бэкенд с базой данных и живыми обновлениями. Позволяет не поднимать Postgres + сокеты ради демо.

### Из карточки
- **Database** — документы и индексы
- **Queries, mutations, actions**
- **Realtime** — UI синхронизируется без WebSocket-обвязки
- **Auth** — строки скоупятся по пользователю
- **File storage, cron, scheduler**
- **Components** — готовые бэкенд-фичи пакетами

**Ship in a day:**
- Живой чат или мультиплеер с обновлением для всех
- Память агента: хранение runs, tools, threads
- Приложение с логином, где каждый видит только свои данные
- Живой дашборд, наполняемый скрейпами или вебхуками
- Список задач: поставить в очередь, вызвать API, показать статус

**Что даёт:**
- Главный призовой трек (судейская панель): 1-е 80 000 RSD · 2-е 50 000 RSD · 3-е 20 000 RSD
- Free tier для маленьких команд
- Продолжение онлайн: All Gas hackathon — https://luma.com/convex-allgas-hackathon?tk=122o36

### Как подключить
_(заполняется)_

---

## 5. Render — `HOST / INFRA`

Публичный URL из Git: веб-приложения, статика, базы, воркеры.

### Из карточки
- **Web services** — сервер из репозитория
- **Static sites** — фронтенд + CDN
- **Render Postgres** — managed SQL, если отказываемся от Convex
- **Redis, cron, background workers**
- **Private services и Workflows**

**Ship in a day:**
- Выложить демо на публичный HTTPS-URL, чтобы судьи не лезли в localhost
- Тонкий API рядом с Convex- или Daytona-агентом
- Классический фуллстек с Postgres, если без Convex
- Воркер, который поллит Firecrawl или обрабатывает загрузки
- Статический лендинг + отдельный API, оба из GitHub

**Кредиты:** промо-кредиты каждому чекнутому участнику. Клеймить на Stack-странице после чек-ина, погашать: dashboard.render.com → Billing → Credit Balance → Enter promo code → Apply. Плюс обычный free tier (web/static/Postgres) — проверять текущие лимиты.

### Как подключить

**MCP-сервер** (hosted, `https://mcp.render.com/mcp`). Рекомендуемый путь — официальный плагин с OAuth:

```
/plugin install render@claude-plugins-official
/reload-plugins
```

Либо вручную по API-ключу (получить: https://dashboard.render.com/u/settings?add-api-key):

```bash
claude mcp add --transport http render https://mcp.render.com/mcp \
  --header "Authorization: Bearer <RENDER_API_KEY>"
```

После подключения первым делом: `Set my Render workspace to <WORKSPACE_NAME>` — все тулы скоупятся на workspace.

MCP умеет: создавать web service / static site / cron job / Postgres / Key Value, триггерить деплои, читать логи и метрики, выполнять read-only SQL к Postgres, **перезаписывать все env vars сервиса**. Воркеры и private services через MCP пока не создаются. Осторожно: MCP имеет полный доступ к аккаунту и деструктивные операции.

**CLI:**
```bash
curl https://downloads.render.com/cli/latest/render-latest-$(uname -s)-$(uname -m) -o render && chmod +x render
render login                        # или export RENDER_API_KEY=...
render services                     # список
render deploys create SERVICE_ID    # деплой
render logs SERVICE_ID
render psql DATABASE_ID
```

#### render.yaml — рабочий пример (API + Vite static + Postgres)

Файл в корне репо, подключение: Dashboard → New → Blueprint.

```yaml
previews:
  generation: automatic

services:
  - type: web
    name: api
    runtime: node
    plan: free
    region: oregon          # регион ИММУТАБЕЛЕН, выбирать сразу
    branch: main
    rootDir: server
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /healthz
    autoDeployTrigger: commit
    buildFilter:
      paths: ["server/**"]
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: hack-db
          property: connectionString
      - key: XAI_API_KEY
        sync: false          # секрет: спросит в дашборде, в git не попадёт
      - key: JWT_SECRET
        generateValue: true

  - type: web
    name: web
    runtime: static
    branch: main
    rootDir: client
    buildCommand: npx convex deploy --cmd 'npm run build'
    staticPublishPath: ./dist
    envVars:
      - key: CONVEX_DEPLOY_KEY
        sync: false
    routes:                  # SPA fallback — обязательно для react-router
      - type: rewrite
        source: /*
        destination: /index.html

databases:
  - name: hack-db
    databaseName: hackdb
    plan: free
    postgresMajorVersion: "17"
```

Ссылки между сервисами: `fromDatabase` (connectionString, user, password…), `fromService` (host, port, hostport, connectionString, envVarKey), `fromGroup`, `generateValue`, `sync: false`.

#### Port binding — частая ошибка

Слушать `0.0.0.0`, не `localhost`. Порт из `process.env.PORT` (дефолт 10000). Зарезервированы и недоступны: 18012, 18013, 19012.

```js
app.listen(process.env.PORT || 10000, "0.0.0.0");
```

Health check: успех = 2xx/3xx за 5 сек. Если новые инстансы не проходят за 15 минут — деплой откатывается. Эндпоинт делать лёгким, **не** ходить в БД.

#### ⚠️ Free tier — критично для демо судьям

- Web service **засыпает после 15 минут** без трафика, **холодный старт ≈ 1 минута** с лоадером Render. Это убьёт демо, если судья откроет ссылку «холодной».
- 750 free instance-часов на workspace в месяц; ФС эфемерная (всё записанное теряется при рестарте).
- **Postgres free:** 1 GB, 100 соединений, **истекает через 30 дней**, без бэкапов и pooling, одна база на workspace.
- **Key Value free:** 25 MB, только in-memory, теряется при рестарте.
- **Static Site бесплатен всегда и не спит** — CDN, Brotli, HTTP/2, TLS.

**Тактика:**
1. Фронт — обязательно Static Site (не спит).
2. Бэкенд разбудить за 2–3 минуты до показа или пинговать `/healthz` внешним cron-ом (UptimeRobot; Render Cron Job на free недоступен).
3. Надёжнее всего — на день демо поднять бэкенд на `0.5c-512mb` ($7/мес), спать перестанет. Кредиты как раз на это.

#### Связка Static Site + Convex

1. Convex Dashboard → Deployment Settings → Generate Production Deploy Key (право `deployment:deploy`).
2. На Render в Static Site env var `CONVEX_DEPLOY_KEY` = этот ключ.
3. Build Command: `npx convex deploy --cmd 'npm run build'`

`convex deploy` сам выставит `VITE_CONVEX_URL` (или `NEXT_PUBLIC_CONVEX_URL`), соберёт фронт и запушит функции из `convex/` в прод. Руками URL прописывать не нужно. Прод-URL `*.onrender.com` добавить в allowed origins провайдера аутентификации.

Vite → `staticPublishPath: ./dist`. Next с SSR — только как Web Service, static лишь при `output: 'export'` (→ `out`).

---

## 6. Wonder — `DESIGN / UI`

Дизайн на канвасе, который сразу является продакшн-React + Tailwind, а не макетом под передачу разработчику.

### Из карточки
- Канвас, слои и компоненты, мапящиеся 1:1 в код
- AI-чат для генерации и итераций дизайна
- Экспорт готового React + Tailwind (или CSS)
- **MCP** — hosted на mcp.wonder.so, Cursor остаётся в синке с канвасом

**Ship in a day:**
- Нарисовать UI демо в Wonder и задеплоить тот React, которым он уже является
- Итерировать лендинг или продуктовый экран с AI на канвасе
- Просить Cursor тянуть/пушить изменения дизайна через MCP
- Не тратить время на перевод Figma → код в однодневном спринте

**Что даёт:** Pro-план каждому участнику. После установки — аутентификация Wonder в настройках MCP (вход через браузер).

### Как подключить

Домены: продукт — **wonder.design** (Aquila Labs, Inc.), приложение — `app.wonder.so`, MCP — `mcp.wonder.so`.

MCP бесплатен на всех планах, включая free. Аутентификация — OAuth через браузер, API-ключей нет. Нужен аккаунт Wonder минимум с одним файлом.

Вариант 1 — официальный плагин (рекомендует дока):
```
/plugin marketplace add aquila-lab/wonder-plugins
/plugin install wonder@wonder
/reload-plugins
```

Вариант 2 — вручную, **из обычного терминала, не из сессии Claude**:
```bash
claude mcp add --transport http wonder https://mcp.wonder.so/mcp
claude mcp list
```

**Флоу авторизации:** открыть в браузере файл-канвас, куда должны идти генерации → в Claude Code отправить промпт (`Generate a purple button in Wonder`) → Claude напечатает URL авторизации → войти в Wonder, подтвердить → **повторить тот же промпт**. Один раз на машину.

MCP работает в обе стороны: агент читает данные дизайна с канваса (реальные данные, не скриншоты) и пишет новые дизайны обратно в реальном времени. Точные имена тулов официально не опубликованы — увидишь после подключения через `/mcp`. Тулы делятся на read-only и write/delete.

#### Воркфлоу на день

1. Аккаунт на app.wonder.so, создать файл-канвас, подключить MCP, пройти OAuth (~20 мин).
2. Задать систему. Если код уже есть:
   > `Read my Tailwind config and create a design in Wonder using my exact colors, typography, and spacing.`

   Ещё лучше — подключить GitHub-репо к файлу Wonder (header файла → GitHub → установить Wonder GitHub App → выбрать репо). Тогда генерации используют реальные компоненты и токены проекта. Первый промпт после подключения медленнее — идёт импорт variables.
3. Итерации по экранам промптами, точечные правки мышью на канвасе.
4. Вытащить код — три пути:
   - **Copy React + Tailwind** прямо из Wonder → вставить в проект. **Для хакатона самый надёжный.**
   - Через MCP: `Use the Wonder MCP to pull my designs and generate the landing page layout` — агент пишет файлы в репо.
   - Через GitHub App: `Export the changes on the Pricing artboard as a pull request against main` — откроет PR в ветке `wonder/*`. В бете, требует чтобы дизайны были импортированы из репо.

**Траблшутинг:** сервер не виден → полный перезапуск агента. Подключён, но агент не пользуется → писать явно «Use the Wonder MCP to …». Поддержка: support@wonder.so.

---

## Локальное окружение (разведка 12.09.2026)

**Что есть:** node v22.22.3 (nvm), npm 10.9.8, npx, uv/uvx, python3, git, gh, docker, curl.
**Чего нет:** `convex`, `bun`, `pnpm`, `jq`, `deno` CLI. Глобальных npm-пакетов кроме corepack/npm нет.

**MCP:** ни одного MCP для x.ai / Firecrawl / Exa / Convex / Render / Wonder не настроено.
Подключены только claude.ai Google Drive / Calendar / Gmail. `plugin:uniswap-cca:cca-supply-schedule` падает при старте — на хакатон не влияет.

**Ключи:** ни одной переменной `XAI_*`, `FIRECRAWL_*`, `EXA_*`, `CONVEX_*`, `RENDER_*` в окружении и шеллах нет. Всё надо получать заново.

**Полезная находка:** маркетплейс `ecc` (github.com/affaan-m/ECC) уже склонирован в `~/.claude/plugins/marketplaces/ecc/`, но плагин выключен. Внутри — готовые скиллы `exa-search`, `deep-research`, `research-ops`, `lead-intelligence` и файл `mcp-configs/mcp-servers.json` с готовыми определениями firecrawl и exa-web-search. Включается:

```bash
claude plugin enable ecc@ecc
```

### Команды подключения MCP

Project-scope создаст `/home/votapil/GrokMarketPulse/.mcp.json`. Для глобальной установки — `--scope user`.

```bash
# Exa — hosted, все 4 тула (список заменяет дефолт)
claude mcp add --transport http exa "https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,agent_run,web_search_advanced_exa"

# Firecrawl — hosted keyless, работает сразу; -oauth даёт полный набор тулов
claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp

# Convex (после `npm i convex` в проекте)
claude mcp add convex --scope project -- npx -y convex@latest mcp start

# Render — через плагин (OAuth) или вручную по API-ключу
claude mcp add --transport http render https://mcp.render.com/mcp \
  --header "Authorization: Bearer <RENDER_API_KEY>"

# Wonder — OAuth через браузер, ключ не нужен
claude mcp add --transport http wonder https://mcp.wonder.so/mcp
```

Плагины (проще, чем ручной MCP): `/plugin install render@claude-plugins-official`,
`/plugin marketplace add aquila-lab/wonder-plugins` + `/plugin install wonder@wonder`.

x.ai официального MCP не имеет — работаем напрямую по REST из кода.

---

## Чек-лист перед стартом

- [ ] Чек-ин на хакатоне (без него не клеймятся кредиты)
- [ ] x.ai: claim → console.x.ai → Billing → Redeem promo code
- [ ] Firecrawl: claim кредитов
- [ ] Exa: claim кредитов
- [ ] Render: claim → dashboard.render.com → Billing → Credit Balance → promo code
- [ ] Wonder: claim Pro + аутентификация MCP через браузер
- [ ] Convex: аккаунт, free tier
- [ ] Все ключи — в `.env.local`, `.env*` в `.gitignore`, ничего в git
