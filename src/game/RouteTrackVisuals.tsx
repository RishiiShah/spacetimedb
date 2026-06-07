import { Text, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { RouteFrameOptions } from "./routeGeometry";
import { createRouteRoadGeometries } from "./routeRoadGeometry";
import {
  createDirectionSignPlacements,
  createRouteBarrierGeometry,
} from "./routeMesh";
import { TrackRouteDetails } from "./trackRouteDetailsScene";
import {
  cityAssetPaths,
  getRouteRailOffset,
  ROAD_SURFACE_Y,
  ROUTE_RAIL_WIDTH,
  type AssetPlacement,
  type TrackDef,
  type Vec3,
} from "./track";

type RouteRoadProps = {
  points: Vec3[];
  width: number;
  railOffset?: number;
  railHeight?: number;
  railColor?: string;
  railWidth?: number;
  showShoulders?: boolean;
  routeLayout?: RouteFrameOptions;
};

export function RouteRoad({
  points,
  width,
  railOffset,
  railHeight,
  railColor = "#d8dde4",
  railWidth = ROUTE_RAIL_WIDTH,
  showShoulders = true,
  routeLayout,
}: RouteRoadProps) {
  const resolvedRailOffset = railOffset ?? getRouteRailOffset(width);
  const geometries = useMemo(
    () =>
      createRouteRoadGeometries({
        points,
        width,
        railHeight,
        showShoulders,
        routeLayout,
      }),
    [points, railHeight, routeLayout, showShoulders, width],
  );
  const asphaltMaterialProps = {
    color: "#2f3740",
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  } as const;
  const shoulderMaterialProps = {
    ...asphaltMaterialProps,
    side: THREE.FrontSide,
  } as const;

  return (
    <>
      <mesh geometry={geometries.asphalt} receiveShadow>
        <meshStandardMaterial {...asphaltMaterialProps} />
      </mesh>
      <mesh geometry={geometries.leftEdge} renderOrder={3}>
        <meshStandardMaterial
          color="#f8fafc"
          roughness={0.55}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={geometries.rightEdge} renderOrder={3}>
        <meshStandardMaterial
          color="#f8fafc"
          roughness={0.55}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={geometries.leftCurb} renderOrder={4}>
        <meshStandardMaterial
          color="#d43f32"
          roughness={0.72}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      <mesh geometry={geometries.rightCurb} renderOrder={4}>
        <meshStandardMaterial
          color="#d43f32"
          roughness={0.72}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      {geometries.leftShoulder && (
        <mesh geometry={geometries.leftShoulder} receiveShadow renderOrder={1}>
          <meshStandardMaterial {...shoulderMaterialProps} />
        </mesh>
      )}
      {geometries.rightShoulder && (
        <mesh geometry={geometries.rightShoulder} receiveShadow renderOrder={1}>
          <meshStandardMaterial {...shoulderMaterialProps} />
        </mesh>
      )}
      {railHeight && (
        <RouteContinuousWalls
          points={points}
          railOffset={resolvedRailOffset}
          railHeight={railHeight}
          railColor={railColor}
          railWidth={railWidth}
          routeLayout={routeLayout}
        />
      )}
    </>
  );
}

function RouteContinuousWalls({
  points,
  railOffset,
  railHeight,
  railColor,
  railWidth,
  routeLayout,
}: {
  points: Vec3[];
  railOffset: number;
  railHeight: number;
  railColor: string;
  railWidth: number;
  routeLayout?: RouteFrameOptions;
}) {
  const leftWallGeometry = useMemo(
    () =>
      createRouteBarrierGeometry(
        points,
        railOffset,
        railWidth,
        railHeight,
        -1,
        railColor,
        undefined,
        ROAD_SURFACE_Y,
        routeLayout,
      ),
    [points, railHeight, railColor, railOffset, railWidth, routeLayout],
  );
  const rightWallGeometry = useMemo(
    () =>
      createRouteBarrierGeometry(
        points,
        railOffset,
        railWidth,
        railHeight,
        1,
        railColor,
        undefined,
        ROAD_SURFACE_Y,
        routeLayout,
      ),
    [points, railHeight, railColor, railOffset, railWidth, routeLayout],
  );
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.42,
        metalness: 0.02,
        side: THREE.FrontSide,
      }),
    [],
  );
  useEffect(() => () => wallMaterial.dispose(), [wallMaterial]);

  return (
    <>
      {[leftWallGeometry, rightWallGeometry].map((geometry, index) => (
        <mesh
          key={`wall-${index}`}
          geometry={geometry}
          material={wallMaterial}
          castShadow
          receiveShadow
          renderOrder={2}
        />
      ))}
    </>
  );
}

function StartGantry({
  spawn,
  width,
  railOffset,
}: {
  spawn: TrackDef["spawn"];
  width: number;
  railOffset?: number;
}) {
  const postOffset = (railOffset ?? getRouteRailOffset(width)) + 3;
  const beamWidth = postOffset * 2 + 4;
  const checkerCount = 12;
  const checkerWidth = beamWidth / checkerCount;

  return (
    <group
      position={[spawn.position.x, spawn.position.y, spawn.position.z]}
      rotation-y={spawn.heading}
    >
      {[-postOffset, postOffset].map((x) => (
        <mesh key={x} castShadow receiveShadow position={[x, 3.7, 0]}>
          <boxGeometry args={[1.6, 7.4, 1.6]} />
          <meshStandardMaterial color="#d8dde4" roughness={0.48} />
        </mesh>
      ))}
      <mesh castShadow receiveShadow position={[0, 7.8, 0]}>
        <boxGeometry args={[beamWidth, 1.25, 1.8]} />
        <meshStandardMaterial color="#161a20" roughness={0.5} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 6.65, -0.04]}>
        <boxGeometry args={[beamWidth - 5, 1.8, 0.32]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.42} />
      </mesh>
      {Array.from({ length: checkerCount }).map((_, index) => (
        <mesh
          key={index}
          castShadow
          receiveShadow
          position={[
            -beamWidth / 2 + checkerWidth * (index + 0.5),
            6.65,
            -0.24,
          ]}
        >
          <boxGeometry args={[checkerWidth, 1.8, 0.18]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? "#111827" : "#f8fafc"}
            roughness={0.4}
          />
        </mesh>
      ))}
      <Text
        position={[0, 6.72, -0.46]}
        rotation-y={Math.PI}
        fontSize={1.08}
        anchorX="center"
        anchorY="middle"
        color="#b91c1c"
        maxWidth={beamWidth - 10}
      >
        START
      </Text>
      <Text
        position={[0, 6.72, 0.46]}
        fontSize={1.08}
        anchorX="center"
        anchorY="middle"
        color="#b91c1c"
        maxWidth={beamWidth - 10}
      >
        START
      </Text>
    </group>
  );
}

function TrackDirectionSigns({
  points,
  width,
  railOffset,
}: {
  points: Vec3[];
  width: number;
  railOffset?: number;
}) {
  const signs = useMemo(
    () => createDirectionSignPlacements(points, width, railOffset),
    [points, railOffset, width],
  );

  return (
    <>
      {signs.map((sign, index) => (
        <Banner
          key={`${sign.path}-${index}`}
          path={sign.path}
          position={sign.position}
          rotationY={sign.rotationY}
        />
      ))}
    </>
  );
}

function Banner({
  path,
  position,
  rotationY = 0,
  scale = 1.4,
}: {
  path: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const gltf = useGLTF(path);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf.scene]);

  return (
    <primitive
      object={scene}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    />
  );
}

export function CityPlacedAsset({
  placement,
  castShadow = false,
}: {
  placement: AssetPlacement;
  castShadow?: boolean;
}) {
  const gltf = useGLTF(cityAssetPaths[placement.assetId]);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = castShadow;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [castShadow, gltf.scene]);

  return (
    <primitive
      object={scene}
      position={[
        placement.position.x,
        placement.position.y,
        placement.position.z,
      ]}
      rotation={[0, placement.rotationY, 0]}
      scale={placement.scale}
    />
  );
}

type StyledRouteTrackProps = {
  points: Vec3[];
  roadWidth: number;
  railOffset?: number;
  railHeight?: number;
  railColor?: string;
  railWidth?: number;
  showShoulders?: boolean;
  routeLayout?: RouteFrameOptions;
  spawn?: TrackDef["spawn"];
  showRaceProps?: boolean;
  showRouteDetails?: boolean;
  showDetailGrandstands?: boolean;
};

export function StyledRouteTrack({
  points,
  roadWidth,
  railOffset,
  railHeight,
  railColor = "#d8dde4",
  railWidth,
  showShoulders = true,
  routeLayout,
  spawn,
  showRaceProps = true,
  showRouteDetails = true,
  showDetailGrandstands = true,
}: StyledRouteTrackProps) {
  const resolvedRailOffset = railOffset ?? getRouteRailOffset(roadWidth);
  const resolvedRailHeight = railHeight;

  return (
    <>
      <RouteRoad
        points={points}
        width={roadWidth}
        railOffset={resolvedRailOffset}
        railHeight={resolvedRailHeight}
        railColor={railColor}
        railWidth={railWidth}
        showShoulders={showShoulders}
        routeLayout={routeLayout}
      />
      {showRouteDetails && resolvedRailHeight && (
        <TrackRouteDetails
          points={points}
          roadWidth={roadWidth}
          railOffset={resolvedRailOffset}
          railHeight={resolvedRailHeight}
          showGrandstands={showDetailGrandstands}
        />
      )}
      {showRaceProps && spawn && (
        <StartGantry
          spawn={spawn}
          width={roadWidth}
          railOffset={resolvedRailOffset}
        />
      )}
      {showRaceProps && (
        <TrackDirectionSigns
          points={points}
          width={roadWidth}
          railOffset={resolvedRailOffset}
        />
      )}
    </>
  );
}
