# Deep-Work Tracker

A full-stack productivity app for logging timed deep-work sessions, tagging them by activity, and visualizing where your focus actually goes — weekly totals, a GitHub-style yearly heatmap, current/longest streaks, and an ML-predicted "your best focus hours" insight learned from your own session history.

## Architecture

```
┌──────────────────┐        ┌───────────────────┐        ┌──────────────────┐
│   React (Vite)   │  /api  │  Express API      │  SQL   │   PostgreSQL     │
│   localhost:5173 ├───────►│  localhost:4000   ├───────►│   (Supabase)     │
│                  │  proxy │                   │  (pg)  │                  │
│  axios + JWT     │        │  auth · tags      │        │  users · tags    │
│  Recharts        │        │  sessions         │        │  sessions        │
│  calendar-heatmap│        │  analytics        │        └──────────────────┘
└──────────────────┘        │  insights ────────┼──────────────┐
                            └───────────────────┘              │ POST /predict
                                                               ▼
                                                    ┌──────────────────────┐
                                                    │  Flask ML service    │
                                                    │  localhost:5001      │
                                                    │  DecisionTreeRegr.   │
                                                    └──────────────────────┘
```

### Why two services?

The ML predictor lives in its own Flask microservice instead of inside Express for three practical reasons: **(1) language fit** — scikit-learn is the natural tool for the model, and Python is where ML iteration happens; **(2) failure isolation** — the predictor is a nice-to-have, so the API treats it as optional: if Flask is down, `/api/insights/best-hours` degrades to a friendly `{ available: false }` instead of taking session logging down with it; **(3) independent evolution** — the model can be retrained, swapped, or scaled without touching (or redeploying) the core API. The Express server is the only thing that talks to Flask; the browser never does.

## Setup

Prerequisites: Node 18+, Python 3.10+, a PostgreSQL database (a free [Supabase](https://supabase.com) project works out of the box).

### 1. Database (schema + demo seed in one file)

Run [`server/db/schema.sql`](server/db/schema.sql) against your database — it creates the tables **and** seeds a demo account with ~90 days of data. Easiest: paste the whole file into the Supabase **SQL Editor** and Run. Re-running is safe (idempotent; demo sessions are regenerated).

> Demo login: `demo@demo.com` / `demo1234`

### 2. Express API

```bash
cd server
npm install
cp .env.example .env    # then edit .env:
#   DATABASE_URL  → your Postgres connection string (URL-encode special chars in the password)
#   JWT_SECRET    → any long random string
npm start               # → http://localhost:4000
```

### 3. ML service

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt     # Windows
# .venv/bin/pip install -r requirements.txt       # macOS/Linux
.venv\Scripts\python app.py                       # → http://localhost:5001
```

### 4. Client

```bash
cd client
npm install
npm run dev             # → http://localhost:5173
```

**Or all three at once (Windows):** `.\dev.ps1` from the repo root opens each service in its own terminal window.

**Sanity check:** with the API + ML service running, `node smoke-test.mjs` from the repo root runs 35 end-to-end checks against every endpoint.

## API

All routes are prefixed with `/api`. 🔒 = requires `Authorization: Bearer <JWT>`.

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/auth/signup` | Create account → `{ token, user }` (400 invalid, 409 duplicate email) |
| POST | `/auth/login` | Log in → `{ token, user }` (401 bad credentials) |
| GET 🔒 | `/tags` | List your tags |
| POST 🔒 | `/tags` | Create tag `{ name, color? }` (409 duplicate name) |
| PUT 🔒 | `/tags/:id` | Update name and/or color |
| DELETE 🔒 | `/tags/:id` | Delete tag — its sessions survive with `tag_id = NULL` |
| GET 🔒 | `/sessions` | List sessions; optional `?from=&to=&tag_id=` filters |
| POST 🔒 | `/sessions` | Log `{ started_at, duration_minutes, tag_id?, note? }` (rejects 0/negative durations and future start times) |
| PUT 🔒 | `/sessions/:id` | Partial update (any field; `tag_id`/`note` nullable) |
| DELETE 🔒 | `/sessions/:id` | Delete session |
| GET 🔒 | `/analytics/weekly` | Minutes per day, last 7 days, zero days included |
| GET 🔒 | `/analytics/tags` | Total minutes per tag with name + color |
| GET 🔒 | `/analytics/heatmap` | `{ date, minutes }` per active day, last 365 days |
| GET 🔒 | `/analytics/streaks` | `{ current_streak, longest_streak }` (window-function trick) |
| GET 🔒 | `/insights/best-hours` | ML prediction; `{ available: false, reason }` when <10 sessions or ML down |
| GET | `/health` | Liveness check |

Errors are always `{ "error": "<human-readable message>" }` with a meaningful status code. Every data query is scoped to the JWT's user id — cross-user access returns 404, never another user's row.

## Screenshots

<!-- Drop screenshots into docs/screenshots/ and update the paths -->

| | |
|---|---|
| ![Dashboard — timer and recent sessions](docs/screenshots/dashboard.png) | ![Analytics — weekly chart, donut, streaks](docs/screenshots/analytics.png) |
| ![Yearly heatmap](docs/screenshots/heatmap.png) | ![Best focus hours prediction](docs/screenshots/best-hours.png) |

## Before deploying (notes to self)

No deployment configs are included — deploy manually. Things that matter:

**Environment variables**

| Service | Variable | Notes |
|---|---|---|
| server | `DATABASE_URL` | Supabase pooler URI; password must be URL-encoded |
| server | `JWT_SECRET` | long random string — never the dev one; rotating it logs everyone out |
| server | `PORT` | default 4000 |
| server | `CORS_ORIGIN` | set to the deployed client origin (comma-separated list) |
| server | `ML_SERVICE_URL` | internal URL of the Flask service |
| ml-service | `PORT` | default 5001 |

**Build/run commands**

- Client: `npm run build` → static files in `client/dist/` (any static host). The dev `/api` proxy is Vite-only — either serve the client from the same origin as the API or set the API's `CORS_ORIGIN` and point axios at the full API URL.
- Server: `npm start` (plain Node, no build step).
- ML service: don't use `python app.py` in production (Flask debug server) — use a WSGI server, e.g. `waitress-serve --port 5001 app:app` (Windows) or `gunicorn -b 0.0.0.0:5001 app:app`.

**Other**

- The Flask service has **no authentication** — it must never be exposed publicly; keep it on a private network reachable only by the API.
- `db/index.js` uses `ssl: { rejectUnauthorized: false }` for the Supabase pooler — fine for dev; for production consider pinning Supabase's CA certificate.
- The demo seed lives in `schema.sql`; skip or strip it for a production database, or leave it — it only touches the `demo@demo.com` account.
