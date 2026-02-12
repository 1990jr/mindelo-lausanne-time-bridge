# AI Backend Setup TODO (Cloudflare Worker + Workers AI)

## 1. Accounts and access
- [ ] Create or log in to a Cloudflare account.
- [ ] Install Wrangler CLI: `npm i -g wrangler`.
- [ ] Authenticate Wrangler: `wrangler login`.
- [ ] Ensure Workers AI is enabled in your Cloudflare account.

## 2. Worker config
- [ ] Decide your frontend origin (GitHub Pages URL) and set it in `worker/wrangler.toml` as `ALLOWED_ORIGIN`.
- [ ] Confirm AI binding exists in `worker/wrangler.toml`:
  `[ai]`
  `binding = "AI"`

## 3. Deploy backend
- [ ] Deploy Worker: `cd worker && wrangler deploy`.
- [ ] Copy the deployed Worker URL (example: `https://mindelo-lausanne-ai-bridge.<subdomain>.workers.dev`).
- [ ] Verify health endpoint: `GET <worker-url>/health`.

## 4. Connect frontend to backend
- [ ] Open browser console on your site and run:
  `localStorage.setItem('timeBridgeAiEndpoint', '<worker-url>/api/insight')`
- [ ] Refresh the page.
- [ ] Verify the AI insight is generated automatically (no button) and appears in the AI card.

## 5. Production hardening (still free)
- [ ] Replace wildcard CORS origin with your exact GitHub Pages domain.
- [ ] Add basic request throttling on Worker (per IP/day) if needed.
- [ ] Add a fallback message on frontend when AI endpoint quota is exceeded.
- [ ] Monitor Worker logs: `cd worker && wrangler tail`.

## 6. Optional enhancements
- [ ] Add a second endpoint for weekly summary (e.g. `/api/weekly-summary`).
- [ ] Add local cache of latest AI insight in browser storage.
- [ ] Add a small history list of recent insights.
