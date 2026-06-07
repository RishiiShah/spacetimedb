export type AppScreen = "home" | "lobby" | "race";

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
