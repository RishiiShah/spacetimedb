# SpaceTimeDB Racer

Browser racing MVP built with React 18, Vite, React Three Fiber, and SpaceTimeDB.

## Features

- **Circuit**, **Stunt**, and **Practice** game modes with track selection
- Pre-race menu: display name, room slug, mode, and track picker
- Open-wheel car with WASD / arrow-key driving and handbrake
- Mapped circuit routes, city loop, stunt showcase, and flat practice road
- SpaceTimeDB multiplayer: rooms, live car positions, checkpoints, lap results

## Controls

| Input | Action              |
| ----- | ------------------- |
| W / ↑ | Throttle            |
| S / ↓ | Brake               |
| A / ← | Steer left          |
| D / → | Steer right         |
| Space | Handbrake           |
| R     | Reset to checkpoint |
| C     | Toggle camera       |

## Local Development

```bash
npm install
npm run generate
npm run dev
```

Optional connection overrides in `.env.local`:

- `VITE_SPACETIMEDB_HOST` — WebSocket URI (defaults to `ws://localhost:3000` for local dev)
- `VITE_SPACETIMEDB_DB_NAME` — database name (set in `.env.local`; no default for production)

Copy `.env.example` to `.env.local` to get started.

## Project Layout

```text
src/game/          Client racing logic
  driving.ts       Keyboard input mapping
  vehicle.ts       Local kinematic car controller
  track.ts         Track registry, modes, checkpoints
  CircuitTrack.tsx Circuit map mesh generation
  StuntTrack.tsx   Stunt route geometry
  RacingScene.tsx  Three.js scene, HUD, session loop
  network.ts       Car snapshot shaping for SpaceTimeDB
spacetimedb/       SpaceTimeDB module (tables + reducers)
public/assets/     Runtime GLBs, audio, skybox, circuit maps
docs/              Architecture, schema, deployment, assets
```

## SpaceTimeDB

```bash
npm run spacetime:publish
```

See `docs/deployment.md` for publish and hosting details.

## Verification

```bash
npm run test
npm run build
```
