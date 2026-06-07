import { describe, expect, it } from "vitest";
import { stuntShowcaseTrack } from "./track";
import {
  applyStuntVehiclePhysics,
  constrainToStuntArenaBounds,
  findDominantStuntSurface,
  sampleRampDeckTopY,
  sampleStuntGroundHeight,
  stuntShowcaseArena,
} from "./stuntArena";
import { sampleRenderedDeckTopY } from "./stuntSurfaceGeometry";
import { createInitialVehicleState, stepVehicle } from "./vehicle";

describe("stunt arena", () => {
  it("samples ramp and platform heights", () => {
    expect(sampleStuntGroundHeight(0, 1.1, 0, stuntShowcaseArena)).toBe(0);
    expect(sampleStuntGroundHeight(0, 1.1, 52, stuntShowcaseArena)).toBeGreaterThan(
      5,
    );
    expect(sampleStuntGroundHeight(0, 1.1, 95, stuntShowcaseArena)).toBe(11);
  });

  it("keeps solid stunt decks from overlapping", () => {
    const solids = stuntShowcaseArena.surfaces.filter(
      (surface) => surface.type === "plane" || surface.type === "ramp",
    );

    for (let left = 0; left < solids.length; left += 1) {
      for (let right = left + 1; right < solids.length; right += 1) {
        const a = solids[left];
        const b = solids[right];
        const overlapX = a.maxX > b.minX && a.minX < b.maxX;
        const overlapZ = a.maxZ > b.minZ && a.minZ < b.maxZ;
        expect(overlapX && overlapZ).toBe(false);
      }
    }
  });

  it("matches rendered deck tops with physics sampling", () => {
    const checks = [
      { x: 0, z: 0 },
      { x: 0, z: 52 },
      { x: 0, z: 95 },
      { x: 60, z: 0 },
      { x: 132, z: 14 },
    ];

    for (const point of checks) {
      const physics = sampleStuntGroundHeight(
        point.x,
        1.1,
        point.z,
        stuntShowcaseArena,
      );
      const dominant = findDominantStuntSurface(
        point.x,
        point.z,
        stuntShowcaseArena,
      );
      const rendered =
        dominant &&
        sampleRenderedDeckTopY(point.x, point.z, dominant.surface);
      expect(rendered).not.toBeNull();
      expect(physics).toBeCloseTo(rendered ?? 0, 2);
    }

    const launchRamp = stuntShowcaseArena.surfaces.find(
      (surface) => surface.type === "ramp" && surface.minZ === 32,
    );
    expect(launchRamp?.type).toBe("ramp");
    if (launchRamp?.type === "ramp") {
      expect(sampleRampDeckTopY(0, 52, launchRamp)).toBeCloseTo(
        sampleRenderedDeckTopY(0, 52, launchRamp) ?? 0,
        4,
      );
    }
  });

  it("keeps the car inside the rectangular bounds", () => {
    const state = {
      ...createInitialVehicleState(),
      position: { x: 200, y: 1.1, z: 0 },
      speed: 30,
      heading: Math.PI / 2,
    };

    const bounded = constrainToStuntArenaBounds(
      state,
      stuntShowcaseArena.bounds,
    );

    expect(bounded.position.x).toBeLessThanOrEqual(
      stuntShowcaseArena.bounds.maxX - 1.55,
    );
    expect(bounded.speed).toBeLessThan(30);
  });

  it("follows stunt surfaces during vehicle stepping", () => {
    const state = {
      ...createInitialVehicleState(),
      position: { x: 0, y: 1.1, z: 10 },
      speed: 24,
      heading: 0,
      verticalSpeed: 0,
    };

    const next = stepVehicle(
      state,
      { throttle: 1, brake: 0, steer: 0 },
      0.05,
      stuntShowcaseTrack,
    );

    expect(next.position.y).toBeGreaterThan(1);
    expect(next.position.z).toBeLessThan(state.position.z);
  });

  it("launches off ramp lips with gravity", () => {
    const launched = applyStuntVehiclePhysics(
      {
        position: { x: 0, y: 12.1, z: 129 },
        heading: Math.PI,
        speed: 28,
        steer: 0,
        reverseArm: 0,
      },
      stuntShowcaseArena,
      { verticalSpeed: 0, lastGroundY: 12.1, airborne: false },
      0.016,
    );

    expect(launched.extras.airborne).toBe(true);
    expect(launched.extras.verticalSpeed).toBeGreaterThan(0);
  });
});
