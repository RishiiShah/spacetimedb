export type AppScreen = "home" | "lobby" | "race";

export function isPageReload() {
  if (typeof performance === "undefined") return false;
  const entry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type === "reload";
}

/** Hard refresh on /race drops in-memory race state — return players to home. */
export function redirectHomeFromRaceRefresh() {
  if (typeof window === "undefined") return false;
  if (!window.location.pathname.startsWith("/race")) return false;
  if (!isPageReload()) return false;
  window.history.replaceState(null, "", "/");
  return true;
}

export function screenFromPath(pathname: string): AppScreen {
  if (pathname.startsWith("/race")) return "race";
  if (pathname.startsWith("/lobby")) return "lobby";
  return "home";
}

export function pathForScreen(screen: AppScreen, roomSlug?: string): string {
  if (screen === "race") return "/race";
  if (screen === "lobby" && roomSlug) return `/lobby/${encodeURIComponent(roomSlug)}`;
  return "/";
}

export function syncAppPath(screen: AppScreen, roomSlug?: string) {
  const next = pathForScreen(screen, roomSlug);
  if (window.location.pathname !== next) {
    window.history.pushState(null, "", next);
  }
}
