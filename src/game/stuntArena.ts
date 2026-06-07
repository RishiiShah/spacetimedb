import * as THREE from "three";
import type { Vec3 } from "./track";

export const STUNT_DECK_THICKNESS = 0.4;

const STUNT_WALL_MARGIN = 1.55;

export type StuntArenaBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  wallHeight?: number;
};

export type StuntPlaneSurface = {
  type: "plane";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
};

export type StuntRampSurface = {
  type: "ramp";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y0: number;
  y1: number;
  axis: "x" | "z";
  lowEnd: "min" | "max";
};

export type StuntPathSurface = {
  type: "path";
  points: Vec3[];
  halfWidth: number;
};

export type StuntSurface =
  | StuntPlaneSurface
  | StuntRampSurface
  | StuntPathSurface;

export type StuntArenaDef = {
  bounds: StuntArenaBounds;
  baseY: number;
  surfaceClearance: number;
  freeRoam: boolean;
  surfaces: StuntSurface[];
};

const STUNT_GRAVITY = 20;
const STUNT_GROUND_FOLLOW_RATE = 16;
const STUNT_AIRBORNE_LEAVE_GAP = 0.35;
const STUNT_LAUNCH_LOOKAHEAD = 4;
const STUNT_SOFT_LANDING_SPEED = 3.5;
const STUNT_MAX_GROUND_VERTICAL_SPEED = 12;

export function createVerticalLoopPoints(
  centerX: number,
  centerY: number,
  centerZ: number,
  radius: number,
  segments = 56,
): Vec3[] {
  const points: Vec3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = -Math.PI / 2 + (index / segments) * Math.PI * 2;
    points.push({
      x: centerX,
      y: round(centerY + Math.sin(angle) * radius),
      z: round(centerZ + Math.cos(angle) * radius),
    });
  }
  return points;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function inRect(
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
) {
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

export function sampleRampDeckTopY(
  x: number,
  z: number,
  ramp: StuntRampSurface,
) {
  if (!inRect(x, z, ramp.minX, ramp.maxX, ramp.minZ, ramp.maxZ)) return null;

  const progress =
    ramp.axis === "z"
      ? ramp.lowEnd === "min"
        ? (z - ramp.minZ) / (ramp.maxZ - ramp.minZ)
        : (ramp.maxZ - z) / (ramp.maxZ - ramp.minZ)
      : ramp.lowEnd === "min"
        ? (x - ramp.minX) / (ramp.maxX - ramp.minX)
        : (ramp.maxX - x) / (ramp.maxX - ramp.minX);

  return ramp.y0 + (ramp.y1 - ramp.y0) * clamp(progress, 0, 1);
}

function createPathCurve(points: Vec3[]) {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    true,
    "centripetal",
  );
}

function samplePathDeckTopY(x: number, z: number, path: StuntPathSurface) {
  if (path.points.length < 2) return null;

  const curve = createPathCurve(path.points);
  let best: { distance: number; height: number } | undefined;

  for (let index = 0; index <= 320; index += 1) {
    const point = curve.getPointAt(index / 320);
    const distance = Math.hypot(x - point.x, z - point.z);
    if (distance > path.halfWidth) continue;
    if (!best || distance < best.distance) {
      best = { distance, height: point.y };
    }
  }

  return best?.height ?? null;
}

function sampleSurfaceDeckTopY(
  x: number,
  z: number,
  surface: StuntSurface,
) {
  if (surface.type === "plane") {
    if (!inRect(x, z, surface.minX, surface.maxX, surface.minZ, surface.maxZ)) {
      return null;
    }
    return surface.y;
  }

  if (surface.type === "ramp") {
    return sampleRampDeckTopY(x, z, surface);
  }

  return samplePathDeckTopY(x, z, surface);
}

function isSolidSurface(surface: StuntSurface) {
  return surface.type === "plane" || surface.type === "ramp";
}

/** Surface that currently supports the vehicle at this XZ point. */
export function findDominantStuntSurface(
  x: number,
  z: number,
  arena: StuntArenaDef,
) {
  let bestSolid: { surface: StuntSurface; height: number } | undefined;
  let bestPath: { surface: StuntSurface; height: number } | undefined;

  for (const surface of arena.surfaces) {
    const sample = sampleSurfaceDeckTopY(x, z, surface);
    if (sample === null) continue;

    if (isSolidSurface(surface)) {
      if (!bestSolid || sample > bestSolid.height) {
        bestSolid = { surface, height: sample };
      }
      continue;
    }

    if (!bestPath || sample > bestPath.height) {
      bestPath = { surface, height: sample };
    }
  }

  return bestSolid ?? bestPath;
}

export function sampleStuntGroundHeight(
  x: number,
  _y: number,
  z: number,
  arena: StuntArenaDef,
) {
  const dominant = findDominantStuntSurface(x, z, arena);
  return dominant?.height ?? arena.baseY;
}

function isLeavingSolidThroughEnd(
  surface: StuntPlaneSurface | StuntRampSurface,
  x: number,
  z: number,
  aheadX: number,
  aheadZ: number,
) {
  const onDeck = inRect(
    x,
    z,
    surface.minX,
    surface.maxX,
    surface.minZ,
    surface.maxZ,
  );
  const aheadOnDeck = inRect(
    aheadX,
    aheadZ,
    surface.minX,
    surface.maxX,
    surface.minZ,
    surface.maxZ,
  );
  if (!onDeck || aheadOnDeck) return false;

  const xInside = aheadX >= surface.minX && aheadX <= surface.maxX;
  const zInside = aheadZ >= surface.minZ && aheadZ <= surface.maxZ;

  if (surface.type === "ramp") {
    if (surface.axis === "z") return xInside && !zInside;
    return zInside && !xInside;
  }

  return (xInside && !zInside) || (zInside && !xInside);
}

function sampleAheadGroundForLip(
  x: number,
  z: number,
  y: number,
  arena: StuntArenaDef,
  dominant: ReturnType<typeof findDominantStuntSurface>,
  forwardX: number,
  forwardZ: number,
  distance: number,
) {
  const aheadX = x + forwardX * distance;
  const aheadZ = z + forwardZ * distance;
  const clearance = arena.surfaceClearance;

  if (!dominant) {
    return sampleStuntGroundHeight(aheadX, y, aheadZ, arena) + clearance;
  }

  const aheadOnDominant = sampleSurfaceDeckTopY(
    aheadX,
    aheadZ,
    dominant.surface,
  );
  if (aheadOnDominant !== null) {
    return aheadOnDominant + clearance;
  }

  if (
    isSolidSurface(dominant.surface) &&
    isLeavingSolidThroughEnd(
      dominant.surface,
      x,
      z,
      aheadX,
      aheadZ,
    )
  ) {
    return sampleStuntGroundHeight(aheadX, y, aheadZ, arena) + clearance;
  }

  // Side/corner exits keep the current deck height so corners do not launch.
  return dominant.height + clearance;
}

export function constrainToStuntArenaBounds(
  state: {
    position: { x: number; y: number; z: number };
    heading: number;
    speed: number;
  },
  bounds: StuntArenaBounds,
  margin = STUNT_WALL_MARGIN,
) {
  const minX = bounds.minX + margin;
  const maxX = bounds.maxX - margin;
  const minZ = bounds.minZ + margin;
  const maxZ = bounds.maxZ - margin;

  let { x, y, z } = state.position;
  let speed = state.speed;
  const speedSign = Math.sign(speed) || 1;
  const travelX = Math.sin(state.heading) * speedSign;
  const travelZ = -Math.cos(state.heading) * speedSign;

  if (x < minX) {
    x = minX;
    if (travelX < 0) speed *= 0.4;
  } else if (x > maxX) {
    x = maxX;
    if (travelX > 0) speed *= 0.4;
  }

  if (z < minZ) {
    z = minZ;
    if (travelZ < 0) speed *= 0.4;
  } else if (z > maxZ) {
    z = maxZ;
    if (travelZ > 0) speed *= 0.4;
  }

  return {
    ...state,
    speed,
    position: { x, y, z },
  };
}

export type StuntVehicleExtras = {
  verticalSpeed: number;
  lastGroundY: number;
  airborne: boolean;
};

export function applyStuntVehiclePhysics<
  T extends {
    position: { x: number; y: number; z: number };
    heading: number;
    speed: number;
    steer: number;
    reverseArm: number;
  },
>(
  state: T,
  arena: StuntArenaDef,
  extras: StuntVehicleExtras,
  deltaSeconds: number,
) {
  const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
  let bounded = constrainToStuntArenaBounds(state, arena.bounds);
  const ground =
    sampleStuntGroundHeight(
      bounded.position.x,
      bounded.position.y,
      bounded.position.z,
      arena,
    ) + arena.surfaceClearance;

  let verticalSpeed = extras.verticalSpeed;
  let y = bounded.position.y;
  let airborne = extras.airborne;

  const forwardX = Math.sin(bounded.heading);
  const forwardZ = -Math.cos(bounded.heading);
  const lookAhead = Math.max(
    STUNT_LAUNCH_LOOKAHEAD,
    Math.abs(bounded.speed) * 0.05,
  );
  const dominant = findDominantStuntSurface(
    bounded.position.x,
    bounded.position.z,
    arena,
  );
  const aheadGround = sampleAheadGroundForLip(
    bounded.position.x,
    bounded.position.z,
    y,
    arena,
    dominant,
    forwardX,
    forwardZ,
    lookAhead,
  );

  const lipDrop = (aheadGround - ground) / lookAhead;
  const launchImpulse = Math.abs(bounded.speed) * Math.max(0, -lipDrop * 0.32);
  const leavingJumpEnd =
    dominant !== undefined &&
    isSolidSurface(dominant.surface) &&
    isLeavingSolidThroughEnd(
      dominant.surface,
      bounded.position.x,
      bounded.position.z,
      bounded.position.x + forwardX * lookAhead,
      bounded.position.z + forwardZ * lookAhead,
    );

  if (
    !airborne &&
    lipDrop < -0.5 &&
    Math.abs(bounded.speed) > 16 &&
    leavingJumpEnd
  ) {
    airborne = true;
    verticalSpeed = Math.max(verticalSpeed, launchImpulse);
  }

  if (!airborne) {
    const followBlend = 1 - Math.exp(-STUNT_GROUND_FOLLOW_RATE * dt);
    const targetY = ground;
    const deltaY = targetY - y;
    y += deltaY * followBlend;
    verticalSpeed = clamp(
      deltaY / Math.max(dt, 0.001),
      -STUNT_MAX_GROUND_VERTICAL_SPEED,
      STUNT_MAX_GROUND_VERTICAL_SPEED,
    );

    if (y > ground + STUNT_AIRBORNE_LEAVE_GAP && verticalSpeed > 3) {
      airborne = true;
    }
  } else {
    verticalSpeed -= STUNT_GRAVITY * dt;
    y += verticalSpeed * dt;

    if (y <= ground) {
      if (verticalSpeed < -STUNT_SOFT_LANDING_SPEED) {
        y = ground;
        verticalSpeed *= -0.18;
      } else {
        y = ground;
        verticalSpeed = 0;
        airborne = false;
      }
    }
  }

  return {
    vehicle: {
      ...state,
      ...bounded,
      position: { ...bounded.position, y },
    },
    extras: {
      verticalSpeed,
      lastGroundY: ground,
      airborne,
    },
  };
}

export const stuntShowcaseArena: StuntArenaDef = {
  bounds: {
    minX: -175,
    maxX: 175,
    minZ: -175,
    maxZ: 175,
    wallHeight: 6,
  },
  baseY: 0,
  surfaceClearance: 1.1,
  freeRoam: true,
  surfaces: [
    {
      type: "plane",
      minX: -30,
      maxX: 30,
      minZ: -30,
      maxZ: 30,
      y: 0,
    },
    {
      type: "ramp",
      minX: -18,
      maxX: 18,
      minZ: 32,
      maxZ: 72,
      y0: 0,
      y1: 11,
      axis: "z",
      lowEnd: "min",
    },
    {
      type: "plane",
      minX: -22,
      maxX: 22,
      minZ: 72,
      maxZ: 112,
      y: 11,
    },
    {
      type: "plane",
      minX: -18,
      maxX: 18,
      minZ: 112,
      maxZ: 132,
      y: 11,
    },
    {
      type: "ramp",
      minX: 34,
      maxX: 78,
      minZ: -10,
      maxZ: 10,
      y0: 0,
      y1: 7,
      axis: "x",
      lowEnd: "min",
    },
    {
      type: "plane",
      minX: 78,
      maxX: 98,
      minZ: -12,
      maxZ: 12,
      y: 7,
    },
    {
      type: "ramp",
      minX: 98,
      maxX: 118,
      minZ: -9,
      maxZ: 9,
      y0: 7,
      y1: 11,
      axis: "x",
      lowEnd: "min",
    },
    {
      type: "path",
      points: createVerticalLoopPoints(132, 11, 0, 14, 64),
      halfWidth: 8,
    },
    {
      type: "ramp",
      minX: -18,
      maxX: 18,
      minZ: -72,
      maxZ: -32,
      y0: 0,
      y1: 9,
      axis: "z",
      lowEnd: "max",
    },
    {
      type: "plane",
      minX: -22,
      maxX: 22,
      minZ: -112,
      maxZ: -72,
      y: 9,
    },
    {
      type: "ramp",
      minX: -18,
      maxX: 18,
      minZ: -148,
      maxZ: -112,
      y0: 9,
      y1: 0,
      axis: "z",
      lowEnd: "min",
    },
    {
      type: "ramp",
      minX: -72,
      maxX: -38,
      minZ: -10,
      maxZ: 10,
      y0: 0,
      y1: 8,
      axis: "x",
      lowEnd: "max",
    },
    {
      type: "plane",
      minX: -112,
      maxX: -72,
      minZ: -14,
      maxZ: 14,
      y: 8,
    },
    {
      type: "ramp",
      minX: -165,
      maxX: -125,
      minZ: 118,
      maxZ: 158,
      y0: 0,
      y1: 6,
      axis: "z",
      lowEnd: "min",
    },
    {
      type: "ramp",
      minX: 125,
      maxX: 165,
      minZ: 118,
      maxZ: 158,
      y0: 0,
      y1: 6,
      axis: "z",
      lowEnd: "min",
    },
    {
      type: "ramp",
      minX: 125,
      maxX: 165,
      minZ: -158,
      maxZ: -118,
      y0: 0,
      y1: 6,
      axis: "z",
      lowEnd: "max",
    },
    {
      type: "ramp",
      minX: -165,
      maxX: -125,
      minZ: -158,
      maxZ: -118,
      y0: 0,
      y1: 6,
      axis: "z",
      lowEnd: "max",
    },
  ],
};
