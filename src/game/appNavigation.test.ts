import { describe, expect, it } from "vitest";
import { pathForScreen, screenFromPath } from "./appNavigation";

describe("appNavigation", () => {
  it("maps paths to screens", () => {
    expect(screenFromPath("/")).toBe("home");
    expect(screenFromPath("/lobby/demo")).toBe("lobby");
    expect(screenFromPath("/race")).toBe("race");
  });

  it("builds paths for screens", () => {
    expect(pathForScreen("home")).toBe("/");
    expect(pathForScreen("lobby", "demo")).toBe("/lobby/demo");
    expect(pathForScreen("race")).toBe("/race");
  });
});
