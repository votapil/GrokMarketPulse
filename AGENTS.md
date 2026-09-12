<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# GrokMarketPulse — agent notes

Hackathon app: live market pulse from the web (Exa + Firecrawl) scored by Grok, stored in Convex, UI from Wonder, hosted on Render.

## Read first

- `docs/STACK.md` — sponsor APIs, credits, MCP, gotchas
- Skill `.cursor/skills/hackathon-stack/SKILL.md`


## Wonder (один канвас)

Единственный файл команды: **GrokMarketPulse**

https://app.wonder.so/votapil/files/01a09523-7468-73ca-9838-1f163930bf0d/branches/main/pages/01a09523-7469-7d1a-93cb-ca004af7f12e

- `fileId` `01a09523-7468-73ca-9838-1f163930bf0d` · `pageId` `01a09523-7469-7d1a-93cb-ca004af7f12e` · org `votapil`
- Не заводить второй канвас; токены в `docs/DESIGN.md`, блоки A в `docs/DESIGN-BLOCKS.md`

## Local secrets

```bash
cp .env.local.example .env.local
# fill keys, then:
npx convex env set XAI_API_KEY
npx convex env set FIRECRAWL_API_KEY
npx convex env set EXA_API_KEY
```

Convex functions never read `.env.local`.

## MCP

Project servers: `.mcp.json` (also `.cursor/mcp.json` for Cursor) (Exa, Firecrawl, Convex, Render, Context7, Wonder).

After adding API keys, put Firecrawl Bearer on the Firecrawl MCP headers for map/crawl/agent. Authenticate Convex / Render / Wonder / Exa in Cursor Settings → MCP if a server shows error.

## Bootstrap (once)

```bash
npm create convex@latest . -- -t react-vite-shadcn
npx convex ai-files install
```
