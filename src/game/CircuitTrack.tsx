import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { TrackDef, Vec3 } from './track';
import { GROUND_PLANE_Y } from './track';

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

export function parseCircuitMapData(map: CircuitMapData, track: TrackDef): ParsedCircuitTrack {
  const curve = map.trackCurves?.find(candidate => (candidate.points?.length ?? 0) > 1);
  if (!curve?.points?.length) {
    return { points: [], closed: false, width: 0 };
  }

  const scale = track.circuitMapScale ?? 0.08;
  const widthScale = Math.max(
    0.8,
    ...((curve.data ?? []).map(pointData => pointData.scaleX ?? 1))
  );

  return {
    points: curve.points.map(point => ({
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
      .then(response => response.json())
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
    () => (mapData ? parseCircuitMapData(mapData, track) : { points: [], closed: false, width: 0 }),
    [mapData, track]
  );

  const roadGeometry = useMemo(() => createRoadGeometry(parsed), [parsed]);

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, GROUND_PLANE_Y, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#5d7d57" roughness={0.96} />
      </mesh>

      {roadGeometry ? (
        <mesh geometry={roadGeometry} receiveShadow castShadow>
          <meshStandardMaterial color="#30343a" roughness={0.86} metalness={0.02} />
        </mesh>
      ) : (
        <mesh receiveShadow rotation-x={-Math.PI / 2}>
          <ringGeometry args={[24, 32, 96]} />
          <meshStandardMaterial color="#30343a" roughness={0.86} />
        </mesh>
      )}
    </>
  );
}

function createRoadGeometry(parsed: ParsedCircuitTrack) {
  if (parsed.points.length < 2 || parsed.width <= 0) return undefined;

  const curve = new THREE.CatmullRomCurve3(
    parsed.points.map(point => new THREE.Vector3(point.x, point.y, point.z)),
    parsed.closed,
    'catmullrom',
    0.5
  );
  const samples = curve.getSpacedPoints(Math.max(96, parsed.points.length * 18));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfWidth = parsed.width / 2;

  for (let index = 0; index < samples.length; index++) {
    const current = samples[index];
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const tangent = next.clone().sub(previous).normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
    right.normalize();

    const leftPoint = current.clone().addScaledVector(right, -halfWidth);
    const rightPoint = current.clone().addScaledVector(right, halfWidth);
    positions.push(leftPoint.x, leftPoint.y, leftPoint.z, rightPoint.x, rightPoint.y, rightPoint.z);
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
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function round(value: number) {
  return Number(value.toFixed(4));
}
