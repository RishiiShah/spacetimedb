# Base Car Upgrade — Aero Parts, Body Fairings & Steering Wheel

Date: 2026-06-07
Status: Approved design, pending implementation plan

## Goal

Make the base car (`open-wheel` / "Apex OW-1", the `CircuitCar` component) look like a
complete F1 car while keeping its livery system and its wide wheel track. Three
upgrades:

1. **Aero parts** borrowed from the lowpoly F1 — a proper rear wing, a front
   splitter/nose wing, and a rear diffuser/crash structure — repainted so every
   livery colors them.
2. **Body fairings** — procedural, livery-painted panels that fill out the body
   at both the nose and tail, which currently taper to a thin point, so the car
   reads as full-bodied like the new car.
3. **Steering wheel** — replace the borrowed `sndcar` cockpit wheel with a
   procedurally built modern F1 wheel.

The lowpoly car (`Veloce LP`) is **not** changed. The original car's wide stance
(wheel track) is preserved — it is defined by `CAR_WHEEL_SPECS` in code,
independent of the body mesh.

## Background

- The base car is composed in code (`RacingScene.tsx` → `CircuitCar`): the
  `open-wheel-chassis.glb` body, four wheels, procedural suspension links, a
  procedural driver, and the cockpit steering wheel GLB.
- Liveries recolor **by material name**: `useLiveriedScene` clones each material
  and the `recolor` callback paints `car_color` → body color and `car_color.001`
  → accent color (`LIVERY_BODY_MATERIAL` / `LIVERY_ACCENT_MATERIAL`).
- The lowpoly F1 (`lowpoly-f1.glb`) has cleanly named, separable nodes for its
  wing/spoiler/diffuser parts, but they all share **one baked stripe texture** —
  so a borrowed part must have its material reassigned to the livery names to be
  paintable.
- Coordinate conventions: the lowpoly is Z-up, +Y = front, cm-scale; the game is
  Y-up and the chassis is authored nose +Z with a 180° group yaw
  (`CAR_MODEL_FORWARD_YAW_OFFSET`). See `docs/asset-pipeline.md` and the
  car-rendering conventions.

## Part mapping (donor nodes in `lowpoly-f1.glb`)

| Output GLB | Source nodes | ~verts | Repaint |
| --- | --- | --- | --- |
| `aero-rear-wing.glb` | `Spoiler` (Cube.004, Cube.001), `Spoiler_2` (Cube.008, Cube.005) | ~760 | wing planes → `car_color` (body); endplates/structure → `car_color.001` (accent) |
| `aero-front-splitter.glb` | `Front_Wing3`, `Front_Wing2.001`, `Front_Spoiler` | ~7950 (quantized) | splitter plane → `car_color`; wing/endplates → `car_color.001` |
| `aero-rear-diffuser.glb` | `Wheel_Holder_rear` | ~1185 | `car_color.001` (accent / black) |

## Design

### 1. Extraction script — `scripts/extract-car-parts.mjs`

A build-time Node script (same toolchain as the FBX→GLB pipeline:
`@gltf-transform/core` + `functions` + `KHRMeshQuantization`). For each of the
three parts it:

- keeps only that part's source nodes and prunes the rest;
- **re-centers** the part to its own origin so R3F positions it directly;
- **bakes orientation + approximate scale** so the GLB comes out Y-up, nose +Z
  (matching the chassis authoring), at roughly base-car scale (~0.007 of the
  lowpoly cm units);
- **reassigns materials** to new materials named `car_color` / `car_color.001`
  (white / near-black base color, no texture), per the table above;
- runs `dedup, weld, prune, quantize` and writes to `public/assets/cars/`.

Run manually; output committed (same convention as `lowpoly-f1.glb`). Because the
parts are named with the livery material names, the existing `useLiveriedScene`
recolor paints them with **no new recolor logic**.

### 2. Asset registry — `src/game/assets.ts`

- Add `aeroRearWing`, `aeroFrontSplitter`, `aeroRearDiffuser` paths and their
  `useGLTF.preload` calls.
- Remove the `steeringWheel` entry and its preload (orphaned by the procedural
  rebuild). `sndcar-f1-steering-wheel.glb` becomes an unused file — flagged, not
  deleted, unless you want it removed.

### 3. Placement & fairing constants — `src/game/driving.ts`

Co-located with the existing `CAR_MODEL_*` constants for one tunable, testable
place:

- `AERO_PARTS`: a table of `{ id, asset, position, rotation, scale }` for the
  three GLB parts. Starting scale ~0.007; rear wing high & rear, splitter low &
  front, diffuser low & rear.
- `BODY_FAIRINGS`: specs for the procedural panels — a front nose fairing and a
  rear/engine-cover fairing (each a position + size, and which color slot
  body/accent). Sized to bridge the thin nose/tail into the body width.

Final numbers dialed in against the running app.

### 4. Scene — `src/game/RacingScene.tsx`

- `CarAeroParts`: rendered inside `CircuitCar`'s car group (sibling of
  `chassisScene`). Loops `AERO_PARTS`, loads each via `usePreparedModel`, runs it
  through the **existing** `useLiveriedScene(recolor)`, and places it by its
  constants. Rendered in both views and on remote cars — it is part of the car
  body, so all players see the upgraded car.
- `CarBodyFairings`: procedural meshes (tapered boxes / simple extrusions) from
  `BODY_FAIRINGS`, using `<meshStandardMaterial color={body | accent}>` so they
  follow the livery directly (no material-name matching needed). Matches the
  existing procedural style (driver, suspension links, cockpit box).
- `CockpitSteeringWheel`: a procedural modern F1 wheel (squared-off rim, grips,
  button face, accent trim) replacing the `<primitive object={steeringWheelScene}>`
  in the driver-view block. Reuses the existing `steeringWheelRef` /
  `rotation.z` steer wiring.
- Remove the `steeringWheelScene` load and its preload.

### 5. Units & boundaries

| Unit | Does what | Depends on |
| --- | --- | --- |
| `extract-car-parts.mjs` | builds 3 repainted aero GLBs from the lowpoly | gltf-transform, `lowpoly-f1.glb` |
| `assets.ts` | registers + preloads the new GLB paths | the built GLBs |
| `driving.ts` constants | placement/fairing data | none (pure data) |
| `CarAeroParts` | loads + repaints + places aero GLBs | assets, `useLiveriedScene`, constants |
| `CarBodyFairings` | procedural body panels | `body`/`accent` props, constants |
| `CockpitSteeringWheel` | procedural cockpit wheel | steer ref |

## Verification

- `npm run build` and `tsc` clean; `vitest` suite green.
- Add an assertion in `assets.test.ts` that the three aero paths are registered.
- `/run` the app:
  - Chase view: Apex OW-1 shows rear wing + front splitter + rear diffuser
    correctly placed; the nose and tail read full-bodied (fairings present).
  - Cycle liveries: aero parts and fairings recolor with body/accent.
  - Driver view: the new procedural steering wheel rotates with steer input.
  - The lowpoly car is unchanged.

## Risks / notes

- **Transform-fitting is the fiddly part** — orientation/scale/position for the
  aero parts and fairing sizes need a couple of live-iteration passes. The
  constants are isolated for exactly this.
- Front splitter is the heaviest donor (~8k verts); quantized on extraction. If
  still too dense, decimate or fall back to a procedural splitter for that piece.
- Lowpoly parts are single-material; the body/accent two-tone split is done
  per-source-node, not per-face — clean enough for these shapes.
- Fairings are stylized panels, not a body re-mesh; they bulk out the silhouette
  while preserving the original chassis's window/light detail and wide track.
