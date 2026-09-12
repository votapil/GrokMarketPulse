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

Ключ лежит в `.env.local` как `XAI_API_KEY` (файл в `.gitignore`, в репозиторий не попадает). Проверен живым вызовом 12.09.2026 — работает.

| Что | Значение |
|---|---|
| Base URL | `https://api.x.ai/v1` |
| Auth | `Authorization: Bearer $XAI_API_KEY` |
| Env | `XAI_API_KEY` |
| Консоль | console.x.ai |

Загрузка ключа в шелле:
```bash
set -a && . ./.env.local && set +a
```

#### Рабочий вызов (проверен)

```bash
curl -s https://api.x.ai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{"model":"grok-4.6","input":"Say OK and nothing else.","max_output_tokens":16}'
```

Ответ — это **не** OpenAI chat completions. Массив `output` содержит два элемента: `type:"reasoning"` (саммари размышлений) и `type:"message"` с текстом. Достать текст:

```
.output[] | select(.type=="message") | .content[0].text
```

В `usage` приходят `reasoning_tokens`, `cached_tokens`, `num_sources_used`, `num_server_side_tools_used` и `cost_in_usd_ticks`.

#### Модели (живой список `GET /v1/models`, 12.09.2026)

| Модель | Контекст | $/M вход | $/M кэш | $/M выход |
|---|---|---|---|---|
| `grok-4.6` | 500 k | 2.00 | 0.50 | 6.00 |
| `grok-4.5` (`grok-build-latest`) | 500 k | 2.00 | 0.30 | 6.00 |
| `grok-4.3` | 1 M | 1.25 | 0.20 | 2.50 |
| `grok-4.20` (reasoning / non-reasoning) | 1 M | 1.25 | 0.20 | 2.50 |
| `grok-4.20-multi-agent` | 1 M | 1.25 | 0.20 | 2.50 |
| `grok-build-0.1` (`grok-code-fast-1`) | 256 k | 1.00 | 0.20 | 2.00 |

Все текстовые модели принимают **text + image** на вход, отдают text.
Генерация картинок и видео — отдельные модели: `grok-imagine-image`, `grok-imagine-image-2.0`, `grok-imagine-image-quality` (`grok-imagine-image-pro`), `grok-imagine-video`, `grok-imagine-video-1.5`.

⚠️ **`long_context_threshold` = 200 000 токенов.** Выше этого порога цена **удваивается** (`*_long_context` поля). Не заливать в контекст сырые скрейпы — фильтровать до отправки.

#### Как считать деньги

Поля цен в API даны в тиках. Формулы **проверены арифметически** на реальном `usage`:

```
$/M токенов        = prompt_text_token_price / 10 000
стоимость вызова $ = usage.cost_in_usd_ticks  / 10 000 000 000
```

Сверка: вызов `grok-4.6` на 130 uncached + 512 cached input + 173 output → расчёт $0.001554, API вернул `cost_in_usd_ticks: 15540000` = $0.001554. Совпало до цента.

**Что это значит для бюджета:** $35 ≈ 22 500 таких вызовов. Кредиты — не узкое место, узкое место это время. Но `grok-4.20-multi-agent` и генерация видео могут съесть бюджет быстро — их без нужды не трогать.

#### Быстрый учёт расхода

Логировать `usage.cost_in_usd_ticks` каждого вызова в таблицу Convex — получится живой счётчик потраченного из $35. **Другого способа нет:** эндпоинта остатка кредитов в API не существует (`/v1/credits`, `/v1/billing`, `/v1/usage`, `/v1/balance` — все 404). Только console.x.ai.

---

### ⚠️ Ловушки бюджета (проверены живыми вызовами)

**1. `max_tokens` / `max_output_tokens` НЕ ограничивают reasoning-токены.** Самая дорогая грабля.

```
Запрос: {"model":"grok-4.6","input":"Is 3571 prime?","max_output_tokens":16}
Факт:   output_tokens=923, из них reasoning_tokens=907
```

Лимит режет только видимый текст. Рассуждения тарифицируются по цене выхода ($6/M) и в лимит не входят. Единственные рычаги — `reasoning_effort` или non-reasoning модель.

**2. `reasoning_tokens` не входят в `completion_tokens`, но оплачиваются.**
`total_tokens = prompt + completion + reasoning`. Кто считает расход по `completion_tokens`, недосчитает в разы.

**3. Полная формула стоимости** (сошлась до тика на десятке независимых вызовов):

```
ticks = (input − cached) × prompt_text_token_price
      + cached          × cached_prompt_text_token_price
      + image_tokens    × prompt_image_token_price
      + (completion + reasoning) × completion_text_token_price
      + N_серверных_тул_коллов × 50 000 000
USD = ticks / 1e10
```

**4. Дефолт `reasoning.effort` у grok-4.6 на `/v1/responses` = `high`.** Дорого по умолчанию — ставь явно.
`effort: "none"` отвергается (400), `"minimal"` — просто алиас `"low"`. Non-reasoning модели наоборот **жёстко отвергают** `reasoning_effort` (400) — придётся ветвиться по модели.

**5. Скрытый системный промпт.** На промпт «hi» grok-4.6 показывает `prompt_tokens = 637`, grok-4.20-non-reasoning — 185. Это нижний порог цены любого вызова. Кэш покрывает часть (гранулярность 512 токенов), но первый вызов в серии платит полностью.

**6. Разброс ×2 на одном и том же запросе.** На grok-4.6 число reasoning-токенов плавает от прогона к прогону (7.6M–15.8M тиков на идентичном промпте). Любой бюджет на reasoning-модель считать с запасом вдвое.

**7. `service_tier: "priority"` = ровно ×2 цены.** `flex` и `standard` скидки **не дают** — молча возвращаются как `default`. Дешёвого тира нет.

**8. Неизвестные параметры молча игнорируются.** `{"totally_bogus_param":123}` → HTTP 200 и списание. Опечатка в имени параметра не упадёт — просто снимет ограничение. Проверяй **эхо в ответе**, а не факт 200.

**9. Пропуск поля `model`** не даёт «missing field» — сервер подставляет `latest` и отвечает «Model not found: latest». Диагностика сбивает с толку.

#### Бесплатное картирование API

Валидация идёт **до аутентификации и до биллинга**, поэтому всю схему можно снять без единого цента:

```
1) парсинг JSON        → 400 plain text
2) десериализация типов → 422 (перечисляет допустимые типы/значения)
3) поиск модели         → 400 JSON "Model not found"
4) аутентификация       → 400 (битый ключ) / 401 (нет заголовка)
5) валидация аргументов → 400 "Argument not supported: X"
6) генерация            → ДЕНЬГИ
```

Приём: шли `"model":"zzz-nope"` вместе с проверяемым полем неверного типа (объект `{"a":1}`).
**422 = поле существует. 400 Model not found = поля нет.**

> ⚠️ **Исключение — эндпоинты генерации.** В `/v1/images/generations` и `/v1/videos/generations` поле `model` **необязательно**: любое валидное тело с непустым `prompt` немедленно запускает платную генерацию. Наши агенты так случайно сожгли 4 картинки и запустили 2 видеозадачи. При картировании этих путей всегда клади заведомо битую `"model":"zzz-nope"`.

---

### Responses API — поверхность (проверено)

| Что | Как на самом деле |
|---|---|
| Текст ответа | `output[]` → элемент `type:"message"` → `content[0].text`. Поля `output_text` в HTTP-ответе **нет** — это хелпер SDK |
| ID ответа | голый UUID **без префикса `resp_`** — regex `^resp_` сломается |
| Конец SSE-потока | `event: response.completed`. Сентинела **`data: [DONE]` нет** — парсеры под OpenAI зависнут |
| `max_tokens` | отвергается явно с подсказкой использовать `max_output_tokens` (это хорошо — ломается громко) |
| `background: true` | **не поддерживается** (400). Асинхронного режима с поллингом нет |
| `store` | по умолчанию **`true`** — промпты и ответы сохраняются на стороне x.ai |
| `instructions` | **не наследуются** через `previous_response_id` — слать в каждом запросе цепочки |
| `reasoning.summary` | мёртвый параметр: мусорное значение молча заменяется дефолтом (но вызов оплачивается) |
| `GET /v1/responses/{id}` | урезанная копия: элемент `reasoning` пропадает, `instructions: null` |
| `DELETE` | не идемпотентен: второй вызов → 404 |

---

### Серверные тулы и поиск — критично для проекта

🔴 **Live Search мёртв.** `search_parameters` и `web_search_options` → **HTTP 410** «Live search is deprecated. Please switch to the Agent Tools API». Все туториалы с `search_parameters` устарели.

🔴 **В `/v1/chat/completions` серверных тулов нет вообще** — только `function`. Поиск живёт исключительно в `/v1/responses`. Если код на chat/completions — придётся переписывать.

Полный enum `tools[].type` (сервер сам перечисляет в тексте 422):
`function`, `web_search`, `x_search`, `image_generation`, `collections_search`, `file_search`, `code_execution`, `code_interpreter`, `mcp`, `shell`, `tool_search`.
Тула `browse` / `browse_page` **не существует** — открытие страницы это действие `open_page` внутри `web_search`, и оно тарифицируется как отдельный тул-колл.

```bash
curl -s https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4.20-0309-non-reasoning",
    "instructions": "Do exactly ONE search. Be brief.",
    "input": [{"role":"user","content":"Что говорят про $TSLA сегодня?"}],
    "tools": [{"type":"x_search",
               "allowed_x_handles":["elonmusk"],
               "from_date":"2026-09-11","to_date":"2026-09-12"}]
  }'
```

**Реальные поля `x_search`** (и больше ничего): `allowed_x_handles`, `excluded_x_handles`, `from_date`, `to_date`, `enable_image_understanding`, `enable_video_understanding`.
Старые фильтры Live Search — `mode`, `limit`, `max_search_results`, `min_favorite_count`, `post_view_count` — **удалены**. Сколько постов забрать, решает сама модель через суб-тул; влиять можно только текстом инструкции.

**Реальные поля `web_search`:** `allowed_domains` / `excluded_domains` (можно на верхнем уровне или внутри `filters`), `user_location{type обязателен, country, city, region, timezone}`, `enable_image_understanding`. **Окна дат у веб-поиска нет** — только у `x_search`.

`tool_choice` принимает только `auto` / `none` / `required`. Направить на **конкретный** серверный тул нельзя (объектная форма → 422). Если объявлены и `web_search`, и `x_search` — выбирает модель.

#### 🔴 Как это парсить (иначе получишь пустой список)

| Тул | Тип элемента в `output[]` |
|---|---|
| `x_search` | **`custom_tool_call`** с `name: "x_keyword_search"` — **не** `x_search_call`! |
| `web_search` | `web_search_call` с `action.sources` |

Счётчики вызовов — в `usage.server_side_tool_usage_details` (`web_search_calls`, `x_search_calls`, …).
`usage.num_sources_used` **всегда 0** — легаси-поле, по нему нельзя понять даже факт поиска.

**Цитаты:** в `output[].content[0].annotations[]` как `{type:"url_citation", url, title, start_index, end_index}`. Верхнеуровневого поля `citations` **нет**. Индексы у reasoning-моделей приходят нулевыми — полагаться только на `url`.

#### 💸 Сколько стоит поиск

**Ровно $0.005 за каждый серверный тул-колл** сверх токенов (50 000 000 тиков, подтверждено дважды независимо на разных моделях, до цента). Поле `search_price: 0` в каталоге моделей — легаси и к реальности отношения не имеет.

Две вещи делают поиск дороже, чем кажется:

1. **Модель сама решает, сколько раз искать.** Параметра `max_tool_calls` в схеме **нет** (молча выбрасывается). Открытый запрос «последние новости xAI» без ограничений сделал **5 тул-коллов**.
2. **Результаты поиска влетают в `input_tokens`** — один открытый веб-запрос дал 29 151 входных токенов против ~1 500 у пустого. Это дороже самих $0.005.

| Рецепт | Факт |
|---|---|
| Открытый `web_search` на grok-4.6, 5 тул-коллов | **$0.078** |
| `x_search` на grok-4.6, 1 поиск | $0.021 |
| `x_search` на grok-4.20-non-reasoning, 2 поиска | $0.008–0.017 |
| `web_search` + `allowed_domains`, 1 поиск, non-reasoning | $0.013 |

**Рецепт экономии:** `grok-4.20-0309-non-reasoning` + `instructions: "Do exactly ONE search"` + `allowed_domains` / `allowed_x_handles`. Выходит в 5–10 раз дешевле открытого поиска на grok-4.6.

---

### OpenAI-совместимость

`openai` SDK работает с `baseURL: "https://api.x.ai/v1"` и `XAI_API_KEY`. Anthropic SDK тоже подключается (заголовок `x-api-key`). Но есть расхождения:

- **`presence_penalty` и `frequency_penalty` не поддерживает ни одна модель** → 400. Если общий OpenAI-клиент всегда шлёт `penalty=0`, все запросы упадут. Вырезать.
- **`stop` не работает на grok-4.6** (400), но работает на grok-4.3 / grok-4.20. Не универсален.
- `logprobs` / `top_logprobs` принимаются, но в ответе **отсутствуют**.
- **Битый ключ отдаёт 400, а не 401** (`{"code":"invalid-argument"}`). Отсутствие заголовка — 401. Код, ловящий `AuthenticationError`, битый ключ пропустит и будет ретраить вечно.
- `/v1/models` отдаёт OpenAI-конверт с ключом `data`, а `/v1/language-models` — с ключом `models`. Поле `context_length` есть **только** в `/v1/models`, а модальности и цены — только в `/v1/language-models`. Нужны оба.
- **Эмбеддингов нет.** `/v1/embedding-models` → `{"models":[]}`. Для RAG нужен другой провайдер.
- В ответе есть нестандартное поле `message.reasoning_content` — в типах SDK его нет.
- Три несовместимых формата ошибок: plain text (400 на битом JSON), plain text 422 у chat/completions, JSON 422 у responses, и `{"code","error"}` у бизнес-логики. Парсер должен уметь все.

### Structured outputs и function calling

Формы **несовместимы** между эндпоинтами:

```jsonc
// /v1/responses — ПЛОСКИЙ tool, parameters обязателен
"tools": [{"type":"function","name":"get_quote","parameters":{...}}]
"text": {"format":{"type":"json_schema","name":"pulse","schema":{...},"strict":true}}

// /v1/chat/completions — ВЛОЖЕННЫЙ
"tools": [{"type":"function","function":{"name":"get_quote","parameters":{...}}}]
"response_format": {"type":"json_schema","json_schema":{"name":"pulse","schema":{...}}}
```

- **`strict` и `additionalProperties: false` на практике no-op** — схема без них всё равно соблюдается, включая `enum`. Доки требуют их, API — нет.
- В `/v1/responses` у вызова функции **два id**: `id` (`fc_…`) и `call_id` (`call-…`). Обратно в `function_call_output` класть **`call_id`**, иначе 422.
- `arguments` приходят **строкой** на обоих эндпоинтах — `json.loads`.
- Опечатка в `tool_choice` молча превращается в `auto` — принудительный вызов тихо отключится.
- Принуждение к конкретной функции заставляет модель **галлюцинировать аргументы** (на «hello there» вызвала `get_quote({"ticker":"AAPL"})`). Форсировать только когда данные во входе точно есть.
- Схема подмешивается в промпт: +35–45 input-токенов на каждый вызов.

### Vision и генерация картинок

🔴 Формат картинки **несовместим** между эндпоинтами:

```jsonc
// chat/completions: type="image_url", значение — ОБЪЕКТ
{"type":"image_url","image_url":{"url":"data:image/png;base64,..."}}
// responses: type="input_image", значение — СТРОКА
{"type":"input_image","image_url":"data:image/png;base64,..."}
```

Перепутанный тип даёт невнятное 400 «Empty content block».

- **`detail` меняет цену вчетверо:** тот же 1024×1024 PNG → `high` = 1026 image_tokens, `low` = 258.
- Формула: `image_tokens = ceil(w/32) × ceil(h/32) + 2` (после ресайза по `detail`; `low` режет длинную сторону до 512).
- Разбивку `image_tokens` отдаёт **только** `/v1/chat/completions`. В `/v1/responses` картинка растворена в `input_tokens`.
- Лимиты: минимум **8×8 px** (классический 1×1 base64-пиксель отвергается), максимум ~179M пикселей.
- MIME в data URI **игнорируется** — тип определяется по сигнатуре байтов.
- Цены генерации: `grok-imagine-image` $0.02 · `grok-imagine-image-2.0` матрица $0.04–$0.08 (дефолт **$0.06**, доки врут про $0.04) · параметр `size` не поддерживается, размер задаётся `aspect_ratio` + `resolution` (`1k`|`2k`).
- 🔴 **Видео дорогое и его цены нет в каталоге API.** Замер живьём: `grok-imagine-video`, 8 секунд → `cost_in_usd_ticks: 4000000000` = **$0.40 за ролик**. Это 1.1% всего бюджета за одну генерацию. Статус берётся из `GET /v1/videos/{id}` (202 `pending` с `progress`, затем 200 `done` с URL).

### Voice — доступен, waitlist не нужен

✅ **Голос работает по нашему обычному Console API key.** Никакого отдельного доступа. Можно строить демо вокруг голоса.

- **Realtime:** `wss://api.x.ai/v1/realtime?voice=<id>` — WebSocket, подключение подтверждено живьём.
  События дельт: **`response.output_audio.delta`** и `response.output_audio_transcript.delta`. Код из примеров OpenAI, ждущий `response.audio.delta`, получит тишину.
- **Голоса:** принимается весь каталог из 28 (`/v1/tts/voices`). ⚠️ Неизвестный голос **не даёт ошибки**, а молча подменяется на `human_eve` — при том что дефолт без параметра `xai_ara`. Опечатка даст демо чужим голосом без предупреждения.
- 🔴 **Ephemeral-токенов для браузера нет:** `/v1/realtime/sessions` → 403. Ключ придётся держать на сервере и проксировать WS. Прямое подключение из фронтенда засветит ключ.
- **`/v1/tts`** — MP3 24 kHz; поля `text` и `language` обязательны (`language` не валидируется). **`/v1/stt`** — модель ровно `grok-stt`, отдаёт пословные таймкоды по умолчанию. Есть и потоковые WS-версии: `wss://api.x.ai/v1/tts`, `wss://api.x.ai/v1/stt`.

**Цены:** realtime **$0.08/мин** ($4.80/час — час открытой сессии съест 14% всех $35) · TTS $15/1M символов · STT $0.10/час.

💡 **Схема «STT → текстовый Grok → TTS» в разы дешевле** realtime speech-to-speech и даёт полный контроль над промптом. Realtime брать только если нужна именно живая перебивка.

### Лимиты и эксплуатация

- **Rate limits помодельные, не на аккаунт:** grok-4.6 → 50M TPM / 7200 RPM; grok-4.20-non-reasoning → 10M TPM / 1800 RPM. На хакатоне не упрёмся.
- Заголовки `x-ratelimit-*` приходят **только на успешных** `chat/completions` — на ошибках и на `/v1/models` их нет. Заголовка `x-ratelimit-reset` **не существует**.
- Полезные заголовки для замера латентности без своего таймера: `x-metrics-ttft-ms`, `x-metrics-mean-itl-ms`, `x-metrics-e2e-ms`.
- **Batch API:** `POST /v1/batches` с телом `{"name":"t"}` **сразу создаёт батч**, dry-run нет. Удалить нельзя (`DELETE` → 405), висит 30 дней.
- Deferred-поллинг живёт по пути `/v1/chat/deferred-completion/{id}` (без `chat` — 404) и отдаёт **202 с пустым телом**.
- Prompt caching включается сам, гранулярность 512 токенов, `prompt_cache_key` не нужен. Хвост короче 512 токенов не кэшируется.
- Бесплатный токенайзер: `POST /v1/tokenize-text` — оценка стоимости до вызова. ⚠️ У grok-4.6/4.5 и grok-4.3/4.20 **разные токенизаторы** (расхождение 1.5%), вызывать с той же моделью.

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

Версии на 12.09.2026: `convex@1.45.0`, `create-convex@0.0.47`.
**Лайфхак:** любая страница `docs.convex.dev` + `.md` → чистый markdown. Индекс: `docs.convex.dev/llms.txt`.

#### 🔴 Ловушка №1 — сигнатура `ctx.db` изменилась в convex 1.31.0

Имя таблицы теперь **первым аргументом**:

```ts
await ctx.db.get("tasks", id)              // не ctx.db.get(id)
await ctx.db.patch("tasks", id, { tag })   // не ctx.db.patch(id, {...})
await ctx.db.replace("tasks", id, {...})
await ctx.db.delete("tasks", id)
```

Старая односоставная форма ещё работает, но **каждый туториал до 2026 года и память любой модели используют её**. Это то, что собьёт команду номер один. Миграция: ESLint-правило `@convex-dev/explicit-table-ids` (с автофиксом).

#### Первые 30 секунд, которые окупаются

```bash
npm create convex@latest grok-market-pulse -- -t react-vite-shadcn
cd grok-market-pulse
npx convex ai-files install     # ← ставит правила для AI-кодинга
npx convex env set XAI_API_KEY xai-...
```

`npx convex ai-files install` кладёт `convex/_generated/ai/guidelines.md` и управляемые секции в `AGENTS.md` / `CLAUDE.md`. Правила кодируют ровно то, что модели врут по памяти: index-vs-filter, «не `.collect()`», размещение `"use node"`, `db.get` с именем таблицы первым, «никаких часов в query», проброс `paginationOptsValidator`.

Шаблоны: `bare`, `react-vite[-shadcn|-clerk|-convexauth]`, `nextjs[-shadcn|-clerk]`, `tanstack-start`, `component`. **AI/agent-шаблона нет.**

#### Env-переменные

Функции **не читают `.env`** — только через CLI:

```bash
npx convex env set XAI_API_KEY sk-...      # без значения — интерактивно, без следа в history
npx convex env set --from-file .env.convex # bulk
npx convex env list
npx convex env set --prod NAME 'value'
```

Имя переменной фронта CLI выводит из `package.json`: vite → `VITE_CONVEX_URL`, next → `NEXT_PUBLIC_CONVEX_URL`.

#### Actions и внешние API (xAI / Firecrawl / Exa)

**`"use node"` НЕ нужен для `fetch`** — дефолтный V8-рантайм имеет `fetch`, Web Crypto и браузерные глобалы, без cold start. `"use node"` нужен только для Node-встроенных (`fs`, `node:crypto`) или пакетов, которые их требуют; цена — cold start, 10 мин вместо 30, файл может содержать только actions.

```ts
export const fetchPulse = internalAction({
  args: { ticker: v.string() },
  handler: async (ctx, { ticker }) => {
    const r = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json",
                 Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({ model: "grok-4.3", input: `Sentiment for ${ticker}` }),
    });
    const d = await r.json();
    await ctx.runMutation(internal.pulse.save, { ticker, raw: d });
  },
});
```

- **`ctx.db` в actions нет.** Доступны: `runQuery`, `runMutation`, `runAction`, `auth`, `storage`, `scheduler`, `vectorSearch`.
- Минимизируй число `runQuery`/`runMutation` — каждый вызов отдельная транзакция, дробление порождает гонки.
- Циклический вывод типов → аннотируй: `async (ctx): Promise<null> =>`.

#### Схема, индексы, запросы

```ts
export default defineSchema({
  pulses: defineTable({
    ticker: v.string(), sentiment: v.string(), score: v.number(),
  })
    .index("by_ticker", ["ticker"])
    .index("by_ticker_and_score", ["ticker", "score"])
    .searchIndex("search_summary", { searchField: "summary", filterFields: ["ticker"] }),
});
```

- `_id` и `_creationTime` добавляются сами; `_creationTime` неявно дописывается последней колонкой в каждый индекс.
- **`withIndex` обязателен явно** — неявного выбора индекса нет. `.filter()` работает **после** скана и не уменьшает число прочитанных строк.
- **Операции COUNT нет.** Никогда `.collect().length` — денормализованный счётчик или `@convex-dev/aggregate`.
- 🔴 **Не читай часы внутри query** — queries не перезапускаются по времени, `Date.now()` протухает и убивает кэш. Передавай время аргументом.
- 🔴 `npx convex deploy` **удаляет индексы, которых нет в схеме**.
- Валидаторы `args`/`returns` обязательны у всех функций, включая internal — это рантайм-валидация, типы TS в рантайме не существуют.

#### Real-time в React

```tsx
const pulses = useQuery(api.pulse.list);                        // undefined пока грузится; живой
const gated  = useQuery(api.pulse.byId, id ? { id } : "skip");  // "skip" — не ходить на бэк
const send   = useMutation(api.pulse.send);
const run    = useAction(api.pulse.refresh);
const { results, status, loadMore } = usePaginatedQuery(api.pulse.list, {}, { initialNumItems: 5 });
```

Подписываться не нужно — Convex трекает read-set каждого запроса и пушит инвалидацию. Все подписки клиента обновляются на **одном снапшоте БД**, приложение внутренне консистентно. **Это и есть главный дифференциатор Convex** — не компоненты.

#### Cron и scheduler

```ts
// convex/crons.ts
const crons = cronJobs();
crons.interval("pulse", { minutes: 5 }, internal.pulse.fetchAll, {});
crons.cron("nightly", "23 4 * * *", internal.reports.build, {});   // UTC
export default crons;
```

3-й аргумент — FunctionReference на mutation или action (импортировать `internal` даже для функций из самого `crons.ts`). Одновременно выполняется не более одного запуска джобы, наложения пропускаются.

```ts
await ctx.scheduler.runAfter(0, internal.pulse.fetch, args);  // канонический паттерн:
                                                              // side-effect action после коммита мутации
```

Из mutation планирование атомарно с транзакцией (упала мутация → ничего не запланировано). Из action — сработает независимо.

#### MCP

Актуальный путь — плагин (MCP + хуки + скиллы):
```
/plugin install convex@claude-plugins-official
```

Либо вручную:
```bash
claude mcp add-json convex '{"type":"stdio","command":"npx","args":["convex","mcp","start"]}'
```

12 тулов: `status` (вызывать первым), `tables`, `data`, `runOneoffQuery` (read-only песочница по данным), `functionSpec`, `run`, `logs`, `insights` (OCC-конфликты за 72 ч), `envList/Get/Set/Remove`. Прод заблокирован по умолчанию.

#### Деплой

```bash
npx convex deploy --cmd 'npm run build'
```

Порядок: выполнить `--cmd` → тайпчек → регенерация `_generated` → бандл → пуш функций, индексов, схемы. Переменная фронта инжектится автоматически, `--cmd-url-env-var-name` для нормального Vite/Next **не нужен**.

`CONVEX_DEPLOY_KEY`: настройки деплоймента → Deploy keys → Generate, **включить permission `deployment:deploy`**.
⚠️ Официального гайда по Render у Convex нет (страница 404), но generic-инструкция `/production/hosting/custom` работает — см. раздел Render выше.

#### Free tier

| | Free |
|---|---|
| **Деплойментов на команду** | **40** ← реальное ограничение |
| Вызовов функций | 1 000 000 / мес |
| Action compute | 20 GB-часов / мес |
| БД: хранение / I/O | 0.5 GB / 1 GB в мес |
| Файлы | 1 GB / 1 GB egress |

Жёсткие лимиты на всех планах: документ 1 MiB · query и mutation user-code **1 с** · Convex-action 30 мин · Node-action 10 мин · args/returns 16 MiB · транзакция 16 MiB чтения / 32 000 просмотренных документов.

На Free доступны preview-деплойменты, vector + text search, crons, файлы, Node actions, insights.

#### ⚠️ Компоненты Convex — вердикт на один день

**Слой компонентов не нужен вообще, если** приложение это «LLM-вызов → сохранить → отрендерить». Один `action` с `fetch` + один `internalMutation` + реактивный `useQuery` дают почти-стриминговый UX без единой новой зависимости.

**`@convex-dev/agent` брать только если демо — персистентный многоходовый чат со стримингом токенов.** Он реально снимает работу (персист сообщений, треды, восстановление после перезагрузки, фан-аут стрима), но закладывай **45–90 минут** на первый рабочий стрим: там матрица `ai@^7` / `@ai-sdk/provider@^4` / Node 22 и дрейф API. Делать в первый час, не в восемнадцатый.

🔴 Всё про Agent, написанное до середины 2026, не скомпилируется: `languageModel` (не `chat`), `instructions` (не `system`), `stopWhen: stepCountIs(n)` (не `maxSteps`), `useUIMessages`. Страница `/agents/overview` в доках содержит **нерабочий пример** — смотри `/agents/getting-started`.

**Дёшево и полезно:** `@convex-dev/rate-limiter` (~10 мин, спасает ключ на публичном демо), `@convex-dev/action-cache` (~5 мин, повторные прогоны демо мгновенны и бесплатны).

**Пропустить:** `workflow`, `persistent-text-streaming`, `workpool`, `rag`.

🚩 **AI Gateway (`@convex-dev/ai-sdk-provider`) на Free-плане выключен** — `AiGatewayDisabled`. Просто `npx convex env set XAI_API_KEY` и `fetch` из action.
🔴 **Convex Chef депрекейтнут**, преемника нет.

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

## Состояние бюджета x.ai

Разведка живого API (16 агентов) израсходовала примерно **$1.0–1.1 из $35**:

| Статья | Сумма |
|---|---|
| 2 видеогенерации по 8 сек (случайно, `model` необязателен) | $0.80 |
| 4 картинки (случайно, там же) | $0.08 |
| ~90 платных текстовых вызовов | ~$0.15 |
| ~250 запросов 400/410/422 для картирования схемы | $0 |

Осталось ≈ **$34**. Побочный мусор: 5 пустых батчей в `/v1/batches` (сами себя отменили, `num_requests: 0`, денег не тратят, но удалить нельзя — висят 30 дней).

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
