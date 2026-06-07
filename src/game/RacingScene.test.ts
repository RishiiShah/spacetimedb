import { readFileSync } from "node:fs";
import { BufferGeometry, Color, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  CIRCUIT_ROUTE_LAYOUT,
  getCircuitRailOffset,
  parseCircuitMapData,
} from "./circuitTrackData";
import { updateCamera } from "./racingCamera";
import { MAX_ROUTE_QUAD_EDGE } from "./routeGeometry";
import { RACING_RENDER_SETTINGS } from "./racingRenderSettings";
import {
  collectBarrierDistances,
  createRouteBarrierGeometry,
} from "./routeMesh";
import { circuitMonzaTrack } from "./track";
import type { VehicleState } from "./vehicle";

function vehicleAtOrigin(): VehicleState {
  return {
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    speed: 0,
    steer: 0,
    reverseArm: 0,
  };
}

describe("racing camera", () => {
  it("uses chase camera offsets in chase mode", () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3();

    for (let i = 0; i < 48; i++) {
      updateCamera(camera, target, vehicleAtOrigin(), "chase");
    }

    expect(camera.position.y).toBeCloseTo(3.87, 1);
    expect(camera.position.z).toBeCloseTo(6, 1);
    expect(camera.fov).toBe(58);
  });

  it("places the driver camera at head height looking down the track", () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3();

    updateCamera(camera, target, vehicleAtOrigin(), "driver");

    expect(camera.position.y).toBeCloseTo(1.18);
    expect(camera.position.z).toBeCloseTo(0.45);
    expect(camera.fov).toBe(72);
    expect(target.z).toBeCloseTo(-14);
  });

  it("caps expensive render settings for smoother local racing", () => {
    expect(RACING_RENDER_SETTINGS.dpr).toEqual([1, 1.35]);
    expect(RACING_RENDER_SETTINGS.shadowMapSize).toEqual([1024, 1024]);
  });

  it("keeps car models from casting or receiving dynamic shadows", () => {
    expect(RACING_RENDER_SETTINGS.carCastShadow).toBe(false);
    expect(RACING_RENDER_SETTINGS.carReceiveShadow).toBe(false);
  });
});

describe("route walls", () => {
  const route = [
    { x: -40, y: 0, z: -40 },
    { x: 40, y: 0, z: -40 },
    { x: 40, y: 0, z: 40 },
    { x: -40, y: 0, z: 40 },
  ];

  function attributeColor(
    attribute: ReturnType<BufferGeometry["getAttribute"]>,
    index: number,
  ) {
    return new Color(
      attribute.getX(index),
      attribute.getY(index),
      attribute.getZ(index),
    );
  }

  function colorDistance(a: Color, b: Color) {
    return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  }

  it("builds full-height continuous walls that alternate red and white by panel length", () => {
    const geometry = createRouteBarrierGeometry(route, 8, 1.6, 1.4, 1);
    const positions = geometry.getAttribute("position");
    const colors = geometry.getAttribute("color");
    const red = new Color("#d43f32");
    const white = new Color("#f8fafc");

    expect(positions.count).toBe(colors.count);
    expect(positions.count % 4).toBe(0);

    const base = attributeColor(colors, 0);
    const top = attributeColor(colors, 2);

    expect(
      colorDistance(base, red) < 0.001 || colorDistance(base, white) < 0.001,
    ).toBe(true);
    expect(colorDistance(base, top)).toBeLessThan(0.001);

    let hasRedPanel = false;
    let hasWhitePanel = false;
    for (let frameStart = 0; frameStart < colors.count; frameStart += 4) {
      const panel = attributeColor(colors, frameStart);
      if (colorDistance(panel, red) < 0.001) hasRedPanel = true;
      if (colorDistance(panel, white) < 0.001) hasWhitePanel = true;
    }
    expect(hasRedPanel).toBe(true);
    expect(hasWhitePanel).toBe(true);
  });

  it("samples walls densely along arc length and snaps panel edges", () => {
    const curveLength = 120;
    const distances = collectBarrierDistances(curveLength);
    const stepSamples = distances.filter(
      (distance, index, all) =>
        index === 0 || distance - all[index - 1] <= 0.2 + 0.01,
    );

    expect(distances[0]).toBe(0);
    expect(distances[distances.length - 1]).toBeLessThan(curveLength);
    expect(distances[distances.length - 1]).toBeGreaterThan(curveLength - 0.25);
    expect(distances).toContain(5.8);
    expect(distances).toContain(11.6);
    expect(stepSamples.length).toBeGreaterThanOrEqual(curveLength / 0.2);
  });

  it("keeps monza barrier panels from stretching across the track", () => {
    const map = JSON.parse(
      readFileSync("public/assets/circuit/maps/monza.json", "utf8"),
    );
    const parsed = parseCircuitMapData(map, circuitMonzaTrack);
    const roadWidth = parsed.width;
    const geometry = createRouteBarrierGeometry(
      parsed.points,
      getCircuitRailOffset(roadWidth),
      1,
      1.4,
      1,
      "#d8dde4",
      undefined,
      0,
      CIRCUIT_ROUTE_LAYOUT,
    );
    const positions = geometry.getAttribute("position");
    const indices = geometry.getIndex();
    if (!indices) throw new Error("expected indexed barrier geometry");

    let maxEdge = 0;
    for (let index = 0; index < indices.count; index += 3) {
      const a = indices.getX(index);
      const b = indices.getX(index + 1);
      const c = indices.getX(index + 2);
      maxEdge = Math.max(
        maxEdge,
        edgeLength(positions, a, b),
        edgeLength(positions, b, c),
        edgeLength(positions, c, a),
      );
    }

    expect(maxEdge).toBeLessThan(MAX_ROUTE_QUAD_EDGE * 1.5);
  });
});

function edgeLength(
  positions: ReturnType<BufferGeometry["getAttribute"]>,
  a: number,
  b: number,
) {
  const ax = positions.getX(a);
  const ay = positions.getY(a);
  const az = positions.getZ(a);
  const bx = positions.getX(b);
  const by = positions.getY(b);
  const bz = positions.getZ(b);
  return Math.hypot(ax - bx, ay - by, az - bz);
}
