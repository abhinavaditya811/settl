# Settl Dashboard (`web/`)

Next.js (App Router, TypeScript) + styled-components frontend for the Settl engine.
It shows the invoice board, the first-contact **approval queue** (with a working
**Approve & Send**), and the per-invoice **decision trace** — and has a light/dark
toggle. It never talks to the engine directly: Next route handlers under `/api/*`
proxy to the FastAPI engine server-side, so the engine URL stays off the browser.

## Run it locally

Two processes. From the repo root, start the engine:

```bash
pip install -e ".[api]"
uvicorn settl.api.main:app --reload --port 8000
```

Then, in `web/`:

```bash
cp .env.local.example .env.local      # points at http://localhost:8000 by default
npm install
npm run dev                            # http://localhost:3000
```

Open http://localhost:3000.

## Live email on approval (optional)

By default the engine runs in **mock mode** — approvals are simulated, no email is
sent (the header shows "Mock mode"). To make the **Approve & Send** button send a
real email to your own inbox, start the engine with the self-test env set (see the
root `.env`):

```bash
SETTL_LIVE_SEND=1 SETTL_TEST_RECIPIENT="you@gmail.com" \
  uvicorn settl.api.main:app --port 8000
```

The header flips to "Live email armed". Every send is force-redirected to
`SETTL_TEST_RECIPIENT`, so a synthetic debtor address is never emailed.

## Deploy

- **Frontend → Vercel.** Set `SETTL_API_BASE_URL` (a server env var) to your
  deployed engine URL.
- **Engine → Cloud Run** (or any container host). It's the FastAPI app
  `settl.api.main:app`.

## Layout

```
src/
  app/
    layout.tsx              root layout: SSR style registry + theme provider
    page.tsx                the dashboard (fetch board, approve, drawer, toasts)
    api/.../route.ts        server-side proxies to the FastAPI engine
  components/               Header, SummaryBar, ApprovalQueue, InvoiceTable, InvoiceDrawer, Badge, ThemeToggle
  lib/                      theme, ThemeContext, styled registry, api client, types, format
```
