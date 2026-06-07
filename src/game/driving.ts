import type { VehicleInput } from "./vehicle";

export type DrivingAction =
  | "throttle"
  | "brake"
  | "steerLeft"
  | "steerRight"
  | "handbrake";

// The chassis GLB is authored with its nose pointing +Z, but the vehicle's
// zero-heading travel direction is -Z, so the model is rotated 180deg to align
// the front of the car with the direction of travel.
export const CAR_MODEL_FORWARD_YAW_OFFSET = Math.PI;
export const CAR_MODEL_RIDE_HEIGHT = 0.24;
export const CAR_VISUAL_MAX_STEER_YAW = 0.48;

export type CarWheelSpec = {
  id: "frontLeft" | "frontRight" | "rearLeft" | "rearRight";
  position: [number, number, number];
};

export type CarSuspensionLink = {
  id: string;
  wheelId: CarWheelSpec["id"];
  start: [number, number, number];
  end: [number, number, number];
};

export const CAR_WHEEL_SPECS: CarWheelSpec[] = [
  { id: "frontLeft", position: [-1.2, 0.12, 1.15] },
  { id: "frontRight", position: [1.2, 0.12, 1.15] },
  { id: "rearLeft", position: [-1.2, 0.12, -1.15] },
  { id: "rearRight", position: [1.2, 0.12, -1.15] },
];

export const CAR_SUSPENSION_LINKS: CarSuspensionLink[] =
  CAR_WHEEL_SPECS.flatMap((wheel) => {
    const side = Math.sign(wheel.position[0]);
    const axle = Math.sign(wheel.position[2]);
    const chassisX = side * 0.46;
    const hubX = side * 1.02;
    const centerZ = wheel.position[2];

    return [
      {
        id: `${wheel.id}-upper`,
        wheelId: wheel.id,
        start: [chassisX, 0.38, centerZ - axle * 0.36],
        end: [hubX, 0.24, centerZ - axle * 0.1],
      },
      {
        id: `${wheel.id}-lower`,
        wheelId: wheel.id,
        start: [chassisX, 0.18, centerZ + axle * 0.36],
        end: [hubX, 0.18, centerZ + axle * 0.1],
      },
    ];
  });

type KeyboardLike = {
  key: string;
  code?: string;
};

export function drivingActionFromKeyboardEvent(
  event: KeyboardLike,
): DrivingAction | undefined {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      return "throttle";
    case "KeyS":
    case "ArrowDown":
      return "brake";
    case "KeyA":
    case "ArrowLeft":
      return "steerLeft";
    case "KeyD":
    case "ArrowRight":
      return "steerRight";
    case "Space":
      return "handbrake";
  }

  switch (event.key.toLowerCase()) {
    case "w":
    case "arrowup":
      return "throttle";
    case "s":
    case "arrowdown":
      return "brake";
    case "a":
    case "arrowleft":
      return "steerLeft";
    case "d":
    case "arrowright":
      return "steerRight";
    case " ":
    case "spacebar":
      return "handbrake";
  }
}

export function inputFromDrivingActions(
  actions: ReadonlySet<string>,
): VehicleInput {
  return {
    throttle: actions.has("throttle") ? 1 : 0,
    brake: actions.has("brake") ? 1 : 0,
    // Positive steer turns the car right (increasing heading), so steerRight is
    // positive and steerLeft is negative. A = left, D = right.
    steer:
      (actions.has("steerRight") ? 1 : 0) -
      (actions.has("steerLeft") ? 1 : 0),
    handbrake: actions.has("handbrake"),
  };
}

export function visualWheelSteerYaw(steer: number) {
  return clamp(steer, -1, 1) * CAR_VISUAL_MAX_STEER_YAW;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
