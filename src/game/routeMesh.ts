import * as THREE from "three";
import { assets } from "./assets";
import {
  createRouteCurve,
  createRouteFrames,
  createRouteFramesForRibbon,
  createRouteSamplesAtDistances,
  MAX_ROUTE_QUAD_EDGE,
  type RouteFrame,
  type RouteFrameOptions,
} from "./routeGeometry";
import { getRouteRailOffset, ROAD_SURFACE_Y, type Vec3 } from "./track";

export function createRouteRibbonGeometry(
  points: Vec3[],
  width: number,
  yOffset: number,
  lateralOffset: number,
  routeLayout?: RouteFrameOptions,
) {
  const halfWidth = width / 2;
  const frames = createRouteFramesForRibbon(
    points,
    halfWidth,
    yOffset,
    routeLayout,
  );

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const center = frame.point
      .clone()
      .addScaledVector(frame.right, lateralOffset);
    const leftPoint = center.clone().addScaledVector(frame.right, -halfWidth);
    const rightPoint = center.clone().addScaledVector(frame.right, halfWidth);
    positions.push(
      leftPoint.x,
      leftPoint.y,
      leftPoint.z,
      rightPoint.x,
      rightPoint.y,
      rightPoint.z,
    );
    uvs.push(0, index / frames.length, 1, index / frames.length);
  }

  for (let index = 0; index < frames.length; index += 1) {
    const nextIndex = (index + 1) % frames.length;
    const base = index * 2;
    const nextBase = nextIndex * 2;
    if (!shouldConnectRibbonVertices(positions, base, nextBase)) {
      continue;
    }
    indices.push(base, nextBase, base + 1, base + 1, nextBase, nextBase + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createDirectionSignPlacements(
  points: Vec3[],
  width: number,
  railOffset?: number,
) {
  const frames = createRouteFrames(points);
  if (frames.length === 0) return [];

  const sideOffset = (railOffset ?? getRouteRailOffset(width)) + 9;
  const markers = [
    { ratio: 0.16, side: -1, path: assets.track.arrowRight },
    { ratio: 0.34, side: 1, path: assets.track.arrowLeft },
    { ratio: 0.48, side: 1, path: assets.track.arrowLeft },
    { ratio: 0.66, side: -1, path: assets.track.arrowRight },
    { ratio: 0.84, side: -1, path: assets.track.arrowRight },
  ];

  return markers.map((marker) => {
    const frame = frames[Math.floor(marker.ratio * frames.length)];
    const position = frame.point
      .clone()
      .addScaledVector(frame.right, sideOffset * marker.side);
    const rotationY =
      Math.atan2(frame.tangent.x, frame.tangent.z) -
      marker.side * (Math.PI / 2);

    return {
      path: marker.path,
      position: [position.x, 0, position.z] as [number, number, number],
      rotationY,
    };
  });
}

const BARRIER_PANEL_LENGTH = 5.8;
const BARRIER_FRAME_STEP = 0.2;
const BARRIER_PANEL_RED = new THREE.Color("#d43f32");
const BARRIER_PANEL_WHITE = new THREE.Color("#f8fafc");

function roundDistance(distance: number) {
  return Math.round(distance * 1000) / 1000;
}

function barrierPanelColor(distance: number, panelLength: number) {
  return Math.floor(distance / panelLength) % 2 === 0
    ? BARRIER_PANEL_RED
    : BARRIER_PANEL_WHITE;
}

export function collectBarrierDistances(
  curveLength: number,
  panelLength = BARRIER_PANEL_LENGTH,
  frameStep = BARRIER_FRAME_STEP,
) {
  const distances: number[] = [];
  const stepCount = Math.ceil(curveLength / frameStep);
  for (let step = 0; step < stepCount; step += 1) {
    distances.push(roundDistance(step * frameStep));
  }

  for (
    let panelEdge = panelLength;
    panelEdge < curveLength;
    panelEdge += panelLength
  ) {
    const rounded = roundDistance(panelEdge);
    if (!distances.some((distance) => Math.abs(distance - rounded) < 0.06)) {
      distances.push(rounded);
    }
  }

  distances.sort((a, b) => a - b);
  return distances;
}

export function createRouteShoulderGeometry(
  points: Vec3[],
  innerOffset: number,
  outerOffset: number,
  side: -1 | 1,
  roadSurfaceY = ROAD_SURFACE_Y,
  routeLayout?: RouteFrameOptions,
) {
  const curve = createRouteCurve(points, roadSurfaceY, routeLayout);
  const curveLength = curve.getLength();
  if (curveLength <= 0 || outerOffset <= innerOffset) {
    return new THREE.BufferGeometry();
  }

  const { samples } = createRouteSamplesAtDistances(
    points,
    collectBarrierDistances(curveLength),
    roadSurfaceY,
    routeLayout,
  );
  const positions: number[] = [];
  const indices: number[] = [];

  for (const frame of samples) {
    const inner = frame.point
      .clone()
      .addScaledVector(frame.right, side * innerOffset);
    const outer = frame.point
      .clone()
      .addScaledVector(frame.right, side * outerOffset);

    positions.push(
      inner.x,
      roadSurfaceY,
      inner.z,
      outer.x,
      roadSurfaceY,
      outer.z,
    );
  }

  for (let index = 0; index < samples.length; index += 1) {
    const nextIndex = (index + 1) % samples.length;
    const base = index * 2;
    const next = nextIndex * 2;
    if (!shouldConnectRibbonVertices(positions, base, next, nextIndex === 0)) {
      continue;
    }
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

export function createRouteBarrierGeometry(
  points: Vec3[],
  railOffset: number,
  railWidth: number,
  height: number,
  side: -1 | 1,
  _railColor = "#d8dde4",
  panelLength = BARRIER_PANEL_LENGTH,
  roadSurfaceY = ROAD_SURFACE_Y,
  routeLayout?: RouteFrameOptions,
) {
  const curve = createRouteCurve(points, roadSurfaceY, routeLayout);
  const totalLength = curve.getLength();
  if (totalLength <= 0) return new THREE.BufferGeometry();

  const distances = collectBarrierDistances(totalLength, panelLength);
  const { samples } = createRouteSamplesAtDistances(
    points,
    distances,
    roadSurfaceY,
    routeLayout,
  );
  if (samples.length < 2) return new THREE.BufferGeometry();

  const innerOffset = railOffset - railWidth / 2;
  const outerOffset = railOffset + railWidth / 2;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index < samples.length; index += 1) {
    const frame = samples[index];
    const inner = frame.point
      .clone()
      .addScaledVector(frame.right, side * innerOffset);
    const outer = frame.point
      .clone()
      .addScaledVector(frame.right, side * outerOffset);
    const panelColor = barrierPanelColor(distances[index], panelLength);

    positions.push(
      inner.x,
      inner.y,
      inner.z,
      outer.x,
      outer.y,
      outer.z,
      inner.x,
      inner.y + height,
      inner.z,
      outer.x,
      outer.y + height,
      outer.z,
    );
    colors.push(
      panelColor.r,
      panelColor.g,
      panelColor.b,
      panelColor.r,
      panelColor.g,
      panelColor.b,
      panelColor.r,
      panelColor.g,
      panelColor.b,
      panelColor.r,
      panelColor.g,
      panelColor.b,
    );
  }

  for (let index = 0; index < samples.length; index += 1) {
    const nextIndex = (index + 1) % samples.length;
    const baseIndex = index * 4;
    const nextBase = nextIndex * 4;
    if (
      !shouldConnectBarrierFrames(
        samples,
        index,
        nextIndex,
        innerOffset,
        outerOffset,
        side,
        nextIndex === 0,
      )
    ) {
      continue;
    }
    pushBarrierQuad(
      indices,
      baseIndex,
      nextBase,
      baseIndex + 2,
      nextBase + 2,
      side,
    );
    pushBarrierQuad(
      indices,
      baseIndex + 2,
      nextBase + 2,
      baseIndex + 3,
      nextBase + 3,
      side,
    );
    pushBarrierQuad(
      indices,
      baseIndex + 1,
      baseIndex + 3,
      nextBase + 3,
      nextBase + 1,
      side === 1 ? -1 : 1,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function vertexDistance(positions: number[], a: number, b: number, stride = 3) {
  const ax = positions[a * stride];
  const az = positions[a * stride + 2];
  const bx = positions[b * stride];
  const bz = positions[b * stride + 2];
  return Math.hypot(ax - bx, az - bz);
}

function shouldConnectRibbonVertices(
  positions: number[],
  base: number,
  nextBase: number,
) {
  const leftEdge = vertexDistance(positions, base, nextBase);
  const rightEdge = vertexDistance(positions, base + 1, nextBase + 1);
  return (
    leftEdge <= MAX_ROUTE_QUAD_EDGE && rightEdge <= MAX_ROUTE_QUAD_EDGE
  );
}

function shouldConnectBarrierFrames(
  samples: RouteFrame[],
  index: number,
  nextIndex: number,
  innerOffset: number,
  outerOffset: number,
  side: -1 | 1,
  isSeam: boolean,
) {
  const current = samples[index];
  const next = samples[nextIndex];
  const innerA = current.point
    .clone()
    .addScaledVector(current.right, side * innerOffset);
  const innerB = next.point
    .clone()
    .addScaledVector(next.right, side * innerOffset);
  const outerA = current.point
    .clone()
    .addScaledVector(current.right, side * outerOffset);
  const outerB = next.point
    .clone()
    .addScaledVector(next.right, side * outerOffset);
  const innerEdge = innerA.distanceTo(innerB);
  const outerEdge = outerA.distanceTo(outerB);
  if (innerEdge > MAX_ROUTE_QUAD_EDGE || outerEdge > MAX_ROUTE_QUAD_EDGE) {
    return false;
  }
  if (
    isSeam &&
    (innerEdge > BARRIER_FRAME_STEP * 2.5 ||
      outerEdge > BARRIER_FRAME_STEP * 2.5)
  ) {
    return false;
  }
  if (current.right.dot(next.right) < 0.25) return false;
  return true;
}

function pushBarrierQuad(
  indices: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  side: -1 | 1,
) {
  if (side === 1) {
    indices.push(a, b, c, c, b, d);
    return;
  }
  indices.push(a, c, b, c, d, b);
}
