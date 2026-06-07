import { describe, expect, it } from "vitest";
import { createRouteFrames } from "./routeGeometry";
import { cityLoopV1Track, cityMonacoTrack } from "./track";

const CITY_GROUND = { width: 1120, height: 760 };

function frameBounds(points: Parameters<typeof createRouteFrames>[0]) {
  const frames = createRouteFrames(points);
  const xs = frames.map((frame) => frame.point.x);
  const zs = frames.map((frame) => frame.point.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...zs) - Math.min(...zs),
  };
}

describe("city ground plane sizing", () => {
  it("covers the city loop rendered route with margin", () => {
    const bounds = frameBounds(cityLoopV1Track.routePoints!);
    const halfW = CITY_GROUND.width / 2;
    const halfH = CITY_GROUND.height / 2;

    expect(bounds.minX).toBeGreaterThanOrEqual(-halfW);
    expect(bounds.maxX).toBeLessThanOrEqual(halfW);
    expect(bounds.minZ).toBeGreaterThanOrEqual(-halfH);
    expect(bounds.maxZ).toBeLessThanOrEqual(halfH);
  });

  it("covers monaco rendered route with margin", () => {
    const bounds = frameBounds(cityMonacoTrack.routePoints!);
    const halfW = CITY_GROUND.width / 2;
    const halfH = CITY_GROUND.height / 2;

    expect(bounds.minX).toBeGreaterThanOrEqual(-halfW);
    expect(bounds.maxX).toBeLessThanOrEqual(halfW);
    expect(bounds.minZ).toBeGreaterThanOrEqual(-halfH);
    expect(bounds.maxZ).toBeLessThanOrEqual(halfH);
  });
});
