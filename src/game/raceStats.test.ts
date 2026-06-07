import { describe, expect, it } from "vitest";
import { orderByProgress, type RacerProgress } from "./raceStats";

const racer = (over: Partial<RacerProgress>): RacerProgress => ({
  id: "x",
  name: "x",
  lap: 0,
  checkpointIndex: 0,
  distanceToNext: 0,
  bestLapMs: undefined,
  ...over,
});

describe("orderByProgress", () => {
  it("ranks higher lap first", () => {
    const order = orderByProgress([
      racer({ id: "a", lap: 0, checkpointIndex: 3 }),
      racer({ id: "b", lap: 1, checkpointIndex: 0 }),
    ]);
    expect(order.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("breaks lap ties by checkpoint then closeness to next", () => {
    const order = orderByProgress([
      racer({ id: "a", lap: 1, checkpointIndex: 2, distanceToNext: 50 }),
      racer({ id: "b", lap: 1, checkpointIndex: 2, distanceToNext: 10 }),
      racer({ id: "c", lap: 1, checkpointIndex: 3, distanceToNext: 99 }),
    ]);
    expect(order.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});
