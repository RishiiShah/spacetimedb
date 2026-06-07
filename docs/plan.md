# SpaceTimeDB Racer MVP Plan

## Goal

Ship a hosted, playable browser MVP: a low-poly racing time-trial with a SpaceTimeDB-backed multiplayer lobby, live opponent positions, lap/checkpoint timing, ghost replay rows, and runtime GLB assets.

## Current State

Built so far:

- Pre-race menu with mode, track, name, and room selection
- Three game modes: circuit, stunt, practice
- Ten playable tracks in `TRACK_REGISTRY` (city loop, seven mapped circuits, stunt showcase, flat practice)
- Open-wheel car model with handbrake and checkpoint reset
- Keyboard input layer in `src/game/driving.ts`
- Circuit map loading via `CircuitTrack.tsx` and JSON under `public/assets/circuit/maps/`
- SpaceTimeDB racing schema with rooms, car state, checkpoints, laps, and ghost frames
- Vitest coverage for vehicle, driving, track, circuit parsing, assets, network, and app shell

## Product Cut

- Instant start, instant restart, checkpoints, lap timer, ghosts.
- Open-wheel car, racing HUD, engine sounds, road/skybox feel.
- City GLBs as background scenery on the city loop.
- SpaceTimeDB as the authoritative realtime database for identity, rooms, race state, transforms, checkpoints, and leaderboards.

## Repository Shape

- `spacetimedb/src/index.ts` — SpaceTimeDB schema and reducers.
- `src/` — React/React Three Fiber client.
- `src/game/` — driving input, vehicle, track registry, scene, network, assets.
- `public/assets/` — runtime GLBs, audio, skybox, and circuit map JSON.
- `docs/` — architecture, schema, deployment, asset pipeline, limitations.

## Technical Direction

Use a browser client with React, Vite, React Three Fiber, and a lightweight local vehicle controller. Do not simulate authoritative car physics in SpaceTimeDB for the MVP. The client sends compact transform snapshots and checkpoint events; SpaceTimeDB validates room membership, stores current car state, and records lap/ghost data.

## Remaining Work

### Car mechanics

- Improve steering, grip, and surface response per track.
- Expand driving tests and telemetry hooks.

### Multiplayer polish

- Tighter checkpoint validation and lap sequence checks server-side.
- Ghost replay playback in the HUD.

### Hosting

- Publish module to your SpaceTimeDB server; database name in `.env.local` only.
- Build and deploy static client. See `docs/deployment.md`.

## MVP Acceptance Criteria

- A user can open the hosted URL and see a 3D racing scene.
- A user can drive a car with keyboard controls.
- Two users can join the same SpaceTimeDB-backed room and see each other move.
- The client shows lap timer and checkpoint progress.
- Finished laps are written to SpaceTimeDB and shown in a leaderboard.
- Runtime assets live under `public/assets/`.

## Non-Goals

- Full track editor.
- Server-authoritative physics.
- Collision-perfect city mesh.
- Account system beyond SpaceTimeDB identity.
- Ranked anti-cheat.
- Mobile controls.

## Commands

```bash
npm install
npm run test
npm run build
spacetime publish --module-path spacetimedb --server maincloud <database-name>
npm run dev
```

## Risks

- SpaceTimeDB publish may require existing login/session and maincloud access.
- Browser performance suffers if too many heavy GLBs are bundled — keep the runtime payload small.
- Generated bindings must be regenerated after changing the SpaceTimeDB module.
