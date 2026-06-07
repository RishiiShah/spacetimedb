import { describe, expect, it } from "vitest";
import {
  cityLoopV1Track,
  cityMonacoTrack,
  circuitAustriaTrack,
  circuitBrandsTrack,
  circuitFundaTrack,
  circuitIndyTrack,
  circuitInterlagosTrack,
  circuitMonzaTrack,
  circuitSuburbanTrack,
} from "./track";
import { trackHasCityBuildings } from "./trackScenery";

describe("trackHasCityBuildings", () => {
  it("allows city GLBs on City Loop, Monaco, and every mapped circuit", () => {
    expect(trackHasCityBuildings(cityLoopV1Track)).toBe(true);
    expect(trackHasCityBuildings(cityMonacoTrack)).toBe(true);
    for (const track of [
      circuitAustriaTrack,
      circuitBrandsTrack,
      circuitFundaTrack,
      circuitIndyTrack,
      circuitInterlagosTrack,
      circuitMonzaTrack,
      circuitSuburbanTrack,
    ]) {
      expect(trackHasCityBuildings(track)).toBe(true);
    }
  });
});
