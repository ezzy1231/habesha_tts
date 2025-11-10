# Habesha TTS – Improvement Plan (Nov 9, 2025)

This document captures a proposed plan to improve the backend and frontend without making code changes yet. It’s organized by area with prioritized phases. No code has been modified.

## Backend Improvements

### 1) Architecture & Separation of Concerns (P1–P2)
- Introduce layers: routes → services (domain logic) → repositories (SQL) → external adapters (Telegram bot, TTS, Socket, Redis lock).
- Consolidate queue/audio logic into a `ttsService` with an adapter for BullMQ.
- Normalize naming and response DTOs (e.g., donation uses `message`/`text`, `audio_file`/`audio_url` → pick one and stick with it).
- Deprecate `db-simple.js` in production; keep behind a clear dev flag only.
- Extract Redis lock handling (bot single instance) into `botLockManager`.

### 2) Security (P1)
- Admin: move from static `X-Admin-Token` to JWT (expiring, role claims); remove `ADMIN_ALLOW_UNPROTECTED` default path.
- Streamer API keys: add rate limiting on auth failures, support rotation, store hashed keys.
- Validate all inputs with a schema library (Zod/Joi) and centralized error middleware.
- Sanitize SSML/markup for TTS input to prevent injection.
- Tighten CORS allowlist and explicitly handle `OPTIONS`.
- Add CSRF protection or convert form endpoints to API-only with tokens.
- Validate socket room joins (check `link_uuid` exists before `join_streamer_room`).

### 3) Performance & Scalability (P2)
- DB indexes: `donations(streamer_id,status,created_at)`, `withdrawals(user_id,status)`, `settings(key)`, `complaints(responded)`.
- Aggregate caching: precompute top streamers/donors periodically or via materialized views.
- Queue config: backoff, concurrency, dead-letter queue.
- Batch/buffer socket emissions to admin room under high load.
- Consider cursor-based pagination for donations.

### 4) Reliability & Error Handling (P1–P2)
- Standard error shape `{ error: { code, message, details? } }` and centralized Express error handler.
- Resilient adapters for Telegram/TTS (retry, circuit breaker, timeouts).
- Health checks `/health` (DB/Redis/bot lock/queue depth); readiness vs liveness.
- Graceful shutdown: drain worker, stop bot polling, finish inflight requests.
- Structured logging (pino/Winston) with correlation IDs per request and socket event.

### 5) Database & Data Integrity (P1)
- Use ledger model: balance = sum(paid donations) − sum(approved withdrawals). Avoid mutating stored balances.
- Enforce FK constraints between donations/withdrawals and users.
- Add transactions for multi-step operations (e.g., withdrawal approval).
- Adopt a migration tool (node-pg-migrate or Prisma). Replace ad-hoc scripts.
- Add audit/event tables for state transitions (donation_events, withdrawal_events).

### 6) Code Quality & Maintainability (P2)
- Backend ESLint + Prettier; add TypeScript gradually (start with services + repositories).
- Centralize env/config validation at startup.
- De-duplicate repeated logic (profile picture URL resolution) into utilities.
- Document service contracts with JSDoc/TSDoc.

### 7) Testing Strategy (P1–P3)
- Unit: donations (create/mark played), withdrawals (approve/insufficient), settings parsing.
- Integration: payment confirm flow (mock TTS + Telegram), socket emissions.
- Contract tests for external adapters (Telegram/TTS).
- Frontend: expand tests beyond current ones (Pagination, Settings, ApiKeyModal flows).
- E2E: Playwright/Cypress covering admin dashboard, streamer playback, withdrawal request.
- Load tests (k6/Artillery) for donation spikes.

### 8) DevOps & Deployment (P1–P2)
- Docker multi-stage builds; smaller base image; add container healthcheck.
- CI: lint, typecheck, tests, Docker build, vulnerability scan; enforce PR checks.
- CD: tagged releases; staging → prod promotion.
- Observability: OpenTelemetry + Prometheus—metrics for queue depth, TTS latency, request rates.
- Secrets: move to a secrets manager; avoid bundling credentials in images.
- Backups: scheduled pg_dump, restore drills.

## Frontend Improvements

### 9) Architecture (P2)
- Break up large pages (`AdminDashboard.jsx`, `StreamerPage.jsx`) into smaller components.
- Introduce React Query/TanStack Query for fetching, caching, refetch, and pagination.
- Standardize API layer with axios instance + interceptors (auth, retries, error normalization).
- Consider Zustand/Redux Toolkit for shared state (queue, playback, auth) if needed.
- Route-level code splitting for heavy admin route.

### 10) Performance (P2–P3)
- Virtualize donation lists (react-window) for large histories.
- Memoize heavy computations; batch state updates on socket events.
- Preload audio assets; use `prefers-reduced-motion` for accessibility/perf.

### 11) UX & Accessibility (P2)
- Add proper aria labels and roles for volume slider, buttons, and modals.
- Ensure contrast ratios in dark mode are WCAG-compliant.
- Implement copy donation link with clipboard + toast.
- Alt text fallbacks for profile images.

### 12) Security (Frontend) (P1)
- Avoid storing long-lived raw API keys in localStorage; provide rotation and optional ephemeral session.
- Sanitize any user-generated content rendered into the DOM.
- Enforce strict CSP headers from backend.

### 13) Audio & Playback (P2)
- Persist unplayed queue across refresh; add “Skip” and recovery for stuck playback.
- Preload next donation audio; graceful fallbacks between WebAudio and HTMLAudio.
- Visible status indicator if AudioContext is blocked; guide user interaction.

### 14) Telemetry & Analytics (P2)
- Track key user events (donation received/played, withdrawal initiated, settings saved) to inform UX tuning.

## Documentation & Compliance

### 15) Docs (P2)
- Update README: architecture diagram, env vars, local dev, migrations, tests, common runbooks.
- Generate OpenAPI spec for backend; share typed clients.
- ADRs for major decisions (queue strategy, auth model, balance computation).

### 16) Privacy & Compliance (P3)
- Classify personal data; encrypt sensitive fields (e.g., phone numbers) at rest.
- Provide privacy notice and consent where applicable.

## Prioritized Roadmap

### Phase 1 (Weeks 1–2)
- Security: JWT admin auth, API key hardening, input validation + error middleware.
- DB: indexes; ledger-based balance; add FK constraints; start migration tooling.
- Logging & Health: structured logs, `/health` endpoint.

### Phase 2 (Weeks 3–4)
- Queue resilience (DLQ/retry/backoff); metrics & tracing.
- Tests: unit + integration for donations/withdrawals; initial Playwright flows.
- Frontend: adopt React Query; refactor large pages into components.

### Phase 3 (Weeks 5–6)
- Performance: virtualized lists; batch socket updates; audio preloading; accessibility fixes.
- UX: copy link + toasts; error overlays; audio skip.

### Phase 4 (Weeks 7–8)
- CI/CD pipeline; OpenAPI + generated types; key rotation; secrets manager.
- Optional: materialized views/caching for leaderboards.

### Phase 5 (Weeks 9+)
- Privacy/encryption for sensitive fields; ADR completion; ongoing perf profiling; full E2E coverage.

## Success Metrics
- No unprotected admin endpoints; JWT required (P1).
- p95 donation confirm path under 300ms (excluding TTS) (P2).
- 80%+ unit/integration coverage on core services (P3).
- Bot lock recovery < 30s on restart (P3).
- Frontend FCP < 2.5s production (P3).

## Edge Cases to Cover in Tests
- TTS failure fallback (demo audio), idempotent donation updates.
- Withdrawal approval with insufficient balance.
- Duplicate socket events; idempotent UI updates.
- Redis failover causing lock loss.
- API key rotation invalidates old sessions cleanly.

## Quick Wins (Start Early)
- Add input validation + sanitize SSML.
- Create DB indexes.
- Add structured logging & `/health` endpoint.
- Add unit tests for donations/withdrawals services.
- Clipboard copy for streamer link + toast.

— End of plan —

## Non‑disruptive Implementation Plan (Phased Rollout without Breaking Existing Functionality)

This section explains how to introduce each phase safely using feature flags, additive schema changes, dual‑run strategies, and clear rollback paths. No code changes are made by this document.

### Cross‑cutting Guardrails (apply to all phases)
- Feature flags and config gates: every new behavior is behind an env flag (default OFF). Include rapid “kill switches.”
- API compatibility: keep v1 endpoints stable; introduce v2 endpoints alongside v1; deprecate gradually.
- Additive DB migrations: create new tables/columns/indexes first; never drop/rename in the same deploy; backfill asynchronously; switch reads; only then clean up.
- Dual‑write/dual‑read where needed: write to old and new models temporarily; reads prefer new with fallback to old until fully migrated.
- Shadow/canary: run new workers/services in shadow mode (no external side‑effects) and compare outputs before switching traffic.
- Observability first: add metrics, traces, and logs before cutovers; define SLOs and alerts; verify dashboards.
- Rollback plan per step: pre‑flight checks; clear “flip back” instructions; no irreversible steps in a single deploy.

---

### Phase 1 (Weeks 1–2): Security, Data, Logging — without breakage
1) Admin Auth (JWT) alongside existing token
	- Add JWT verification behind `ADMIN_AUTH_JWT_ENABLED=false`.
	- Accept BOTH: legacy header token + JWT; log uptake rates.
	- Communicate to admins; provide migration window; flip to JWT‑only later with a flag.

2) Streamer API key hardening
	- Add new hashed column `api_key_hash` (keep `api_key` for now).
	- On API key update, dual‑write: store hash; keep plaintext during transition.
	- Validate: try hash; if miss, fall back to plaintext; record metrics; plan rotation date.
	- Rate limit failures behind flag; start with log‑only mode.

3) Input validation & error middleware
	- Introduce schema validators in “report‑only” mode: validate, log violations, still pass request through.
	- After 1–2 weeks with zero false positives, switch to enforce mode per endpoint via feature flag.

4) DB indexes & FK constraints
	- Create indexes CONCURRENTLY in Postgres; measure query plans before/after.
	- Add FK constraints with `NOT VALID`, then `VALIDATE CONSTRAINT` to avoid locking; fix any orphaned rows first.

5) Ledger‑based balance
	- Create a view or computed query path for balance; keep existing balance fields untouched.
	- Read‑switch: behind flag, make reads use the ledger view; compare results via logs.
	- When fully confident, stop writing to derived balance fields; clean up in a later maintenance window.

6) Logging & health checks
	- Add structured logging and `/health` endpoint; no behavior changes; required for later cutovers.

Rollback: disable flags to revert to legacy token; stop using validators (report‑only); revert read path to old balance computation; indexes and views can remain.

---

### Phase 2 (Weeks 3–4): Queue Resilience, Observability, Tests — safe parallelization
1) BullMQ worker hardening
	- Start a new “hardened” worker in SHADOW mode (consumes copies of jobs or observes events) with side‑effects disabled; record outcomes and errors.
	- Add retry policies/backoff/DLQ but do not own production traffic yet.
	- After parity confidence, gradually shift a percentage of real jobs behind flag; monitor; ramp to 100%.

2) Metrics & Tracing
	- Add OpenTelemetry/Prometheus exporters; no runtime behavior changes.
	- Create dashboards: TTS latency, queue depth, job failure rate, donation → audio end‑to‑end time.

3) Test coverage
	- Add unit/integration suites; run in CI only; no production impact.

Rollback: flip traffic back to legacy worker by flag; leave shadow worker running for diagnostics.

---

### Phase 3 (Weeks 5–6): Performance & UX — progressive enhancement
1) Frontend data layer (React Query)
	- Introduce behind `VITE_USE_REACT_QUERY=false`; keep current axios paths.
	- Ship both code paths; per‑route opt‑in; turn on for admin first; monitor cache/refetch correctness.

2) Virtualized lists & batching socket updates
	- Add virtualization behind a flag; fall back to current list rendering when OFF.
	- Batch socket updates in memory behind a flag; compare CPU/paint metrics; toggle live if regressions appear.

3) Audio pipeline improvements
	- Add preloading and “Skip” button behind flags; default OFF; enable for small % of streamers first (config‑based allowlist).

4) Accessibility & UI polish
	- ARIA and contrast updates are additive; no functional risk.

Rollback: toggle flags OFF to restore current data fetching, list rendering, and audio behavior instantly.

---

### Phase 4 (Weeks 7–8): CI/CD, OpenAPI, Secrets — parallel adoption
1) CI pipeline
	- Add as non‑blocking initially (advisory); then switch to blocking once pass rates are stable.

2) OpenAPI + generated types
	- Generate specs from current endpoints; keep v1 stable.
	- Consumers can adopt generated types incrementally; no server changes required.

3) Key rotation & secrets manager
	- Support multiple active admin/streamer keys temporarily.
	- Read from secrets manager if present; fall back to env vars; migrate env to secrets in stages.

4) Canary deployments
	- Route a small percentage of traffic (or a single instance) to new builds; compare health metrics; promote on success.

Rollback: demote canary; CI remains but gates can be marked advisory; continue reading secrets from env fallback.

---

### Phase 5 (Weeks 9+): Privacy, Encryption, E2E — reversible migrations
1) Encrypt sensitive fields
	- Add new encrypted columns (e.g., `phone_number_enc`) while keeping old columns.
	- Background job to backfill; reads prefer new with fallback; writes dual‑write.
	- After verification, stop using old columns; drop in a later maintenance window.

2) E2E coverage & policy docs
	- Add Playwright/Cypress suites; run in staging; then nightly in prod shadow mode.
	- Publish privacy notice and data handling policies; no runtime changes.

Rollback: keep old columns populated during dual‑write; switch reads back; pause backfill jobs.

---

### Operational Playbooks
- Pre‑flight checklist: flags default, env vars present, dashboards green, error budget headroom.
- Cutover steps: enable feature flag for a seed user/room; watch metrics 15–30 min; expand radius; document timestamps.
- Post‑cutover verification: compare business KPIs (donation rate, TTS success) against baseline; watch logs for schema mismatch.
- Rollback steps: disable flags; scale down new workers; re‑enable legacy; capture incident notes.

### Success Criteria for “No Regressions”
- Zero increase in 4xx/5xx rate for touched endpoints during rollout windows.
- TTS success rate unchanged or improved; queue latency p95 unchanged or improved.
- Frontend error boundary triggers not increased; session duration stable.

— End of non‑disruptive implementation plan —
