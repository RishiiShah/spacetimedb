import { describe, expect, it } from "vitest";
import { createRouteCurve, createRouteFrames } from "./routeGeometry";
import { createRouteRibbonGeometry } from "./routeMesh";
import { TRACK_REGISTRY } from "./track";

function ribbonCoverage(points: Parameters<typeof createRouteRibbonGeometry>[0], width: number) {
  const frames = createRouteFrames(points);
  const geometry = createRouteRibbonGeometry(points, width, 0, 0);
  const indices = geometry.getIndex();
  const triangleCount = (indices?.count ?? 0) / 3;
  const connectedSegments = triangleCount / 2;
  const coverage = connectedSegments / frames.length;
  return { frames: frames.length, triangleCount, coverage };
}

describe("local route road mesh", () => {
  const localTracks = Object.values(TRACK_REGISTRY).filter(
    (track) => track.origin === "local" && track.routePoints?.length,
  );

  it.each(localTracks.map((track) => [track.slug, track] as const))(
    "%s generates enough asphalt to render a visible track",
    (slug, track) => {
      const points = track.routePoints!;
      const width = track.roadWidth ?? 34;
      const length = createRouteCurve(points).getLength();
      const { triangleCount, coverage } = ribbonCoverage(points, width);

      expect(length, `${slug} arc length`).toBeGreaterThan(100);
      expect(triangleCount, `${slug} triangles`).toBeGreaterThan(100);
      expect(coverage, `${slug} ribbon coverage`).toBeGreaterThan(0.85);
    },
  );
});
