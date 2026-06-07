# Base Car Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the base `open-wheel` car a proper rear wing, front splitter, and rear diffuser (extracted from the lowpoly F1 and repainted to the livery materials), fuller body via procedural fairings at nose and tail, and a procedurally rebuilt cockpit steering wheel.

**Architecture:** A build-time script carves three repainted part GLBs out of `lowpoly-f1.glb`. They're registered in `assets.ts`, positioned by data constants in `driving.ts`, and rendered inside the existing `CircuitCar` group where the existing `useLiveriedScene` recolor paints them by material name. Body fullness and the steering wheel are pure-procedural R3F meshes that follow the livery colors directly. The lowpoly car is untouched; the original wheel track is preserved.

**Tech Stack:** React Three Fiber + three.js, `@gltf-transform/core|functions|extensions` (already in `node_modules` via the CLI dep), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-base-car-upgrade-design.md`

**Conventions reminder:** The chassis is authored nose **+Z**; the `CircuitCar` group applies `rotation-y = Math.PI` (`CAR_MODEL_FORWARD_YAW_OFFSET`) so the nose faces the −Z travel direction. Aero parts live *inside* that group, so they must also be authored nose **+Z**. The lowpoly donor is Z-up, +Y = front, cm-scale.

---

## File Structure

| File | Responsibility | Action |
| --- | --- | --- |
| `scripts/extract-car-parts.mjs` | Build the 3 repainted aero GLBs from the lowpoly | Create |
| `public/assets/cars/aero-rear-wing.glb` etc. | Generated part meshes | Generate (committed) |
| `src/game/assets.ts` | Asset path registry | Modify |
| `src/game/assets.test.ts` | Asset manifest tests | Modify |
| `src/game/driving.ts` | Placement + fairing data constants | Modify |
| `src/game/driving.test.ts` | Constant sanity tests | Modify |
| `src/game/RacingScene.tsx` | `CarAeroParts`, `CarBodyFairings`, `CockpitSteeringWheel`, wiring | Modify |

---

## Task 1: Extraction script + generate part GLBs

**Files:**
- Create: `scripts/extract-car-parts.mjs`
- Generate: `public/assets/cars/aero-rear-wing.glb`, `aero-front-splitter.glb`, `aero-rear-diffuser.glb`

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/base-car-upgrade
```

- [ ] **Step 2: Write the extraction script**

Create `scripts/extract-car-parts.mjs`:

```js
// Carves three repainted part GLBs out of the lowpoly F1 donor so the base
// CircuitCar can wear them with working liveries. Run: `node scripts/extract-car-parts.mjs`
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import {
  dedup, weld, prune, quantize, transformPrimitive,
} from '@gltf-transform/functions';

const SRC = 'public/assets/cars/lowpoly-f1.glb';
const OUT_DIR = 'public/assets/cars';

// Material names the livery recolor paints (must match driving.ts).
const BODY = 'car_color';
const ACCENT = 'car_color.001';

// For each output: which top-level donor nodes to keep, and which mesh gets
// which livery material. Mesh names come from `lowpoly-f1.glb`.
const PARTS = [
  {
    out: 'aero-rear-wing.glb',
    keepNodes: ['Spoiler', 'Spoiler_2'],
    bodyMeshes: ['Cube.004', 'Cube.008'],   // wing planes
    // everything else (Cube.001, Cube.005 = endplates/structure) -> accent
  },
  {
    out: 'aero-front-splitter.glb',
    keepNodes: ['Front_Wing3', 'Front_Wing2.001', 'Front_Spoiler'],
    bodyMeshes: ['Plane.010'],               // splitter plane
    // Cube.006, Cube.003 (wing/endplates) -> accent
  },
  {
    out: 'aero-rear-diffuser.glb',
    keepNodes: ['Wheel_Holder_rear'],
    bodyMeshes: [],                          // all accent (black diffuser)
  },
];

// --- column-major mat4 helpers ---
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++)
    o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; };
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; };
const translate = (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
const trs = (n) => {
  const t = n.getTranslation(), q = n.getRotation(), s = n.getScale();
  const [x,y,z,w] = q, x2=x+x,y2=y+y,z2=z+z;
  const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  const [sx,sy,sz] = s;
  return [(1-(yy+zz))*sx,(xy+wz)*sx,(xz-wy)*sx,0,
          (xy-wz)*sy,(1-(xx+zz))*sy,(yz+wx)*sy,0,
          (xz+wy)*sz,(yz-wx)*sz,(1-(xx+yy))*sz,0,
          t[0],t[1],t[2],1];
};

// Upright + nose+Z, no mirror: rotY(180) * rotX(-90). Z-up,+Y-front -> Y-up, nose +Z.
const G = mul(rotY(Math.PI), rotX(-Math.PI / 2));

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);

async function build(part) {
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];

  // Detach (dispose) every top-level node we are not keeping.
  for (const node of [...scene.listChildren()]) {
    if (!part.keepNodes.includes(node.getName())) node.dispose();
  }

  // Bake G * worldMatrix into each surviving mesh's vertices, then zero each
  // node's transform so the baked coords are used as-is. Children receive the
  // world matrix by parameter (not by re-reading the parent), so zeroing inline
  // is safe.
  const baked = new Set();
  const walk = (node, parentWorld) => {
    const world = mul(parentWorld, trs(node));
    const mesh = node.getMesh();
    if (mesh) {
      const m = mul(G, world);
      for (const prim of mesh.listPrimitives()) {
        if (baked.has(prim)) continue;       // guard against shared accessors
        transformPrimitive(prim, m);
        baked.add(prim);
      }
    }
    for (const child of node.listChildren()) walk(child, world);
    node.setTranslation([0,0,0]); node.setRotation([0,0,0,1]); node.setScale([1,1,1]);
  };
  for (const node of scene.listChildren()) walk(node, trs2identity());

  // Prune first so the disposed nodes' orphaned meshes don't pollute the bbox
  // / repaint passes below.
  await doc.transform(prune());

  // Recenter to the part's own origin (XYZ centroid of the bbox).
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    for (let i = 0; i < pos.getCount(); i++) {
      const v = pos.getElement(i, []);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
    }
  }
  const center = min.map((v, k) => (v + max[k]) / 2);
  const recenter = translate(-center[0], -center[1], -center[2]);
  const re = new Set();
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    if (re.has(prim)) continue; transformPrimitive(prim, recenter); re.add(prim);
  }

  // Repaint: new flat livery materials, assigned per mesh name.
  const bodyMat = doc.createMaterial(BODY).setBaseColorFactor([1,1,1,1])
    .setMetallicFactor(0.3).setRoughnessFactor(0.45);
  const accentMat = doc.createMaterial(ACCENT).setBaseColorFactor([0.05,0.05,0.06,1])
    .setMetallicFactor(0.3).setRoughnessFactor(0.5);
  for (const mesh of root.listMeshes()) {
    const useBody = part.bodyMeshes.includes(mesh.getName());
    for (const prim of mesh.listPrimitives()) prim.setMaterial(useBody ? bodyMat : accentMat);
  }

  await doc.transform(dedup(), weld(), prune(), quantize());
  await io.write(`${OUT_DIR}/${part.out}`, doc);
  console.log('wrote', part.out);
}

function trs2identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }

for (const part of PARTS) await build(part);
```

- [ ] **Step 3: Generate the GLBs**

Run: `node scripts/extract-car-parts.mjs`
Expected output:
```
wrote aero-rear-wing.glb
wrote aero-front-splitter.glb
wrote aero-rear-diffuser.glb
```

- [ ] **Step 4: Verify the GLBs are small and well-formed**

Run: `ls -la public/assets/cars/aero-*.glb`
Expected: three files exist, each well under 300 KB (rear wing tiny ~10–40 KB, splitter largest). If any file is missing or the script throws, fix before continuing.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract-car-parts.mjs public/assets/cars/aero-rear-wing.glb public/assets/cars/aero-front-splitter.glb public/assets/cars/aero-rear-diffuser.glb
git commit -m "Add car aero-part extraction script and GLBs"
```

---

## Task 2: Register aero assets, drop the steering-wheel GLB

**Files:**
- Modify: `src/game/assets.ts`
- Test: `src/game/assets.test.ts`

- [ ] **Step 1: Update the asset-manifest test**

Replace the steering-wheel test in `src/game/assets.test.ts` with aero-part assertions. The full file becomes:

```ts
import { describe, expect, it } from 'vitest';
import { assets } from './assets';

describe('game asset manifest', () => {
  it('uses optimized neutral open-wheel GLBs as the first car model', () => {
    expect(assets.cars.chassis).toBe('/assets/cars/open-wheel-chassis.glb');
    expect(assets.cars.wheel).toBe('/assets/cars/open-wheel-wheel.glb');
  });

  it('registers the repainted aero parts borrowed from the lowpoly F1', () => {
    expect(assets.cars.aeroRearWing).toBe('/assets/cars/aero-rear-wing.glb');
    expect(assets.cars.aeroFrontSplitter).toBe('/assets/cars/aero-front-splitter.glb');
    expect(assets.cars.aeroRearDiffuser).toBe('/assets/cars/aero-rear-diffuser.glb');
  });

  it('includes the low-poly F1 as a second selectable car', () => {
    expect(assets.cars.lowPoly).toBe('/assets/cars/lowpoly-f1.glb');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- assets`
Expected: FAIL — `assets.cars.aeroRearWing` is undefined; the removed steering-wheel test no longer runs.

- [ ] **Step 3: Update the asset registry**

In `src/game/assets.ts`, change the `cars` block to (removing `steeringWheel`, adding the three aero paths):

```ts
  cars: {
    chassis: '/assets/cars/open-wheel-chassis.glb',
    wheel: '/assets/cars/open-wheel-wheel.glb',
    aeroRearWing: '/assets/cars/aero-rear-wing.glb',
    aeroFrontSplitter: '/assets/cars/aero-front-splitter.glb',
    aeroRearDiffuser: '/assets/cars/aero-rear-diffuser.glb',
    lowPoly: '/assets/cars/lowpoly-f1.glb',
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- assets`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/assets.ts src/game/assets.test.ts
git commit -m "Register aero-part assets, drop steering-wheel GLB"
```

---

## Task 3: Placement + fairing data constants

**Files:**
- Modify: `src/game/driving.ts`
- Test: `src/game/driving.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/driving.test.ts`:

```ts
import { AERO_PARTS, BODY_FAIRINGS } from "./driving";

describe("car body upgrade data", () => {
  it("defines the three aero parts with unique ids", () => {
    const ids = AERO_PARTS.map((p) => p.id);
    expect(ids).toEqual(["rearWing", "frontSplitter", "rearDiffuser"]);
    expect(new Set(ids).size).toBe(3);
  });

  it("places the rear wing behind and above the front splitter", () => {
    const wing = AERO_PARTS.find((p) => p.id === "rearWing")!;
    const splitter = AERO_PARTS.find((p) => p.id === "frontSplitter")!;
    expect(wing.position[2]).toBeLessThan(splitter.position[2]); // -Z is rear
    expect(wing.position[1]).toBeGreaterThan(splitter.position[1]); // higher up
  });

  it("defines nose and tail body fairings", () => {
    expect(BODY_FAIRINGS.map((f) => f.id)).toEqual(["nose", "tail"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- driving`
Expected: FAIL — `AERO_PARTS` / `BODY_FAIRINGS` are not exported.

- [ ] **Step 3: Add the constants**

In `src/game/driving.ts`, after the existing `CAR_VISUAL_MAX_STEER_YAW` constant (around line 71), add:

```ts
// Aero parts borrowed from the lowpoly F1 and repainted to the livery
// materials. They mount inside the CircuitCar group (nose +Z, before the group
// yaw flip). Values are tuned visually against the running app; -Z is the rear
// of the car, +Y is up.
export type AeroPartId = "rearWing" | "frontSplitter" | "rearDiffuser";

export type AeroPartSpec = {
  id: AeroPartId;
  position: [number, number, number];
  rotationY: number;
  scale: number;
};

export const AERO_PARTS: AeroPartSpec[] = [
  { id: "rearWing", position: [0, 0.95, -1.7], rotationY: 0, scale: 0.011 },
  { id: "frontSplitter", position: [0, 0.18, 1.7], rotationY: 0, scale: 0.011 },
  { id: "rearDiffuser", position: [0, 0.22, -1.5], rotationY: 0, scale: 0.011 },
];

// Procedural bodywork that fills out the thin nose/tail into a full-bodied
// silhouette. Ellipsoids (scaled spheres) painted with the livery colors. `radii`
// are the x/y/z half-extents; `color` selects the body or accent livery slot.
export type BodyFairingSpec = {
  id: "nose" | "tail";
  position: [number, number, number];
  radii: [number, number, number];
  color: "body" | "accent";
};

export const BODY_FAIRINGS: BodyFairingSpec[] = [
  { id: "nose", position: [0, 0.42, 1.05], radii: [0.5, 0.3, 1.0], color: "body" },
  { id: "tail", position: [0, 0.5, -1.0], radii: [0.6, 0.42, 0.95], color: "body" },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- driving`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/driving.ts src/game/driving.test.ts
git commit -m "Add aero placement and body fairing constants"
```

---

## Task 4: Aero parts in the scene (with livery repaint)

**Files:**
- Modify: `src/game/RacingScene.tsx`

This task is verified by build + the existing tests (3D placement is not unit-testable; visual tuning happens in Task 7).

- [ ] **Step 1: Add the shared livery recolor + aero components**

In `src/game/RacingScene.tsx`, first add `AERO_PARTS`, `AeroPartSpec` to the existing import from `./driving` (alongside `CAR_WHEEL_SPECS`, etc.).

Add a module-level helper near `useLiveriedScene` (after it, ~line 306):

```tsx
// Paints the livery body/accent materials by name. Shared by the chassis and
// the borrowed aero parts (which the extraction script names car_color / car_color.001).
function createLiveryRecolor(body: string, accent: string) {
  return (material: THREE.MeshStandardMaterial) => {
    if (material.name === LIVERY_BODY_MATERIAL) {
      material.color = new THREE.Color(body);
      material.metalness = 0.35;
      material.roughness = 0.42;
    } else if (material.name === LIVERY_ACCENT_MATERIAL) {
      material.color = new THREE.Color(accent);
      material.metalness = 0.3;
      material.roughness = 0.5;
    }
    return true;
  };
}

const AERO_ASSET: Record<AeroPartSpec["id"], string> = {
  rearWing: assets.cars.aeroRearWing,
  frontSplitter: assets.cars.aeroFrontSplitter,
  rearDiffuser: assets.cars.aeroRearDiffuser,
};

function AeroPart({
  spec,
  recolor,
}: {
  spec: AeroPartSpec;
  recolor: (material: THREE.MeshStandardMaterial) => boolean;
}) {
  const raw = usePreparedModel(AERO_ASSET[spec.id], true, true, true);
  const scene = useLiveriedScene(raw, recolor);
  return (
    <group position={spec.position} rotation-y={spec.rotationY} scale={spec.scale}>
      <primitive object={scene} />
    </group>
  );
}

function CarAeroParts({
  recolor,
}: {
  recolor: (material: THREE.MeshStandardMaterial) => boolean;
}) {
  return (
    <>
      {AERO_PARTS.map((spec) => (
        <AeroPart key={spec.id} spec={spec} recolor={recolor} />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Reuse the shared recolor in `CircuitCar` and render the aero parts**

In `CircuitCar`, replace the inline `recolor` useMemo (the block at ~lines 352–366) with:

```tsx
  const recolor = useMemo(
    () => createLiveryRecolor(body, accent),
    [body, accent],
  );
```

Then, inside the returned `<group scale={0.9} rotation-y={CAR_MODEL_FORWARD_YAW_OFFSET}>`, add `<CarAeroParts>` right after the chassis primitive:

```tsx
      <primitive object={chassisScene} scale={0.85} />
      <CarAeroParts recolor={recolor} />
```

- [ ] **Step 3: Preload the aero GLBs**

At the bottom of the file, next to the existing `useGLTF.preload` calls (~lines 1208–1211), replace the `steeringWheel` preload line and add the aero preloads:

```tsx
useGLTF.preload(assets.cars.chassis);
useGLTF.preload(assets.cars.wheel);
useGLTF.preload(assets.cars.aeroRearWing);
useGLTF.preload(assets.cars.aeroFrontSplitter);
useGLTF.preload(assets.cars.aeroRearDiffuser);
useGLTF.preload(assets.cars.lowPoly);
```

(Removing `useGLTF.preload(assets.cars.steeringWheel)` — the property no longer exists. The `steeringWheelScene` load is removed in Task 6.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: passes. (If it complains about `assets.cars.steeringWheel` still referenced in the `usePreparedModel(assets.cars.steeringWheel, ...)` call, that line is removed in Task 6 — comment it out temporarily or proceed to Task 6 before the full build. To keep this task self-contained, leave the steering-wheel code untouched here and only remove the *preload* line in this step.)

- [ ] **Step 5: Commit**

```bash
git add src/game/RacingScene.tsx
git commit -m "Render repainted aero parts on the base car"
```

---

## Task 5: Procedural body fairings

**Files:**
- Modify: `src/game/RacingScene.tsx`

- [ ] **Step 1: Add the `CarBodyFairings` component**

Add `BODY_FAIRINGS` to the `./driving` import. Add this component near `DriverFigure` (~line 439):

```tsx
function CarBodyFairings({ body, accent }: { body: string; accent: string }) {
  return (
    <>
      {BODY_FAIRINGS.map((fairing) => (
        <mesh
          key={fairing.id}
          castShadow
          receiveShadow
          position={fairing.position}
          scale={fairing.radii}
        >
          <sphereGeometry args={[1, 18, 14]} />
          <meshStandardMaterial
            color={fairing.color === "body" ? body : accent}
            metalness={0.3}
            roughness={0.45}
          />
        </mesh>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Render fairings inside `CircuitCar`**

Inside the same car group, after `<CarAeroParts recolor={recolor} />`, add:

```tsx
      <CarBodyFairings body={body} accent={accent} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/game/RacingScene.tsx
git commit -m "Add procedural nose/tail body fairings"
```

---

## Task 6: Procedural cockpit steering wheel

**Files:**
- Modify: `src/game/RacingScene.tsx`

- [ ] **Step 1: Add the `CockpitSteeringWheel` component**

Add near `DriverFigure` (~line 439):

```tsx
// Modern squared-off F1 wheel: a rim, two side grips, and a button face.
// Accent-tinted so it reads against the dark cockpit. Rotation is driven by the
// parent group's steeringWheelRef.
function CockpitSteeringWheel({ accent }: { accent: string }) {
  return (
    <group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.08, 12, 24]} />
        <meshStandardMaterial color="#0b0b0f" roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Button face */}
      <mesh castShadow position={[0, 0, -0.02]}>
        <boxGeometry args={[0.62, 0.42, 0.08]} />
        <meshStandardMaterial color="#15151c" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Accent strip / top marker */}
      <mesh position={[0, 0.16, 0.03]}>
        <boxGeometry args={[0.16, 0.05, 0.02]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
      </mesh>
      {/* Side grips */}
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow position={[side * 0.42, -0.06, 0.06]} rotation={[0, 0, side * 0.5]}>
          <capsuleGeometry args={[0.07, 0.26, 4, 8]} />
          <meshStandardMaterial color="#1b1b22" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Replace the GLB steering wheel and remove its load**

In `CircuitCar`, delete the `steeringWheelScene` declaration (the `usePreparedModel(assets.cars.steeringWheel, true, true, true)` block, ~lines 369–374).

In the driver-view block (~lines 398–407), replace `<primitive object={steeringWheelScene} />` so the block reads:

```tsx
      {view === "driver" && (
        <group
          ref={steeringWheelRef}
          position={[0, 0.82, 0.36]}
          rotation={[Math.PI * 0.08, 0, 0]}
          scale={0.42}
        >
          <CockpitSteeringWheel accent={accent} />
        </group>
      )}
```

- [ ] **Step 3: Full typecheck + build**

Run: `npx tsc -b`
Expected: passes with no remaining reference to `assets.cars.steeringWheel` or `steeringWheelScene`.

- [ ] **Step 4: Run the whole test suite**

Run: `npm test`
Expected: all suites PASS (assets, driving, vehicle, track, network, CircuitTrack).

- [ ] **Step 5: Commit**

```bash
git add src/game/RacingScene.tsx
git commit -m "Replace GLB steering wheel with procedural cockpit wheel"
```

---

## Task 7: Live visual tuning + final verification

**Files:**
- Modify (tuning only): `src/game/driving.ts`, possibly `src/game/RacingScene.tsx`

3D placement can only be judged on screen. This task dials in the constants from Tasks 3 and the steering-wheel mount.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with no errors.

- [ ] **Step 2: Run the app and inspect the base car (chase view)**

Use the `/run` skill (or `npm run dev`) to launch and screenshot. Select "Apex OW-1".
Verify, adjusting `AERO_PARTS` and `BODY_FAIRINGS` in `driving.ts` as needed:
- Rear wing sits high and at the rear, facing forward (not backward/upside down). If it faces backward, set its `rotationY` to `Math.PI`; if inverted, revisit the `G` rotation in the extraction script and re-run Task 1.
- Front splitter sits low at the nose; rear diffuser low at the back.
- Nose and tail read full-bodied (fairings bulk out the thin areas) without clipping through the wheels or floating.

- [ ] **Step 3: Verify liveries paint the new parts**

Cycle through the liveries in the pre-race UI. Confirm the rear wing, splitter, diffuser, and fairings recolor with the body/accent colors of each livery (they should never show the lowpoly stripe texture).

- [ ] **Step 4: Verify the cockpit steering wheel (driver view)**

Switch to driver/cockpit view. Confirm the procedural wheel renders centered, and rotates left/right with A/D steering input.

- [ ] **Step 5: Verify no regression on the lowpoly car**

Select "Veloce LP" and confirm it looks exactly as before (no aero parts, no fairings attached).

- [ ] **Step 6: Commit any tuning changes**

```bash
git add src/game/driving.ts src/game/RacingScene.tsx
git commit -m "Tune aero/fairing placement and steering wheel"
```

- [ ] **Step 7: Update the asset-pipeline doc**

Add a short note to `docs/asset-pipeline.md` describing `scripts/extract-car-parts.mjs` (what it carves out of the lowpoly, that parts are renamed to the livery materials, and how to re-run it). Commit:

```bash
git add docs/asset-pipeline.md
git commit -m "Document car-part extraction script"
```

---

## Notes for the implementer

- **Don't delete `sndcar-f1-steering-wheel.glb`.** It is orphaned by Task 6 but left on disk; removing the file is out of scope unless the user asks.
- **The extraction `G` matrix (upright + nose +Z) is the riskiest piece.** If parts come out mis-oriented, prefer fixing `rotationY` per-part in `driving.ts` for a 180° yaw; only edit `G` for up/down or roll problems, and re-run Task 1 + re-commit the GLBs.
- **`transformPrimitive` mutates accessors in place;** the `baked`/`re` guards prevent double-applying to any shared accessor. Within each part the meshes are unique, so this is belt-and-suspenders.
