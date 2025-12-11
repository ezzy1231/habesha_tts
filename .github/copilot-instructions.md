# HabeshaTTS Copilot Instructions

## Architecture Overview
This is a **real-time TTS donation platform** with three main components:
- **Backend** (`backend/`): Express API + BullMQ worker (single process via `backend/index.js`)
- **Frontend** (`frontend/`): React SPA (Vite + Tailwind) with streamer/admin dashboards
- **Bot** (`bot/`): Telegram bot with Redis-backed state machine for multi-step flows

**Data flow**: Donor → Telegram Bot → Backend API → BullMQ Queue → TTS Worker → Socket.IO → Streamer Dashboard

## Critical Patterns

### Database Access
- Use `db-postgres.js` exclusively (not `db.js` or `db-simple.js`)
- Always use parameterized queries: `db.query('SELECT * FROM users WHERE id = $1', [id])`
- For transactions, acquire client: `const client = await db.getClient(); await client.query('BEGIN');`

### Bot State Machine (`bot/stateStore.js`)
- State flows use Redis with in-memory fallback (dual-write enabled by default)
- Always `await` state operations: `await userStates.set(tgId, { step: 'next_step', ...data })`
- Handler registration pattern in `bot/handlers/`:
```javascript
export const registerMessageFlows = (bot, deps = {}) => {
  const { db, userStates, pendingDonations } = deps;
  bot.on('message', async (msg) => { /* ... */ });
};
```

### Real-time Updates
- Socket.IO rooms: `admin` for admin dashboard, `linkUuid` for streamer-specific events
- Emit pattern: `io.to('admin').emit('event_name', payload)`
- Use `emitAdminEvent()` from `backend/utils/adminNotifications.js` for admin broadcasts

### Authentication
- Admin routes: `x-admin-token` header checked against `ADMIN_TOKEN` env var
- Streamer routes: `protectStreamer` middleware validates `link_uuid` + `api_key`
- Bot instance lock uses Redis to prevent duplicate Telegram polling

### Queue Processing (`backend/queue-optimized.js`)
- Single `ttsQueue` handles TTS generation jobs
- Worker runs in-process (no separate worker command needed)
- Job data must include: `donationId`, `spokenText`, `engine`, `voice`, `streamer_id`, `link_uuid`

## Project-Specific Conventions

### Frontend Components
- Use `createPortal(content, document.body)` for modals to escape parent constraints
- Dark mode: check `document.documentElement.classList.contains('dark')`
- API calls use axios with `VITE_BASE_URL` as base

### Amharic Text
- Bot messages are in Amharic (use existing message patterns as templates)
- TTS uses Google Cloud with `am-ET` language code
- Sanitize text before TTS: remove zero-width chars, control chars

### Balance/Ledger Operations
- Use `getStreamerBalance()` and `insertLedgerEntry()` from `backend/utils/balance.js`
- Ledger feature flags: `LEDGER_DUAL_WRITE`, `LEDGER_READ_ENABLED`, `LEDGER_READ_FALLBACK`

## Common Commands
```bash
# Backend (from repo root)
npm run dev          # Start with nodemon
npm start            # Production start

# Frontend (from frontend/)
npm run dev          # Vite dev server
npm run build        # Production build

# Testing
npm run test:bot-state  # Bot state store tests
```

## Key Files Reference
| Purpose | File |
|---------|------|
| Main entry | `backend/index.js` |
| Database | `backend/db-postgres.js` |
| Queue/Worker | `backend/queue-optimized.js` |
| Bot entry | `bot/bot.js` |
| Bot state | `bot/stateStore.js` |
| Admin routes | `backend/routes/admin.js` |
| Live status | `backend/utils/liveStatus.js` |
| TTS generation | `bot/utils/tts.js` |
| React routes | `frontend/src/App.jsx` |
