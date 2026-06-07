import * as THREE from "three";
import { sampleRouteGroundY } from "./routeGeometry";
import { sceneryLateralOffset } from "./trackScenery";
import {
  ROUTE_WALL_HEIGHT,
  type RouteLayoutOptions,
  type TrackDef,
  type Vec3,
} from "./track";

type CircuitPoint = { x: number; y: number; z: number };

type CircuitCurve = {
  closed?: boolean;
  points?: CircuitPoint[];
  data?: Array<{ scaleX?: number }>;
};

export type CircuitMapData = {
  trackCurves?: CircuitCurve[];
};

export type ParsedCircuitTrack = {
  points: Vec3[];
  closed: boolean;
  width: number;
};

const CIRCUIT_ROAD_WIDTH = 21;
const STRAIGHT_ANCHOR_SPAN = 40;
const CIRCUIT_GROUND_PADDING = 360;
export const CIRCUIT_RAIL_WIDTH = 1;
const COLLINEAR_DOT_THRESHOLD = 0.985;

/** Tighter barrier placement so parallel straights do not visually merge. */
export function getCircuitRailOffset(roadWidth: number) {
  return roadWidth / 2 + 2.6 + 0.35 + CIRCUIT_RAIL_WIDTH / 2;
}

export const CIRCUIT_ROUTE_LAYOUT: RouteLayoutOptions = {
  curveType: "centripetal",
};

/** Drop redundant control points on straights so splines do not cut corners inward. */
export function refineCircuitRoutePoints(points: Vec3[]): Vec3[] {
  if (points.length < 3) return points;

  const refined: Vec3[] = [];
  const count = points.length;

  for (let index = 0; index < count; index += 1) {
    const prev = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];

    const v1x = current.x - prev.x;
    const v1z = current.z - prev.z;
    const v2x = next.x - current.x;
    const v2z = next.z - current.z;
    const len1 = Math.hypot(v1x, v1z);
    const len2 = Math.hypot(v2x, v2z);

    if (len1 < 0.25 || len2 < 0.25) continue;

    const dot = (v1x * v2x + v1z * v2z) / (len1 * len2);
    if (dot > COLLINEAR_DOT_THRESHOLD) continue;

    refined.push(current);
  }

  return refined.length >= 3 ? refined : points;
}

/** Keep long straights from bowing when only corner control points remain. */
export function anchorLongStraightSegments(
  points: Vec3[],
  maxSegmentLength = STRAIGHT_ANCHOR_SPAN,
): Vec3[] {
  if (points.length < 2) return points;

  const anchored: Vec3[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    anchored.push(current);

    const dx = next.x - current.x;
    const dz = next.z - current.z;
    const segmentLength = Math.hypot(dx, dz);
    if (segmentLength <= maxSegmentLength) continue;

    const segments = Math.ceil(segmentLength / maxSegmentLength);
    for (let step = 1; step < segments; step += 1) {
      const progress = step / segments;
      anchored.push({
        x: round(current.x + dx * progress),
        y: round(current.y + (next.y - current.y) * progress),
        z: round(current.z + dz * progress),
      });
    }
  }

  return anchored;
}

const SHARP_CORNER_DOT = 0.94;
const CORNER_INSET = 24;

/** Replace tight apexes with approach/exit anchors so mapped turns round cleanly. */
export function densifyCornerControlPoints(points: Vec3[]): Vec3[] {
  if (points.length < 3) return points;

  const densified: Vec3[] = [];
  const count = points.length;

  for (let index = 0; index < count; index += 1) {
    const prev = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];

    const incomingX = current.x - prev.x;
    const incomingZ = current.z - prev.z;
    const outgoingX = next.x - current.x;
    const outgoingZ = next.z - current.z;
    const incomingLength = Math.hypot(incomingX, incomingZ);
    const outgoingLength = Math.hypot(outgoingX, outgoingZ);

    if (incomingLength < 0.5 || outgoingLength < 0.5) {
      densified.push(current);
      continue;
    }

    const turnDot =
      (incomingX * outgoingX + incomingZ * outgoingZ) /
      (incomingLength * outgoingLength);

    if (turnDot < SHARP_CORNER_DOT) {
      const approachInset = Math.min(CORNER_INSET, incomingLength * 0.42);
      const exitInset = Math.min(CORNER_INSET, outgoingLength * 0.42);
      densified.push({
        x: round(current.x - (incomingX / incomingLength) * approachInset),
        y: round(current.y),
        z: round(current.z - (incomingZ / incomingLength) * approachInset),
      });
      densified.push({
        x: round(current.x + (outgoingX / outgoingLength) * exitInset),
        y: round(current.y),
        z: round(current.z + (outgoingZ / outgoingLength) * exitInset),
      });
      continue;
    }

    densified.push(current);
  }

  return densified;
}

function alignPointToRouteSurface(
  point: Vec3,
  routePoints: Vec3[],
  routeLayout: RouteLayoutOptions,
): Vec3 {
  return {
    x: point.x,
    y: sampleRouteGroundY(point, routePoints, routeLayout),
    z: point.z,
  };
}

export function buildCircuitCollisionTrack(
  track: TrackDef,
  parsed: ParsedCircuitTrack,
): TrackDef {
  const roadWidth = parsed.width;
  const routePoints = parsed.points;
  const routeLayout = CIRCUIT_ROUTE_LAYOUT;
  const base = {
    ...track,
    routePoints,
    roadWidth,
    railOffset: getCircuitRailOffset(roadWidth),
    railHeight: ROUTE_WALL_HEIGHT,
    routeLayout,
  };

  return {
    ...base,
    spawn: {
      ...base.spawn,
      position: alignPointToRouteSurface(
        base.spawn.position,
        routePoints,
        routeLayout,
      ),
    },
    checkpoints: base.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      position: alignPointToRouteSurface(
        checkpoint.position,
        routePoints,
        routeLayout,
      ),
    })),
  };
}

type StandPlacement = {
  position: Vec3;
  rotationY: number;
  scale: number;
};

export function parseCircuitMapData(
  map: CircuitMapData,
  track: TrackDef,
): ParsedCircuitTrack {
  const curve = map.trackCurves?.find(
    (candidate) => (candidate.points?.length ?? 0) > 1,
  );
  if (!curve?.points?.length) {
    return { points: [], closed: false, width: 0 };
  }

  const scale = track.circuitMapScale ?? 0.16;
  const widthScale = Math.max(
    0.8,
    ...(curve.data ?? []).map((pointData) => pointData.scaleX ?? 1),
  );
  const scaled = curve.points.map((point) => ({
    x: round(point.x * scale),
    y: round(point.y * scale),
    z: round(point.z * scale),
  }));

  const refined = refineCircuitRoutePoints(scaled);
  return {
    points: anchorLongStraightSegments(densifyCornerControlPoints(refined)),
    closed: Boolean(curve.closed),
    width: round(CIRCUIT_ROAD_WIDTH * widthScale),
  };
}

export function minCenterlineSeparation(points: Vec3[], samples = 400) {
  if (points.length < 3) return Number.POSITIVE_INFINITY;

  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    true,
    "centripetal",
  );
  const positions: THREE.Vector3[] = [];
  for (let index = 0; index < samples; index += 1) {
    positions.push(curve.getPointAt(index / samples));
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < samples; index += 1) {
    for (let other = index + 24; other < index + samples - 24; other += 1) {
      const distance = positions[index].distanceTo(positions[other % samples]);
      if (distance < minDistance) minDistance = distance;
    }
  }

  return minDistance;
}

export function createGrandstandPlacements(
  parsed: ParsedCircuitTrack,
): StandPlacement[] {
  if (parsed.points.length < 6) return [];

  const curve = new THREE.CatmullRomCurve3(
    parsed.points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    parsed.closed,
    "catmullrom",
    0.5,
  );

  const count = 6;
  const stands: StandPlacement[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = index / count;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    tangent.y = 0;
    if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, -1);
    tangent.normalize();

    const side = index % 2 === 0 ? 1 : -1;
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const lateral = sceneryLateralOffset(parsed.width);
    const position = {
      x: round(point.x + right.x * lateral * side),
      y: round(point.y),
      z: round(point.z + right.z * lateral * side),
    };

    if (!isClearOfRoute(parsed, position, parsed.width / 2 + 5)) continue;

    stands.push({
      position,
      rotationY: Math.atan2(tangent.x, tangent.z) + (side > 0 ? Math.PI : 0),
      scale: 1.2 + (index % 2) * 0.15,
    });
  }

  return stands;
}

export function createStartGrandstands(
  spawn: TrackDef["spawn"],
  parsed: ParsedCircuitTrack,
): StandPlacement[] {
  if (parsed.width <= 0) return [];

  const heading = spawn.heading;
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const offset = parsed.width / 2 + 9;

  return [-1, 1].map((side) => ({
    position: {
      x: round(spawn.position.x + rightX * offset * side),
      y: spawn.position.y,
      z: round(spawn.position.z + rightZ * offset * side),
    },
    rotationY: heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2),
    scale: 1.5,
  }));
}

export function isClearOfRoute(
  parsed: ParsedCircuitTrack,
  position: Vec3,
  minDistance: number,
) {
  if (parsed.points.length < 2) return true;

  for (let index = 0; index < parsed.points.length; index += 1) {
    const start = parsed.points[index];
    const end = parsed.points[(index + 1) % parsed.points.length];
    if (!parsed.closed && index === parsed.points.length - 1) break;

    const projected = projectToSegment(
      { x: position.x, z: position.z },
      { x: start.x, z: start.z },
      { x: end.x, z: end.z },
    );
    if (projected.distance < minDistance) return false;
  }

  return true;
}

export function groundSizeForParsed(parsed: ParsedCircuitTrack) {
  if (parsed.points.length === 0) return 260;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of parsed.points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  const centeredSize = Math.max(
    Math.abs(minX) * 2,
    Math.abs(maxX) * 2,
    Math.abs(minZ) * 2,
    Math.abs(maxZ) * 2,
  );

  return (
    Math.max(maxX - minX, maxZ - minZ, centeredSize) + CIRCUIT_GROUND_PADDING
  );
}

function projectToSegment(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number },
) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) {
    return {
      x: start.x,
      z: start.z,
      distance: Math.hypot(point.x - start.x, point.z - start.z),
    };
  }

  const progress = clamp(
    ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq,
    0,
    1,
  );
  const x = start.x + progress * dx;
  const z = start.z + progress * dz;

  return {
    x,
    z,
    distance: Math.hypot(point.x - x, point.z - z),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
