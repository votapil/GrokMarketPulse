# Deploy — GrokMarketPulse

Public demo is a **Render static site**. Convex is the API. The static site does not sleep.

## Demo URL

Set after the first Blueprint apply (placeholder until then):

`https://grok-market-pulse.onrender.com`

`curl -sI https://<app>.onrender.com` should return `200`. Region is chosen once in the Render dashboard and **cannot be changed**.

## How a deploy works

1. Push to `main`.
2. Render runs `npx convex deploy --cmd 'npm run build'`.
3. Convex deploy writes **production** functions and injects `VITE_CONVEX_URL` for the Vite build. Do not hardcode that URL in git.
4. Render publishes `./dist` and rewrites `/*` → `/index.html`.

## `CONVEX_DEPLOY_KEY`

1. Convex Dashboard → the **production** deployment → Settings → Deploy Keys → Generate.
2. Enable permission `deployment:deploy`.
3. Paste into the Render service env var `CONVEX_DEPLOY_KEY` (`sync: false` in `render.yaml` — never commit the value).

To rotate: generate a new key in Convex, replace the Render env var, trigger a deploy. Revoke the old key in Convex.

## Logs

- **Render:** Dashboard → service → Logs (build + CDN publish).
- **Convex:** Dashboard → Logs, or `npx convex logs` / Convex MCP `logs`.

Frontend 404s on deep links mean the SPA rewrite is missing. Function errors belong in Convex logs, not Render.

## Local

```bash
cp .env.local.example .env.local
npx convex dev
npm run dev
```

Convex functions read keys from `npx convex env set`, not from `.env.local`.
