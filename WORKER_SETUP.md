# Pinnacle Eagle Chatbot — Worker Setup

Stand up the Cloudflare Worker that powers the Claude-backed chatbot. ~10 minutes start to finish. Free tier covers 100K requests/day.

## Prerequisites

- A Cloudflare account (free) — https://dash.cloudflare.com/sign-up
- An Anthropic API key — https://console.anthropic.com/settings/keys

## Step 1 — Create the Worker

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Create** → **Create Worker**.
2. Name it something like `pinnacle-eagle`. Click **Deploy** to get the default placeholder live.
3. Click **Edit code**.
4. Delete everything in the editor.
5. Open `worker.js` from this repo, copy the entire contents, paste into the editor.
6. Click **Save and deploy**.

## Step 2 — Add the API key as a secret

1. In the Worker page, click **Settings** → **Variables**.
2. Under **Environment Variables**, click **Add variable**.
3. Name: `ANTHROPIC_API_KEY`. Value: paste your key (starts with `sk-ant-...`).
4. Toggle **Encrypt** so the value is treated as a secret.
5. Click **Save and deploy**.

## Step 3 — Update allowed origins (if needed)

`worker.js` allows requests from `https://thumbstick-nick.github.io` plus localhost. If your wiki is hosted elsewhere, edit the `ALLOWED_ORIGINS` array near the top of the file before deploying.

## Step 4 — Wire the wiki to the Worker

1. Copy your Worker URL from the dashboard (looks like `https://pinnacle-eagle.your-account.workers.dev`).
2. Open `index.html` in this repo.
3. Find the line `const CHATBOT_PROXY_URL = "";` (use Ctrl+F).
4. Paste your URL between the quotes:
   ```js
   const CHATBOT_PROXY_URL = "https://pinnacle-eagle.your-account.workers.dev";
   ```
5. Commit and push. GitHub Pages picks it up within a minute.

## Step 5 — Test

1. Open the live wiki.
2. Click the eagle launcher (bottom-right). The header should say "Powered by Claude Haiku 4.5".
3. Ask something like "what permissions do I need to publish content?" — you should see a synthesized 2-4 sentence answer with citation links.

## Costs

Haiku 4.5 is about $1 per million input tokens and $5 per million output tokens. Each wiki question is ~3K input + ~300 output ≈ $0.005. **A team of 50 people asking 10 questions a day each is roughly $2.50/day or $75/month.** Cloudflare Workers free tier handles up to 100K requests per day for free.

## Failure modes the wiki handles automatically

- Worker URL not configured (`CHATBOT_PROXY_URL` empty): chatbot falls back to local keyword search silently. No errors shown.
- Rate limit (429 from Anthropic): keyword answer + small "rate-limited" notice.
- Worker down / network error: keyword answer + "AI assistant unavailable" notice.
- Bad context (no matching sections): keyword response only.

So you can ship the wiki without the Worker and add it later — nothing breaks.

## Tightening security further (optional)

The Worker as-written checks the `Origin` header but a determined attacker can spoof that. If abuse becomes an issue:

- Add Cloudflare WAF rate-limiting rules (free tier includes basic rate limiting).
- Add a shared site token: bake a long random string into both `worker.js` and `index.html`, have the Worker reject requests without it. Provides modest extra friction.
- Move the wiki to Cloudflare Pages and use the same account — then Worker bindings can require same-account auth.

For an internal POC behind no auth at all, the origin check is sufficient.
