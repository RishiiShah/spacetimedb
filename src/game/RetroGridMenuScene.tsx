import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { assets } from "./assets";
import { getLiveryById } from "./driving";

const LOWPOLY_SCALE = 0.008;
const LOWPOLY_UPRIGHT_X = -Math.PI / 2;

function CheckeredStartLine() {
  const tiles = useMemo(() => {
    const blocks: Array<[number, number, string]> = [];
    for (let index = 0; index < 12; index += 1) {
      const color = index % 2 === 0 ? "#f8fafc" : "#111827";
      blocks.push([(index - 5.5) * 1.1, -6, color]);
    }
    return blocks;
  }, []);

  return (
    <group position={[0, 0.012, -2]}>
      {tiles.map(([x, z, color], index) => (
        <mesh key={index} position={[x, 0, z]} receiveShadow>
          <boxGeometry args={[1.05, 0.02, 1.05]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function PalmTree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 2.8, 8]} />
        <meshStandardMaterial color="#6b4f2a" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 3.1, 0]}>
        <coneGeometry args={[1.1, 1.8, 8]} />
        <meshStandardMaterial color="#3d8b45" roughness={0.82} />
      </mesh>
    </group>
  );
}

function MenuCar({
  bodyColor,
  groupRef,
}: {
  bodyColor: string;
  groupRef: RefObject<THREE.Group>;
}) {
  const gltf = useGLTF(assets.cars.lowPoly);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        const apply = (material: THREE.Material) => {
          const next = material.clone() as THREE.MeshStandardMaterial;
          next.color = new THREE.Color(bodyColor);
          return next;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(apply)
          : apply(object.material);
      }
    });
    return clone;
  }, [bodyColor, gltf.scene]);

  return (
    <group
      ref={groupRef}
      position={[0, 0.26, 0]}
      rotation={[0, -Math.PI / 6, 0]}
    >
      <group rotation-x={LOWPOLY_UPRIGHT_X} scale={LOWPOLY_SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

function MenuScene({ bodyColor }: { bodyColor: string }) {
  const carRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!carRef.current) return;
    carRef.current.position.y =
      0.26 + Math.sin(clock.elapsedTime * 2.4) * 0.018;
  });

  return (
    <>
      <color attach="background" args={["#7ec0ee"]} />
      <fog attach="fog" args={["#9fd4f0", 28, 95]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight color="#fff4d6" groundColor="#355f46" intensity={0.45} />
      <directionalLight
        castShadow
        intensity={1.15}
        color="#ffaa66"
        position={[10, 14, 8]}
        shadow-mapSize={[1024, 1024]}
      />

      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial
          color="#3a4f63"
          roughness={0.86}
          metalness={0.02}
        />
      </mesh>
      <gridHelper args={[90, 90, 0x00ffff, 0x004444]} position={[0, 0.01, 0]} />
      <CheckeredStartLine />

      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, -18]}>
        <planeGeometry args={[120, 40]} />
        <meshStandardMaterial color="#5d8f52" roughness={0.95} />
      </mesh>

      <PalmTree position={[-8, 0, -4]} />
      <PalmTree position={[-11, 0, 2]} />
      <PalmTree position={[10, 0, -3]} />
      <PalmTree position={[12, 0, 4]} />

      <MenuCar bodyColor={bodyColor} groupRef={carRef} />
    </>
  );
}

export function RetroGridMenuScene({ liveryId }: { liveryId: string }) {
  const livery = getLiveryById(liveryId);

  return (
    <Canvas
      className="retro-menu-canvas"
      shadows
      camera={{ position: [0, 1.6, 6.5], fov: 52, near: 0.1, far: 200 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <MenuScene bodyColor={livery.body} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(assets.cars.lowPoly);
