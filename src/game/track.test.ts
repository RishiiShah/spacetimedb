import { describe, expect, it } from "vitest";
import {
  GAME_MODES,
  TRACK_REGISTRY,
  type Vec3,
  getDefaultTrackForMode,
  getTrackById,
  getTracksByMode,
} from "./track";

function routeBounds(points: Vec3[]) {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...zs) - Math.min(...zs),
  };
}

function segmentIntersection(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
  const orientation = (p: Vec3, q: Vec3, r: Vec3) =>
    Math.sign((q.z - p.z) * (r.x - q.x) - (q.x - p.x) * (r.z - q.z));

  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

function nonAdjacentSegmentsDoNotCross(points: Vec3[]) {
  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % points.length;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < points.length;
      secondIndex += 1
    ) {
      const secondNext = (secondIndex + 1) % points.length;
      const adjacent =
        firstIndex === secondIndex ||
        firstIndex === secondNext ||
        firstNext === secondIndex ||
        firstNext === secondNext;
      if (adjacent) continue;
      if (
        segmentIntersection(
          points[firstIndex],
          points[firstNext],
          points[secondIndex],
          points[secondNext],
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function pointToSegmentDistance(point: Vec3, start: Vec3, end: Vec3) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return Math.hypot(point.x - start.x, point.z - start.z);

  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq,
    ),
  );
  const projectedX = start.x + progress * dx;
  const projectedZ = start.z + progress * dz;
  return Math.hypot(point.x - projectedX, point.z - projectedZ);
}

function nearestRouteSegmentDistance(point: Vec3, points: Vec3[]) {
  let closest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    closest = Math.min(
      closest,
      pointToSegmentDistance(point, points[index], points[nextIndex]),
    );
  }

  return closest;
}

function nearestRouteSegment(point: Vec3, points: Vec3[]) {
  let closest = {
    distance: Number.POSITIVE_INFINITY,
    start: points[0],
    end: points[1],
  };

  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    const distance = pointToSegmentDistance(
      point,
      points[index],
      points[nextIndex],
    );
    if (distance < closest.distance) {
      closest = { distance, start: points[index], end: points[nextIndex] };
    }
  }

  return closest;
}

function segmentProgress(point: Vec3, start: Vec3, end: Vec3) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return 0;
  return ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq;
}

function segmentDistance(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

function closestNonAdjacentSegmentDistance(points: Vec3[]) {
  let closest = Number.POSITIVE_INFINITY;
  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % points.length;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < points.length;
      secondIndex += 1
    ) {
      const secondNext = (secondIndex + 1) % points.length;
      const adjacent =
        firstIndex === secondIndex ||
        firstIndex === secondNext ||
        firstNext === secondIndex ||
        firstNext === secondNext;
      if (adjacent) continue;
      closest = Math.min(
        closest,
        segmentDistance(
          points[firstIndex],
          points[firstNext],
          points[secondIndex],
          points[secondNext],
        ),
      );
    }
  }
  return closest;
}

describe("track registry", () => {
  it("exposes Circuit, Stunt, and Practice modes", () => {
    expect(GAME_MODES.map((mode) => mode.id)).toEqual([
      "circuit",
      "stunt",
      "practice",
    ]);
    expect(GAME_MODES.find((mode) => mode.id === "circuit")?.label).toBe(
      "Circuit",
    );
    expect(GAME_MODES.find((mode) => mode.id === "stunt")?.label).toBe("Stunt");
    expect(GAME_MODES.find((mode) => mode.id === "practice")?.label).toBe(
      "Practice",
    );
  });

  it("registers multiple Circuit maps", () => {
    const circuitTracks = getTracksByMode("circuit");
    const mappedTracks = circuitTracks.filter((track) => track.circuitMapPath);

    expect(mappedTracks.map((track) => track.slug)).toEqual(
      expect.arrayContaining([
        "circuit-monza",
        "circuit-austria",
        "circuit-interlagos",
      ]),
    );
    expect(mappedTracks.length).toBeGreaterThanOrEqual(7);
    expect(
      mappedTracks.every((track) => track.circuitMapPath?.endsWith(".json")),
    ).toBe(true);
  });

  it("keeps Stunt mode available as the stunt baseline", () => {
    const stuntTracks = getTracksByMode("stunt");

    expect(stuntTracks.map((track) => track.slug)).toContain("stunt-showcase");
    expect(stuntTracks.every((track) => track.mode === "stunt")).toBe(true);
  });

  it("every track has spawn and checkpoints for race flow", () => {
    for (const track of Object.values(TRACK_REGISTRY)) {
      expect(track.spawn.position).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
      });
      expect(track.checkpoints.length).toBeGreaterThan(0);
      expect(track.checkpoints[0].index).toBe(0);
    }
  });

  it("looks up tracks by bigint id and mode defaults", () => {
    const circuit = getDefaultTrackForMode("circuit");
    const stunt = getDefaultTrackForMode("stunt");

    expect(circuit.mode).toBe("circuit");
    expect(stunt.mode).toBe("stunt");
    expect(getTrackById(circuit.id)).toBe(circuit);
  });

  it("starts circuit mode on the hand-drawn city loop", () => {
    const track = getDefaultTrackForMode("circuit");

    expect(track.slug).toBe("city-loop-v1");
    expect(track.origin).toBe("local");
    expect(track.type).toBe("circuit");
    expect(track.routePoints?.length).toBeGreaterThanOrEqual(11);
    expect(track.checkpoints.length).toBeGreaterThanOrEqual(6);
    expect(track.roadWidth).toBeGreaterThanOrEqual(34);
    expect(track.railHeight).toBeCloseTo(1.4);
    expect(track.railOffset).toBeGreaterThanOrEqual(18);
    expect(
      track.placements.some(
        (placement) => placement.assetId === "twistedTower",
      ),
    ).toBe(true);
    expect(
      track.placements.some(
        (placement) => placement.assetId === "trafficLight",
      ),
    ).toBe(true);
  });

  it("keeps the city loop large enough to avoid road-over-road overlap", () => {
    const track = getDefaultTrackForMode("circuit");
    const points = track.routePoints ?? [];
    const bounds = routeBounds(points);

    expect(bounds.width).toBeGreaterThanOrEqual(850);
    expect(bounds.height).toBeGreaterThanOrEqual(480);
    expect(nonAdjacentSegmentsDoNotCross(points)).toBe(true);
    expect(track.roadWidth).toBeCloseTo(40.5);
    expect(track.railOffset).toBeCloseTo((track.roadWidth ?? 0) / 2 + 3.4);
    expect(closestNonAdjacentSegmentDistance(points)).toBeGreaterThanOrEqual(
      (track.roadWidth ?? 0) * 2,
    );
  });

  it("places the city loop start 20 percent into the straight after the opening corner", () => {
    const track = getDefaultTrackForMode("circuit");
    const points = track.routePoints ?? [];
    const nearest = nearestRouteSegment(track.spawn.position, points);
    const segmentLength = Math.hypot(
      nearest.end.x - nearest.start.x,
      nearest.end.z - nearest.start.z,
    );
    const progress = segmentProgress(
      track.spawn.position,
      nearest.start,
      nearest.end,
    );

    expect(nearest.distance).toBeLessThanOrEqual(1);
    expect(nearest.start).toEqual(points[1]);
    expect(nearest.end).toEqual(points[2]);
    expect(segmentLength).toBeGreaterThanOrEqual(120);
    expect(progress).toBeGreaterThanOrEqual(0.18);
    expect(progress).toBeLessThanOrEqual(0.22);
    expect(
      nearestRouteSegmentDistance(track.checkpoints[0].position, points),
    ).toBeLessThanOrEqual(1);
    expect(
      segmentProgress(track.checkpoints[0].position, points[1], points[2]),
    ).toBeGreaterThan(progress);
  });

  it("keeps local route placements outside the road and rail envelope", () => {
    const localRouteTracks = Object.values(TRACK_REGISTRY).filter(
      (track) => track.origin === "local" && track.routePoints,
    );

    expect(localRouteTracks.length).toBeGreaterThan(0);

    for (const track of localRouteTracks) {
      const clearance = (track.roadWidth ?? 0) / 2 + (track.railOffset ?? 0);

      for (const placement of track.placements) {
        expect(
          nearestRouteSegmentDistance(
            placement.position,
            track.routePoints ?? [],
          ),
          `${track.slug}:${placement.assetId}@${placement.position.x},${placement.position.z}`,
        ).toBeGreaterThanOrEqual(clearance);
      }
    }
  });

  it("includes a flat road-only practice world for driving mechanics", () => {
    const practiceTracks = getTracksByMode("practice");
    const track = practiceTracks[0];

    expect(track.slug).toBe("flat-road-practice");
    expect(track.origin).toBe("local");
    expect(track.routePoints?.length).toBeGreaterThanOrEqual(4);
    expect(track.roadWidth).toBeCloseTo(39);
    expect(track.placements).toEqual([]);
    expect(getDefaultTrackForMode("practice")).toBe(track);
  });
});
