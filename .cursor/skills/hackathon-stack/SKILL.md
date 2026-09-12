---
name: hackathon-stack
description: >-
  GrokMarketPulse hackathon stack: Grok/xAI, Exa, Firecrawl, Convex, Wonder, Render.
  Use when researching the web, scraping pages, calling Grok, writing Convex backend,
  designing UI, or deploying the demo.
---

# Hackathon stack

Canonical details (credits, endpoints, gotchas): `docs/STACK.md`.

## Tool split

| Job | Tool |
|---|---|
| Find sources, freshness, citations | **Exa** (`web_search_exa`, `web_fetch_exa`, `agent_run`) |
| Full page text, JS/PDF, site map, structured scrape | **Firecrawl** (`scrape`; with API key: `map`, `crawl`, `agent`) |
| LLM (chat, vision, imagine) | **xAI REST** `https://api.x.ai/v1` — no official MCP |
| Persist + realtime UI | **Convex** queries/mutations/actions |
| Screens / landing | **Wonder** MCP → copy React+Tailwind into the app |
| Public HTTPS for judges | **Render** static site + `npx convex deploy --cmd 'npm run build'` |
| Current library docs | **Context7** |

xAI is called from Convex **actions** with `fetch` (V8 runtime). Do not use `"use node"` just for `fetch`.

## Env

Local file: `.env.local` (gitignored). Template: `.env.local.example`.

Convex **does not** read `.env.local`. After a key exists:

```bash
npx convex env set XAI_API_KEY
npx convex env set FIRECRAWL_API_KEY
npx convex env set EXA_API_KEY
```

## Grok call shape

`POST https://api.x.ai/v1/responses` with `Authorization: Bearer $XAI_API_KEY`.
Response `output[]` has `type: "reasoning"` then `type: "message"` — take `.content[0].text` from the message item.

Prefer `grok-4.3` or `grok-4.6` for text. Avoid `grok-4.20-multi-agent` and video models unless the demo needs them (budget).

`long_context_threshold` = 200k tokens — never dump raw scrapes into the prompt; filter first.

Log `usage.cost_in_usd_ticks` (divide by 10_000_000_000 for USD).

## Exa → Firecrawl pipeline

1. Exa `/search` `type: "auto"`, `numResults` 10–20, `contents.highlights: true`.
2. Pick 3–5 URLs that need full or structured text.
3. Firecrawl scrape `formats: ["markdown"]`, `maxAge: 86400000`. Use `json` format only if structure is required (+4 credits/page).
4. Site section: Firecrawl **map** (1 credit) → filter URLs → scrape those only. Always set `limit` on crawl (default 10_000 pages).
5. Dedup URLs (strip utm/fragments) before scrape.

Keyless Firecrawl MCP is scrape/search/parse only. Crawl/map/agent need `FIRECRAWL_API_KEY` on the MCP `Authorization` header.

## Convex traps (2026)

- `ctx.db.get("table", id)` — table name **first** (since 1.31.0).
- No `ctx.db` in actions — use `runQuery` / `runMutation`.
- Queries must not call `Date.now()`; pass time as an arg.
- Always `withIndex`; `.filter()` does not reduce reads.
- Never `.collect().length` for counts.
- `npx convex deploy` drops indexes missing from the schema.
- Validators on `args`/`returns` are required, including internal functions.

After `npx convex ai-files install`, follow generated `AGENTS.md` / `convex/_generated/ai/guidelines.md`.

Skip `@convex-dev/agent`, workflow, RAG unless the demo is a persistent multi-turn chat. Cheap wins: `@convex-dev/rate-limiter`, `@convex-dev/action-cache`. AI Gateway is disabled on Free — raw `fetch` to xAI.

## Render

Front: **Static Site** (does not sleep). Build: `npx convex deploy --cmd 'npm run build'`.
Web services sleep after 15 min on free — do not put the judge demo solely on a free web service.

## Wonder

Design on canvas, then **Copy React + Tailwind** into this repo. Do not spend the day on Figma export. Duplicate before large restyles; fast text/color tweaks in place.
