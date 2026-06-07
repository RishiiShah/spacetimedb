# Deployment Plan

## SpaceTimeDB

Database name and connection details belong in `.env.local` only (see `.env.example`). Do not commit production values.

Publish command:

```bash
spacetime publish --module-path spacetimedb --server maincloud <database-name>
```

Generate TypeScript bindings after schema changes:

```bash
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
```

## Client

The Vite client reads two env vars from `.env.local`:

| Variable | Purpose |
| --- | --- |
| `VITE_SPACETIMEDB_HOST` | WebSocket URI |
| `VITE_SPACETIMEDB_DB_NAME` | Database name |

Local development defaults in `src/main.tsx` when unset:

```text
VITE_SPACETIMEDB_HOST=ws://localhost:3000
```

Set `VITE_SPACETIMEDB_DB_NAME` in `.env.local` for both local and hosted databases.

Build command:

```bash
npm run build
```

Deploy `dist/` to the chosen static host.

## Verification

- Open hosted URL in two browser profiles.
- Confirm both clients connect to the same SpaceTimeDB database.
- Join the same room slug.
- Drive both cars.
- Verify remote car movement appears within one second.
- Finish a lap and verify a leaderboard row appears.
