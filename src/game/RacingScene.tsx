import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, Text, useGLTF } from "@react-three/drei";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { assets } from "./assets";
import {
  CAR_MODEL_FORWARD_YAW_OFFSET,
  CAR_MODEL_RIDE_HEIGHT,
  CAR_SUSPENSION_LINKS,
  CAR_VISUAL_MAX_STEER_YAW,
  CAR_WHEEL_SPECS,
  LIVERY_ACCENT_MATERIAL,
  LIVERY_BODY_MATERIAL,
  type CarId,
  type CarSuspensionLink,
  type CarWheelSpec,
  drivingActionFromKeyboardEvent,
  getLiveryById,
  inputFromDrivingActions,
  visualWheelSteerYaw,
} from "./driving";
import { createSnapshot, type CarSnapshot } from "./network";
import {
  ROUTE_RAIL_WIDTH,
  cityAssetPaths,
  getRouteRailOffset,
  getTrackById,
  type AssetPlacement,
  type TrackDef,
  type Vec3,
} from "./track";
import { createRouteFrames } from "./routeGeometry";
import {
  createVehicleAtTrackReset,
  resolveVehicleObstacleCollisions,
  stepVehicle,
  type VehicleInput,
  type VehicleState,
} from "./vehicle";
import { CircuitTrackAssets } from "./CircuitTrack";
import { StuntTrackAssets } from "./StuntTrack";
import type { CarState } from "../module_bindings/types";

export type RacingTelemetry = {
  speed: number;
  checkpointIndex: number;
  elapsedMs: number;
  cameraMode?: string;
};

type RacingSceneProps = {
  localIdentity: string;
  roomId?: bigint;
  trackId?: bigint;
  carId?: CarId;
  liveryId?: string;
  remoteCars: CarState[];
  onSnapshot: (snapshot: CarSnapshot) => void;
  onCheckpoint: (checkpointIndex: number, elapsedMs: number) => void;
  onFinishLap: (elapsedMs: number, checkpointCount: number) => void;
  onTelemetry: (telemetry: RacingTelemetry) => void;
};

export function RacingScene(props: RacingSceneProps) {
  return (
    <Canvas
      className="racing-canvas"
      shadows
      camera={{ position: [0, 12, 34], fov: 58 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#8aaec5"]} />
      <fog attach="fog" args={["#8aaec5", 180, 980]} />
      <ambientLight intensity={0.38} />
      <hemisphereLight color="#dcecff" groundColor="#6f8466" intensity={0.78} />
      <directionalLight
        castShadow
        intensity={2.1}
        position={[80, 120, 48]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-camera-left={-520}
        shadow-camera-right={520}
        shadow-camera-top={440}
        shadow-camera-bottom={-440}
        shadow-bias={-0.0001}
      />
      <Suspense fallback={<LoadingLabel />}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  );
}

function SceneContent({
  localIdentity,
  roomId,
  trackId,
  carId,
  liveryId,
  remoteCars,
  onSnapshot,
  onCheckpoint,
  onFinishLap,
  onTelemetry,
}: RacingSceneProps) {
  const livery = getLiveryById(liveryId);
  const currentTrack = useMemo(() => getTrackById(trackId), [trackId]);
  const inputRef = useRef<VehicleInput>({
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
  });
  const vehicleRef = useRef<VehicleState>(
    createVehicleAtTrackReset(currentTrack),
  );
  const localCarRef = useRef<THREE.Group>(null);
  const localSteerRef = useRef(0);
  const localSpeedRef = useRef(0);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const lastPublishRef = useRef(0);
  const startMsRef = useRef(performance.now());
  const nextCheckpointRef = useRef(0);
  const [cameraMode, setCameraMode] = useState<"chase" | "driver">("chase");

  const resetVehicle = (checkpointIndex?: number) => {
    vehicleRef.current = createVehicleAtTrackReset(
      currentTrack,
      checkpointIndex,
    );
    if (localCarRef.current) {
      localCarRef.current.position.set(
        vehicleRef.current.position.x,
        vehicleRef.current.position.y + CAR_MODEL_RIDE_HEIGHT,
        vehicleRef.current.position.z,
      );
      localCarRef.current.rotation.y = -vehicleRef.current.heading;
    }
  };

  useEffect(() => {
    startMsRef.current = performance.now();
    nextCheckpointRef.current = 0;
    resetVehicle();
  }, [currentTrack]);

  useKeyboardInput(
    inputRef,
    () => {
      const previousCheckpoint =
        nextCheckpointRef.current === 0
          ? undefined
          : Math.max(0, nextCheckpointRef.current - 1);
      resetVehicle(previousCheckpoint);
    },
    () => setCameraMode((mode) => (mode === "chase" ? "driver" : "chase")),
  );

  useFrame(({ camera, clock }, delta) => {
    const vehicle = resolveVehicleObstacleCollisions(
      stepVehicle(vehicleRef.current, inputRef.current, delta, currentTrack),
      remoteCars.map((car) => ({ x: car.x, z: car.z })),
    );
    vehicleRef.current = vehicle;
    localSteerRef.current = vehicle.steer;
    localSpeedRef.current = vehicle.speed;

    if (localCarRef.current) {
      localCarRef.current.position.set(
        vehicle.position.x,
        vehicle.position.y + CAR_MODEL_RIDE_HEIGHT,
        vehicle.position.z,
      );
      localCarRef.current.rotation.y = -vehicle.heading;
    }

    updateCamera(camera, cameraTargetRef.current, vehicle, cameraMode);

    const elapsedMs = Math.max(
      0,
      Math.floor(performance.now() - startMsRef.current),
    );
    const nextCheckpoint = currentTrack.checkpoints[nextCheckpointRef.current];
    if (
      nextCheckpoint &&
      distance2D(vehicle.position, nextCheckpoint.position) <=
        checkpointRadius(nextCheckpoint)
    ) {
      onCheckpoint(nextCheckpoint.index, elapsedMs);
      nextCheckpointRef.current += 1;

      if (nextCheckpointRef.current >= currentTrack.checkpoints.length) {
        onFinishLap(elapsedMs, currentTrack.checkpoints.length);
        startMsRef.current = performance.now();
        nextCheckpointRef.current = 0;
      }
    }

    onTelemetry({
      speed: Math.max(0, vehicle.speed),
      checkpointIndex: nextCheckpointRef.current,
      elapsedMs,
      cameraMode,
    });

    if (
      roomId &&
      trackId &&
      clock.elapsedTime - lastPublishRef.current > 0.08
    ) {
      lastPublishRef.current = clock.elapsedTime;
      onSnapshot(
        createSnapshot({
          identity: localIdentity,
          roomId: Number(roomId),
          trackId: Number(trackId),
          position: vehicle.position,
          heading: vehicle.heading,
          speed: vehicle.speed,
          checkpointIndex: nextCheckpointRef.current,
          elapsedMs,
        }),
      );
    }
  });

  return (
    <>
      <Environment files={[...assets.skybox.night]} background />

      <TrackRenderer track={currentTrack} />

      <group
        ref={localCarRef}
        position={[
          currentTrack.spawn.position.x,
          currentTrack.spawn.position.y + CAR_MODEL_RIDE_HEIGHT,
          currentTrack.spawn.position.z,
        ]}
      >
        <CarModel
          carId={carId}
          body={livery.body}
          accent={livery.accent}
          steerRef={localSteerRef}
          speedRef={localSpeedRef}
          view={cameraMode}
        />
      </group>
      {remoteCars.map((car) => (
        <RemoteCar key={car.identity.toHexString()} car={car} />
      ))}
    </>
  );
}

function TrackRenderer({ track }: { track: TrackDef }) {
  if (track.mode === "stunt") return <StuntTrackAssets />;
  if (track.circuitMapPath) return <CircuitTrackAssets track={track} />;

  return <CityTrackAssets track={track} />;
}

function CarModel({
  carId,
  body,
  accent,
  steerRef,
  speedRef,
  speed = 0,
  view = "chase",
}: {
  carId?: CarId;
  body: string;
  accent: string;
  steerRef?: MutableRefObject<number>;
  speedRef?: MutableRefObject<number>;
  speed?: number;
  view?: "chase" | "driver";
}) {
  if (carId === "lowpoly") return <LowPolyCar body={body} />;
  return (
    <CircuitCar
      body={body}
      accent={accent}
      steerRef={steerRef}
      speedRef={speedRef}
      speed={speed}
      view={view}
    />
  );
}

// Clone the meshes' materials for this instance and recolor by material name, so
// liveries are per-car (never mutate the shared cached materials).
function useLiveriedScene(
  scene: THREE.Object3D,
  recolor: (material: THREE.MeshStandardMaterial) => boolean,
) {
  return useMemo(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        const apply = (material: THREE.Material) => {
          const cloned = material.clone() as THREE.MeshStandardMaterial;
          recolor(cloned);
          return cloned;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(apply)
          : apply(object.material);
      }
    });
    return scene;
    // recolor is recreated per body/accent change by the caller's useMemo deps
  }, [scene, recolor]);
}

// The low-poly F1 is a single authored model (Z-up, Y-forward, cm scale), so it
// is uprighted into our Y-up world, scaled down, and lifted so the tires sit on
// the road. Tune LOWPOLY_Y if it floats or sinks.
const LOWPOLY_SCALE = 0.008;
const LOWPOLY_Y = 0.04;
const LOWPOLY_UPRIGHT_X = -Math.PI / 2;
const WHEEL_VISUAL_RADIUS = 0.46;

function LowPolyCar({ body }: { body: string }) {
  const scene = usePreparedModel(assets.cars.lowPoly, true, true, true);
  // The LowPoly has a baked texture; tint its material so the livery color reads
  // through the stripes.
  const recolor = useMemo(
    () => (material: THREE.MeshStandardMaterial) => {
      material.color = new THREE.Color(body);
      return true;
    },
    [body],
  );
  const tinted = useLiveriedScene(scene, recolor);
  return (
    <group
      position={[0, LOWPOLY_Y, 0]}
      rotation-x={LOWPOLY_UPRIGHT_X}
      scale={LOWPOLY_SCALE}
    >
      <primitive object={tinted} />
    </group>
  );
}

function CircuitCar({
  body,
  accent,
  steerRef,
  speedRef,
  speed = 0,
  view = "chase",
}: {
  body: string;
  accent: string;
  steerRef?: MutableRefObject<number>;
  speedRef?: MutableRefObject<number>;
  speed?: number;
  view?: "chase" | "driver";
}) {
  const rawChassis = usePreparedModel(assets.cars.chassis, true, true, true);
  // Paint the body + accent materials, with a glossier finish so it reads as
  // racecar paint instead of matte plastic.
  const recolor = useMemo(
    () => (material: THREE.MeshStandardMaterial) => {
      if (material.name === LIVERY_BODY_MATERIAL) {
        material.color = new THREE.Color(body);
        material.metalness = 0.35;
        material.roughness = 0.42;
      } else if (material.name === LIVERY_ACCENT_MATERIAL) {
        material.color = new THREE.Color(accent);
        material.metalness = 0.3;
        material.roughness = 0.5;
      }
      return true;
    },
    [body, accent],
  );
  const chassisScene = useLiveriedScene(rawChassis, recolor);
  const wheelScene = usePreparedModel(assets.cars.wheel, true, true, true);
  const steeringWheelScene = usePreparedModel(
    assets.cars.steeringWheel,
    true,
    true,
    true,
  );
  const wheelGroupsRef = useRef(new Map<CarWheelSpec["id"], THREE.Group>());
  const wheelVisualsRef = useRef(new Map<CarWheelSpec["id"], THREE.Group>());
  const steeringWheelRef = useRef<THREE.Group>(null);
  const visualSteerRef = useRef(0);
  const wheelSpinRef = useRef(0);
  const visibleWheels =
    view === "driver" ? CAR_WHEEL_SPECS.filter(isFrontWheel) : CAR_WHEEL_SPECS;

  useFrame((_, delta) => {
    const targetSteer = -(steerRef?.current ?? 0);
    visualSteerRef.current = THREE.MathUtils.damp(
      visualSteerRef.current,
      targetSteer,
      12,
      delta,
    );
    const steerYaw = visualWheelSteerYaw(visualSteerRef.current);
    wheelSpinRef.current +=
      ((speedRef?.current ?? speed) * delta) / WHEEL_VISUAL_RADIUS;

    for (const wheel of CAR_WHEEL_SPECS) {
      const group = wheelGroupsRef.current.get(wheel.id);
      if (group) group.rotation.y = isFrontWheel(wheel) ? steerYaw : 0;
      const visual = wheelVisualsRef.current.get(wheel.id);
      if (visual) visual.rotation.x = -wheelSpinRef.current;
    }
    if (steeringWheelRef.current) {
      steeringWheelRef.current.rotation.z =
        -(steerYaw / CAR_VISUAL_MAX_STEER_YAW) * 0.85;
    }
  });

  return (
    <group scale={0.9} rotation-y={CAR_MODEL_FORWARD_YAW_OFFSET}>
      {view === "chase" && <primitive object={chassisScene} scale={0.85} />}
      {/* You don't see yourself from the cockpit; passengers only show in chase. */}
      {view === "chase" && <DriverFigure />}
      <group
        ref={steeringWheelRef}
        position={[0, 0.82, 0.36]}
        rotation={[Math.PI * 0.08, 0, 0]}
        scale={0.42}
      >
        <primitive object={steeringWheelScene} />
      </group>
      {view === "chase" &&
        CAR_SUSPENSION_LINKS.map((link) => (
          <SuspensionLink key={link.id} link={link} />
        ))}
      {visibleWheels.map((wheel) => (
        <group
          key={wheel.id}
          ref={(group) => {
            if (group) wheelGroupsRef.current.set(wheel.id, group);
            else wheelGroupsRef.current.delete(wheel.id);
          }}
          position={wheel.position}
        >
          <mesh castShadow position={[wheel.position[0] * -0.14, 0.02, 0]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color="#050505" roughness={0.75} />
          </mesh>
          <group
            ref={(group) => {
              if (group) wheelVisualsRef.current.set(wheel.id, group);
              else wheelVisualsRef.current.delete(wheel.id);
            }}
          >
            <primitive object={wheelScene.clone()} scale={0.85} />
          </group>
        </group>
      ))}
      {view === "chase" && (
        <mesh castShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[1.8, 0.28, 3.2]} />
          <meshStandardMaterial color={body} transparent opacity={0.18} />
        </mesh>
      )}
    </group>
  );
}

function isFrontWheel(wheel: CarWheelSpec) {
  return wheel.position[2] > 0;
}

function DriverFigure() {
  return (
    // Sunk down into the cockpit so the driver reads as seated, not perched.
    <group position={[0, 0.02, -0.02]}>
      <mesh castShadow position={[0, 0.24, -0.08]} scale={[0.34, 0.42, 0.32]}>
        <capsuleGeometry args={[0.32, 0.38, 4, 8]} />
        <meshStandardMaterial color="#111827" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.78, 0.06]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.55} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.76, 0.24]}
        rotation={[0.35, 0, 0]}
        scale={[0.18, 0.08, 0.08]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          position={[side * 0.24, 0.48, 0.26]}
          rotation={[0.95, 0, side * 0.38]}
        >
          <capsuleGeometry args={[0.045, 0.42, 4, 8]} />
          <meshStandardMaterial color="#111827" roughness={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function SuspensionLink({ link }: { link: CarSuspensionLink }) {
  const transform = useMemo(() => {
    const start = new THREE.Vector3(...link.start);
    const end = new THREE.Vector3(...link.end);
    const direction = end.clone().sub(start);
    const length = direction.length();
    const position = start.clone().add(end).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );

    return {
      length,
      position: position.toArray() as [number, number, number],
      quaternion: quaternion.toArray() as [number, number, number, number],
    };
  }, [link]);

  return (
    <mesh
      castShadow
      receiveShadow
      position={transform.position}
      quaternion={transform.quaternion}
    >
      <cylinderGeometry args={[0.035, 0.035, transform.length, 8]} />
      <meshStandardMaterial color="#050505" roughness={0.82} />
    </mesh>
  );
}

function RemoteCar({ car }: { car: CarState }) {
  return (
    <group
      position={[car.x, car.y + CAR_MODEL_RIDE_HEIGHT, car.z]}
      quaternion={[car.qx, car.qy, car.qz, car.qw]}
    >
      <CircuitCar body="#38bdf8" accent="#10212a" speed={car.speed} />
    </group>
  );
}

function CityTrackAssets({ track }: { track: TrackDef }) {
  const isPractice = track.mode === "practice";
  const roadWidth = track.roadWidth ?? 34;

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.08, 0]}>
        <planeGeometry args={isPractice ? [720, 520] : [1120, 760]} />
        <meshStandardMaterial
          color={isPractice ? "#778a70" : "#78956c"}
          roughness={0.98}
        />
      </mesh>

      {track.routePoints && (
        <RouteRoad
          points={track.routePoints}
          width={roadWidth}
          railOffset={track.railOffset}
          railHeight={track.railHeight}
          railColor={track.railColor}
        />
      )}

      {track.placements.map((placement, index) => (
        <PlacedAsset
          key={`${placement.assetId}-${index}`}
          placement={placement}
        />
      ))}
      {!isPractice && (
        <>
          <StartGantry
            spawn={track.spawn}
            width={roadWidth}
            railOffset={track.railOffset}
          />
          {track.routePoints && (
            <TrackDirectionSigns
              points={track.routePoints}
              width={roadWidth}
              railOffset={track.railOffset}
            />
          )}
        </>
      )}
    </>
  );
}

function RouteRoad({
  points,
  width,
  railOffset,
  railHeight,
  railColor = "#d8dde4",
}: {
  points: Vec3[];
  width: number;
  railOffset?: number;
  railHeight?: number;
  railColor?: string;
}) {
  const resolvedRailOffset = railOffset ?? getRouteRailOffset(width);
  const asphaltGeometry = useMemo(
    () => createRouteRibbonGeometry(points, width, 0.02, 0),
    [points, width],
  );
  const leftEdgeGeometry = useMemo(
    () => createRouteRibbonGeometry(points, 1.35, 0.075, -width / 2 + 1.4),
    [points, width],
  );
  const rightEdgeGeometry = useMemo(
    () => createRouteRibbonGeometry(points, 1.35, 0.075, width / 2 - 1.4),
    [points, width],
  );
  const leftCurbGeometry = useMemo(
    () => createRouteRibbonGeometry(points, 2.6, 0.085, -width / 2 - 1.3),
    [points, width],
  );
  const rightCurbGeometry = useMemo(
    () => createRouteRibbonGeometry(points, 2.6, 0.085, width / 2 + 1.3),
    [points, width],
  );

  return (
    <>
      <mesh geometry={asphaltGeometry} receiveShadow>
        <meshStandardMaterial
          color="#2f3740"
          roughness={0.88}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={leftEdgeGeometry}>
        <meshStandardMaterial
          color="#f8fafc"
          roughness={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={rightEdgeGeometry}>
        <meshStandardMaterial
          color="#f8fafc"
          roughness={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={leftCurbGeometry}>
        <meshStandardMaterial
          color="#d43f32"
          roughness={0.72}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={rightCurbGeometry}>
        <meshStandardMaterial
          color="#d43f32"
          roughness={0.72}
          side={THREE.DoubleSide}
        />
      </mesh>
      {railHeight && (
        <RouteContinuousWalls
          points={points}
          railOffset={resolvedRailOffset}
          railHeight={railHeight}
          railColor={railColor}
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
}: {
  points: Vec3[];
  railOffset: number;
  railHeight: number;
  railColor: string;
}) {
  const innerOffset = railOffset - ROUTE_RAIL_WIDTH / 2;
  const stripeHeight = Math.min(0.16, railHeight * 0.16);
  const stripeBase = railHeight * 0.52;
  const leftWallGeometry = useMemo(
    () => createRouteVerticalRibbonGeometry(points, railHeight, -innerOffset),
    [innerOffset, points, railHeight],
  );
  const rightWallGeometry = useMemo(
    () => createRouteVerticalRibbonGeometry(points, railHeight, innerOffset),
    [innerOffset, points, railHeight],
  );
  const leftStripeGeometry = useMemo(
    () =>
      createRouteVerticalRibbonGeometry(
        points,
        stripeHeight,
        -innerOffset + 0.015,
        stripeBase,
      ),
    [innerOffset, points, stripeBase, stripeHeight],
  );
  const rightStripeGeometry = useMemo(
    () =>
      createRouteVerticalRibbonGeometry(
        points,
        stripeHeight,
        innerOffset - 0.015,
        stripeBase,
      ),
    [innerOffset, points, stripeBase, stripeHeight],
  );
  const leftCapGeometry = useMemo(
    () =>
      createRouteRibbonGeometry(
        points,
        ROUTE_RAIL_WIDTH,
        railHeight,
        -railOffset,
      ),
    [points, railHeight, railOffset],
  );
  const rightCapGeometry = useMemo(
    () =>
      createRouteRibbonGeometry(
        points,
        ROUTE_RAIL_WIDTH,
        railHeight,
        railOffset,
      ),
    [points, railHeight, railOffset],
  );

  return (
    <>
      {[leftWallGeometry, rightWallGeometry].map((geometry, index) => (
        <mesh
          key={`wall-${index}`}
          geometry={geometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={railColor}
            roughness={0.38}
            metalness={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {[leftStripeGeometry, rightStripeGeometry].map((geometry, index) => (
        <mesh key={`wall-stripe-${index}`} geometry={geometry}>
          <meshStandardMaterial
            color="#d43f32"
            roughness={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {[leftCapGeometry, rightCapGeometry].map((geometry, index) => (
        <mesh key={`wall-cap-${index}`} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#151a22"
            roughness={0.32}
            metalness={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
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

function PlacedAsset({ placement }: { placement: AssetPlacement }) {
  const scene = usePreparedModel(cityAssetPaths[placement.assetId], true, true);
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
  const scene = usePreparedModel(path, true, true);
  return (
    <primitive
      object={scene}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    />
  );
}

// Faces meeting at less than this angle get smoothed shading; sharper edges
// (wings, nose) stay crisp. Larger = smoother/rounder look.
const MODEL_CREASE_ANGLE = (70 * Math.PI) / 180;

function usePreparedModel(
  path: string,
  castShadow: boolean,
  receiveShadow: boolean,
  smooth = false,
) {
  const gltf = useGLTF(path);

  return useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = castShadow;
        object.receiveShadow = receiveShadow;
        object.frustumCulled = true;
        if (smooth && object.geometry) {
          // Recompute normals with a crease angle so curved surfaces shade
          // smoothly instead of looking faceted, without rounding hard edges.
          object.geometry = toCreasedNormals(
            object.geometry,
            MODEL_CREASE_ANGLE,
          );
        }
      }
    });
    return scene;
  }, [castShadow, gltf.scene, receiveShadow, smooth]);
}

function createRouteRibbonGeometry(
  points: Vec3[],
  width: number,
  yOffset: number,
  lateralOffset: number,
) {
  const frames = createRouteFrames(points, yOffset);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfWidth = width / 2;

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const center = frame.point
      .clone()
      .addScaledVector(frame.right, lateralOffset);
    const leftPoint = center.clone().addScaledVector(frame.right, -halfWidth);
    const rightPoint = center.clone().addScaledVector(frame.right, halfWidth);
    positions.push(
      leftPoint.x,
      leftPoint.y,
      leftPoint.z,
      rightPoint.x,
      rightPoint.y,
      rightPoint.z,
    );
    uvs.push(0, index / frames.length, 1, index / frames.length);

    const nextIndex = (index + 1) % frames.length;
    const base = index * 2;
    const nextBase = nextIndex * 2;
    indices.push(base, nextBase, base + 1, base + 1, nextBase, nextBase + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createRouteVerticalRibbonGeometry(
  points: Vec3[],
  height: number,
  lateralOffset: number,
  yBase = 0,
) {
  const frames = createRouteFrames(points);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const base = frame.point
      .clone()
      .addScaledVector(frame.right, lateralOffset);
    positions.push(
      base.x,
      base.y + yBase,
      base.z,
      base.x,
      base.y + yBase + height,
      base.z,
    );
    uvs.push(index / frames.length, 0, index / frames.length, 1);

    const nextIndex = (index + 1) % frames.length;
    const baseIndex = index * 2;
    const nextBase = nextIndex * 2;
    indices.push(
      baseIndex,
      nextBase,
      baseIndex + 1,
      baseIndex + 1,
      nextBase,
      nextBase + 1,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createDirectionSignPlacements(
  points: Vec3[],
  width: number,
  railOffset?: number,
) {
  const frames = createRouteFrames(points);
  if (frames.length === 0) return [];

  const sideOffset = (railOffset ?? getRouteRailOffset(width)) + 9;
  const markers = [
    { ratio: 0.16, side: -1, path: assets.track.arrowRight },
    { ratio: 0.34, side: 1, path: assets.track.arrowLeft },
    { ratio: 0.48, side: 1, path: assets.track.arrowLeft },
    { ratio: 0.66, side: -1, path: assets.track.arrowRight },
    { ratio: 0.84, side: -1, path: assets.track.arrowRight },
  ];

  return markers.map((marker) => {
    const frame = frames[Math.floor(marker.ratio * frames.length)];
    const position = frame.point
      .clone()
      .addScaledVector(frame.right, sideOffset * marker.side);
    const rotationY =
      Math.atan2(frame.tangent.x, frame.tangent.z) -
      marker.side * (Math.PI / 2);

    return {
      path: marker.path,
      position: [position.x, 0, position.z] as [number, number, number],
      rotationY,
    };
  });
}
function LoadingLabel() {
  return (
    <Html center>
      <div className="loading-scene">Loading track...</div>
    </Html>
  );
}

function useKeyboardInput(
  inputRef: React.MutableRefObject<VehicleInput>,
  onReset: () => void,
  onToggleCamera: () => void,
) {
  // Keep the held-key set and callbacks in refs so the listener effect mounts
  // once. Otherwise re-renders (network/telemetry updates) would re-run the
  // effect, replacing the set with an empty one and dropping currently-held
  // keys until they are released and pressed again.
  const onResetRef = useRef(onReset);
  const onToggleCameraRef = useRef(onToggleCamera);
  onResetRef.current = onReset;
  onToggleCameraRef.current = onToggleCamera;

  useEffect(() => {
    const keys = new Set<string>();
    const update = () => {
      inputRef.current = inputFromDrivingActions(keys);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const action = drivingActionFromKeyboardEvent(event);
      if (action) {
        event.preventDefault();
        keys.add(action);
        update();
        return;
      }

      const key = event.key.toLowerCase();
      if (event.repeat) return;
      if (key === "r") onResetRef.current();
      if (key === "c") onToggleCameraRef.current();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = drivingActionFromKeyboardEvent(event);
      if (!action) return;

      event.preventDefault();
      keys.delete(action);
      update();
    };
    const clearInput = () => {
      keys.clear();
      update();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearInput);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearInput);
    };
  }, [inputRef]);
}

// Chase camera: distance behind and height above the car. Lower = closer.
const CHASE_DISTANCE = 6;
const CHASE_HEIGHT = 3.87;
const CHASE_LOOK_HEIGHT = 1.6;
const CHASE_FOV = 58;
// Per-frame follow factor. Higher catches up faster, which shrinks the extra
// gap the camera falls behind by at high speed (steady-state lag ~= speed/factor).
const CHASE_FOLLOW = 0.2;
// Driver camera: a cockpit seat near the car's center at head height, looking
// down the track. A wider FOV adds peripheral view and a sense of speed.
// DRIVER_BACK > 0 sits behind center (more car visible); negative sits forward.
const DRIVER_BACK = 0.15;
const DRIVER_HEIGHT = 1.22;
const DRIVER_LOOK_AHEAD = 24;
const DRIVER_LOOK_HEIGHT = 1.08;
const DRIVER_FOV = 70;

function updateCamera(
  camera: THREE.Camera,
  target: THREE.Vector3,
  vehicle: VehicleState,
  mode: "chase" | "driver",
) {
  // Unit forward vector matching the vehicle's travel direction.
  const forwardX = Math.sin(vehicle.heading);
  const forwardZ = -Math.cos(vehicle.heading);

  // Wider field of view in the cockpit for immersion and speed; normal behind.
  if (camera instanceof THREE.PerspectiveCamera) {
    const desiredFov = mode === "driver" ? DRIVER_FOV : CHASE_FOV;
    if (camera.fov !== desiredFov) {
      camera.fov = desiredFov;
      camera.updateProjectionMatrix();
    }
  }

  if (mode === "driver") {
    // Rigidly attached to the car so the cockpit view never lags or bobs while
    // accelerating, as if you were sitting in the seat.
    camera.position.set(
      vehicle.position.x - forwardX * DRIVER_BACK,
      vehicle.position.y + DRIVER_HEIGHT,
      vehicle.position.z - forwardZ * DRIVER_BACK,
    );
    target.set(
      vehicle.position.x + forwardX * DRIVER_LOOK_AHEAD,
      vehicle.position.y + DRIVER_LOOK_HEIGHT,
      vehicle.position.z + forwardZ * DRIVER_LOOK_AHEAD,
    );
    camera.lookAt(target);
    return;
  }

  const desiredCamera = new THREE.Vector3(
    vehicle.position.x - forwardX * CHASE_DISTANCE,
    vehicle.position.y + CHASE_HEIGHT,
    vehicle.position.z - forwardZ * CHASE_DISTANCE,
  );
  camera.position.lerp(desiredCamera, CHASE_FOLLOW);
  target.set(
    vehicle.position.x,
    vehicle.position.y + CHASE_LOOK_HEIGHT,
    vehicle.position.z,
  );
  camera.lookAt(target);
}

function checkpointRadius(checkpoint: TrackDef["checkpoints"][number]) {
  return Math.max(8, checkpoint.width / 2);
}

function distance2D(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

useGLTF.preload(assets.cars.chassis);
useGLTF.preload(assets.cars.wheel);
useGLTF.preload(assets.cars.steeringWheel);
useGLTF.preload(assets.cars.lowPoly);
