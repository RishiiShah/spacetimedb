import * as THREE from "three";
import type { RouteLayoutOptions, Vec3 } from "./track";

export type RouteFrame = {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
};

export type RouteFrameOptions = RouteLayoutOptions;

const frameCache = new WeakMap<
  Vec3[],
  Map<string, RouteFrame[]>
>();

function frameCacheKey(yOffset: number, options?: RouteFrameOptions) {
  return `${yOffset}|${options?.curveType ?? "centripetal"}|${options?.tension ?? 0.5}`;
}

export function createRouteCurve(
  points: Vec3[],
  yOffset = 0,
  options?: RouteFrameOptions,
) {
  const curveType = options?.curveType ?? "centripetal";
  return new THREE.CatmullRomCurve3(
    points.map(
      (point) => new THREE.Vector3(point.x, point.y + yOffset, point.z),
    ),
    true,
    curveType,
    options?.tension ?? 0.5,
  );
}

export function createRouteFrames(
  points: Vec3[],
  yOffset = 0,
  options?: RouteFrameOptions,
) {
  if (points.length < 2) return [];

  const cacheKey = frameCacheKey(yOffset, options);
  const cachedByOffset = frameCache.get(points);
  const cached = cachedByOffset?.get(cacheKey);
  if (cached) return cached;

  const curve = createRouteCurve(points, yOffset, options);
  const sampleCount = Math.max(
    options?.curveType === "catmullrom" ? 420 : 360,
    points.length * 32,
  );
  const frames: RouteFrame[] = [];
  let previousRight: THREE.Vector3 | undefined = initialRouteRight(curve);

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleCount;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const right = stabilizeRight(tangent, previousRight);
    previousRight = right.clone();
    frames.push({
      point,
      tangent: tangent.clone().setY(0).normalize(),
      right,
    });
  }

  const nextByOffset = cachedByOffset ?? new Map<string, RouteFrame[]>();
  nextByOffset.set(cacheKey, frames);
  if (!cachedByOffset) frameCache.set(points, nextByOffset);
  return frames;
}

/** Skip ribbon/barrier quads longer than this to avoid overflow triangles. */
export const MAX_ROUTE_QUAD_EDGE = 2.4;

function stabilizeRight(
  tangent: THREE.Vector3,
  previousRight?: THREE.Vector3,
) {
  const flat = tangent.clone();
  flat.y = 0;
  if (flat.lengthSq() < 0.0001) flat.set(0, 0, -1);
  flat.normalize();

  const right = new THREE.Vector3(flat.z, 0, -flat.x).normalize();
  if (previousRight && right.dot(previousRight) < 0) right.multiplyScalar(-1);
  return right;
}

function initialRouteRight(curve: THREE.CatmullRomCurve3) {
  return stabilizeRight(curve.getTangentAt(0.999));
}

/** Arc-length samples with a continuous Frenet frame (no polyline lerp). */
export function createRouteSamplesAtDistances(
  points: Vec3[],
  distances: number[],
  yOffset = 0,
  routeLayout?: RouteFrameOptions,
) {
  const curve = createRouteCurve(points, yOffset, routeLayout);
  const totalLength = curve.getLength();
  if (totalLength <= 0 || distances.length === 0) {
    return { samples: [], totalLength: 0 };
  }

  let previousRight = initialRouteRight(curve);
  const samples: RouteFrame[] = [];

  for (const distance of distances) {
    const u = clamp(distance / totalLength, 0, 0.999999);
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    const right = stabilizeRight(tangent, previousRight);
    previousRight = right.clone();
    const flatTangent = tangent.clone();
    flatTangent.y = 0;
    if (flatTangent.lengthSq() < 0.0001) flatTangent.set(0, 0, -1);
    flatTangent.normalize();
    samples.push({ point, tangent: flatTangent, right });
  }

  return { samples, totalLength };
}

export type RouteCurveProjection = {
  distance: number;
  x: number;
  z: number;
  y: number;
};

export function nearestRouteCurveProjection(
  point: { x: number; z: number },
  points: Vec3[],
  routeLayout?: RouteFrameOptions,
): RouteCurveProjection {
  const frames = createRouteFrames(points, 0, routeLayout);
  let closest: RouteCurveProjection = {
    distance: Number.POSITIVE_INFINITY,
    x: points[0].x,
    z: points[0].z,
    y: points[0].y,
  };

  for (let index = 0; index < frames.length; index += 1) {
    const current = frames[index].point;
    const next = frames[(index + 1) % frames.length].point;
    const projected = projectToSegment(
      point,
      { x: current.x, z: current.z },
      { x: next.x, z: next.z },
    );
    if (projected.distance >= closest.distance) continue;

    closest = {
      distance: projected.distance,
      x: projected.x,
      z: projected.z,
      y: current.y + (next.y - current.y) * projected.progress,
    };
  }

  return closest;
}

export function sampleRouteGroundY(
  point: { x: number; z: number },
  points: Vec3[],
  routeLayout?: RouteFrameOptions,
) {
  return nearestRouteCurveProjection(point, points, routeLayout).y;
}

/** Road-surface Y for a world XZ point, using route elevation when available. */
export function resolveRouteSurfaceY(
  point: { x: number; y: number; z: number },
  track?: { routePoints?: Vec3[]; routeLayout?: RouteFrameOptions },
) {
  const points = track?.routePoints;
  if (!points || points.length < 2) return point.y;
  return sampleRouteGroundY(point, points, track.routeLayout);
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
      progress: 0,
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
    progress,
    distance: Math.hypot(point.x - x, point.z - z),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
