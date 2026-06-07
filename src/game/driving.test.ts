import { describe, expect, it } from "vitest";
import {
  CAR_MODEL_FORWARD_YAW_OFFSET,
  CAR_MODEL_RIDE_HEIGHT,
  CAR_SUSPENSION_LINKS,
  CAR_VISUAL_MAX_STEER_YAW,
  CAR_WHEEL_SPECS,
  CARS,
  DEFAULT_CAR_ID,
  DEFAULT_LIVERY_ID,
  LIVERIES,
  LOWPOLY_WHEEL_NODE_NAMES,
  LOWPOLY_VISUAL_MAX_STEER_YAW,
  drivingActionFromKeyboardEvent,
  getCarById,
  getCarVisualGroundOffset,
  getLiveryById,
  inputFromDrivingActions,
  isLowPolyWheelNodeName,
  lowPolyWheelSteerYaw,
  visualWheelSteerYaw,
} from "./driving";

describe("driving controls", () => {
  it("keeps forward throttle active while steering is pressed and released", () => {
    const actions = new Set(["throttle"]);

    actions.add("steerLeft");
    expect(inputFromDrivingActions(actions)).toMatchObject({
      throttle: 1,
      brake: 0,
      steer: -1,
    });

    actions.delete("steerLeft");
    expect(inputFromDrivingActions(actions)).toMatchObject({
      throttle: 1,
      brake: 0,
      steer: 0,
    });
  });

  it("steers left negative (A) and right positive (D)", () => {
    expect(inputFromDrivingActions(new Set(["steerLeft"])).steer).toBe(-1);
    expect(inputFromDrivingActions(new Set(["steerRight"])).steer).toBe(1);
  });

  it("maps WASD and arrow keys to the same driving actions", () => {
    expect(drivingActionFromKeyboardEvent({ key: "w", code: "KeyW" })).toBe(
      "throttle",
    );
    expect(
      drivingActionFromKeyboardEvent({ key: "ArrowUp", code: "ArrowUp" }),
    ).toBe("throttle");
    expect(drivingActionFromKeyboardEvent({ key: "a", code: "KeyA" })).toBe(
      "steerLeft",
    );
    expect(
      drivingActionFromKeyboardEvent({ key: "ArrowLeft", code: "ArrowLeft" }),
    ).toBe("steerLeft");
  });

  it("rotates the +Z-authored chassis 180deg so the nose faces travel direction", () => {
    expect(CAR_MODEL_FORWARD_YAW_OFFSET).toBe(Math.PI);
  });

  it("lifts the visual car enough for tire bottoms to clear the road", () => {
    expect(CAR_MODEL_RIDE_HEIGHT).toBeGreaterThanOrEqual(0.22);
    expect(CAR_MODEL_RIDE_HEIGHT).toBeLessThanOrEqual(0.28);
  });

  it("places low-poly tire contact on the road surface", () => {
    expect(getCarVisualGroundOffset("lowpoly")).toBe(0.282);
    expect(getCarVisualGroundOffset("open-wheel")).toBe(0.24);
  });

  it("defines suspension links that visually connect every tire to the chassis", () => {
    expect(CAR_SUSPENSION_LINKS).toHaveLength(CAR_WHEEL_SPECS.length * 2);

    for (const wheel of CAR_WHEEL_SPECS) {
      const links = CAR_SUSPENSION_LINKS.filter(
        (link) => link.wheelId === wheel.id,
      );

      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(Math.sign(link.end[0])).toBe(Math.sign(wheel.position[0]));
        expect(Math.abs(link.start[0])).toBeLessThan(Math.abs(link.end[0]));
        expect(Math.abs(link.end[0] - wheel.position[0])).toBeLessThan(0.25);
        expect(Math.abs(link.end[2] - wheel.position[2])).toBeLessThan(0.35);
      }
    }
  });

  it("maps eased steering input to clamped front tire yaw", () => {
    expect(visualWheelSteerYaw(0)).toBe(0);
    expect(visualWheelSteerYaw(1)).toBe(CAR_VISUAL_MAX_STEER_YAW);
    expect(visualWheelSteerYaw(-1)).toBe(-CAR_VISUAL_MAX_STEER_YAW);
    expect(visualWheelSteerYaw(2)).toBe(CAR_VISUAL_MAX_STEER_YAW);
  });

  it("targets all baked low-poly wheel nodes for tyre animation", () => {
    expect(LOWPOLY_WHEEL_NODE_NAMES).toEqual([
      "Wheel",
      "Wheel.001",
      "Wheel.002",
      "Wheel.003",
    ]);
    expect(isLowPolyWheelNodeName("Wheel.001")).toBe(true);
    expect(isLowPolyWheelNodeName("Main_body.COmmiting")).toBe(false);
  });

  it("yaws only the low-poly front tyres with steering input", () => {
    expect(LOWPOLY_VISUAL_MAX_STEER_YAW).toBeLessThan(CAR_VISUAL_MAX_STEER_YAW);
    expect(lowPolyWheelSteerYaw("Wheel", 1)).toBe(LOWPOLY_VISUAL_MAX_STEER_YAW);
    expect(lowPolyWheelSteerYaw("Wheel.001", -1)).toBe(
      -LOWPOLY_VISUAL_MAX_STEER_YAW,
    );
    expect(lowPolyWheelSteerYaw("Wheel.002", 1)).toBe(0);
    expect(lowPolyWheelSteerYaw("Wheel.003", -1)).toBe(0);
  });

  it("offers only the low-poly car with a valid default", () => {
    expect(CARS.map((car) => car.id)).toEqual(["lowpoly"]);
    expect(CARS.some((car) => car.id === DEFAULT_CAR_ID)).toBe(true);
    expect(getCarById("lowpoly").id).toBe("lowpoly");
    expect(getCarById(undefined).id).toBe(DEFAULT_CAR_ID);
    expect(getCarById("nonexistent").id).toBe(DEFAULT_CAR_ID);
    expect(CARS.map((car) => car.name).join(" ")).not.toMatch(/apex/i);
  });

  it("offers liveries with valid colors and a working default", () => {
    expect(LIVERIES.length).toBeGreaterThanOrEqual(2);
    expect(LIVERIES.some((livery) => livery.id === DEFAULT_LIVERY_ID)).toBe(
      true,
    );
    for (const livery of LIVERIES) {
      expect(livery.body).toMatch(/^#[0-9a-f]{6}$/i);
      expect(livery.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(getLiveryById("scuderia").id).toBe("scuderia");
    expect(getLiveryById(undefined).id).toBe(DEFAULT_LIVERY_ID);
    expect(getLiveryById("nope").id).toBe(DEFAULT_LIVERY_ID);
  });
});
