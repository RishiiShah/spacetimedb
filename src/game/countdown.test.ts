import { describe, expect, it } from "vitest";
import { countdownPhase } from "./countdown";

// startsAtMs is the GO time; controls modal occupies the first 5s of the 8s lead.
const GO = 18000;
const START = GO - 8000;

describe("countdownPhase", () => {
  it("is controls during the first 5 seconds", () => {
    expect(countdownPhase(START + 1000, START, GO).phase).toBe("controls");
  });
  it("counts 3..2..1 in the last 3 seconds", () => {
    expect(countdownPhase(GO - 2500, START, GO)).toEqual({
      phase: "count",
      count: 3,
    });
    expect(countdownPhase(GO - 1500, START, GO)).toEqual({
      phase: "count",
      count: 2,
    });
    expect(countdownPhase(GO - 500, START, GO)).toEqual({
      phase: "count",
      count: 1,
    });
  });
  it("is go at or after GO", () => {
    expect(countdownPhase(GO + 10, START, GO).phase).toBe("go");
  });
});
