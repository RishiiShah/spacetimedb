# SpaceTimeDB Racer

A browser-based multiplayer open-wheel racing game built with React, Three.js, and [SpacetimeDB](https://spacetimedb.com). Drive on real-world-inspired circuits, a city loop, stunt arenas, or a flat practice road — alone or with friends in shared rooms — with live car positions, checkpoint timing, and lap leaderboards.

## Why SpacetimeDB?

Traditional multiplayer games usually need three separate pieces: a game client, a custom backend server, and a database. The server handles connections, validates actions, stores state, and pushes updates to other players. That stack is powerful but heavy for an MVP — you write networking glue, manage WebSocket fan-out, design REST or RPC APIs, and keep server and database in sync.

**SpacetimeDB collapses the server and database into one system.** Application logic runs inside the database as a WebAssembly module. Clients connect directly over WebSocket, call reducers to mutate state, and subscribe to SQL queries for live data. There is no separate game server to deploy, scale, or maintain.

This project uses SpacetimeDB because racing multiplayer needs exactly what it provides:

| Need | How SpacetimeDB handles it |
| ---- | -------------------------- |
| **Room-based matchmaking** | `room` and `room_member` tables with reducers like `join_or_create_room` |
| **Live car positions** | `car_state` table; clients publish transforms, all subscribers get row updates instantly |
| **Race events** | `checkpoint_event`, `lap_result`, and `ghost_frame` tables persist timing and replay data |
| **Shared race start** | `room_race_start` row acts as a synchronized start signal for all room members |
| **Player identity** | Built-in `identity` per connection — no custom auth server required for the MVP |
| **Transactional rules** | Reducers enforce membership checks atomically (e.g. reject `publish_car_state` from non-members) |

The client still runs all rendering and physics locally for responsive driving. SpacetimeDB is the **authoritative sync and persistence layer** — not a physics engine. Local simulation stays at 60 fps; position snapshots publish at ~10–20 Hz and remote cars are interpolated on receive.

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser Client (React + React Three Fiber)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Local driving│  │ 3D rendering │  │ HUD / leaderboard│  │
│  │ & physics    │  │ & audio      │  │ from subscriptions│  │
│  └──────┬───────┘  └──────────────┘  └────────▲─────────┘  │
│         │ publish transforms / race events     │ live rows  │
└─────────┼──────────────────────────────────────┼────────────┘
          │ reducers                             │ subscriptions
          ▼                                      │
┌─────────────────────────────────────────────────────────────┐
│  SpacetimeDB Module (TypeScript → WASM)                     │
│  Tables: player, room, car_state, lap_result, ghost_frame…  │
│  Reducers: join_room, publish_car_state, finish_lap, …      │
└─────────────────────────────────────────────────────────────┘
```

Static assets (GLB models, textures, audio, circuit map JSON) are served from the Vite client. SpacetimeDB stores only compact game state and race events.

## Features

- **Three game modes** — Circuit, Stunt, and Practice, each with its own track selection
- **Pre-race lobby** — display name, room slug, mode picker, and track picker
- **Multiplayer rooms** — create or join by room code; host starts races when two or more players are ready
- **Open-wheel driving** — WASD / arrow keys, handbrake, checkpoint reset
- **Multiple tracks** — mapped circuits (Monza, Austria, Brands Hatch, Interlagos, Indy, Monaco, and more), a city loop, stunt showcase with loops and corkscrews, and a flat practice road
- **Live multiplayer** — see other players' cars with interpolated movement
- **Lap timing** — checkpoint gates, elapsed time, and room leaderboards
- **Ghost replay frames** — sampled transforms stored for best-lap comparison (foundation for ghost racing)

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Client UI | React 18, Vite, TypeScript |
| 3D rendering | Three.js, React Three Fiber, Drei |
| Physics | Client-side kinematic controller (Rapier available for future work) |
| State | Zustand |
| Backend | SpacetimeDB 2.x module (TypeScript) |
| Client SDK | `spacetimedb` npm package with generated bindings |

## Controls

| Input | Action |
| ----- | ------ |
| W / ↑ | Throttle |
| S / ↓ | Brake |
| A / ← | Steer left |
| D / → | Steer right |
| Space | Handbrake |
| R | Reset to last checkpoint |
| C | Toggle camera mode |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [SpacetimeDB CLI](https://spacetimedb.com/install) (`spacetime` command)

### Install and run locally

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set your database name:

```env
VITE_SPACETIMEDB_HOST=ws://localhost:3000
VITE_SPACETIMEDB_DB_NAME=your-database-name
```

Generate client bindings and start the dev server:

```bash
npm run generate
npm run dev
```

In a separate terminal, start SpacetimeDB and publish the module:

```bash
spacetime start
npm run spacetime:publish:local
```

Open the Vite URL (typically `http://localhost:5173`). Open a second browser profile or incognito window, join the same room slug, and drive.

### Environment variables

| Variable | Purpose |
| -------- | ------- |
| `VITE_SPACETIMEDB_HOST` | WebSocket URI. Defaults to `ws://localhost:3000` when unset. |
| `VITE_SPACETIMEDB_DB_NAME` | Database name. Required — set in `.env.local` for local and production. |

Never commit `.env.local`. See `.env.example` for the template.

## Project Structure

```text
src/
  App.tsx                 Pre-race menu, SpacetimeDB connection, subscriptions
  main.tsx                Vite entry, SpacetimeDB client bootstrap
  module_bindings/        Generated TypeScript bindings (do not edit by hand)
  game/
    driving.ts            Keyboard input → vehicle controls
    vehicle.ts            Kinematic car simulation, checkpoint reset
    track.ts              Track registry, checkpoints, city asset placements
    CircuitTrack.tsx      Circuit JSON → road mesh
    StuntTrack.tsx        Procedural stunt geometry
    RacingScene.tsx       Scene graph, camera, audio, multiplayer sync loop
    network.ts            Car snapshot shaping and remote interpolation
    assets.ts             Runtime asset path manifest

spacetimedb/
  src/index.ts            Tables, reducers, lifecycle hooks

public/assets/            GLB models, audio, skybox, circuit map JSON

docs/                     Architecture, schema, deployment, asset pipeline
```

## SpacetimeDB Module

The module in `spacetimedb/` defines the multiplayer data model:

- **Players** — identity, display name, online status
- **Rooms** — slug-based join codes, track assignment, race start signals
- **Car state** — latest position, rotation, speed, and checkpoint per player
- **Race results** — checkpoint events, lap times, ghost replay frames

Key reducers: `set_player_name`, `join_or_create_room`, `start_room_race`, `publish_car_state`, `record_checkpoint`, `finish_lap`, `record_ghost_frame`.

After changing the module schema or reducers:

```bash
npm run generate          # Regenerate client bindings
npm run spacetime:publish:local   # Local server
npm run spacetime:publish         # SpacetimeDB Maincloud
```

Full schema reference: [`docs/spacetimedb-schema.md`](docs/spacetimedb-schema.md).

## Development

```bash
npm run dev        # Vite dev server with HMR
npm run test       # Vitest unit tests
npm run build      # Production client build
npm run lint       # ESLint + Prettier check
npm run format     # Prettier write
```

### Typical workflow

1. Edit client code under `src/game/`.
2. Edit server logic under `spacetimedb/src/`.
3. Run `npm run generate` after any module change.
4. Republish with `npm run spacetime:publish:local`.
5. Reload the browser — subscriptions pick up new rows automatically.

## Deployment

- **SpacetimeDB module** — publish to [Maincloud](https://spacetimedb.com) or self-hosted with `spacetime publish`.
- **Client** — `npm run build` produces a static `dist/` folder for any static host.

Set `VITE_SPACETIMEDB_HOST` and `VITE_SPACETIMEDB_DB_NAME` in your hosting provider's environment (or a build-time `.env.local`). Details: [`docs/deployment.md`](docs/deployment.md).

## Architecture Notes

- **Client-predicted physics** — the local car simulates every frame; the server stores snapshots, not a physics tick loop. This keeps input latency low.
- **Subscription-driven UI** — leaderboards, remote cars, and room state all render from subscribed table rows, not reducer return values.
- **Reducer authorization** — every mutation checks `ctx.sender` membership in the target room. Client-supplied identity arguments are never trusted.
- **Asset boundary** — large binary assets stay in `public/assets/`. Only track metadata and race events live in SpacetimeDB.

Deeper design docs: [`docs/architecture.md`](docs/architecture.md).

## Known Limitations (MVP)

- Car physics are client-side and not cheat-proof.
- SpacetimeDB stores latest transforms and race events; it does not run a physics simulation.
- Background city props are visual only (no collision unless proxies are added).
- Server-side checkpoint sequence validation is minimal — clients report their own timing.

See [`docs/mvp-limitations.md`](docs/mvp-limitations.md) for the full list.

## Further Reading

| Document | Contents |
| -------- | -------- |
| [`docs/architecture.md`](docs/architecture.md) | System diagram, client vs server responsibilities, networking model |
| [`docs/spacetimedb-schema.md`](docs/spacetimedb-schema.md) | Table and reducer reference |
| [`docs/deployment.md`](docs/deployment.md) | Publish commands, hosting checklist |
| [`docs/asset-pipeline.md`](docs/asset-pipeline.md) | Runtime asset inventory and paths |
| [`AGENTS.md`](AGENTS.md) | Contributor and agent conventions |

## License

Private project — not published to a package registry.
