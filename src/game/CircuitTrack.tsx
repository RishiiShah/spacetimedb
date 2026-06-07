import { useEffect, useMemo, useState } from "react";
import {
  CIRCUIT_RAIL_WIDTH,
  CIRCUIT_ROUTE_LAYOUT,
  getCircuitRailOffset,
  groundSizeForParsed,
  parseCircuitMapData,
  type CircuitMapData,
} from "./circuitTrackData";
import { getCircuitCityPlacements } from "./circuitTrackScenery";
import { CityPlacedAsset, StyledRouteTrack } from "./RouteTrackVisuals";
import { CITY_GROUND_COLOR, trackHasCityBuildings } from "./trackScenery";
import type { TrackDef } from "./track";
import { GROUND_PLANE_Y, ROUTE_WALL_HEIGHT } from "./track";

export function CircuitTrackAssets({ track }: { track: TrackDef }) {
  const [mapData, setMapData] = useState<CircuitMapData | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!track.circuitMapPath) {
      setMapData(null);
      return;
    }

    fetch(track.circuitMapPath)
      .then((response) => response.json())
      .then((data: CircuitMapData) => {
        if (!cancelled) setMapData(data);
      })
      .catch(() => {
        if (!cancelled) setMapData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [track.circuitMapPath]);

  const parsed = useMemo(
    () =>
      mapData
        ? parseCircuitMapData(mapData, track)
        : { points: [], closed: false, width: 0 },
    [mapData, track],
  );

  const roadWidth = parsed.width > 0 ? parsed.width : 21;
  const railOffset = getCircuitRailOffset(roadWidth);
  const groundSize = useMemo(() => groundSizeForParsed(parsed), [parsed]);
  const showCircuitDetails = trackHasCityBuildings(track);
  const cityPlacements = useMemo(
    () => getCircuitCityPlacements(track, parsed, roadWidth),
    [parsed, roadWidth, track],
  );

  return (
    <>
      <mesh
        receiveShadow
        rotation-x={-Math.PI / 2}
        position={[0, GROUND_PLANE_Y, 0]}
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial
          color={CITY_GROUND_COLOR}
          roughness={0.98}
          depthWrite={false}
        />
      </mesh>

      {parsed.points.length > 1 ? (
        <StyledRouteTrack
          points={parsed.points}
          roadWidth={roadWidth}
          railOffset={railOffset}
          railHeight={ROUTE_WALL_HEIGHT}
          railWidth={CIRCUIT_RAIL_WIDTH}
          railColor="#d8dde4"
          showShoulders={showCircuitDetails}
          routeLayout={CIRCUIT_ROUTE_LAYOUT}
          spawn={track.spawn}
          showDetailGrandstands={showCircuitDetails}
          showRouteDetails={showCircuitDetails}
        />
      ) : (
        <mesh receiveShadow rotation-x={-Math.PI / 2}>
          <ringGeometry args={[24, 32, 96]} />
          <meshStandardMaterial color="#30343a" roughness={0.86} />
        </mesh>
      )}

      {cityPlacements.map((placement, index) => (
        <CityPlacedAsset
          key={`${placement.assetId}-${index}`}
          placement={placement}
          castShadow
        />
      ))}
    </>
  );
}
