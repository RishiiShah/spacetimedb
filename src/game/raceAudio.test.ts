import { describe, expect, it } from "vitest";
import {
  brakeVolume,
  enginePlaybackRate,
  engineVolume,
  screechVolume,
} from "./raceAudio";

describe("race audio mixing", () => {
  it("raises engine pitch with speed", () => {
    expect(enginePlaybackRate(0)).toBeLessThan(enginePlaybackRate(72));
  });

  it("keeps a small idle engine level at standstill", () => {
    expect(engineVolume(0, 0)).toBeGreaterThan(0.2);
  });

  it("ramps brake volume with pedal and speed", () => {
    expect(brakeVolume(1, 40)).toBeGreaterThan(brakeVolume(0.5, 10));
    expect(brakeVolume(1, 0)).toBe(0);
  });

  it("adds screech under steer or handbrake", () => {
    expect(screechVolume(1, 50, false)).toBeGreaterThan(0);
    expect(screechVolume(0, 50, true)).toBeGreaterThan(0);
    expect(screechVolume(0.1, 10, false)).toBe(0);
  });
});
