# HabeshaTTS

A full-stack donation platform that streams AI-generated speech to content creators in real time. Streamers collect payments via Telegram, donors submit text-to-speech requests, and admins oversee onboarding, fraud controls, and payouts from a unified dashboard.

## Key Features
- **Streamer & donor portals** – Streamers get live donation queues with audio playback while donors submit paid TTS messages.
- **Admin control plane** – Manage approvals, reorder the public streamer list, remove accounts, review recharges/withdrawals, and inspect complaints.
- **Donor moderation controls** – Ban/unban donors with reasons and timed expirations directly from the admin dashboard.
- **Streamer flag escalations** – Streamers surface problematic donors with a single menu tap, automatically notifying admins with context-rich reviews.
- **Telegram automation** – The bot onboards new streamers, sends OTP links, and routes donation notifications.
- **Realtime + queueing** – Socket.IO keeps dashboards live while BullMQ/Redis and Google Cloud TTS handle heavy audio generation asynchronously.
- **Auditable finances** – Postgres-backed ledgers, recharge flows, withdrawals, and admin-adjustable balances ensure transparent accounting.

## Architecture Overview
```
Donor UI (Vite/React)  <--Socket.IO-->  Backend API (Express)  <--BullMQ-->  TTS Worker
                                   \                                  /
                                    \-- Telegram Bot (node-telegram-bot-api)
                                         |-- Postgres (donations, ledgers)
                                         |-- Redis (queues, bot state)
                                         |-- Google Cloud TTS
```
- **Backend (`backend/`)** – Node.js + Express + Postgres (via `pg`). Handles REST APIs, sockets, ledger math, and integrates BullMQ workers.
- **Frontend (`frontend/`)** – React + Vite + Tailwind. Hosts landing page, streamer dashboard, and feature-rich admin surface.
- **Bot (`bot/`)** – Telegram runtime split into command/message/callback handlers with Redis-backed state storage.
- **Scripts (`scripts/`)** – DB migrations, maintenance utilities, and SQL helpers (e.g., ledger indexes, data loads).

## Repository Layout
```
backend/         Express app, routes, middleware, queues, utilities
frontend/        React SPA (landing, streamer, admin dashboards)
bot/             Telegram bot runtime, handlers, Redis state store
scripts/         Database migrations + operational tooling
public/          Shared static assets (audio samples, sounds)
Dockerfile       Container entry for backend API + worker
```

## Prerequisites
- Node.js 18+
- npm 9+ (or pnpm/yarn if preferred)
- PostgreSQL 14+ with a database provisioned for the app
- Redis 6+ (BullMQ queue + bot state)
- Google Cloud project with Text-to-Speech enabled (service account JSON)
- Telegram Bot Token (via @BotFather)

## Getting Started
1. **Clone & install root dependencies**
   ```bash
   git clone https://github.com/ezzy1231/habesha_tts.git
   cd habesha_tts
   npm install
   ```
2. **Install frontend deps**
   ```bash
   cd frontend
   npm install
   cd ..
   ```
3. **Configure environment variables** (see tables below). Store secrets in `.env` files or your secret manager. Point `GOOGLE_APPLICATION_CREDENTIALS` to the downloaded service-account JSON.
4. **Run Postgres + Redis** locally (Docker, neon.tech, etc.). Apply schema using `node scripts/init-db.js` if needed.
5. **Start the backend**
   ```bash
   npm run dev
   ```
6. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```
7. Visit `http://localhost:5173` for the landing page, `/admin` for the admin panel (prompts for admin token), and `/streamer/:uuid` for streamer dashboards.

## Environment Variables
### Backend / Bot
| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port (default `5000`). |
| `DATABASE_URL` | Yes | Postgres connection string. |
| `REDIS_URL` | Yes | Redis connection for BullMQ + bot state. |
| `ADMIN_TOKEN` | Yes | Shared secret required for every `/api/admin` request. |
| `FRONTEND_URL`, `PUBLIC_FRONTEND_URL`, `CLIENT_URL` | No | Base URL used in bot notifications and CORS allowlist. |
| `ALLOWED_ORIGINS`, `FRONTEND_URLS` | No | Comma-separated list of extra origins for CORS/Socket.IO. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes (TTS) | Path to Google Cloud service-account JSON for TTS. |
| `TELEGRAM_BOT_TOKEN` | Yes (bot) | Token from @BotFather. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Recommended | Token utilities used by streaming auth helpers. |
| `LEDGER_DUAL_WRITE`, `LEDGER_READ_ENABLED`, `LEDGER_READ_FALLBACK` | Optional | Feature flags for the Postgres ledger module. |
| `BOT_STATE_REDIS_URL`, `BOT_STATE_*` | Optional | Override bot state-store behavior (see `bot/README.md`). |

### Frontend
| Variable | Required | Description |
| --- | --- | --- |
| `VITE_BASE_URL` | Yes | Points the SPA to the backend API (`http://localhost:5000` during dev, Cloud Run URL in prod). |

## Useful NPM Scripts
| Command | Location | Purpose |
| --- | --- | --- |
| `npm run dev` | repo root | Starts backend API + worker (single process). |
| `npm start` | repo root | Launch backend for production (reads `.env`). |
| `npm run test:bot-state` | repo root | Smoke tests for Redis/in-memory bot state. |
| `npm run dev` | `frontend/` | Launches Vite dev server with hot reload. |
| `npm run build` | `frontend/` | Produces static assets in `frontend/dist`. |

## Database & Queue Utilities
- `scripts/init-db.js` – bootstraps core Postgres tables and default settings.
- `scripts/add-donor-ban-fields.js` – adds the donor ban columns + indexes (`is_banned`, `ban_reason`, expirations).
- `scripts/add-donor-flag-table.js` – creates `donor_flag_requests` (streamer flag queue) plus supporting indexes.
- `scripts/sql/*.sql` – hand-written DDL (performance indexes, ledger tables).
- `scripts/add-*.js` – one-off migrations (new columns, complaint tracking, etc.).
Run any script with `node scripts/<name>.js` once, then commit resulting schema changes.

## Streamer Flag Workflow
1. **Run the migration** – `node scripts/add-donor-flag-table.js` creates the `donor_flag_requests` table plus indexes.
2. **Streamer dashboard UI** – Every donation card now exposes a ⋮ menu with `⏳ Time Ban`, `🚫 Ban`, and `✅ Unban` shortcuts. Selecting one records a flag and immediately disables the menu while the request is pending.
3. **Backend endpoint** – `POST /streamer/:uuid/donations/:donationId/flag` (or `/v1/streamer/...` when JWT-protected) validates the action, dedupes pending reviews, stores the record, and emits a `donor_flag_created` admin socket event.
4. **Admin follow-up** – Admin tooling can subscribe to the new event or query `donor_flag_requests` directly to approve, ban, or dismiss the streamer’s request. Resolving a flag (setting `status != 'pending'`) automatically re-enables the streamer’s menu for future escalations.

## Testing & Verification
- **Bot state**: `npm run test:bot-state`.
- **Manual QA**: use the admin dashboard to approve a test streamer, generate a donation via the donation form, and confirm audio playback/ledger entries.
- **Health checks**: `/health` endpoint verifies Redis, Postgres, and bot-lock status (returns `503` if anything critical is down).

## Deployment Notes
- **Backend**: Deploy via the provided `Dockerfile` or directly to Cloud Run/App Service. Ensure `ADMIN_TOKEN`, `DATABASE_URL`, `REDIS_URL`, and Google credentials are injected as secrets.
- **Frontend**: `npm run build` inside `frontend/` and host the `dist/` folder (Firebase Hosting, Vercel, Netlify, etc.). Set `VITE_BASE_URL` to the deployed API URL before building.
- **Telegram Bot**: Only the instance that acquires the Redis lock starts polling, so horizontal scaling is safe as long as every replica shares `REDIS_URL`.

## Troubleshooting
- `403` on admin requests → confirm the `x-admin-token` header matches `ADMIN_TOKEN` configured on the backend.
- `404` when removing streamers → redeploy the backend so `/api/admin/streamers/:id` exists in production.
- Socket.IO disconnects on prod → add your CDN/hostnames to `FRONTEND_URLS` and redeploy so CORS + Socket.IO allowlists match.
- Audio never leaves "Generating" state → verify Redis is reachable and Google Cloud credentials are mounted (check worker logs for BullMQ or TTS errors).

Happy building! ✨
