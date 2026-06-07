import type { VehicleInput } from "./vehicle";

export type DrivingAction =
  | "throttle"
  | "brake"
  | "steerLeft"
  | "steerRight"
  | "handbrake";

export type CarId = "open-wheel" | "lowpoly";

export type CarOption = {
  id: CarId;
  name: string;
  summary: string;
};

// Selectable cars. Handling is shared; only the model differs for now.
export const CARS: CarOption[] = [
  {
    id: "open-wheel",
    name: "Apex OW-1",
    summary: "Lean open-wheel prototype with exposed suspension.",
  },
  {
    id: "lowpoly",
    name: "Veloce LP",
    summary: "Full-body F1 with rear wing, halo and cockpit detail.",
  },
];

export const DEFAULT_CAR_ID: CarId = "open-wheel";

export function getCarById(id: string | undefined): CarOption {
  return CARS.find((car) => car.id === id) ?? CARS[0];
}

// Liveries recolor the car. `body` paints the main shell material, `accent`
// the secondary panels. They are plain colors (no UVs needed), so they apply to
// any car and cost nothing beyond a per-instance material clone.
export type Livery = {
  id: string;
  name: string;
  body: string;
  accent: string;
};

export const LIVERIES: Livery[] = [
  { id: "ghost", name: "Ghost White", body: "#e9eef4", accent: "#161a22" },
  { id: "scuderia", name: "Scuderia Red", body: "#d11f26", accent: "#15151a" },
  { id: "aqua", name: "Aqua Sting", body: "#16c4b0", accent: "#0d1f27" },
  { id: "sunburst", name: "Sunburst", body: "#f5b011", accent: "#23232a" },
  { id: "midnight", name: "Midnight Blue", body: "#274d99", accent: "#0c1530" },
];

export const DEFAULT_LIVERY_ID = "ghost";

export function getLiveryById(id: string | undefined): Livery {
  return LIVERIES.find((livery) => livery.id === id) ?? LIVERIES[0];
}

// Material names inside the open-wheel chassis GLB that liveries recolor.
export const LIVERY_BODY_MATERIAL = "car_color";
export const LIVERY_ACCENT_MATERIAL = "car_color.001";

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
