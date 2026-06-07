import * as THREE from "three";
import type { Vec3 } from "./track";

export type RouteFrame = {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
};

const frameCache = new WeakMap<Vec3[], Map<number, RouteFrame[]>>();

export function createRouteFrames(points: Vec3[], yOffset = 0) {
  if (points.length < 2) return [];

  const cachedByOffset = frameCache.get(points);
  const cached = cachedByOffset?.get(yOffset);
  if (cached) return cached;

  const curve = new THREE.CatmullRomCurve3(
    points.map(
      (point) => new THREE.Vector3(point.x, point.y + yOffset, point.z),
    ),
    true,
    "centripetal",
  );
  const sampleCount = Math.max(720, points.length * 64);
  const frames: RouteFrame[] = [];
  const seamTangent = curve.getTangentAt((sampleCount - 1) / sampleCount);
  seamTangent.y = 0;
  if (seamTangent.lengthSq() < 0.0001) seamTangent.set(0, 0, -1);
  seamTangent.normalize();
  let previousRight: THREE.Vector3 | undefined = new THREE.Vector3(
    seamTangent.z,
    0,
    -seamTangent.x,
  ).normalize();

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleCount;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    tangent.y = 0;
    if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, -1);
    tangent.normalize();

    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    if (previousRight && right.dot(previousRight) < 0) right.multiplyScalar(-1);
    previousRight = right.clone();
    frames.push({ point, tangent, right });
  }

  const nextByOffset = cachedByOffset ?? new Map<number, RouteFrame[]>();
  nextByOffset.set(yOffset, frames);
  if (!cachedByOffset) frameCache.set(points, nextByOffset);
  return frames;
}

export function nearestRouteCurveProjection(
  point: { x: number; z: number },
  points: Vec3[],
) {
  const frames = createRouteFrames(points);
  let closest = {
    distance: Number.POSITIVE_INFINITY,
    x: points[0].x,
    z: points[0].z,
  };

  for (let index = 0; index < frames.length; index += 1) {
    const current = frames[index].point;
    const next = frames[(index + 1) % frames.length].point;
    const projected = projectToSegment(
      point,
      { x: current.x, z: current.z },
      { x: next.x, z: next.z },
    );
    if (projected.distance < closest.distance) closest = projected;
  }

  return closest;
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
