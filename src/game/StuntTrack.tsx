import { useMemo } from "react";
import {
  stuntShowcaseArena,
  type StuntArenaDef,
  type StuntSurface,
} from "./stuntArena";
import { createStuntSurfaceGeometry } from "./stuntSurfaceGeometry";
import type { TrackDef } from "./track";

const ASPHALT = "#2f3740";
const CURB = "#d43f32";
const RAIL = "#f8fafc";
const GRASS = "#6b8f5a";

function arenaWalls(bounds: StuntArenaDef["bounds"]) {
  const height = bounds.wallHeight ?? 6;
  const widthX = bounds.maxX - bounds.minX;
  const widthZ = bounds.maxZ - bounds.minZ;
  const centerY = height / 2;
  const thickness = 1.4;

  return (
    <>
      <mesh position={[0, centerY, bounds.minZ - thickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[widthX + thickness * 2, height, thickness]} />
        <meshStandardMaterial color={RAIL} roughness={0.7} />
      </mesh>
      <mesh position={[0, centerY, bounds.maxZ + thickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[widthX + thickness * 2, height, thickness]} />
        <meshStandardMaterial color={CURB} roughness={0.7} />
      </mesh>
      <mesh
        position={[bounds.minX - thickness / 2, centerY, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[thickness, height, widthZ + thickness * 2]} />
        <meshStandardMaterial color={RAIL} roughness={0.7} />
      </mesh>
      <mesh
        position={[bounds.maxX + thickness / 2, centerY, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[thickness, height, widthZ + thickness * 2]} />
        <meshStandardMaterial color={CURB} roughness={0.7} />
      </mesh>
    </>
  );
}

function StuntSurfaceMesh({ surface }: { surface: StuntSurface }) {
  const geometry = useMemo(
    () => createStuntSurfaceGeometry(surface),
    [surface],
  );

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial color={ASPHALT} roughness={0.82} metalness={0.02} />
    </mesh>
  );
}

export function StuntTrackAssets({ track }: { track: TrackDef }) {
  const arena = track.stuntArena ?? stuntShowcaseArena;
  const groundSize = arena.bounds.maxX - arena.bounds.minX + 60;

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, arena.baseY - 0.02, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={GRASS} roughness={0.96} />
      </mesh>

      {arena.surfaces.map((surface, index) => (
        <StuntSurfaceMesh key={`${surface.type}-${index}`} surface={surface} />
      ))}

      {arenaWalls(arena.bounds)}

      <mesh position={[0, arena.baseY + 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[26, 30, 64]} />
        <meshStandardMaterial color="#facc15" roughness={0.6} />
      </mesh>
    </>
  );
}
