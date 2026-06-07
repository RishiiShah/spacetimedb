import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, useGLTF } from "@react-three/drei";
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
  CAR_SUSPENSION_LINKS,
  CAR_WHEEL_SPECS,
  CAR_VISUAL_MAX_STEER_YAW,
  LIVERY_ACCENT_MATERIAL,
  LIVERY_BODY_MATERIAL,
  type CarId,
  type CarSuspensionLink,
  type CarWheelSpec,
  drivingActionFromKeyboardEvent,
  getCarVisualGroundOffset,
  getLiveryById,
  inputFromDrivingActions,
  LOWPOLY_FRONT_WHEEL_NODE_NAMES,
  lowPolyWheelSteerYaw,
  visualWheelSteerYaw,
} from "./driving";
import { createSnapshot, type CarSnapshot } from "./network";
import {
  carStateToSnapshot,
  normalizeCarId,
  RemoteCarSnapshotBuffer,
  REMOTE_VISUAL_SMOOTHING,
} from "./remoteCarBuffer";
import { RaceAudioController } from "./raceAudio";
import {
  type StuntCarVisualState,
  updateStuntCarVisual,
} from "./stuntMotion";
import { GROUND_PLANE_Y, getTrackById, type TrackDef } from "./track";
import {
  createVehicleAtTrackReset,
  resolveVehicleObstacleCollisions,
  stepVehicle,
  type VehicleInput,
  type VehicleState,
} from "./vehicle";
import { updateCamera } from "./racingCamera";
import { CircuitTrackAssets } from "./CircuitTrack";
import { useResolvedTrackRoute } from "./resolvedTrackRoute";
import { RACING_RENDER_SETTINGS } from "./racingRenderSettings";
import type { RacingTelemetry } from "./racingTelemetry";
import {
  CityPlacedAsset,
  StyledRouteTrack,
} from "./RouteTrackVisuals";
import { StuntTrackAssets } from "./StuntTrack";
import {
  CITY_GROUND_COLOR,
  PRACTICE_GROUND_COLOR,
  trackHasCityBuildings,
} from "./trackScenery";
import type { CarState } from "../module_bindings/types";

type RacingSceneProps = {
  localIdentity: string;
  roomId?: bigint;
  trackId?: bigint;
  carId?: CarId;
  liveryId?: string;
  racing?: boolean;
  goMs?: number;
  gridSlot?: number;
  gridSize?: number;
  remoteCars: CarState[];
  onSnapshot: (snapshot: CarSnapshot) => void;
  onCheckpoint: (checkpointIndex: number, elapsedMs: number) => void;
  onFinishLap: (elapsedMs: number, checkpointCount: number) => void;
  onTelemetry: (telemetry: RacingTelemetry) => void;
  onLoaded?: () => void;
};

export function RacingScene(props: RacingSceneProps) {
  return (
    <Canvas
      className="racing-canvas"
      shadows
      camera={{ position: [0, 12, 34], fov: 58 }}
      dpr={RACING_RENDER_SETTINGS.dpr}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
      }}
    >
      <color attach="background" args={["#8aaec5"]} />
      <fog attach="fog" args={["#8aaec5", 180, 980]} />
      <ambientLight intensity={0.38} />
      <hemisphereLight color="#dcecff" groundColor="#6f8466" intensity={0.78} />
      <directionalLight
        castShadow
        intensity={2.1}
        position={[80, 120, 48]}
        shadow-mapSize={RACING_RENDER_SETTINGS.shadowMapSize}
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
  racing = true,
  goMs,
  gridSlot,
  gridSize = 1,
  remoteCars,
  onSnapshot,
  onCheckpoint,
  onFinishLap,
  onTelemetry,
  onLoaded,
}: RacingSceneProps) {
  const livery = getLiveryById(liveryId);
  const currentTrack = useMemo(() => getTrackById(trackId), [trackId]);
  const physicsTrack = useResolvedTrackRoute(currentTrack);
  const inputRef = useRef<VehicleInput>({
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
  });
  const vehicleRef = useRef<VehicleState>(
    createVehicleAtTrackReset(
      currentTrack,
      undefined,
      roomId !== undefined && gridSlot !== undefined
        ? { slotIndex: gridSlot, gridSize }
        : undefined,
    ),
  );
  const localCarRef = useRef<THREE.Group>(null);
  const stuntVisualRef = useRef<StuntCarVisualState>({
    pitch: 0,
    roll: 0,
    y: currentTrack.spawn.position.y + getCarVisualGroundOffset(carId),
  });
  const localSteerRef = useRef(0);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const lastPublishRef = useRef(0);
  const startMsRef = useRef(performance.now());
  const nextCheckpointRef = useRef(0);
  const awaitingFinishRef = useRef(false);
  const audioRef = useRef<RaceAudioController | null>(null);
  const [cameraMode, setCameraMode] = useState<"chase" | "driver">("chase");
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  useEffect(() => {
    onLoadedRef.current?.();
  }, []);

  const carGroundOffset = getCarVisualGroundOffset(carId);
  const wasRacingRef = useRef(racing);

  const syncCarVisual = () => {
    if (!localCarRef.current) return;
    localCarRef.current.position.x = vehicleRef.current.position.x;
    localCarRef.current.position.z = vehicleRef.current.position.z;
    localCarRef.current.rotation.y = -vehicleRef.current.heading;
    if (currentTrack.stuntArena) {
      stuntVisualRef.current.y =
        vehicleRef.current.position.y + carGroundOffset;
    } else {
      localCarRef.current.position.y =
        vehicleRef.current.position.y + carGroundOffset;
    }
  };

  const resetVehicle = (
    checkpointIndex?: number,
    useGrid = false,
    track: TrackDef = physicsTrack,
  ) => {
    const grid =
      useGrid && roomId !== undefined && gridSlot !== undefined
        ? { slotIndex: gridSlot, gridSize }
        : undefined;
    vehicleRef.current = createVehicleAtTrackReset(track, checkpointIndex, grid);
    if (currentTrack.stuntArena) {
      stuntVisualRef.current.pitch = 0;
      stuntVisualRef.current.roll = 0;
      stuntVisualRef.current.y =
        vehicleRef.current.position.y + carGroundOffset;
    }
    syncCarVisual();
  };

  const resolvedRouteSignature = useMemo(() => {
    if (!physicsTrack.routePoints?.length) return null;
    return `${physicsTrack.slug}:${physicsTrack.routePoints.length}:${physicsTrack.roadWidth ?? 0}`;
  }, [physicsTrack]);

  useEffect(() => {
    startMsRef.current = performance.now();
    nextCheckpointRef.current = 0;
    awaitingFinishRef.current = false;
    resetVehicle(
      undefined,
      roomId !== undefined && gridSlot !== undefined,
      currentTrack,
    );
  }, [currentTrack, roomId, gridSlot, gridSize]);

  useEffect(() => {
    if (!resolvedRouteSignature || currentTrack.routePoints?.length) return;
    resetVehicle(
      undefined,
      roomId !== undefined && gridSlot !== undefined,
      physicsTrack,
    );
  }, [resolvedRouteSignature, roomId, gridSlot, gridSize]);

  useEffect(() => {
    if (racing && !wasRacingRef.current && roomId !== undefined) {
      resetVehicle(undefined, gridSlot !== undefined);
      startMsRef.current = performance.now();
    }
    wasRacingRef.current = racing;
  }, [racing, roomId, gridSlot, gridSize]);

  useEffect(() => {
    const audio = new RaceAudioController();
    audioRef.current = audio;

    const tryStartCountdown = () => {
      if (goMs === undefined) return;
      void audio.unlock().then((ready) => {
        if (ready && !audio.hasStartedCountdown()) {
          audio.startCountdown(goMs);
        }
      });
    };

    void audio.preload().then(tryStartCountdown);

    const onUnlock = () => tryStartCountdown();
    window.addEventListener("keydown", onUnlock, { once: true });
    window.addEventListener("pointerdown", onUnlock, { once: true });

    return () => {
      window.removeEventListener("keydown", onUnlock);
      audio.dispose();
      audioRef.current = null;
    };
  }, [currentTrack.id, goMs]);

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
    const now = Date.now();
    const activeInput = racing
      ? inputRef.current
      : { throttle: 0, brake: 0, steer: 0, handbrake: true };
    const vehicle = resolveVehicleObstacleCollisions(
      stepVehicle(vehicleRef.current, activeInput, delta, physicsTrack),
      remoteCars.map((car) => ({
        x: car.x,
        z: car.z,
        // A car that has not started its run (still at spawn) or whose snapshot
        // is older than 2s is a phantom — do not collide with it.
        active:
          racing &&
          car.runStartedAtMs !== 0n &&
          now - Number(car.updatedAt.toDate().getTime()) < 2000,
      })),
    );
    vehicleRef.current = vehicle;
    localSteerRef.current = vehicle.steer;

    if (localCarRef.current) {
      localCarRef.current.position.x = vehicle.position.x;
      localCarRef.current.position.z = vehicle.position.z;
      localCarRef.current.rotation.y = -vehicle.heading;

      if (currentTrack.stuntArena) {
        updateStuntCarVisual(
          localCarRef.current,
          vehicle.position.y,
          vehicle.heading,
          currentTrack.stuntArena,
          carGroundOffset,
          stuntVisualRef.current,
          delta,
          vehicle.position.x,
          vehicle.position.z,
        );
      } else {
        localCarRef.current.position.y = vehicle.position.y + carGroundOffset;
        localCarRef.current.rotation.x = 0;
        localCarRef.current.rotation.z = 0;
      }
    }

    updateCamera(
      camera,
      cameraTargetRef.current,
      vehicle,
      cameraMode,
      Boolean(currentTrack.stuntArena),
    );

    if (!racing) startMsRef.current = performance.now();
    const elapsedMs = Math.max(
      0,
      Math.floor(performance.now() - startMsRef.current),
    );
    const nextCheckpoint = currentTrack.stuntArena?.freeRoam
      ? undefined
      : currentTrack.checkpoints[nextCheckpointRef.current];
    if (
      !awaitingFinishRef.current &&
      nextCheckpoint &&
      distance2D(vehicle.position, nextCheckpoint.position) <=
        checkpointRadius(nextCheckpoint)
    ) {
      audioRef.current?.playCheckpoint();
      onCheckpoint(nextCheckpoint.index, elapsedMs);
      nextCheckpointRef.current += 1;
      if (nextCheckpointRef.current >= currentTrack.checkpoints.length) {
        // All checkpoints hit; the lap only completes once the car returns
        // across the start/finish line at spawn.
        awaitingFinishRef.current = true;
      }
    }

    if (
      !currentTrack.stuntArena?.freeRoam &&
      awaitingFinishRef.current &&
      distance2D(vehicle.position, currentTrack.spawn.position) <=
        FINISH_LINE_RADIUS
    ) {
      audioRef.current?.playLap();
      onFinishLap(elapsedMs, currentTrack.checkpoints.length);
      startMsRef.current = performance.now();
      nextCheckpointRef.current = 0;
      awaitingFinishRef.current = false;
    }

    onTelemetry({
      speed: Math.max(0, vehicle.speed),
      checkpointIndex: nextCheckpointRef.current,
      elapsedMs,
      cameraMode,
      x: vehicle.position.x,
      z: vehicle.position.z,
    });

    audioRef.current?.updateDriving({
      speed: vehicle.speed,
      throttle: inputRef.current.throttle,
      brake: inputRef.current.brake,
      steer: vehicle.steer,
      handbrake: Boolean(inputRef.current.handbrake),
    });

    if (
      roomId &&
      trackId &&
      clock.elapsedTime - lastPublishRef.current > 0.033
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
          currentTrack.spawn.position.y + carGroundOffset,
          currentTrack.spawn.position.z,
        ]}
      >
        <CarModel
          carId={carId}
          body={livery.body}
          accent={livery.accent}
          steerRef={localSteerRef}
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
  if (track.mode === "stunt") return <StuntTrackAssets track={track} />;
  if (track.circuitMapPath) return <CircuitTrackAssets track={track} />;

  return <CityTrackAssets track={track} />;
}

function CarModel({
  carId,
  body,
  accent,
  steerRef,
  view = "chase",
}: {
  carId?: CarId;
  body: string;
  accent: string;
  steerRef?: MutableRefObject<number>;
  view?: "chase" | "driver";
}) {
  if (carId === "lowpoly") return <LowPolyCar body={body} steerRef={steerRef} />;
  return (
    <CircuitCar body={body} accent={accent} steerRef={steerRef} view={view} />
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

// The low-poly F1 is authored Z-up, Y-forward, so it is uprighted into our Y-up
// world and scaled to match the previous car's footprint (~4.6m long). Ground
// offset is on the car group. Wheels and steering wheel are separate nodes.
const LOWPOLY_SCALE = 0.8;
const LOWPOLY_UPRIGHT_X = -Math.PI / 2;
// The cockpit steering wheel node. It is an identity-rotated child authored
// Z-up, so it spins about its local Y (the steering-column / forward axis).
const LOWPOLY_STEERING_WHEEL_NODE = "SteeringWheel_02";
// Radians the steering wheel turns at full lock. Larger than the road-wheel
// deflection so the cockpit wheel reads as clearly turning.
const LOWPOLY_STEERING_WHEEL_MAX_SPIN = 0.85;

function LowPolyCar({
  body,
  steerRef,
}: {
  body: string;
  steerRef?: MutableRefObject<number>;
}) {
  const scene = usePreparedModel(
    assets.cars.lowPoly,
    RACING_RENDER_SETTINGS.carCastShadow,
    RACING_RENDER_SETTINGS.carReceiveShadow,
    true,
  );
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

  // Resolve the front road wheels and the cockpit steering wheel so they can
  // deflect with steering. All are identity-rotated children of an identity
  // root, so the upright (-90deg about X) maps their local Z to world-up:
  // yaw the road wheels about local Z, and spin the steering wheel about
  // local Y (the column axis).
  const steerNodes = useMemo(() => {
    const frontWheels = LOWPOLY_FRONT_WHEEL_NODE_NAMES.map((name) =>
      tinted.getObjectByName(name),
    ).filter((node): node is THREE.Object3D => Boolean(node));
    const steeringWheel = tinted.getObjectByName(LOWPOLY_STEERING_WHEEL_NODE);
    return { frontWheels, steeringWheel };
  }, [tinted]);

  useFrame(() => {
    const steer = steerRef?.current ?? 0;
    // Negated so the wheels deflect toward the turn (positive steer = right).
    for (const wheel of steerNodes.frontWheels) {
      wheel.rotation.z = -lowPolyWheelSteerYaw(wheel.name, steer);
    }
    if (steerNodes.steeringWheel) {
      steerNodes.steeringWheel.rotation.y =
        -THREE.MathUtils.clamp(steer, -1, 1) * LOWPOLY_STEERING_WHEEL_MAX_SPIN;
    }
  });

  return (
    <group rotation-x={LOWPOLY_UPRIGHT_X} scale={LOWPOLY_SCALE}>
      <primitive object={tinted} />
    </group>
  );
}

function CircuitCar({
  body,
  accent,
  steerRef,
  view = "chase",
}: {
  body: string;
  accent: string;
  steerRef?: MutableRefObject<number>;
  view?: "chase" | "driver";
}) {
  const rawChassis = usePreparedModel(
    assets.cars.chassis,
    RACING_RENDER_SETTINGS.carCastShadow,
    RACING_RENDER_SETTINGS.carReceiveShadow,
    true,
  );
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
  const wheelScene = usePreparedModel(
    assets.cars.wheel,
    RACING_RENDER_SETTINGS.carCastShadow,
    RACING_RENDER_SETTINGS.carReceiveShadow,
    true,
  );
  const steeringWheelScene = usePreparedModel(
    assets.cars.steeringWheel,
    RACING_RENDER_SETTINGS.carCastShadow,
    RACING_RENDER_SETTINGS.carReceiveShadow,
    true,
  );
  const wheelGroupsRef = useRef(new Map<CarWheelSpec["id"], THREE.Group>());
  const steeringWheelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    // Negated so the visible wheels and steering wheel deflect toward the turn
    // direction (the chassis is mounted with a 180deg yaw offset).
    const steerYaw = visualWheelSteerYaw(-(steerRef?.current ?? 0));
    for (const wheel of CAR_WHEEL_SPECS) {
      const group = wheelGroupsRef.current.get(wheel.id);
      if (group) group.rotation.y = isFrontWheel(wheel) ? steerYaw : 0;
    }
    if (steeringWheelRef.current) {
      steeringWheelRef.current.rotation.z =
        -(steerYaw / CAR_VISUAL_MAX_STEER_YAW) * 0.85;
    }
  });

  return (
    <group scale={0.9} rotation-y={CAR_MODEL_FORWARD_YAW_OFFSET}>
      <primitive object={chassisScene} scale={0.85} />
      {/* You don't see yourself from the cockpit; passengers only show in chase. */}
      {view === "chase" && <DriverFigure />}
      {/* The steering wheel only reads from inside the car. */}
      {view === "driver" && (
        <group
          ref={steeringWheelRef}
          position={[0, 0.82, 0.36]}
          rotation={[Math.PI * 0.08, 0, 0]}
          scale={0.42}
        >
          <primitive object={steeringWheelScene} />
        </group>
      )}
      {CAR_SUSPENSION_LINKS.map((link) => (
        <SuspensionLink key={link.id} link={link} />
      ))}
      {CAR_WHEEL_SPECS.map((wheel) => (
        <group
          key={wheel.id}
          ref={(group) => {
            if (group) wheelGroupsRef.current.set(wheel.id, group);
            else wheelGroupsRef.current.delete(wheel.id);
          }}
          position={wheel.position}
        >
          <mesh
            castShadow={RACING_RENDER_SETTINGS.carCastShadow}
            position={[wheel.position[0] * -0.14, 0.02, 0]}
          >
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color="#050505" roughness={0.75} />
          </mesh>
          <primitive object={wheelScene.clone()} scale={0.85} />
        </group>
      ))}
      <mesh
        castShadow={RACING_RENDER_SETTINGS.carCastShadow}
        position={[0, 0.6, 0]}
      >
        <boxGeometry args={[1.8, 0.28, 3.2]} />
        <meshStandardMaterial color={body} transparent opacity={0.18} />
      </mesh>
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
      <mesh
        castShadow={RACING_RENDER_SETTINGS.carCastShadow}
        position={[0, 0.24, -0.08]}
        scale={[0.34, 0.42, 0.32]}
      >
        <capsuleGeometry args={[0.32, 0.38, 4, 8]} />
        <meshStandardMaterial color="#111827" roughness={0.7} />
      </mesh>
      <mesh
        castShadow={RACING_RENDER_SETTINGS.carCastShadow}
        position={[0, 0.78, 0.06]}
      >
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.55} />
      </mesh>
      <mesh
        castShadow={RACING_RENDER_SETTINGS.carCastShadow}
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
          castShadow={RACING_RENDER_SETTINGS.carCastShadow}
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
      castShadow={RACING_RENDER_SETTINGS.carCastShadow}
      receiveShadow={RACING_RENDER_SETTINGS.carReceiveShadow}
      position={transform.position}
      quaternion={transform.quaternion}
    >
      <cylinderGeometry args={[0.035, 0.035, transform.length, 8]} />
      <meshStandardMaterial color="#050505" roughness={0.82} />
    </mesh>
  );
}

function RemoteCar({ car }: { car: CarState }) {
  const groupRef = useRef<THREE.Group>(null);
  const bufferRef = useRef(new RemoteCarSnapshotBuffer());
  const initializedRef = useRef(false);

  const carId = normalizeCarId(car.carId);
  const livery = getLiveryById(car.liveryId);
  const groundOffset = getCarVisualGroundOffset(carId);
  const serverTimeMs = car.updatedAt.toDate().getTime();

  useEffect(() => {
    bufferRef.current.push(carStateToSnapshot(car), serverTimeMs);
  }, [
    car.x,
    car.y,
    car.z,
    car.qx,
    car.qy,
    car.qz,
    car.qw,
    car.speed,
    car.checkpointIndex,
    serverTimeMs,
  ]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const sampled = bufferRef.current.sample();
    if (!sampled) return;

    const targetPosition = new THREE.Vector3(
      sampled.x,
      sampled.y + groundOffset,
      sampled.z,
    );
    const targetQuaternion = new THREE.Quaternion(
      sampled.qx,
      sampled.qy,
      sampled.qz,
      sampled.qw,
    );

    if (!initializedRef.current) {
      group.position.copy(targetPosition);
      group.quaternion.copy(targetQuaternion);
      initializedRef.current = true;
      return;
    }

    const blend = 1 - Math.exp(-REMOTE_VISUAL_SMOOTHING * delta);
    group.position.lerp(targetPosition, blend);
    group.quaternion.slerp(targetQuaternion, blend);
  });

  return (
    <group ref={groupRef}>
      <CarModel carId={carId} body={livery.body} accent={livery.accent} />
    </group>
  );
}

function CityTrackAssets({ track }: { track: TrackDef }) {
  const isPractice = track.mode === "practice";
  const roadWidth = track.roadWidth ?? 34;
  const showCityBuildings = trackHasCityBuildings(track);

  return (
    <>
      <mesh
        receiveShadow
        rotation-x={-Math.PI / 2}
        position={[0, GROUND_PLANE_Y, 0]}
      >
        <planeGeometry args={isPractice ? [720, 520] : [1120, 760]} />
        <meshStandardMaterial
          color={isPractice ? PRACTICE_GROUND_COLOR : CITY_GROUND_COLOR}
          roughness={0.98}
        />
      </mesh>

      {track.routePoints && (
        <StyledRouteTrack
          points={track.routePoints}
          roadWidth={roadWidth}
          railOffset={track.railOffset}
          railHeight={track.railHeight}
          railColor={track.railColor}
          spawn={isPractice ? undefined : track.spawn}
          showRaceProps={!isPractice}
          showRouteDetails={showCityBuildings && Boolean(track.railHeight)}
        />
      )}

      {showCityBuildings &&
        track.placements.map((placement, index) => (
          <CityPlacedAsset
            key={`${placement.assetId}-${index}`}
            placement={placement}
          />
        ))}
    </>
  );
}

// Route visuals live in RouteTrackVisuals.tsx and routeMesh.ts.


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

// How close to the spawn (start/finish) line counts as crossing it to complete
// a lap. Roughly half the road width so any line crossing triggers it.
const FINISH_LINE_RADIUS = 24;

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
