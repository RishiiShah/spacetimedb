import { MAX_ROUTE_QUAD_EDGE } from "./routeGeometry";
import { createRouteRibbonGeometry } from "./routeMesh";
import type { Vec3 } from "./track";

function vertexDistance(positions: number[], a: number, b: number) {
  const ax = positions[a * 3];
  const az = positions[a * 3 + 2];
  const bx = positions[b * 3];
  const bz = positions[b * 3 + 2];
  return Math.hypot(ax - bx, az - bz);
}

function segmentConnected(
  indices: { count: number; getX: (index: number) => number },
  base: number,
  nextBase: number,
) {
  for (let offset = 0; offset < indices.count; offset += 3) {
    const a = indices.getX(offset);
    const b = indices.getX(offset + 1);
    const c = indices.getX(offset + 2);
    if (
      (a === base && b === nextBase) ||
      (a === base + 1 && b === nextBase + 1) ||
      (b === base && c === nextBase) ||
      (b === base + 1 && c === nextBase + 1)
    ) {
      return true;
    }
  }
  return false;
}

export function analyzeRouteRibbon(points: Vec3[], width: number) {
  const geometry = createRouteRibbonGeometry(points, width, 0, 0);
  const positions = Array.from(
    geometry.getAttribute("position").array as Float32Array,
  );
  const indices = geometry.getIndex();
  const frameCount = positions.length / 6;
  const triangleCount = (indices?.count ?? 0) / 3;
  const connectedSegments = triangleCount / 2;

  let maxSkippedEdge = 0;
  let skippedSegments = 0;
  if (indices) {
    for (let index = 0; index < frameCount; index += 1) {
      const nextIndex = (index + 1) % frameCount;
      const base = index * 2;
      const nextBase = nextIndex * 2;
      const leftEdge = vertexDistance(positions, base, nextBase);
      const rightEdge = vertexDistance(positions, base + 1, nextBase + 1);
      const maxEdge = Math.max(leftEdge, rightEdge);
      if (!segmentConnected(indices, base, nextBase)) {
        skippedSegments += 1;
        maxSkippedEdge = Math.max(maxSkippedEdge, maxEdge);
      }
    }
  }

  return {
    frames: frameCount,
    triangleCount,
    connectedSegments,
    skippedSegments,
    maxSkippedEdge,
    coverage: connectedSegments / frameCount,
  };
}

export function maxRibbonEdgeLength(points: Vec3[], width: number) {
  const geometry = createRouteRibbonGeometry(points, width, 0, 0);
  const positions = Array.from(
    geometry.getAttribute("position").array as Float32Array,
  );
  const frameCount = positions.length / 6;
  let maxEdge = 0;
  for (let index = 0; index < frameCount; index += 1) {
    const nextIndex = (index + 1) % frameCount;
    const base = index * 2;
    const nextBase = nextIndex * 2;
    maxEdge = Math.max(
      maxEdge,
      vertexDistance(positions, base, nextBase),
      vertexDistance(positions, base + 1, nextBase + 1),
    );
  }
  return maxEdge;
}

export { MAX_ROUTE_QUAD_EDGE };
