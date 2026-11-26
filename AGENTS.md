# AGENTS.md

## ui-sdk (frontend)

The React app in `frontend/` uses ui-sdk (`@ui-sdk/react`, `@ui-sdk/core`; needs React 19+).

Before using ui-sdk, follow the ui-sdk skill if it's installed, and read
`frontend/node_modules/@ui-sdk/react/docs/llms.txt`.

To build a new component, also search `frontend/node_modules/@ui-sdk/react/docs/core.md`
by heading, and read `rendering.md` next to it.

The ui-sdk skill is pinned in `skills-lock.json` (installed into `.claude/skills/`, which is
not committed). Restore it with `npx skills@latest experimental_install` from the repo root.
