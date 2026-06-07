import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { circuitMonzaTrack } from "./track";
import {
  createGrandstandPlacements,
  isClearOfRoute,
  parseCircuitMapData,
} from "./CircuitTrack";

describe("Circuit map parsing", () => {
  it("turns route JSON into scaled road points", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );

    const parsed = parseCircuitMapData(map, circuitMonzaTrack);

    expect(parsed.points.length).toBeGreaterThan(20);
    expect(parsed.points[0]).toEqual({ x: 9.6, y: 0, z: 16.8 });
    expect(parsed.closed).toBe(true);
    expect(parsed.width).toBeGreaterThan(8);
  });

  it("ignores invalid or empty map data without crashing", () => {
    const parsed = parseCircuitMapData({ trackCurves: [] }, circuitMonzaTrack);

    expect(parsed.points).toEqual([]);
    expect(parsed.closed).toBe(false);
  });

  it("places grandstands around monza without overlapping the road", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const stands = createGrandstandPlacements(parsed);

    expect(stands.length).toBeGreaterThanOrEqual(4);
    for (const stand of stands) {
      expect(isClearOfRoute(parsed, stand.position, parsed.width / 2 + 4)).toBe(
        true,
      );
    }
  });
});
