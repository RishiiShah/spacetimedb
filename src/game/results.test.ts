import { describe, expect, it } from "vitest";
import { orderResults, type ResultRow } from "./results";

const row = (o: Partial<ResultRow>): ResultRow => ({
  id: "x",
  name: "x",
  lapsDone: 0,
  totalMs: 0,
  bestLapMs: undefined,
  ...o,
});

describe("orderResults", () => {
  it("ranks more laps first, then lower total time", () => {
    const out = orderResults([
      row({ id: "a", lapsDone: 3, totalMs: 90000 }),
      row({ id: "b", lapsDone: 3, totalMs: 88000 }),
      row({ id: "c", lapsDone: 2, totalMs: 60000 }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});
