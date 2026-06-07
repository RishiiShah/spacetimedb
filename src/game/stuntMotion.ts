import type { Object3D } from "three";
import type { StuntArenaDef } from "./stuntArena";
import { sampleStuntGroundHeight } from "./stuntArena";

/** Exponential damp toward a target (frame-rate independent). */
export function dampToward(
  current: number,
  target: number,
  deltaSeconds: number,
  rate: number,
) {
  const blend = 1 - Math.exp(-rate * deltaSeconds);
  return current + (target - current) * blend;
}

export function sampleStuntSurfaceTilt(
  x: number,
  z: number,
  heading: number,
  arena: StuntArenaDef,
  sampleDistance = 1.5,
) {
  const forwardX = Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = Math.sin(heading);

  const center = sampleStuntGroundHeight(x, 0, z, arena);
  const front = sampleStuntGroundHeight(
    x + forwardX * sampleDistance,
    0,
    z + forwardZ * sampleDistance,
    arena,
  );
  const back = sampleStuntGroundHeight(
    x - forwardX * sampleDistance,
    0,
    z - forwardZ * sampleDistance,
    arena,
  );
  const left = sampleStuntGroundHeight(
    x - rightX * sampleDistance,
    0,
    z - rightZ * sampleDistance,
    arena,
  );
  const right = sampleStuntGroundHeight(
    x + rightX * sampleDistance,
    0,
    z + rightZ * sampleDistance,
    arena,
  );

  return {
    pitch: Math.atan2(front - back, sampleDistance * 2),
    roll: Math.atan2(right - left, sampleDistance * 2),
    center,
  };
}

export type StuntCarVisualState = {
  pitch: number;
  roll: number;
  y: number;
};

export function updateStuntCarVisual(
  group: Object3D,
  vehicleY: number,
  heading: number,
  arena: StuntArenaDef,
  carGroundOffset: number,
  visual: StuntCarVisualState,
  deltaSeconds: number,
  x: number,
  z: number,
) {
  const tilt = sampleStuntSurfaceTilt(x, z, heading, arena);
  const rotationRate = 9.5;
  const heightRate = 14;

  visual.pitch = dampToward(visual.pitch, tilt.pitch, deltaSeconds, rotationRate);
  visual.roll = dampToward(visual.roll, tilt.roll, deltaSeconds, rotationRate);
  visual.y = dampToward(
    visual.y,
    vehicleY + carGroundOffset,
    deltaSeconds,
    heightRate,
  );

  group.rotation.x = visual.pitch;
  group.rotation.z = -visual.roll;
  group.position.y = visual.y;
}
