import { describe, expect, it } from "vitest";
import { dampToward } from "./stuntMotion";

describe("stunt motion smoothing", () => {
  it("eases toward a target over multiple frames", () => {
    let value = 0;
    for (let frame = 0; frame < 30; frame += 1) {
      value = dampToward(value, 1, 1 / 60, 12);
    }
    expect(value).toBeGreaterThan(0.9);
    expect(value).toBeLessThan(1.01);
  });
});
