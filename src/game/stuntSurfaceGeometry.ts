import * as THREE from "three";
import {
  sampleRampDeckTopY,
  STUNT_DECK_THICKNESS,
  type StuntPathSurface,
  type StuntPlaneSurface,
  type StuntRampSurface,
  type StuntSurface,
} from "./stuntArena";

export function createPathCurve(points: StuntPathSurface["points"]) {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    true,
    "centripetal",
  );
}

function pushQuad(
  positions: number[],
  indices: number[],
  a: number,
  b: number,
  c: number,
  d: number,
) {
  indices.push(a, b, c, a, c, d);
}

function pushDeckBox(
  positions: number[],
  indices: number[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  topY: number | ((x: number, z: number) => number),
) {
  const top = (x: number, z: number) =>
    typeof topY === "number" ? topY : topY(x, z);
  const bottom = (x: number, z: number) => top(x, z) - STUNT_DECK_THICKNESS;

  const y00 = top(minX, minZ);
  const y10 = top(maxX, minZ);
  const y11 = top(maxX, maxZ);
  const y01 = top(minX, maxZ);
  const b00 = bottom(minX, minZ);
  const b10 = bottom(maxX, minZ);
  const b11 = bottom(maxX, maxZ);
  const b01 = bottom(minX, maxZ);

  const base = positions.length / 3;
  positions.push(
    minX,
    y00,
    minZ,
    maxX,
    y10,
    minZ,
    maxX,
    y11,
    maxZ,
    minX,
    y01,
    maxZ,
    minX,
    b00,
    minZ,
    maxX,
    b10,
    minZ,
    maxX,
    b11,
    maxZ,
    minX,
    b01,
    maxZ,
  );

  pushQuad(positions, indices, base, base + 1, base + 2, base + 3);
  pushQuad(positions, indices, base + 7, base + 6, base + 5, base + 4);
  pushQuad(positions, indices, base + 4, base + 5, base + 1, base);
  pushQuad(positions, indices, base + 1, base + 5, base + 6, base + 2);
  pushQuad(positions, indices, base + 2, base + 6, base + 7, base + 3);
  pushQuad(positions, indices, base + 3, base + 7, base + 4, base);
  pushQuad(positions, indices, base, base + 3, base + 7, base + 4);
  pushQuad(positions, indices, base + 1, base, base + 4, base + 5);
}

function finalizeGeometry(positions: number[], indices: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createPlaneDeckGeometry(plane: StuntPlaneSurface) {
  const positions: number[] = [];
  const indices: number[] = [];
  pushDeckBox(
    positions,
    indices,
    plane.minX,
    plane.maxX,
    plane.minZ,
    plane.maxZ,
    plane.y,
  );
  return finalizeGeometry(positions, indices);
}

export function createRampDeckGeometry(ramp: StuntRampSurface) {
  const positions: number[] = [];
  const indices: number[] = [];
  pushDeckBox(
    positions,
    indices,
    ramp.minX,
    ramp.maxX,
    ramp.minZ,
    ramp.maxZ,
    (x, z) => sampleRampDeckTopY(x, z, ramp) ?? ramp.y0,
  );
  return finalizeGeometry(positions, indices);
}

export function createPathDeckGeometry(path: StuntPathSurface) {
  const curve = createPathCurve(path.points);
  const shape = new THREE.Shape();
  shape.moveTo(-path.halfWidth, 0);
  shape.lineTo(path.halfWidth, 0);
  shape.lineTo(path.halfWidth, -STUNT_DECK_THICKNESS);
  shape.lineTo(-path.halfWidth, -STUNT_DECK_THICKNESS);
  shape.lineTo(-path.halfWidth, 0);

  return new THREE.ExtrudeGeometry(shape, {
    steps: 320,
    bevelEnabled: false,
    extrudePath: curve,
  });
}

export function createStuntSurfaceGeometry(surface: StuntSurface) {
  if (surface.type === "plane") return createPlaneDeckGeometry(surface);
  if (surface.type === "ramp") return createRampDeckGeometry(surface);
  return createPathDeckGeometry(surface);
}

/** Highest Y on the rendered deck at a world XZ point (for alignment tests). */
export function sampleRenderedDeckTopY(
  x: number,
  z: number,
  surface: StuntSurface,
) {
  if (surface.type === "plane") {
    if (
      x < surface.minX ||
      x > surface.maxX ||
      z < surface.minZ ||
      z > surface.maxZ
    ) {
      return null;
    }
    return surface.y;
  }

  if (surface.type === "ramp") {
    return sampleRampDeckTopY(x, z, surface);
  }

  const curve = createPathCurve(surface.points);
  let best: { dist: number; y: number } | undefined;
  for (let index = 0; index <= 320; index += 1) {
    const point = curve.getPointAt(index / 320);
    const dist = Math.hypot(x - point.x, z - point.z);
    if (dist > surface.halfWidth) continue;
    if (!best || dist < best.dist) best = { dist, y: point.y };
  }
  return best?.y ?? null;
}
