import * as THREE from "three";
import { createRouteFrames } from "./routeGeometry";
import {
  getRouteCurbOuterOffset,
  getRouteRailOffset,
  ROAD_SURFACE_Y,
  ROUTE_RAIL_WIDTH,
  type Vec3,
} from "./track";

export type DetailPlacement = {
  position: Vec3;
  rotationY: number;
  scale?: number;
};

export type SponsorBoardPlacement = DetailPlacement & {
  label: string;
};

export type CornerSignPlacement = {
  position: [number, number, number];
  rotationY: number;
  scale?: number;
};

const SIDEWALK_WIDTH = 3.2;
const SIDEWALK_GAP = 0.35;
const LAMPPOST_SPACING = 55;
const MAX_LAMPPOSTS = 16;
const SPONSOR_SPACING = 90;
const MAX_SPONSOR_BOARDS = 8;
const GRANDSTAND_COUNT = 4;
const SIDEWALK_FRAME_STRIDE = 3;
const CORNER_SAMPLE_STEP = 6;
const CORNER_ANGLE_THRESHOLD = 0.2;
const SPONSOR_LABELS = ["NOVA", "APEX", "VELOCITY", "TURBO", "GRIP", "SHIFT"];

function resolveRailOffset(roadWidth: number, railOffset?: number) {
  return railOffset ?? getRouteRailOffset(roadWidth);
}

function getSidewalkOffsets(
  roadWidth: number,
  railOffset: number | undefined,
  hasRails: boolean,
) {
  if (hasRails) {
    const wallOuter =
      resolveRailOffset(roadWidth, railOffset) + ROUTE_RAIL_WIDTH / 2;
    const inner = wallOuter + SIDEWALK_GAP;
    return { inner, outer: inner + SIDEWALK_WIDTH };
  }

  const inner = getRouteCurbOuterOffset(roadWidth) + 0.2;
  return { inner, outer: inner + SIDEWALK_WIDTH };
}

function getDetailCenterOffset(
  roadWidth: number,
  railOffset: number | undefined,
  hasRails: boolean,
) {
  const { inner, outer } = getSidewalkOffsets(roadWidth, railOffset, hasRails);
  return (inner + outer) / 2;
}

function createRouteCurve(points: Vec3[], y = ROAD_SURFACE_Y) {
  return new THREE.CatmullRomCurve3(
    points.map(
      (point) => new THREE.Vector3(point.x, point.y + y, point.z),
    ),
    true,
    "centripetal",
  );
}

function createRouteBandGeometry(
  points: Vec3[],
  innerOffset: number,
  outerOffset: number,
  side: -1 | 1,
  y = ROAD_SURFACE_Y,
) {
  const frames = createRouteFrames(points, y);
  if (frames.length < 2 || outerOffset <= innerOffset) {
    return new THREE.BufferGeometry();
  }

  const positions: number[] = [];
  const indices: number[] = [];

  const sampled: typeof frames = [];
  for (let index = 0; index < frames.length; index += SIDEWALK_FRAME_STRIDE) {
    sampled.push(frames[index]);
  }
  if (sampled[sampled.length - 1] !== frames[frames.length - 1]) {
    sampled.push(frames[frames.length - 1]);
  }

  for (const frame of sampled) {
    const inner = frame.point
      .clone()
      .addScaledVector(frame.right, side * innerOffset);
    const outer = frame.point
      .clone()
      .addScaledVector(frame.right, side * outerOffset);
    positions.push(inner.x, y, inner.z, outer.x, y, outer.z);
  }

  for (let index = 0; index < sampled.length; index += 1) {
    const base = index * 2;
    const next = ((index + 1) % sampled.length) * 2;
    if (side === 1) {
      indices.push(base, base + 1, next + 1, base, next + 1, next);
    } else {
      indices.push(base, next, next + 1, base, next + 1, base + 1);
    }
  }

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

function placementAtDistance(
  points: Vec3[],
  distance: number,
  sideOffset: number,
  side: -1 | 1,
): DetailPlacement {
  const curve = createRouteCurve(points);
  const curveLength = curve.getLength();
  const u = curveLength <= 0 ? 0 : distance / curveLength;
  const point = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u);
  tangent.y = 0;
  if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, -1);
  tangent.normalize();

  const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
  const position = point.clone().addScaledVector(right, sideOffset * side);

  return {
    position: {
      x: position.x,
      y: ROAD_SURFACE_Y,
      z: position.z,
    },
    rotationY:
      Math.atan2(tangent.x, tangent.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2),
  };
}

export function createSidewalkGeometries(
  points: Vec3[],
  roadWidth: number,
  railOffset?: number,
  hasRails = false,
) {
  const { inner, outer } = getSidewalkOffsets(roadWidth, railOffset, hasRails);
  return {
    left: createRouteBandGeometry(points, inner, outer, -1),
    right: createRouteBandGeometry(points, inner, outer, 1),
  };
}

export function createLamppostPlacements(
  points: Vec3[],
  roadWidth: number,
  railOffset?: number,
  hasRails = false,
): DetailPlacement[] {
  if (points.length < 2) return [];

  const curve = createRouteCurve(points);
  const curveLength = curve.getLength();
  if (curveLength <= 0) return [];

  const centerOffset = getDetailCenterOffset(roadWidth, railOffset, hasRails);
  const placements: DetailPlacement[] = [];

  const spacing = Math.max(
    LAMPPOST_SPACING,
    curveLength / Math.max(1, MAX_LAMPPOSTS),
  );

  for (
    let distance = spacing / 2, count = 0;
    distance < curveLength && count < MAX_LAMPPOSTS;
    distance += spacing, count += 1
  ) {
    placements.push(
      placementAtDistance(
        points,
        distance,
        centerOffset,
        count % 2 === 0 ? -1 : 1,
      ),
    );
  }

  return placements;
}

export function createSponsorBoardPlacements(
  points: Vec3[],
  roadWidth: number,
  railOffset?: number,
): SponsorBoardPlacement[] {
  if (points.length < 2) return [];

  const curve = createRouteCurve(points);
  const curveLength = curve.getLength();
  if (curveLength <= 0) return [];

  const wallOffset =
    resolveRailOffset(roadWidth, railOffset) + ROUTE_RAIL_WIDTH / 2 + 0.45;
  const placements: SponsorBoardPlacement[] = [];

  const spacing = Math.max(
    SPONSOR_SPACING,
    curveLength / Math.max(1, MAX_SPONSOR_BOARDS),
  );

  for (
    let distance = spacing / 2, index = 0;
    distance < curveLength && index < MAX_SPONSOR_BOARDS;
    distance += spacing, index += 1
  ) {
    const placement = placementAtDistance(
      points,
      distance,
      wallOffset,
      index % 2 === 0 ? -1 : 1,
    );
    placements.push({
      ...placement,
      label: SPONSOR_LABELS[index % SPONSOR_LABELS.length],
    });
  }

  return placements;
}

export function createRouteGrandstandPlacements(
  points: Vec3[],
  roadWidth: number,
  railOffset?: number,
): DetailPlacement[] {
  if (points.length < 2) return [];

  const sideOffset =
    resolveRailOffset(roadWidth, railOffset) + ROUTE_RAIL_WIDTH / 2 + 9;
  const placements: DetailPlacement[] = [];

  for (let index = 0; index < GRANDSTAND_COUNT; index += 1) {
    const ratio = (index + 1) / (GRANDSTAND_COUNT + 1);
    const curve = createRouteCurve(points);
    const point = curve.getPointAt(ratio);
    const tangent = curve.getTangentAt(ratio);
    tangent.y = 0;
    if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, -1);
    tangent.normalize();

    const side = index % 2 === 0 ? 1 : -1;
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const position = point.clone().addScaledVector(right, sideOffset * side);

    placements.push({
      position: {
        x: position.x,
        y: ROAD_SURFACE_Y,
        z: position.z,
      },
      rotationY: Math.atan2(tangent.x, tangent.z) + (side > 0 ? Math.PI : 0),
      scale: 1.15 + (index % 2) * 0.2,
    });
  }

  return placements;
}

export function createCornerSignPlacements(
  points: Vec3[],
  roadWidth: number,
  railOffset?: number,
): CornerSignPlacement[] {
  const frames = createRouteFrames(points);
  if (frames.length < CORNER_SAMPLE_STEP + 2) return [];

  const sideOffset = resolveRailOffset(roadWidth, railOffset) + 6;
  const signs: CornerSignPlacement[] = [];

  for (
    let index = CORNER_SAMPLE_STEP;
    index < frames.length;
    index += CORNER_SAMPLE_STEP
  ) {
    const previous = frames[index - CORNER_SAMPLE_STEP].tangent;
    const current = frames[index].tangent;
    const angle = previous.angleTo(current);
    if (angle < CORNER_ANGLE_THRESHOLD) continue;

    const turn = previous.x * current.z - previous.z * current.x;
    const side = turn >= 0 ? 1 : -1;
    const frame = frames[index];
    const position = frame.point
      .clone()
      .addScaledVector(frame.right, sideOffset * side);

    signs.push({
      position: [position.x, ROAD_SURFACE_Y, position.z],
      rotationY:
        Math.atan2(frame.tangent.x, frame.tangent.z) +
        (side > 0 ? Math.PI / 2 : -Math.PI / 2),
      scale: 1.2 + Math.min(angle, 0.6) * 0.5,
    });
  }

  return signs;
}
