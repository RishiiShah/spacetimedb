import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPageReload,
  pathForScreen,
  redirectHomeFromRaceRefresh,
  screenFromPath,
} from "./appNavigation";

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

  it("detects hard reload navigations", () => {
    vi.stubGlobal("performance", {
      getEntriesByType: () => [{ type: "reload" }],
    });

    expect(isPageReload()).toBe(true);
  });

  it("redirects hard refresh on /race back to home", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("history", { replaceState });
    vi.stubGlobal("location", { pathname: "/race" });
    vi.stubGlobal("performance", {
      getEntriesByType: () => [{ type: "reload" }],
    });

    expect(redirectHomeFromRaceRefresh()).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it("does not redirect in-app /race navigation", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("history", { replaceState });
    vi.stubGlobal("location", { pathname: "/race" });
    vi.stubGlobal("performance", {
      getEntriesByType: () => [{ type: "navigate" }],
    });

    expect(redirectHomeFromRaceRefresh()).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
