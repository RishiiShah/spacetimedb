import {
  createRouteFrames,
  nearestRouteCurveProjection,
  type RouteFrame,
} from "./routeGeometry";
import {
  getRouteRailOffset,
  ROUTE_RAIL_WIDTH,
  type AssetPlacement,
  type Vec3,
} from "./track";

const SCENERY_ASSETS: Array<AssetPlacement["assetId"]> = [
  "ecoGrid",
  "ecoSlope",
  "ecoTerrace",
  "twistedTower",
  "palm",
  "busStop",
  "trafficLight",
];

const SCENERY_ROUTE_GAP = 16;
const SCENERY_PLACEMENT_EXTRA_OFFSET = 10;
const SCENERY_DISTANCE_EXPANSIONS = [0, 18, 36, 56, 78] as const;
const SCENERY_ASSET_FOOTPRINT_RADIUS: Record<
  AssetPlacement["assetId"],
  number
> = {
  roadStraight: 0,
  roadCurve: 0,
  ecoGrid: 18,
  ecoSlope: 18,
  ecoTerrace: 20,
  twistedTower: 16,
  trafficLight: 2,
  busStop: 7,
  palm: 4,
};

export const CITY_GROUND_COLOR = "#78956c";
export const PRACTICE_GROUND_COLOR = "#778a70";

/** Local routes with hand-placed city GLBs. Mapped circuits generate theirs. */
const LOCAL_CITY_BUILDING_TRACK_SLUGS = new Set(["city-loop-v1", "monaco"]);

export function trackHasCityBuildings(track: {
  slug: string;
  origin?: string;
}) {
  return (
    track.origin === "mapped-circuit" ||
    LOCAL_CITY_BUILDING_TRACK_SLUGS.has(track.slug)
  );
}

export function sceneryFootprintRadius(
  assetId: AssetPlacement["assetId"],
  scale = 1,
) {
  return SCENERY_ASSET_FOOTPRINT_RADIUS[assetId] * scale;
}

/** Buildings sit outside the barrier wall, not just outside the asphalt edge. */
export function sceneryLateralOffset(
  roadWidth: number,
  scale = 1.2,
  assetId?: AssetPlacement["assetId"],
) {
  if (assetId) {
    return (
      sceneryMinClearance(roadWidth, scale, assetId) +
      SCENERY_PLACEMENT_EXTRA_OFFSET
    );
  }
  return getRouteRailOffset(roadWidth) + ROUTE_RAIL_WIDTH / 2 + 14;
}

export function sceneryMinClearance(
  roadWidth: number,
  scale = 1.2,
  assetId?: AssetPlacement["assetId"],
) {
  const wallOuter = getRouteRailOffset(roadWidth) + ROUTE_RAIL_WIDTH / 2;
  const footprint = assetId
    ? sceneryFootprintRadius(assetId, scale)
    : scale * 6;
  return wallOuter + SCENERY_ROUTE_GAP + footprint;
}

export function isClearOfRoutePoints(
  position: { x: number; z: number },
  points: Vec3[],
  minDistance: number,
) {
  if (points.length < 2) return true;
  const projected = nearestRouteCurveProjection(position, points);
  return (
    Math.hypot(position.x - projected.x, position.z - projected.z) >=
    minDistance
  );
}

export function createRouteSceneryPlacements(
  points: Vec3[],
  roadWidth: number,
  targetCount = 14,
): AssetPlacement[] {
  const frames = createRouteFrames(points);
  if (frames.length < 4) return [];

  const stride = Math.max(1, Math.floor(frames.length / targetCount));
  const placements: AssetPlacement[] = [];
  let placementAttempt = 0;

  for (let index = 0; index < frames.length; index += stride) {
    const frame = frames[index];
    const side = placementAttempt % 2 === 0 ? 1 : -1;
    const assetId = SCENERY_ASSETS[placementAttempt % SCENERY_ASSETS.length];
    const scale = 1.15 + (placementAttempt % 4) * 0.12;
    placementAttempt += 1;

    const placement = findClearSceneryPlacement({
      frame,
      points,
      roadWidth,
      side,
      assetId,
      scale,
    });

    if (placement) placements.push(placement);
    if (placements.length >= targetCount) break;
  }

  return placements;
}

function findClearSceneryPlacement({
  frame,
  points,
  roadWidth,
  side,
  assetId,
  scale,
}: {
  frame: RouteFrame;
  points: Vec3[];
  roadWidth: number;
  side: 1 | -1;
  assetId: AssetPlacement["assetId"];
  scale: number;
}): AssetPlacement | undefined {
  const sides = [side, side === 1 ? -1 : 1] as const;
  const minDistance = sceneryMinClearance(roadWidth, scale, assetId);
  const baseLateral = sceneryLateralOffset(roadWidth, scale, assetId);

  for (const expansion of SCENERY_DISTANCE_EXPANSIONS) {
    for (const candidateSide of sides) {
      const lateral = baseLateral + expansion;
      const position = {
        x: round(frame.point.x + frame.right.x * lateral * candidateSide),
        y: 0,
        z: round(frame.point.z + frame.right.z * lateral * candidateSide),
      };

      if (!isClearOfRoutePoints(position, points, minDistance)) continue;

      return {
        assetId,
        position,
        rotationY:
          Math.atan2(frame.tangent.x, frame.tangent.z) + candidateSide * 0.28,
        scale,
      };
    }
  }

  return undefined;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
