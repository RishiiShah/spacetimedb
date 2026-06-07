import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "./track";
import {
  createCornerSignPlacements,
  createLamppostPlacements,
  createRouteGrandstandPlacements,
  createSidewalkGeometries,
  createSponsorBoardPlacements,
  type DetailPlacement,
  type SponsorBoardPlacement,
} from "./trackRouteDetails";

type TrackRouteDetailsProps = {
  points: Vec3[];
  roadWidth: number;
  railOffset?: number;
  railHeight?: number;
  showGrandstands?: boolean;
};

export function TrackRouteDetails({
  points,
  roadWidth,
  railOffset,
  railHeight,
  showGrandstands = true,
}: TrackRouteDetailsProps) {
  const hasRails = Boolean(railHeight);
  const sidewalks = useMemo(
    () => createSidewalkGeometries(points, roadWidth, railOffset, hasRails),
    [hasRails, points, railOffset, roadWidth],
  );
  const lampposts = useMemo(
    () => createLamppostPlacements(points, roadWidth, railOffset, hasRails),
    [hasRails, points, railOffset, roadWidth],
  );
  const sponsorBoards = useMemo(
    () =>
      hasRails
        ? createSponsorBoardPlacements(points, roadWidth, railOffset)
        : [],
    [hasRails, points, railOffset, roadWidth],
  );
  const grandstands = useMemo(
    () =>
      showGrandstands && hasRails
        ? createRouteGrandstandPlacements(points, roadWidth, railOffset)
        : [],
    [hasRails, points, railOffset, roadWidth, showGrandstands],
  );
  const cornerSigns = useMemo(
    () => createCornerSignPlacements(points, roadWidth, railOffset),
    [points, railOffset, roadWidth],
  );

  const sidewalkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#b8bec8",
        roughness: 0.82,
        metalness: 0.04,
      }),
    [],
  );

  useEffect(() => () => sidewalkMaterial.dispose(), [sidewalkMaterial]);
  useEffect(
    () => () => {
      sidewalks.left.dispose();
      sidewalks.right.dispose();
    },
    [sidewalks],
  );

  return (
    <>
      <mesh
        geometry={sidewalks.left}
        material={sidewalkMaterial}
        receiveShadow
        renderOrder={1}
      />
      <mesh
        geometry={sidewalks.right}
        material={sidewalkMaterial}
        receiveShadow
        renderOrder={1}
      />

      {lampposts.map((post, index) => (
        <Lamppost key={`lamp-${index}`} placement={post} />
      ))}

      {sponsorBoards.map((board, index) => (
        <SponsorBoard key={`board-${index}`} placement={board} />
      ))}

      {grandstands.map((stand, index) => (
        <RouteGrandstand key={`stand-${index}`} placement={stand} />
      ))}

      {cornerSigns.map((sign, index) => (
        <CornerSign key={`corner-sign-${index}`} sign={sign} />
      ))}
    </>
  );
}

function Lamppost({ placement }: { placement: DetailPlacement }) {
  return (
    <group
      position={[
        placement.position.x,
        placement.position.y,
        placement.position.z,
      ]}
      rotation={[0, placement.rotationY, 0]}
    >
      <mesh castShadow receiveShadow position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 4.4, 8]} />
        <meshStandardMaterial color="#5a6270" metalness={0.45} roughness={0.48} />
      </mesh>
      <mesh castShadow position={[0.42, 4.15, 0]}>
        <boxGeometry args={[0.95, 0.16, 0.32]} />
        <meshStandardMaterial
          color="#1a2230"
          emissive="#ffe7a8"
          emissiveIntensity={0.55}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

function SponsorBoard({ placement }: { placement: SponsorBoardPlacement }) {
  return (
    <group
      position={[
        placement.position.x,
        placement.position.y + 1.15,
        placement.position.z,
      ]}
      rotation={[0, placement.rotationY, 0]}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.6, 1.4, 0.12]} />
        <meshStandardMaterial color="#111827" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.07]} receiveShadow>
        <boxGeometry args={[3.35, 1.15, 0.04]} />
        <meshStandardMaterial
          color={placement.label.length % 2 === 0 ? "#1d4ed8" : "#b91c1c"}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, 0.15, 0.1]} receiveShadow>
        <boxGeometry args={[2.8, 0.22, 0.02]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>
    </group>
  );
}

function RouteGrandstand({ placement }: { placement: DetailPlacement }) {
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
  const scale = placement.scale ?? 1;

  return (
    <group
      position={[
        placement.position.x,
        placement.position.y,
        placement.position.z,
      ]}
      rotation={[0, placement.rotationY, 0]}
      scale={scale}
    >
      <mesh castShadow receiveShadow material={tierMaterial} position={[0, 0.35, 0]}>
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
      <mesh castShadow receiveShadow material={tierMaterial} position={[0, 0.12, 1.35]}>
        <boxGeometry args={[9.8, 0.24, 0.35]} />
      </mesh>
    </group>
  );
}

function CornerSign({
  sign,
}: {
  sign: {
    position: [number, number, number];
    rotationY: number;
    scale?: number;
  };
}) {
  return (
    <group
      position={sign.position}
      rotation={[0, sign.rotationY, 0]}
      scale={sign.scale ?? 1.4}
    >
      <mesh castShadow position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 2.7, 6]} />
        <meshStandardMaterial color="#64748b" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 2.55, 0.16]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.4, 1.1, 0.08]} />
        <meshStandardMaterial color="#facc15" roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.55, 0.21]}>
        <boxGeometry args={[1.1, 0.75, 0.02]} />
        <meshStandardMaterial color="#111827" roughness={0.5} />
      </mesh>
    </group>
  );
}
