import { describe, expect, it } from "vitest";
import {
  MAX_ROUTE_QUAD_EDGE,
  analyzeRouteRibbon,
} from "./routeMeshDiagnostics";
import { cityLoopV1Track, cityMonacoTrack } from "./track";

describe("route ribbon diagnostics", () => {
  it("connects monaco hairpins without ribbon gaps", () => {
    const monaco = analyzeRouteRibbon(
      cityMonacoTrack.routePoints!,
      cityMonacoTrack.roadWidth ?? 20,
    );

    expect(monaco.skippedSegments).toBe(0);
    expect(monaco.coverage).toBeGreaterThan(0.99);
    expect(monaco.maxSkippedEdge).toBeLessThanOrEqual(MAX_ROUTE_QUAD_EDGE);
  });

  it("keeps city loop ribbon continuous", () => {
    const cityLoop = analyzeRouteRibbon(
      cityLoopV1Track.routePoints!,
      cityLoopV1Track.roadWidth ?? 40,
    );

    expect(cityLoop.skippedSegments).toBe(0);
    expect(cityLoop.coverage).toBeGreaterThan(0.99);
  });
});
