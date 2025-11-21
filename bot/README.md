# Bot Module Overview

This directory houses the Telegram bot runtime. The refactor split the bot into composable handler modules and introduced a Redis-backed state store so conversational flows survive restarts.

## Folder Map

- `bot.js` – initializes the Telegram client, loads settings, and wires handler registrars.
- `handlers/commands.js` – all `/command` handlers.
- `handlers/messages.js` – multi-step state machine (registration, donation, recharge, complaints).
- `handlers/callbacks.js` – inline keyboard interactions.
- `stateStore.js` – dual-write Redis + in-memory adapter used by the handlers.
- `tests/stateStore.test.js` – smoke tests for the state store contract.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `BOT_STATE_REDIS_URL` | falls back to `REDIS_URL` | Redis connection string used for bot state. |
| `BOT_STATE_ENABLE_REDIS` | `true` if a URL is provided | Toggle Redis usage entirely. Set to `false` to force in-memory mode. |
| `BOT_STATE_DUAL_WRITE` | `true` | When `true`, state is written to both Redis and in-memory cache for safe rollout. |
| `BOT_STATE_PREFER_REDIS` | `true` | Controls whether reads attempt Redis first. Disable to read from memory while still dual-writing. |
| `BOT_USER_STATE_TTL_SECONDS` | `1800` | Default TTL for user state machine entries. |
| `BOT_PENDING_DONATION_TTL_SECONDS` | `900` | TTL for pending donation selections. |

## Testing

Run the lightweight smoke suite to validate the state store contract:

```
npm run test:bot-state
```

The test exercises `createStateStore` with basic set/get/delete flows and collection updates, ensuring compatibility for both Redis-enabled and in-memory scenarios.

## Operational Notes

- Redis failures automatically fall back to the in-memory cache while logging errors; no process restart is required.
- Handler modules interact with the store through async `get/set/delete` helpers—always `await` these calls when adding new flows.
- To roll back to in-memory behavior, set `BOT_STATE_ENABLE_REDIS=false` and restart the bot. The existing handler code requires no changes.
