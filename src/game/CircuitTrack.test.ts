import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { TrackDef } from "./track";
import {
  circuitAustriaTrack,
  circuitBrandsTrack,
  circuitFundaTrack,
  circuitIndyTrack,
  circuitInterlagosTrack,
  circuitMonzaTrack,
  circuitSuburbanTrack,
} from "./track";
import {
  buildCircuitCollisionTrack,
  createGrandstandPlacements,
  densifyCornerControlPoints,
  groundSizeForParsed,
  isClearOfRoute,
  minCenterlineSeparation,
  parseCircuitMapData,
} from "./circuitTrackData";
import { getCircuitCityPlacements } from "./circuitTrackScenery";
import { createRouteRoadGeometries } from "./routeRoadGeometry";
import { sceneryFootprintRadius, sceneryMinClearance } from "./trackScenery";
import { getRouteFenceInnerOffset } from "./track";
import { ROAD_SURFACE_Y, ROUTE_WALL_HEIGHT } from "./track";
import {
  createInitialVehicleState,
  stepVehicle,
  VEHICLE_COLLISION_HALF_WIDTH,
} from "./vehicle";
import {
  nearestRouteCurveProjection,
  sampleRouteGroundY,
} from "./routeGeometry";

const MAPPED_CIRCUIT_TRACKS = [
  circuitAustriaTrack,
  circuitBrandsTrack,
  circuitFundaTrack,
  circuitIndyTrack,
  circuitInterlagosTrack,
  circuitMonzaTrack,
  circuitSuburbanTrack,
] as const;

describe("Circuit map parsing", () => {
  it("turns route JSON into scaled road points", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );

    const parsed = parseCircuitMapData(map, circuitMonzaTrack);

    expect(parsed.points.length).toBeGreaterThanOrEqual(15);
    expect(parsed.points[0].z).toBe(32);
    expect(
      Math.max(...parsed.points.map((point) => Math.abs(point.x))),
    ).toBeGreaterThan(180);
    expect(parsed.closed).toBe(true);
    expect(parsed.width).toBeGreaterThan(16);
    expect(minCenterlineSeparation(parsed.points)).toBeGreaterThan(
      parsed.width + 6,
    );
  });

  it("exposes mapped circuit routes for barrier collision", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const collisionTrack = buildCircuitCollisionTrack(
      circuitMonzaTrack,
      parsed,
    );

    expect(collisionTrack.routePoints?.length).toBeGreaterThanOrEqual(15);
    expect(collisionTrack.roadWidth).toBeGreaterThan(16);
    expect(collisionTrack.railOffset).toBeGreaterThan(
      (collisionTrack.roadWidth ?? 0) / 2,
    );

    const fenceLimit =
      getRouteFenceInnerOffset(
        collisionTrack.roadWidth ?? 0,
        collisionTrack.railOffset,
      ) - VEHICLE_COLLISION_HALF_WIDTH;
    const outside = {
      ...createInitialVehicleState(),
      position: {
        x: circuitMonzaTrack.spawn.position.x + 80,
        y: 0,
        z: circuitMonzaTrack.spawn.position.z,
      },
      speed: 20,
      heading: circuitMonzaTrack.spawn.heading,
    };
    const next = stepVehicle(
      outside,
      { throttle: 0, brake: 0, steer: 0 },
      0.016,
      collisionTrack,
    );
    const distance = nearestRouteCurveProjection(
      next.position,
      collisionTrack.routePoints ?? [],
      collisionTrack.routeLayout,
    ).distance;

    expect(distance).toBeCloseTo(fenceLimit, 0);
  });

  it("syncs spawn, checkpoint, physics, and mesh height on elevated austria", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/austria.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitAustriaTrack);
    const track = buildCircuitCollisionTrack(circuitAustriaTrack, parsed);
    const points = track.routePoints ?? [];
    const layout = track.routeLayout;

    expect(Math.max(...points.map((point) => point.y))).toBeGreaterThan(3);
    expect(track.checkpoints[1]?.position.y).toBeGreaterThan(2);

    const checkpoint = track.checkpoints[1].position;
    const physicsY = sampleRouteGroundY(checkpoint, points, layout);
    expect(physicsY).toBeCloseTo(checkpoint.y, 1);

    const geometries = createRouteRoadGeometries({
      points,
      width: track.roadWidth ?? 21,
      routeLayout: layout,
    });
    const asphaltY = nearestAsphaltY(
      geometries.asphalt,
      checkpoint.x,
      checkpoint.z,
    );
    expect(physicsY).toBeCloseTo(asphaltY, 1.2);
  });

  it("ignores invalid or empty map data without crashing", () => {
    const parsed = parseCircuitMapData({ trackCurves: [] }, circuitMonzaTrack);

    expect(parsed.points).toEqual([]);
    expect(parsed.closed).toBe(false);
  });

  it("rounds tight corners without keeping the sharp apex points", () => {
    const square = [
      { x: 0, y: 0, z: 0 },
      { x: 40, y: 0, z: 0 },
      { x: 40, y: 0, z: 40 },
      { x: 0, y: 0, z: 40 },
    ];

    const rounded = densifyCornerControlPoints(square);

    expect(rounded.length).toBe(8);
    for (const apex of square) {
      expect(rounded).not.toContainEqual(apex);
    }
    for (const point of rounded) {
      expect(nearestControlPointDistance(point, square)).toBeGreaterThan(0);
      expect(nearestControlPointDistance(point, square)).toBeLessThanOrEqual(
        18,
      );
    }
  });

  it("uses a stronger rounded inset on larger mapped-circuit corners", () => {
    const square = [
      { x: 0, y: 0, z: 0 },
      { x: 80, y: 0, z: 0 },
      { x: 80, y: 0, z: 80 },
      { x: 0, y: 0, z: 80 },
    ];

    const rounded = densifyCornerControlPoints(square);

    expect(rounded.length).toBe(8);
    for (const point of rounded) {
      expect(nearestControlPointDistance(point, square)).toBeGreaterThanOrEqual(
        22,
      );
      expect(nearestControlPointDistance(point, square)).toBeLessThanOrEqual(
        26,
      );
    }
  });

  it("places grandstands around monza without overlapping the road", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const stands = createGrandstandPlacements(parsed);

    expect(stands.length).toBeGreaterThanOrEqual(3);
    for (const stand of stands) {
      expect(isClearOfRoute(parsed, stand.position, parsed.width / 2 + 4)).toBe(
        true,
      );
    }
  });

  it("generates city buildings around monza without overlapping the road", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const placements = getCircuitCityPlacements(
      circuitMonzaTrack,
      parsed,
      parsed.width,
    );

    expect(placements.length).toBeGreaterThanOrEqual(8);
    expect(
      placements.some((placement) => placement.assetId === "twistedTower"),
    ).toBe(true);
    for (const placement of placements) {
      expect(
        isClearOfRoute(
          parsed,
          placement.position,
          sceneryMinClearance(parsed.width, placement.scale, placement.assetId),
        ),
      ).toBe(true);
    }
  });

  it("keeps monza city assets inside the expanded grass area", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const placements = getCircuitCityPlacements(
      circuitMonzaTrack,
      parsed,
      parsed.width,
    );
    const halfGround = groundSizeForParsed(parsed) / 2;

    for (const placement of placements) {
      const footprint = sceneryFootprintRadius(
        placement.assetId,
        placement.scale,
      );
      expect(Math.abs(placement.position.x) + footprint).toBeLessThan(
        halfGround,
      );
      expect(Math.abs(placement.position.z) + footprint).toBeLessThan(
        halfGround,
      );
    }
  });

  it("generates clear city buildings around every mapped circuit", () => {
    for (const track of MAPPED_CIRCUIT_TRACKS) {
      const parsed = parseMappedCircuit(track);
      const placements = getCircuitCityPlacements(track, parsed, parsed.width);

      expect(placements.length, track.slug).toBeGreaterThanOrEqual(6);
      for (const placement of placements) {
        expect(
          isClearOfRoute(
            parsed,
            placement.position,
            sceneryMinClearance(
              parsed.width,
              placement.scale,
              placement.assetId,
            ),
          ),
          `${track.slug} ${placement.assetId}`,
        ).toBe(true);
      }
    }
  });

  it("keeps generated city buildings inside every mapped circuit grass area", () => {
    for (const track of MAPPED_CIRCUIT_TRACKS) {
      const parsed = parseMappedCircuit(track);
      const placements = getCircuitCityPlacements(track, parsed, parsed.width);
      const halfGround = groundSizeForParsed(parsed) / 2;

      expect(placements.length, track.slug).toBeGreaterThanOrEqual(6);
      for (const placement of placements) {
        const footprint = sceneryFootprintRadius(
          placement.assetId,
          placement.scale,
        );
        expect(
          Math.abs(placement.position.x) + footprint,
          `${track.slug} ${placement.assetId} x`,
        ).toBeLessThan(halfGround);
        expect(
          Math.abs(placement.position.z) + footprint,
          `${track.slug} ${placement.assetId} z`,
        ).toBeLessThan(halfGround);
      }
    }
  });

  it("keeps monza road paint and curbs above asphalt to avoid flickering", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const geometries = createRouteRoadGeometries({
      points: parsed.points,
      width: parsed.width,
      railHeight: ROUTE_WALL_HEIGHT,
      routeLayout: circuitMonzaTrack.routeLayout,
      showShoulders: true,
    });

    expect(minGeometryY(geometries.asphalt)).toBeCloseTo(ROAD_SURFACE_Y);
    expect(minGeometryY(geometries.leftEdge)).toBeGreaterThan(
      minGeometryY(geometries.asphalt),
    );
    expect(minGeometryY(geometries.rightEdge)).toBeGreaterThan(
      minGeometryY(geometries.asphalt),
    );
    expect(minGeometryY(geometries.leftCurb)).toBeGreaterThan(
      minGeometryY(geometries.leftEdge),
    );
    expect(minGeometryY(geometries.rightCurb)).toBeGreaterThan(
      minGeometryY(geometries.rightEdge),
    );
  });

  it("does not connect folded monza road strips across tight chicanes", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const geometries = createRouteRoadGeometries({
      points: parsed.points,
      width: parsed.width,
      railHeight: ROUTE_WALL_HEIGHT,
      routeLayout: circuitMonzaTrack.routeLayout,
      showShoulders: true,
    });

    expect(maxTriangleEdge(geometries.asphalt)).toBeLessThan(parsed.width + 6);
    expect(maxTriangleEdge(geometries.leftEdge)).toBeLessThan(8);
    expect(maxTriangleEdge(geometries.rightEdge)).toBeLessThan(8);
    expect(maxTriangleEdge(geometries.leftCurb)).toBeLessThan(8);
    expect(maxTriangleEdge(geometries.rightCurb)).toBeLessThan(8);
    if (!geometries.leftShoulder || !geometries.rightShoulder) {
      throw new Error("expected monza shoulder geometry");
    }
    expect(maxTriangleEdge(geometries.leftShoulder)).toBeLessThan(8);
    expect(maxTriangleEdge(geometries.rightShoulder)).toBeLessThan(8);
  });

  it("does not connect folded road strips on any mapped circuit", () => {
    for (const track of MAPPED_CIRCUIT_TRACKS) {
      const parsed = parseMappedCircuit(track);
      const geometries = createRouteRoadGeometries({
        points: parsed.points,
        width: parsed.width,
        railHeight: ROUTE_WALL_HEIGHT,
        routeLayout: track.routeLayout,
        showShoulders: true,
      });

      expect(maxTriangleEdge(geometries.asphalt), track.slug).toBeLessThan(
        parsed.width + 6,
      );
      expect(maxTriangleEdge(geometries.leftEdge), track.slug).toBeLessThan(8);
      expect(maxTriangleEdge(geometries.rightEdge), track.slug).toBeLessThan(8);
      expect(maxTriangleEdge(geometries.leftCurb), track.slug).toBeLessThan(8);
      expect(maxTriangleEdge(geometries.rightCurb), track.slug).toBeLessThan(8);
      if (!geometries.leftShoulder || !geometries.rightShoulder) {
        throw new Error(`expected ${track.slug} shoulder geometry`);
      }
      expect(maxTriangleEdge(geometries.leftShoulder), track.slug).toBeLessThan(
        8,
      );
      expect(
        maxTriangleEdge(geometries.rightShoulder),
        track.slug,
      ).toBeLessThan(8);
    }
  });
});

function parseMappedCircuit(track: TrackDef) {
  if (!track.circuitMapPath) {
    throw new Error(`expected ${track.slug} to have circuit map data`);
  }
  const map = JSON.parse(readFileSync(`public${track.circuitMapPath}`, "utf8"));
  return parseCircuitMapData(map, track);
}

function minGeometryY(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  let minY = Number.POSITIVE_INFINITY;
  for (let index = 0; index < positions.count; index += 1) {
    minY = Math.min(minY, positions.getY(index));
  }
  return minY;
}

function maxTriangleEdge(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!index) throw new Error("expected indexed geometry");

  let maxEdge = 0;
  for (let cursor = 0; cursor < index.count; cursor += 3) {
    const a = index.getX(cursor);
    const b = index.getX(cursor + 1);
    const c = index.getX(cursor + 2);
    maxEdge = Math.max(
      maxEdge,
      geometryEdgeLength(positions, a, b),
      geometryEdgeLength(positions, b, c),
      geometryEdgeLength(positions, c, a),
    );
  }

  return maxEdge;
}

function geometryEdgeLength(
  positions: ReturnType<THREE.BufferGeometry["getAttribute"]>,
  a: number,
  b: number,
) {
  return Math.hypot(
    positions.getX(a) - positions.getX(b),
    positions.getY(a) - positions.getY(b),
    positions.getZ(a) - positions.getZ(b),
  );
}

function nearestControlPointDistance(
  point: THREE.Vector3 | { x: number; z: number },
  points: Array<{ x: number; z: number }>,
) {
  return Math.min(
    ...points.map((candidate) =>
      Math.hypot(point.x - candidate.x, point.z - candidate.z),
    ),
  );
}

function nearestAsphaltY(geometry: THREE.BufferGeometry, x: number, z: number) {
  const positions = geometry.getAttribute("position");
  let bestDistance = Number.POSITIVE_INFINITY;
  let height = 0;

  for (let index = 0; index < positions.count; index += 1) {
    const vx = positions.getX(index);
    const vz = positions.getZ(index);
    const distance = Math.hypot(x - vx, z - vz);
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    height = positions.getY(index);
  }

  return height;
}
