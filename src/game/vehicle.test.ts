import { describe, expect, it } from "vitest";
import { cityLoopV1Track, getRouteFenceInnerOffset } from "./track";
import { nearestRouteCurveProjection } from "./routeGeometry";
import {
  VEHICLE_COLLISION_HALF_WIDTH,
  VEHICLE_OBSTACLE_COLLISION_RADIUS,
  createInitialVehicleState,
  createVehicleAtTrackReset,
  resolveVehicleObstacleCollisions,
  stepVehicle,
} from "./vehicle";

describe("vehicle movement", () => {
  it("accelerates forward when throttle is pressed", () => {
    const state = createInitialVehicleState();

    const next = stepVehicle(state, { throttle: 1, brake: 0, steer: 0 }, 1);

    expect(next.speed).toBeGreaterThan(0);
    expect(next.position.z).toBeLessThan(0);
  });

  it("turns while moving", () => {
    const state = { ...createInitialVehicleState(), speed: 20 };

    const next = stepVehicle(state, { throttle: 0, brake: 0, steer: 1 }, 0.5);

    expect(next.heading).toBeGreaterThan(0);
  });

  it("continues accelerating when throttle and steering are held together", () => {
    const state = { ...createInitialVehicleState(), speed: 20 };

    const next = stepVehicle(state, { throttle: 1, brake: 0, steer: 1 }, 0.5);

    expect(next.speed).toBeGreaterThan(state.speed);
    expect(next.heading).toBeGreaterThan(state.heading);
  });

  it("scrubs speed while cornering at speed", () => {
    const state = { ...createInitialVehicleState(), speed: 60 };

    const straight = stepVehicle(
      state,
      { throttle: 0, brake: 0, steer: 0 },
      0.2,
    );
    const cornering = stepVehicle(
      state,
      { throttle: 0, brake: 0, steer: 1 },
      0.2,
    );

    expect(cornering.speed).toBeLessThan(straight.speed);
  });

  it("drops speed in a corner even under full throttle at high speed", () => {
    // Already mid-corner (wheel turned), so this checks sustained cornering
    // rather than the eased turn-in transient.
    const state = { ...createInitialVehicleState(), speed: 70, steer: 1 };

    const cornering = stepVehicle(
      state,
      { throttle: 1, brake: 0, steer: 1 },
      0.2,
    );

    expect(cornering.speed).toBeLessThan(state.speed);
  });

  it("builds speed back up once the wheel is straightened", () => {
    const state = { ...createInitialVehicleState(), speed: 40 };

    const cornering = stepVehicle(
      state,
      { throttle: 1, brake: 0, steer: 1 },
      0.2,
    );
    const straightening = stepVehicle(
      state,
      { throttle: 1, brake: 0, steer: 0 },
      0.2,
    );

    expect(straightening.speed).toBeGreaterThan(cornering.speed);
    expect(straightening.speed).toBeGreaterThan(state.speed);
  });

  it("stops faster on the handbrake than on the foot brake", () => {
    const state = { ...createInitialVehicleState(), speed: 40 };

    const braking = stepVehicle(
      state,
      { throttle: 0, brake: 1, steer: 0 },
      0.2,
    );
    const handbraking = stepVehicle(
      state,
      { throttle: 0, brake: 0, steer: 0, handbrake: true },
      0.2,
    );

    expect(handbraking.speed).toBeLessThan(braking.speed);
  });

  it("does not accelerate while the handbrake is held with throttle", () => {
    const state = { ...createInitialVehicleState(), speed: 30 };

    const next = stepVehicle(
      state,
      { throttle: 1, brake: 0, steer: 0, handbrake: true },
      0.2,
    );

    expect(next.speed).toBeLessThan(state.speed);
  });

  it("eases steering instead of snapping to full lock", () => {
    const state = { ...createInitialVehicleState(), speed: 30 };

    const next = stepVehicle(state, { throttle: 0, brake: 0, steer: 1 }, 0.05);

    expect(next.steer).toBeGreaterThan(0);
    expect(next.steer).toBeLessThan(1);
  });

  it("slides through high-speed corners with the nose ahead of travel", () => {
    const state = {
      ...createInitialVehicleState(),
      speed: 70,
      heading: 0,
      steer: 1,
    };

    const next = stepVehicle(state, { throttle: 0, brake: 0, steer: 1 }, 0.02);
    const moveAngle = Math.atan2(
      next.position.x - state.position.x,
      -(next.position.z - state.position.z),
    );

    expect(next.heading).toBeGreaterThan(moveAngle);
  });

  it("steers with less authority at high speed than at moderate speed", () => {
    const moderate = {
      ...createInitialVehicleState(),
      speed: 16,
      heading: 0,
      steer: 1,
    };
    const fast = {
      ...createInitialVehicleState(),
      speed: 70,
      heading: 0,
      steer: 1,
    };

    const turnedModerate = stepVehicle(
      moderate,
      { throttle: 0, brake: 0, steer: 1 },
      0.05,
    );
    const turnedFast = stepVehicle(
      fast,
      { throttle: 0, brake: 0, steer: 1 },
      0.05,
    );

    expect(turnedFast.heading).toBeLessThan(turnedModerate.heading);
  });

  it("brakes without reversing immediately", () => {
    const state = { ...createInitialVehicleState(), speed: 25 };

    const next = stepVehicle(state, { throttle: 0, brake: 1, steer: 0 }, 0.2);

    expect(next.speed).toBeGreaterThanOrEqual(0);
    expect(next.speed).toBeLessThan(state.speed);
  });

  it("handbrake increases low-speed rotation while bleeding speed", () => {
    const state = { ...createInitialVehicleState(), speed: 25 };

    const normal = stepVehicle(state, { throttle: 0, brake: 0, steer: 1 }, 0.2);
    const handbrake = stepVehicle(
      state,
      { throttle: 0, brake: 0, steer: 1, handbrake: true },
      0.2,
    );

    expect(handbrake.heading).toBeGreaterThan(normal.heading);
    expect(handbrake.speed).toBeLessThan(normal.speed);
  });

  it("respawns at checkpoint x/z while keeping the car on the track surface", () => {
    const checkpoint = cityLoopV1Track.checkpoints[0];

    const reset = createVehicleAtTrackReset(cityLoopV1Track, checkpoint.index);

    expect(reset.position).toEqual({
      x: checkpoint.position.x,
      y: cityLoopV1Track.spawn.position.y,
      z: checkpoint.position.z,
    });
    expect(reset.heading).toBe(checkpoint.rotationY);
  });

  it("stops route-based tracks at the rendered wall edge", () => {
    const state = {
      ...createInitialVehicleState(),
      position: { x: -250, y: 0, z: 260 },
      speed: 20,
    };

    const next = stepVehicle(
      state,
      { throttle: 0, brake: 0, steer: 0 },
      0.016,
      cityLoopV1Track,
    );

    const distance = nearestRouteCurveProjection(
      next.position,
      cityLoopV1Track.routePoints ?? [],
    ).distance;

    expect(distance).toBeCloseTo(
      getRouteFenceInnerOffset(
        cityLoopV1Track.roadWidth ?? 0,
        cityLoopV1Track.railOffset,
      ) - VEHICLE_COLLISION_HALF_WIDTH,
    );
    expect(next.speed).toBe(0);
  });

  it("does not collide early on smoothed route curves", () => {
    const state = {
      ...createInitialVehicleState(),
      position: {
        x: -468.47192385202237,
        y: 0,
        z: 158.69492531669277,
      },
      speed: 20,
    };

    const next = stepVehicle(
      state,
      { throttle: 0, brake: 0, steer: 0 },
      0,
      cityLoopV1Track,
    );

    expect(next.position.x).toBeCloseTo(state.position.x);
    expect(next.position.z).toBeCloseTo(state.position.z);
    expect(next.speed).toBe(state.speed);
  });

  it("pushes the car out of overlapping remote car obstacles", () => {
    const state = {
      ...createInitialVehicleState(),
      position: { x: 1, y: 0, z: 0 },
      speed: 20,
    };

    const next = resolveVehicleObstacleCollisions(state, [{ x: 0, z: 0 }]);
    const distance = Math.hypot(next.position.x, next.position.z);

    expect(distance).toBeCloseTo(VEHICLE_OBSTACLE_COLLISION_RADIUS);
    expect(next.speed).toBeLessThan(state.speed);
  });

  it("leaves the car unchanged when remote cars are not overlapping", () => {
    const state = {
      ...createInitialVehicleState(),
      position: { x: 20, y: 0, z: 0 },
      speed: 20,
    };

    const next = resolveVehicleObstacleCollisions(state, [{ x: 0, z: 0 }]);

    expect(next).toEqual(state);
  });
});
