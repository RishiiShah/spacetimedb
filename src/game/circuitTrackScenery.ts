import type { ParsedCircuitTrack } from "./circuitTrackData";
import {
  createRouteSceneryPlacements,
  trackHasCityBuildings,
} from "./trackScenery";
import type { AssetPlacement, TrackDef } from "./track";

export function getCircuitCityPlacements(
  track: TrackDef,
  parsed: ParsedCircuitTrack,
  roadWidth: number,
): AssetPlacement[] {
  if (!trackHasCityBuildings(track) || parsed.points.length < 2) return [];

  const generated = createRouteSceneryPlacements(
    parsed.points,
    roadWidth,
    circuitCityTargetCount(track, parsed),
  );

  return [...track.placements, ...generated];
}

function circuitCityTargetCount(track: TrackDef, parsed: ParsedCircuitTrack) {
  const routeSizedCount = Math.round(parsed.points.length * 0.55);
  if (track.slug === "circuit-monza") return Math.max(24, routeSizedCount);
  return Math.max(16, Math.min(24, routeSizedCount));
}
