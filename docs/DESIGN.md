# DESIGN.md — визуальный язык GrokMarketPulse

**Файл Wonder (один на команду):** [GrokMarketPulse](https://app.wonder.so/votapil/files/01a09523-7468-73ca-9838-1f163930bf0d/branches/main/pages/01a09523-7469-7d1a-93cb-ca004af7f12e) — орг. `votapil`, `fileId` `01a09523-7468-73ca-9838-1f163930bf0d`, `pageId` `01a09523-7469-7d1a-93cb-ca004af7f12e`, ветка `main`.

> Прежний канвас `nikita-volker` / «Market Pulse» (`01a09579-…`) **deprecated** — не открывать второй файл. Rename в Wonder: **GrokMarketPulse**. GitHub App → `votapil/GrokMarketPulse`. Артборды B (Shell / Artifact / Sources / Landing) и блоки A (`Block/*`, `Panel/Chat`) живут на **этом** канвасе.

Скриншоты — артборды на канвасе (зум Fit). Ниже — id корней и что на них видно.

---

## Артборды (дорожка B)

| Канвас | `data-node-id` | Роль в демо |
|---|---|---|
| **Page - Shell** | `and` | Pulse `/`, кадр 0:00–0:10: три панели, шапка, **одна** кнопка Run Scan, слоты под блоки A |
| **Page - Artifact** | `any` | `/artifact/:id`: battlecard + offer слева, landing preview в безеле |
| **Page - Sources** | `hop` | `/sources`: предзаполненный watchlist + тумблер Simulate competitor edit |
| **Page - Landing** | `iii` | Финальный кадр демо: сгенерированная страница Helpdesk AI. Самый проработанный |
| **State Loading Skeleton** | `kit` | Общий loading: шаги скана, не спиннер |
| **State Empty Workspace** | `eve` | Общий empty: No signals yet → Run Scan |
| **State Error Scan Failed** | `bud` | Общий error: Scan did not finish → Retry scan |

Артборды `Block/*` и `Panel/Chat` рисует дорожка A в T-37 на **этом же файле**. Токены не переопределять.

---

## Сцена и стиль

Регистр: **ясность** (product dashboard), не маркетинг.

Сцена: **панель ночного борта** (industrial / vehicle dashboard). Шасси — графитовый пластик `#1a1f24`, один emergency-stop акцент `#ff4757`, цены и статусы — как приборные цифры (JetBrains Mono), caution-LED янтарный `#f5a524`.

Не использовать: Inter, фиолетовый «AI SaaS», кислотный терминал, cream×terracotta.

Landing (артефакт для клиента) инвертирует землю на `palette/paper` × `palette/ink` — это «экран прибора», не второй продукт.

---

## Токены

Слои: primitive `palette/*` → semantic `color/*` и `severity/*` (alias). В коде — `cssVar` как есть (`bg-[var(--color-bg)]`), никогда `var(--color/bg)`.

### Primitive — цвет

| Token | cssVar | Hex | Объект сцены |
|---|---|---|---|
| `palette/chassis` | `--palette-chassis` | `#1a1f24` | корпус панели |
| `palette/panel` | `--palette-panel` | `#242b32` | приподнятая плашка |
| `palette/recessed` | `--palette-recessed` | `#12161a` | колодец / фид |
| `palette/text` | `--palette-text` | `#e8eef2` | приборный белый |
| `palette/muted` | `--palette-muted` | `#a8b2c1` | подписи |
| `palette/accent` | `--palette-accent` | `#ff4757` | emergency stop / Run Scan |
| `palette/amber` | `--palette-amber` | `#f5a524` | caution LED |
| `palette/info` | `--palette-info` | `#7eb6ff` | info LED |
| `palette/ok` | `--palette-ok` | `#2ed573` | system operational |
| `palette/border` | `--palette-border` | `#3a4450` | кромка панели |
| `palette/critical` | `--palette-critical` | `#ff2d55` | critical LED (ярче accent) |
| `palette/paper` | `--palette-paper` | `#e0e5ec` | бумага лендинга |
| `palette/ink` | `--palette-ink` | `#2d3436` | чернила лендинга |

### Semantic — цвет (alias)

| Token | cssVar | aliasOf |
|---|---|---|
| `color/bg` | `--color-bg` | palette/chassis |
| `color/surface` | `--color-surface` | palette/panel |
| `color/text` | `--color-text` | palette/text |
| `color/text-muted` | `--color-text-muted` | palette/muted |
| `color/accent` | `--color-accent` | palette/accent |
| `color/border` | `--color-border` | palette/border |

### Severity (читается на тёмном фоне, текст ≥ 4.5:1 к `#1a1f24`)

| Уровень | Token | Hex | Как рисовать |
|---|---|---|---|
| low | `severity/low` → info | `#7eb6ff` | холодный LED, без glow |
| medium | `severity/medium` → amber | `#f5a524` | caution LED |
| high | `severity/high` → accent | `#ff4757` | stop, без glow |
| critical | `severity/critical` | `#ff2d55` | stop + `shadow-[0_0_10px_2px_rgba(255,45,85,0.6)]` |

Белый `#ffffff` на кнопке accent — единственный текст на насыщенном красном. Severity-цвет **не** класть мелким текстом на `surface` без LED-точки рядом: точка несёт цвет, подпись остаётся `--color-text`.

Контраст к `#1a1f24` (WCAG 2.2 AA, текст ≥ 4.5:1; large 18px/700 ≥ 3:1):

| Пара | ~ratio | Роль |
|---|---|---|
| `#e8eef2` на `#1a1f24` | 14.6:1 | body / titles |
| `#a8b2c1` на `#1a1f24` | 8.0:1 | muted captions |
| `#7eb6ff` на `#1a1f24` | 8.0:1 | low LED + label |
| `#f5a524` на `#1a1f24` | 8.6:1 | medium LED + label |
| `#ff4757` на `#1a1f24` | 4.4:1 | high — **только LED**, не body < 18px |
| `#ff2d55` на `#1a1f24` | 4.3:1 | critical — LED + glow, не body |
| `#ffffff` на `#ff4757` | 3.9:1 | CTA **Run Scan** / **Lock Pro at $45** — `text-[18px]` + `weight/bold` (large text, порог 3:1) |
| `#2d3436` на `#e0e5ec` | 10.5:1 | landing body |

### Шрифты

| Token | cssVar | Значение | Роль |
|---|---|---|---|
| `font/sans` | `--font-sans` | IBM Plex Sans | UI, заголовки |
| `font/mono` | `--font-mono` | JetBrains Mono | цены, URL, мета, severity-лейблы |
| `weight/regular` | `--weight-regular` | 400 | body |
| `weight/medium` | `--weight-medium` | 500 | ряды, нав |
| `weight/bold` | `--weight-bold` | 700 | кнопки, активный нав |
| `weight/black` | `--weight-black` | 800 | «Your competitor moved.», цена DiffView |

Привязка: `font-[family-name:var(--font-sans)]`, `font-[number:var(--weight-bold)]`. Голый `font-[var(--font-sans)]` не биндится.

Шкала (dashboard, tight): caption 11–13px mono · body 14–15px · title 18–20px · display 32px (Shell) / 56px (Landing). Ниже 11px нет.

### Spacing / radius / layout

| Token | cssVar | px |
|---|---|---|
| `space/1` … `space/8` | `--space-1` … `--space-8` | 4 / 8 / 12 / 16 / 24 / 32 |
| `radius/sm` | `--radius-sm` | 4 (бейджи) |
| `radius/md` | `--radius-md` | 8 (кнопки, ряды) |
| `radius/lg` | `--radius-lg` | 16 (безель preview) |
| `size/header` | `--size-header` | 56 |
| `size/feed` | `--size-feed` | 280 |

Шапка `h-[56px]`. Фид слева `w-[280px]`. Правая панель `w-[320px]`. Ритм gap 8–16px.

---

## Скелетоны

Не спиннер в пустоте. Шаги скана зажигаются по одному (артборд `kit`):

1. `Firecrawl: fetching pricing page` — зелёный LED (идёт / готов)
2. `Diffing snapshots` — янтарный LED
3. `Grok: filtering noise` — тусклый LED, ещё не начат

Плейсхолдеры блоков — dashed `border-[var(--color-border)]`, подпись mono uppercase. На Shell в слоте DiffView уже стоит призрак `$49 → $39` muted: судья видит обещание кадра 0:35, A в T-37 красит его в приборный белый / accent.

---

## Три состояния по экранам

Примитивы — артборды `kit` / `eve` / `bud`. T-05 кладёт их в `src/components/state/` (`Skeleton`, `EmptyState`, `ErrorState`).

| Экран | loading | empty | error |
|---|---|---|---|
| **Shell / Pulse** | `kit`: шаги скана в центре, фид не прыгает | `eve`: «No signals yet» + Run Scan | `bud`: 402/timeout Firecrawl + Retry scan |
| **Artifact** | скелетон безеля (те же полоски, что `kit`) | empty: «Generate an artifact from a recommendation» + ссылка на Pulse | error: «Grok did not return JSON» + Retry |
| **Sources** | 2 skeleton-ряда списка | empty не в демо (воркспейс предзаполнен); если случится — «Add a page to watch» | error: URL не открылся, `metadata.statusCode` + Retry |
| **Landing** (превью) | бумага в безеле без текста, CTA-плейсхолдер | не рисуем пустой лендинг — слот «preview after Generate» | та же `bud` внутри безеля: «Preview failed» |

Копирайт empty/error конкретный, без «Oops» и без кодов в одиночку.

---

## Правила вёрстки для T-05

- Три роута, нав **в шапке**, без бокового меню. Активный пункт — `weight/bold` + `--color-text`, остальные muted.
- Pulse: `grid`/`flex` колонки feed 280 / workspace `flex-1` / action 320. Никакого hamburger.
- Единственная saturated CTA на экране — **Run Scan** (и Generate на Artifact, тот же accent).
- DiffView «Before → After» — самый крупный текст на Pulse (mono black 48px+). Сейчас слот; после T-37 — живые `$49 → $39`.
- Иконки: `lucide-react` (`LuScanLine`, `LuActivity`, …), не emoji.
- `ConvexProvider` + шапка с «Helpdesk AI · Pro $45 · SMB».

---

## Аудит артбордов

- Pass: Page - Shell — три панели, ценность с первой строки, одна CTA.
- Pass: Page - Artifact — battlecard читается, лендинг в безеле отделён от chrome.
- Pass: Page - Sources — тумблер в шапке, v2 live на прайсинге.
- Pass: Page - Landing — headline несёт демо, таблица Us vs AcmeFlow, CTA одна фраза везде: **Lock Pro at $45**.
- Pass: State Loading / Empty / Error — конкретный next action.
