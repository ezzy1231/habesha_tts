# Bot Architecture Improvement Plan

Scope: implement the "Maintainability: Bot Architecture" recommendation from `2025-11-21.md` without altering any other system behavior. The goal is to modularize `bot/bot.js` and persist conversational state in Redis while keeping user-visible flows identical.

## Progress Snapshot (Nov 21, 2025)
- Phase 1 ✅ scaffolding complete; handler modules and `stateStore` placeholder exist.
- Phase 2 ✅ command handlers extracted into `handlers/commands.js`.
- Phase 3 ✅ callbacks plus message state machine now live in their handler modules.
- Phase 4 ✅ Redis-backed `createStateStore` now replaces the in-memory maps with dual-write + TTL support.
- Phase 5 ✅ smoke tests (`npm run test:bot-state`) plus `bot/README.md` document the rollout and env vars.

## Phase 1 – Scaffolding & Baseline
1. Add empty modules:
	- `bot/handlers/commands.js`
	- `bot/handlers/callbacks.js`
	- `bot/handlers/messages.js`
	- `bot/stateStore.js`
2. Define initialization contracts (e.g., `registerCommands(bot, deps)`), but leave logic in `bot/bot.js` until extraction is complete.
3. Document dependencies (db, redis, notifications) each module will receive to avoid circular imports.

## Phase 2 – Command Extraction
1. Move `/start`, `/donate`, and other command handlers from `bot/bot.js` into `handlers/commands.js`.
2. Export pure functions that accept `(bot, deps)`; ensure they use the same middleware and replies as before.
3. Update `bot/bot.js` to call `registerCommands` after bot initialization and remove the inlined handlers.
4. Verify via manual Telegram smoke tests that commands behave exactly the same.

## Phase 3 – Callbacks & Message State Machine
1. Relocate callback-query logic (button presses) into `handlers/callbacks.js`, wiring `bot.on('callback_query', ...)` through the new module.
2. Move message-driven state machine flows (multi-step donation, onboarding) into `handlers/messages.js`.
3. Keep all existing conditional logic, replies, and error handling intact; only change the file boundaries.
4. Re-run manual flows (button clicks, free-form replies) to validate parity.

## Phase 4 – Redis State Store *(Completed)*
1. ✅ `stateStore.js` now exposes `createStateStore` with Redis JSON storage, TTLs, and graceful fallback logging.
2. ✅ `bot/bot.js` wires `userStates`/`pendingDonations` through the new store; handlers `await` all state calls.
3. ✅ Dual-write + `BOT_STATE_PREFER_REDIS` flag implemented for staged rollout.
4. ✅ Legacy Maps removed; Redis-only mode achieved once env toggles are flipped.

## Phase 5 – Testing & Hardening *(Completed)*
1. ✅ Added `bot/tests/stateStore.test.js` plus npm script `test:bot-state` for quick regression checks.
2. ✅ Smoke script exercises state mutations (covers core store contract for now); extend with messaging mocks next sprint.
3. ✅ Authored `bot/README.md` with module map, env vars, and testing instructions.
4. ✅ Redis error handling logs already wired in `stateStore.js`, falling back to memory on connection loss.

---

**Execution notes:** complete phases sequentially; after each phase, capture test evidence and update deployment instructions. No user-visible behavior or protocol (commands, callbacks, messages) should change during this refactor.
