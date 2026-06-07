import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AssetPlacement, TrackDef, Vec3 } from "./track";
import { GROUND_PLANE_Y, cityAssetPaths } from "./track";

type CircuitPoint = { x: number; y: number; z: number };

type CircuitCurve = {
  closed?: boolean;
  points?: CircuitPoint[];
  data?: Array<{ scaleX?: number }>;
};

type CircuitMapData = {
  trackCurves?: CircuitCurve[];
};

export type ParsedCircuitTrack = {
  points: Vec3[];
  closed: boolean;
  width: number;
};

type StandPlacement = {
  position: Vec3;
  rotationY: number;
  scale: number;
};

const SCENERY_ASSETS: Array<AssetPlacement["assetId"]> = [
  "ecoGrid",
  "ecoSlope",
  "ecoTerrace",
  "twistedTower",
  "palm",
  "busStop",
];

export function parseCircuitMapData(
  map: CircuitMapData,
  track: TrackDef,
): ParsedCircuitTrack {
  const curve = map.trackCurves?.find(
    (candidate) => (candidate.points?.length ?? 0) > 1,
  );
  if (!curve?.points?.length) {
    return { points: [], closed: false, width: 0 };
  }

  const scale = track.circuitMapScale ?? 0.08;
  const widthScale = Math.max(
    0.8,
    ...(curve.data ?? []).map((pointData) => pointData.scaleX ?? 1),
  );

  return {
    points: curve.points.map((point) => ({
      x: round(point.x * scale),
      y: round(point.y * scale),
      z: round(point.z * scale),
    })),
    closed: Boolean(curve.closed),
    width: round(12 * widthScale),
  };
}

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

  const roadGeometry = useMemo(() => createRoadGeometry(parsed), [parsed]);
  const groundSize = useMemo(() => groundSizeForParsed(parsed), [parsed]);
  const sceneryPlacements = useMemo(
    () => createSceneryPlacements(parsed),
    [parsed],
  );
  const grandstandPlacements = useMemo(
    () => createGrandstandPlacements(parsed),
    [parsed],
  );
  const startGrandstands = useMemo(
    () => createStartGrandstands(track.spawn, parsed),
    [track.spawn, parsed],
  );

  return (
    <>
      {/* Grass sits slightly below asphalt; depthWrite off so it never wins the
          depth test against the road ribbon and cause z-fighting gaps. */}
      <mesh
        receiveShadow
        rotation-x={-Math.PI / 2}
        position={[0, GROUND_PLANE_Y, 0]}
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial
          color="#5d7d57"
          roughness={0.96}
          depthWrite={false}
        />
      </mesh>

      {roadGeometry ? (
        <mesh geometry={roadGeometry} receiveShadow castShadow>
          <meshStandardMaterial
            color="#30343a"
            roughness={0.86}
            metalness={0.02}
          />
        </mesh>
      ) : (
        <mesh receiveShadow rotation-x={-Math.PI / 2}>
          <ringGeometry args={[24, 32, 96]} />
          <meshStandardMaterial color="#30343a" roughness={0.86} />
        </mesh>
      )}

      {sceneryPlacements.map((placement, index) => (
        <CircuitPlacedAsset
          key={`scenery-${placement.assetId}-${index}`}
          placement={placement}
        />
      ))}

      {grandstandPlacements.map((stand, index) => (
        <CircuitGrandstand
          key={`grandstand-${index}`}
          position={stand.position}
          rotationY={stand.rotationY}
          scale={stand.scale}
        />
      ))}

      {startGrandstands.map((stand, index) => (
        <CircuitGrandstand
          key={`start-stand-${index}`}
          position={stand.position}
          rotationY={stand.rotationY}
          scale={stand.scale}
        />
      ))}
    </>
  );
}

function CircuitPlacedAsset({ placement }: { placement: AssetPlacement }) {
  const gltf = useGLTF(cityAssetPaths[placement.assetId]);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

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

function CircuitGrandstand({ position, rotationY, scale = 1 }: StandPlacement) {
  const tierMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e2e8f0",
        roughness: 0.72,
        metalness: 0.04,
      }),
    [],
  );
  const seatMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#dc2626",
        roughness: 0.82,
      }),
    [],
  );

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      <mesh
        castShadow
        receiveShadow
        material={tierMaterial}
        position={[0, 0.35, 0]}
      >
        <boxGeometry args={[9.5, 0.7, 3.2]} />
      </mesh>
      {[0, 1, 2].map((tier) => (
        <mesh
          key={tier}
          castShadow
          receiveShadow
          material={seatMaterial}
          position={[0, 0.95 + tier * 0.62, -0.55 - tier * 0.42]}
        >
          <boxGeometry args={[9.2 - tier * 0.35, 0.42, 2.6 - tier * 0.28]} />
        </mesh>
      ))}
      <mesh
        castShadow
        receiveShadow
        material={tierMaterial}
        position={[0, 0.12, 1.35]}
      >
        <boxGeometry args={[9.8, 0.24, 0.35]} />
      </mesh>
    </group>
  );
}

function createRoadGeometry(parsed: ParsedCircuitTrack) {
  if (parsed.points.length < 2 || parsed.width <= 0) return undefined;

  const curve = new THREE.CatmullRomCurve3(
    parsed.points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    parsed.closed,
    "catmullrom",
    0.5,
  );
  const samples = curve.getSpacedPoints(
    Math.max(96, parsed.points.length * 18),
  );
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfWidth = parsed.width / 2;

  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const tangent = next.clone().sub(previous).normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
    right.normalize();

    const leftPoint = current.clone().addScaledVector(right, -halfWidth);
    const rightPoint = current.clone().addScaledVector(right, halfWidth);
    positions.push(
      leftPoint.x,
      leftPoint.y,
      leftPoint.z,
      rightPoint.x,
      rightPoint.y,
      rightPoint.z,
    );
    uvs.push(0, index / samples.length, 1, index / samples.length);

    if (index < samples.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  if (parsed.closed) {
    const base = (samples.length - 1) * 2;
    indices.push(base, base + 1, 0, base + 1, 1, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createSceneryPlacements(parsed: ParsedCircuitTrack): AssetPlacement[] {
  if (parsed.points.length < 4) return [];

  const stride = Math.max(2, Math.floor(parsed.points.length / 22));
  const placements: AssetPlacement[] = [];

  for (let index = 0; index < parsed.points.length; index += stride) {
    const current = parsed.points[index];
    const next = parsed.points[(index + 1) % parsed.points.length];
    const dx = next.x - current.x;
    const dz = next.z - current.z;
    const length = Math.hypot(dx, dz) || 1;
    const side = index % 2 === 0 ? 1 : -1;
    const lateral = parsed.width / 2 + 11 + (index % 3) * 1.4;
    const position = {
      x: round(current.x + side * (-dz / length) * lateral),
      y: current.y,
      z: round(current.z + side * (dx / length) * lateral),
    };

    if (!isClearOfRoute(parsed, position, parsed.width / 2 + 7)) continue;

    placements.push({
      assetId: SCENERY_ASSETS[index % SCENERY_ASSETS.length],
      position,
      rotationY: Math.atan2(dx, dz) + side * 0.25,
      scale: 1.15 + (index % 4) * 0.12,
    });
  }

  return placements;
}

export function createGrandstandPlacements(
  parsed: ParsedCircuitTrack,
): StandPlacement[] {
  if (parsed.points.length < 6) return [];

  const curve = new THREE.CatmullRomCurve3(
    parsed.points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    parsed.closed,
    "catmullrom",
    0.5,
  );

  const count = 6;
  const stands: StandPlacement[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = index / count;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    tangent.y = 0;
    if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, -1);
    tangent.normalize();

    const side = index % 2 === 0 ? 1 : -1;
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const lateral = parsed.width / 2 + 9;
    const position = {
      x: round(point.x + right.x * lateral * side),
      y: round(point.y),
      z: round(point.z + right.z * lateral * side),
    };

    if (!isClearOfRoute(parsed, position, parsed.width / 2 + 5)) continue;

    stands.push({
      position,
      rotationY: Math.atan2(tangent.x, tangent.z) + (side > 0 ? Math.PI : 0),
      scale: 1.2 + (index % 2) * 0.15,
    });
  }

  return stands;
}

function createStartGrandstands(
  spawn: TrackDef["spawn"],
  parsed: ParsedCircuitTrack,
): StandPlacement[] {
  if (parsed.width <= 0) return [];

  const heading = spawn.heading;
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const offset = parsed.width / 2 + 9;

  return [-1, 1].map((side) => ({
    position: {
      x: round(spawn.position.x + rightX * offset * side),
      y: spawn.position.y,
      z: round(spawn.position.z + rightZ * offset * side),
    },
    rotationY: heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2),
    scale: 1.5,
  }));
}

export function isClearOfRoute(
  parsed: ParsedCircuitTrack,
  position: Vec3,
  minDistance: number,
) {
  if (parsed.points.length < 2) return true;

  for (let index = 0; index < parsed.points.length; index += 1) {
    const start = parsed.points[index];
    const end = parsed.points[(index + 1) % parsed.points.length];
    if (!parsed.closed && index === parsed.points.length - 1) break;

    const projected = projectToSegment(
      { x: position.x, z: position.z },
      { x: start.x, z: start.z },
      { x: end.x, z: end.z },
    );
    if (projected.distance < minDistance) return false;
  }

  return true;
}

function groundSizeForParsed(parsed: ParsedCircuitTrack) {
  if (parsed.points.length === 0) return 260;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of parsed.points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  return Math.max(maxX - minX, maxZ - minZ) + 140;
}

function projectToSegment(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number },
) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) {
    return {
      distance: Math.hypot(point.x - start.x, point.z - start.z),
    };
  }

  const progress = clamp(
    ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq,
    0,
    1,
  );
  const x = start.x + progress * dx;
  const z = start.z + progress * dz;

  return {
    distance: Math.hypot(point.x - x, point.z - z),
  };
}

function round(value: number) {
  return Number(value.toFixed(4));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

for (const assetId of SCENERY_ASSETS) {
  useGLTF.preload(cityAssetPaths[assetId]);
}
