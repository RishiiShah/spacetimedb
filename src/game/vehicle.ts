import type { TrackDef } from "./track";

export type VehicleState = {
  position: { x: number; y: number; z: number };
  heading: number;
  speed: number;
  // Eased steering position (-1..1) so input changes are smoothed, not instant.
  steer: number;
};

export type VehicleInput = {
  throttle: number;
  brake: number;
  steer: number;
  handbrake?: boolean;
};

const MAX_FORWARD_SPEED = 72;
const MAX_REVERSE_SPEED = -18;
const ACCELERATION = 28;
const BRAKE_FORCE = 16.25;
const DRAG = 4.8;
const STEER_RATE = 1.9;
// Handbrake is the strongest stopper (more than the foot brake) and also cuts
// throttle, so holding it cannot accelerate the car.
const HANDBRAKE_DRAG = 24.25;
const HANDBRAKE_STEER_MULTIPLIER = 1.25;
// Cornering grip loss (per second). Steering scrubs speed in proportion to how
// hard and how fast you are turning, so corners bleed speed and straightening
// lets the car build it back up. Raise for grippier/slower corners.
const CORNER_GRIP_LOSS = 0.7;
// Steering input easing (per second). Sharp/quick at low speed, smoother at
// high speed so the wheel reacts fast in slow corners and calmly at top speed.
const STEER_SMOOTHING_LOW = 9;
const STEER_SMOOTHING_HIGH = 4;
// Steering authority vs speed: you must be moving to turn, so authority ramps in
// from a standstill up to STEER_LOW_SPEED, then tapers toward
// STEER_HIGH_AUTHORITY of full lock by STEER_HIGH_SPEED for high-speed stability.
const STEER_LOW_SPEED = 16;
const STEER_HIGH_SPEED = 72;
const STEER_HIGH_AUTHORITY = 0.5;
// Speed trim on top of the authority curve: turns are STEER_SPEED_TRIM quicker
// at top speed, the same amount slower at a standstill, and unchanged at the
// mid-speed point.
const STEER_SPEED_TRIM = 0.15;
// Drift: above DRIFT_SPEED_THRESHOLD the travel direction lags behind the
// heading by up to DRIFT_MAX_SLIP radians, so the car slides slightly through
// fast corners. Kept small so it is felt but never wild.
const DRIFT_MAX_SLIP = 0.12;
const DRIFT_SPEED_THRESHOLD = 38;

export function createInitialVehicleState(): VehicleState {
  return {
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    speed: 0,
    steer: 0,
  };
}

export function createVehicleAtTrackReset(
  track: TrackDef,
  checkpointIndex?: number,
): VehicleState {
  const checkpoint =
    checkpointIndex === undefined
      ? undefined
      : track.checkpoints[checkpointIndex];
  const resetPoint = checkpoint?.position ?? track.spawn.position;

  return {
    ...createInitialVehicleState(),
    position: {
      x: resetPoint.x,
      y: track.spawn.position.y,
      z: resetPoint.z,
    },
    heading: checkpoint?.rotationY ?? track.spawn.heading,
  };
}

export function stepVehicle(
  state: VehicleState,
  input: VehicleInput,
  deltaSeconds: number,
): VehicleState {
  const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
  const handbrake = Boolean(input.handbrake && Math.abs(state.speed) > 2);
  // Handbrake overrides throttle: you cannot accelerate while holding it.
  const throttle = handbrake ? 0 : clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);

  const speedMagnitude = Math.abs(state.speed);
  const speedFraction = Math.min(speedMagnitude / MAX_FORWARD_SPEED, 1);
  // Sharper steering response at low speed, smoother at high speed.
  const steerSmoothing =
    STEER_SMOOTHING_LOW +
    (STEER_SMOOTHING_HIGH - STEER_SMOOTHING_LOW) * speedFraction;
  const steer = approach(
    state.steer,
    clamp(input.steer, -1, 1),
    steerSmoothing * dt,
  );

  const turnFactor = Math.min(speedMagnitude / 28, 1);
  const drag = state.speed === 0 ? 0 : Math.sign(state.speed) * DRAG;
  const handbrakeDrag = handbrake
    ? Math.sign(state.speed || 1) * HANDBRAKE_DRAG
    : 0;
  const corneringScrub =
    state.speed === 0
      ? 0
      : Math.sign(state.speed) *
        CORNER_GRIP_LOSS *
        Math.abs(steer) *
        turnFactor *
        speedMagnitude;
  const acceleration =
    throttle * ACCELERATION -
    brake * BRAKE_FORCE -
    drag -
    handbrakeDrag -
    corneringScrub;
  const speed = clamp(
    state.speed + acceleration * dt,
    MAX_REVERSE_SPEED,
    MAX_FORWARD_SPEED,
  );
  // Steering authority vs speed: ramps in from a standstill, peaks through
  // low/mid speed, then tapers at high speed so the car stays stable up top.
  const authorityTrim = 1 + STEER_SPEED_TRIM * (2 * speedFraction - 1);
  const steerAuthority =
    Math.min(speedMagnitude / STEER_LOW_SPEED, 1) *
    (1 +
      (STEER_HIGH_AUTHORITY - 1) *
        clamp(
          (speedMagnitude - STEER_LOW_SPEED) /
            (STEER_HIGH_SPEED - STEER_LOW_SPEED),
          0,
          1,
        )) *
    authorityTrim;
  const steerRate = STEER_RATE * (handbrake ? HANDBRAKE_STEER_MULTIPLIER : 1);
  const heading = state.heading + steer * steerRate * steerAuthority * dt;

  // Drift: at high speed the travel direction lags slightly behind the heading,
  // so the nose points into the corner while the car slides a touch wide.
  const driftFactor = clamp(
    (Math.abs(speed) - DRIFT_SPEED_THRESHOLD) /
      (MAX_FORWARD_SPEED - DRIFT_SPEED_THRESHOLD),
    0,
    1,
  );
  const movementAngle = heading - DRIFT_MAX_SLIP * steer * driftFactor;

  return {
    speed,
    heading,
    steer,
    position: {
      x: state.position.x + Math.sin(movementAngle) * speed * dt,
      y: state.position.y,
      z: state.position.z - Math.cos(movementAngle) * speed * dt,
    },
  };
}

function approach(current: number, target: number, t: number) {
  return current + (target - current) * Math.min(1, Math.max(0, t));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
