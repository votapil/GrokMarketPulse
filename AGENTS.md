# GrokMarketPulse — agent notes

Hackathon app: live market pulse from the web (Exa + Firecrawl) scored by Grok, stored in Convex, UI from Wonder, hosted on Render.

## Read first

- `docs/STACK.md` — sponsor APIs, credits, MCP, gotchas
- Skill `.cursor/skills/hackathon-stack/SKILL.md`

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

Project servers: `.cursor/mcp.json` (Exa, Firecrawl, Convex, Render, Context7, Wonder).

After adding API keys, put Firecrawl Bearer on the Firecrawl MCP headers for map/crawl/agent. Authenticate Convex / Render / Wonder / Exa in Cursor Settings → MCP if a server shows error.

## Bootstrap (once)

```bash
npm create convex@latest . -- -t react-vite-shadcn
npx convex ai-files install
```
