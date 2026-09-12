# DESIGN-BLOCKS.md — артборды блоков GrokMarketPulse (дорожка A · T-37)

**Wonder (единственный канвас команды):** [GrokMarketPulse](https://app.wonder.so/votapil/files/01a09523-7468-73ca-9838-1f163930bf0d/branches/main/pages/01a09523-7469-7d1a-93cb-ca004af7f12e) — орг. `votapil`, `fileId` `01a09523-7468-73ca-9838-1f163930bf0d`, `pageId` `01a09523-7469-7d1a-93cb-ca004af7f12e`, ветка `main`.

> Это **единственный** файл Wonder для A и B. Не открывать и не ссылаться как на primary на прежний `nikita-volker` / «Market Pulse» (`01a09579-…`) — deprecated. Токены **не переопределять** — канон в [`docs/DESIGN.md`](./DESIGN.md).

> **Токены привязаны и на канвасе тоже.** Блоки дорожки A ссылаются на `var(--…)` вместо хекс-литералов и имён шрифтов, поэтому `get_element_code` отдаёт вставляемый код — его можно копировать в React как есть, без ручного перевода литералов в токены.

> Дорожка B не трогает артборды `Block/*` и `Panel/Chat`. Дорожка A не редактирует `Shell` / `Artifact` / `Landing` / `Sources` / State-*.

---

## Когда открывать Wonder

- Только для поверхностей, **которых ещё нет в коде**. Уже свёрстанные блоки заморожены — их не перерисовывают на канвасе, правки идут в `src/components/blocks/`.
- Состояния блоков (`loading` / `empty` / `error`) на канвасе **не рисуются**: они живут в `src/components/blocks/registry.tsx`. На канвасе только **ready**.
- Идентификаторы артбордов здесь намеренно не записаны — они протухают при каждом касании канваса. Артборд ищется по label: Block Signal Card, Block Diff View, Block Evidence Card, Block Metric Cards, Block Recommendation Cards, Panel Chat.

Геометрия ready-блоков: Signal `280×109` · Diff `720×220` · Evidence `480×156` · Metric `360×160` · Rec `320×817` · Chat `320×427`.

**Локальных PNG в репо нет** — Wonder MCP отдаёт кадр в чат, не файл. Чтобы посмотреть: открыть [GrokMarketPulse](https://app.wonder.so/votapil/files/01a09523-7468-73ca-9838-1f163930bf0d/branches/main/pages/01a09523-7469-7d1a-93cb-ca004af7f12e) и зумить к нужному блоку по его label.

На каждом блоке в продукте нужны четыре состояния: `loading` · `empty` · `error` · `ready` — см. таблицу «Общие правила состояний».

---

## Артборды ↔ слоты Shell

| Артборд | Роль в демо | Слот на Shell |
|---|---|---|
| `Block/SignalCard` | Карточка сигнала в левом фиде (0:35) | Feed 280px |
| `Block/DiffView` | **Before → After** — главный кадр (0:35) | Workspace center |
| `Block/EvidenceCard` | Доказательство: URL, timestamp, фрагмент | Workspace center |
| `Block/MetricCards` | Threat, score, confidence, price delta | Workspace center |
| `Block/RecommendationCards` | Три рекомендации с Generate | Action panel 320px |
| `Panel/Chat` | Grok-объяснение: Fact / Evidence / AI analysis | Action panel 320px |

---

## Токены (только из DESIGN.md)

Использовать `cssVar` как есть: `bg-[var(--color-bg)]`, **никогда** `var(--color/bg)`.

### Primitive — цвет

| Token | cssVar | Hex |
|---|---|---|
| `palette/chassis` | `--palette-chassis` | `#1a1f24` |
| `palette/panel` | `--palette-panel` | `#242b32` |
| `palette/recessed` | `--palette-recessed` | `#12161a` |
| `palette/text` | `--palette-text` | `#e8eef2` |
| `palette/muted` | `--palette-muted` | `#a8b2c1` |
| `palette/accent` | `--palette-accent` | `#ff4757` |
| `palette/amber` | `--palette-amber` | `#f5a524` |
| `palette/info` | `--palette-info` | `#7eb6ff` |
| `palette/ok` | `--palette-ok` | `#2ed573` |
| `palette/border` | `--palette-border` | `#3a4450` |
| `palette/critical` | `--palette-critical` | `#ff2d55` |

### Semantic — цвет

| Token | cssVar | aliasOf |
|---|---|---|
| `color/bg` | `--color-bg` | `palette/chassis` |
| `color/surface` | `--color-surface` | `palette/panel` |
| `color/text` | `--color-text` | `palette/text` |
| `color/text-muted` | `--color-text-muted` | `palette/muted` |
| `color/accent` | `--color-accent` | `palette/accent` |
| `color/border` | `--color-border` | `palette/border` |

### Severity

| Уровень | Token | Hex | Рисование |
|---|---|---|---|
| low | `severity/low` → info | `#7eb6ff` | холодный LED, **без glow** |
| medium | `severity/medium` → amber | `#f5a524` | caution LED |
| high | `severity/high` → accent | `#ff4757` | stop, **без glow** |
| critical | `severity/critical` | `#ff2d55` | stop + `shadow-[0_0_10px_2px_rgba(255,45,85,0.6)]` |

**Правило severity:** цвет несёт **LED-точка** (8×8px, `rounded-full`), подпись — `--color-text`. Severity-цвет **не** класть мелким body-текстом на `color/surface` без точки. На `#ff4757` / `#ff2d55` body < 18px не использовать.

### Типографика

| Token | cssVar | Значение |
|---|---|---|
| `font/sans` | `--font-sans` | IBM Plex Sans |
| `font/mono` | `--font-mono` | JetBrains Mono |
| `weight/regular` | `--weight-regular` | 400 |
| `weight/medium` | `--weight-medium` | 500 |
| `weight/bold` | `--weight-bold` | 700 |
| `weight/black` | `--weight-black` | 800 |

Шкала: caption 11–13px mono · body 14–15px · title 18–20px · **DiffView display 48px+** mono black.

Привязка: `font-[family-name:var(--font-sans)]`, `font-[number:var(--weight-bold)]`.

### Spacing / radius / layout

| Token | cssVar | px |
|---|---|---|
| `space/1` … `space/8` | `--space-1` … `--space-8` | 4 / 8 / 12 / 16 / 24 / 32 |
| `radius/sm` | `--radius-sm` | 4 |
| `radius/md` | `--radius-md` | 8 |
| `radius/lg` | `--radius-lg` | 16 |
| `size/header` | `--size-header` | 56 |
| `size/feed` | `--size-feed` | 280 |

Shell: feed `w-[280px]`, action panel `w-[320px]`, gap `space/2`–`space/4` (8–16px).

---

## Fact / Evidence / AI analysis (ТЗ §33)

Три зоны **не смешиваются** — судья различает их без чтения подписей.

| Зона | Смысл | Фон | Кромка | Тип | Маркер |
|---|---|---|---|---|---|
| **Fact** | Что изменилось (diff, цены, факты скана) | `color/surface` (`#242b32`) | solid `color/border` 1px | `--font-mono`, `--color-text` | Нет glow, нет dashed |
| **Evidence** | Откуда (URL, провайдер, timestamp, фрагмент) | `palette/recessed` (`#12161a`) | solid `color/border` 1px | `--font-mono`, URL `--palette-info` | Бейдж провайдера (`Firecrawl` / `Exa` / `fixture`) |
| **AI analysis** | Вывод модели, не факт | `color/surface` | **dashed** `color/border` 1px | `--font-sans` body, заголовок mono uppercase 11px | LED `--palette-info` + подпись «AI ANALYSIS»; disclaimer muted «Model inference — verify against evidence» |

**DiffView** = зона Fact. **EvidenceCard** = зона Evidence. **Panel/Chat** (верхняя секция assessment) = три stacked-секции Fact → Evidence → AI analysis с визуальными правилами таблицы.

---

## DiffView — размер «Before → After»

- **Самый крупный текст на экране Pulse** — крупнее title блоков, title Shell, метрик.
- Размер: **48px minimum**, `font-[family-name:var(--font-mono)]`, `font-[number:var(--weight-black)]` (800).
- Цвет: before `--color-text-muted`, стрелка `→` `--color-text-muted`, after `--color-text`; дельта `−20%` — `--palette-accent` только если high severity, иначе `--color-text`.
- Направление читается **без цвета**: стрелка `→` + знак `−` / `+`.
- Под diff-ценой — построчный fragment diff (added `--palette/ok`, removed `--palette/accent`), не весь markdown.

Пример ready (совпадает с канвасом, Block Diff View): `Pro $49/mo` → `Pro $39/mo` · `−20%`.

---

## Общие правила состояний (все блоки)

Не спиннер в пустоте. Паттерн из артбордов `State Loading Skeleton` / `State Empty Workspace` / `State Error Scan Failed` (дорожка B).

| Состояние | Визуал | Копирайт (конкретный, без «Oops») |
|---|---|---|
| **loading** | Dashed `border-[var(--color-border)]`, skeleton-полоски `bg-[var(--palette-border)]` animate-pulse; для DiffView — призрак `$49 → $39` muted | Block-specific step label mono uppercase |
| **empty** | Тот же dashed контейнер, иконка `lucide-react` muted | Block-specific next action |
| **error** | Solid border `palette/accent`, фон `color/surface` | Причина + кнопка Retry (outline, не второй saturated CTA) |
| **ready** | Полные данные по спецификации блока | — |

---

## Block/SignalCard · T-09

**Ready** `280×109`, сверен со скрином: competitor name (title 18px sans bold), signal type mono caption, severity LED + label, relative time mono muted, selected — left border 3px `color/accent`.

| Состояние | Содержимое |
|---|---|
| loading | 3 skeleton-ряда в dashed card |
| empty | «No signals yet» + hint «Run Scan to watch competitors» |
| error | «Could not load signals» + Retry |
| ready | AcmeFlow · Price change · High · 2m ago |

### React+Tailwind (ready) — эталон для кода

```tsx
<article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] border-l-[3px] border-l-[var(--color-accent)]">
  <div className="flex items-start justify-between gap-[var(--space-2)]">
    <h3 className="font-[family-name:var(--font-sans)] text-[18px] font-[number:var(--weight-bold)] text-[var(--color-text)]">
      AcmeFlow
    </h3>
    <time className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
      2m ago
    </time>
  </div>
  <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-wide text-[var(--color-text-muted)]">
    Price change
  </p>
  <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
    <span className="h-2 w-2 rounded-full bg-[var(--palette-accent)]" aria-hidden />
    <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]">High</span>
  </div>
</article>
```

---

## Block/DiffView · T-11

**Ready** `720×220`, сверен со скрином: Fact-зона. Before → After 48px+ black mono — **largest on screen**.

| Состояние | Содержимое |
|---|---|
| loading | Dashed box; muted ghost `$49 → $39`; skeleton lines below |
| empty | «No price diff for this signal» |
| error | «Diff unavailable» + Retry |
| ready | `Pro $49/mo → Pro $39/mo`, `−20%`, line diff below |

### React+Tailwind (ready)

```tsx
<section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
    Fact · Price change
  </p>
  <div className="mt-[var(--space-3)] flex flex-wrap items-baseline gap-x-[var(--space-3)] gap-y-[var(--space-2)]">
    <span className="font-[family-name:var(--font-mono)] text-[48px] font-[number:var(--weight-black)] leading-none text-[var(--color-text-muted)]">
      Pro $49/mo
    </span>
    <span className="font-[family-name:var(--font-mono)] text-[32px] text-[var(--color-text-muted)]" aria-hidden>
      →
    </span>
    <span className="font-[family-name:var(--font-mono)] text-[48px] font-[number:var(--weight-black)] leading-none text-[var(--color-text)]">
      Pro $39/mo
    </span>
    <span className="font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold)] text-[var(--palette-accent)]">
      −20%
    </span>
  </div>
  <ul className="mt-[var(--space-4)] space-y-[var(--space-1)] font-[family-name:var(--font-mono)] text-[13px]">
    <li className="text-[var(--palette-ok)]">+ Pro plan now $39/mo</li>
    <li className="text-[var(--palette-accent)]">− Pro plan was $49/mo</li>
  </ul>
</section>
```

---

## Block/EvidenceCard · T-11

**Ready** `480×156`, сверен со скрином: Evidence-зона. Recessed well, URL, provider badge, timestamp, fragment, confidence.

| Состояние | Содержимое |
|---|---|
| loading | Recessed dashed; skeleton URL + 2 lines |
| empty | «No evidence attached» |
| error | «Source page did not open» + status hint + Retry |
| ready | Firecrawl badge, URL, timestamp, fragment, 91% confidence; `fixture` → плашка `cached snapshot` |

### React+Tailwind (ready)

```tsx
<section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-4)]">
  <div className="flex items-center justify-between gap-[var(--space-2)]">
    <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text)]">
      Firecrawl
    </span>
    <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
      Detected 2026-09-12 14:32 UTC
    </span>
  </div>
  <a
    href="https://acmeflow.example/pricing"
    className="mt-[var(--space-2)] block truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--palette-info)] underline-offset-2 hover:underline"
  >
    https://acmeflow.example/pricing
  </a>
  <blockquote className="mt-[var(--space-3)] border-l-2 border-[var(--color-border)] pl-[var(--space-3)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
    &ldquo;Pro — $39/mo, billed monthly&rdquo;
  </blockquote>
  <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text)]">
    Confidence <span className="text-[var(--palette-ok)]">91%</span>
  </p>
</section>
```

---

## Block/MetricCards · T-09

**Ready** `360×160`: grid 2×2 mini-panels on `color/surface`. Threat uses severity LED rules.

| Метрика | Пример | Стиль |
|---|---|---|
| Threat | High | LED `palette/accent` + label |
| Score | 82 | mono 20px bold |
| Confidence | 91% | mono, `palette/ok` if ≥ 80% |
| Price Δ | −20% | mono, sign readable without color |

| Состояние | Содержимое |
|---|---|
| loading | 4 skeleton tiles dashed |
| empty | «Metrics pending assessment» |
| error | «Metrics unavailable» + Retry |
| ready | Threat High · 82 · 91% · −20% |

### React+Tailwind (ready)

```tsx
<div className="grid grid-cols-2 gap-[var(--space-2)]">
  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
    <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">Threat</p>
    <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-2)]">
      <span className="h-2 w-2 rounded-full bg-[var(--palette-accent)]" aria-hidden />
      <span className="font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold)] text-[var(--color-text)]">High</span>
    </div>
  </div>
  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
    <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">Score</p>
    <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold)] text-[var(--color-text)]">82</p>
  </div>
  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
    <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">Confidence</p>
    <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold)] text-[var(--palette-ok)]">91%</p>
  </div>
  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
    <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">Price Δ</p>
    <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold)] text-[var(--color-text)]">−20%</p>
  </div>
</div>
```

---

## Block/RecommendationCards · T-13

**Ready** `320×817`: три карточки в action panel. Title sans bold; meta mono; **Generate** — outline (единственная saturated CTA на Shell остаётся Run Scan).

| Состояние | Содержимое |
|---|---|
| loading | 3 skeleton cards |
| empty | «No recommendations yet» · «Wait for assessment» |
| error | «Recommendations failed» + Retry |
| ready | 3 cards: title, action, rationale, impact, effort, risk, priority, Generate |

### React+Tailwind (ready — одна карточка)

```tsx
<article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
  <div className="flex items-start justify-between gap-[var(--space-2)]">
    <h4 className="font-[family-name:var(--font-sans)] text-[16px] font-[number:var(--weight-bold)] text-[var(--color-text)]">
      Match Pro pricing
    </h4>
    <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--palette-amber)]">P1</span>
  </div>
  <p className="mt-[var(--space-2)] text-[14px] text-[var(--color-text-muted)]">
    Drop Pro to $39/mo to stay competitive in SMB.
  </p>
  <dl className="mt-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px]">
    <div><dt className="text-[var(--color-text-muted)]">Impact</dt><dd className="text-[var(--color-text)]">High retention</dd></div>
    <div><dt className="text-[var(--color-text-muted)]">Effort</dt><dd className="text-[var(--color-text)]">Low</dd></div>
    <div><dt className="text-[var(--color-text-muted)]">Risk</dt><dd className="text-[var(--color-text)]">Margin −13%</dd></div>
  </dl>
  <button
    type="button"
    className="mt-[var(--space-4)] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]"
  >
    Generate
  </button>
</article>
```

---

## Panel/Chat · T-13

**Ready** `320×427`: правая панель 320px — assessment stack (Fact / Evidence / AI analysis) + optional chat thread below.

| Состояние | Содержимое |
|---|---|
| loading | «Assessing…» + 3 section skeletons |
| empty | «Select a signal to see assessment» |
| error | «Assessment failed» + Retry |
| ready | Grok copy: Fact summary → Evidence refs → AI analysis dashed; RecommendationCards ниже |

### React+Tailwind (ready — assessment header)

```tsx
<aside className="flex w-[320px] flex-col gap-[var(--space-4)] border-l border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-4)]">
  <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
    <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
      Fact
    </h3>
    <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[14px] text-[var(--color-text)]">
      Competitor Pro dropped from $49/mo to $39/mo (−20%).
    </p>
  </section>

  <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-3)]">
    <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
      Evidence
    </h3>
    <a href="#" className="mt-[var(--space-2)] block truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--palette-info)]">
      acmeflow.example/pricing
    </a>
  </section>

  <section className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
    <div className="flex items-center gap-[var(--space-2)]">
      <span className="h-2 w-2 rounded-full bg-[var(--palette-info)]" aria-hidden />
      <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text)]">
        AI analysis
      </h3>
    </div>
    <p className="mt-[var(--space-1)] text-[11px] text-[var(--color-text-muted)]">
      Model inference — verify against evidence
    </p>
    <p className="mt-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
      13% cheaper than your Pro tier; overlaps your core SMB segment. Recommend response within 2 weeks.
    </p>
  </section>
</aside>
```

---

## Severity — примеры LED

```tsx
const severityStyles = {
  low:      { led: "bg-[var(--palette-info)]",    glow: "" },
  medium:   { led: "bg-[var(--palette-amber)]",   glow: "" },
  high:     { led: "bg-[var(--palette-accent)]",  glow: "" },
  critical: {
    led: "bg-[var(--palette-critical)]",
    glow: "shadow-[0_0_10px_2px_rgba(255,45,85,0.6)]",
  },
} as const;
```

Label всегда `text-[var(--color-text)]`, never severity hex as body fill.

---

## Связь с реализацией

| Задача | Компонент | Артборд | Источник истины |
|---|---|---|---|
| T-09 | `SignalCard` | Block/SignalCard | сниппет + скрин MCP |
| T-09 | `MetricCards` | Block/MetricCards | сниппет + скрин MCP |
| T-11 | `DiffView` | Block/DiffView | сниппет + скрин MCP |
| T-11 | `EvidenceCard` | Block/EvidenceCard | сниппет + скрин MCP |
| T-13 | `RecommendationCards` | Block/RecommendationCards | сниппет + скрин MCP |
| T-13 | `ActionPanel` / Chat | Panel/Chat | сниппет + скрин MCP |

React+Tailwind сниппеты выше — ready-state эталон с `cssVar` из DESIGN.md. Канвас даёт то же самое: `get_element_code` для блоков A возвращает `var(--…)`, а не хекс, — код вставляется в React без ручного перевода литералов в токены.

### Чеклист имплементации (T-09 / T-11 / T-13)

1. Пропсы: данные сигнала / assessment / recommendations; не хардкодить только демо-строки в проде.
2. Четыре состояния на блок; empty/error копирайт из таблиц выше.
3. DiffView ≥ 48px mono black; Fact / Evidence / AI analysis не смешивать визуально.
4. Generate outline; saturated CTA только Run Scan на Shell.
5. Severity только через LED + `--color-text` label.
