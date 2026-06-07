import * as THREE from "three";
import type { VehicleState } from "./vehicle";

const CHASE_DISTANCE = 6;
const CHASE_HEIGHT = 3.87;
const CHASE_LOOK_HEIGHT = 1.6;
const CHASE_FOV = 58;
const CHASE_FOLLOW = 0.2;
const CHASE_FOLLOW_STUNT = 0.14;
const CHASE_HEIGHT_STUNT = 4.35;
const DRIVER_BACK = 0.45;
const DRIVER_HEIGHT = 1.18;
const DRIVER_LOOK_AHEAD = 14;
const DRIVER_LOOK_HEIGHT = 0.65;
const DRIVER_FOV = 72;
const DRIVER_FOV_MAX = 80;
const DRIVER_SPEED_REF = 72;
const DRIVER_MAX_LEAN = 0.06;
const REVERSE_VIEW_SPEED = -2;
const REVERSE_CAM_DISTANCE = 7;
const REVERSE_CAM_HEIGHT = 3.4;
const REVERSE_CAM_LOOK_HEIGHT = 1.2;

export function updateCamera(
  camera: THREE.Camera,
  target: THREE.Vector3,
  vehicle: VehicleState,
  mode: "chase" | "driver",
  stuntMode = false,
) {
  const forwardX = Math.sin(vehicle.heading);
  const forwardZ = -Math.cos(vehicle.heading);

  const speedFraction = Math.min(
    Math.abs(vehicle.speed) / DRIVER_SPEED_REF,
    1,
  );

  if (vehicle.speed < REVERSE_VIEW_SPEED) {
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== CHASE_FOV) {
      camera.fov = CHASE_FOV;
      camera.updateProjectionMatrix();
    }
    const desired = new THREE.Vector3(
      vehicle.position.x + forwardX * REVERSE_CAM_DISTANCE,
      vehicle.position.y + REVERSE_CAM_HEIGHT,
      vehicle.position.z + forwardZ * REVERSE_CAM_DISTANCE,
    );
    camera.position.lerp(desired, CHASE_FOLLOW);
    target.set(
      vehicle.position.x,
      vehicle.position.y + REVERSE_CAM_LOOK_HEIGHT,
      vehicle.position.z,
    );
    camera.lookAt(target);
    return;
  }

  if (camera instanceof THREE.PerspectiveCamera) {
    const desiredFov =
      mode === "driver"
        ? DRIVER_FOV + (DRIVER_FOV_MAX - DRIVER_FOV) * speedFraction
        : CHASE_FOV;
    if (camera.fov !== desiredFov) {
      camera.fov = desiredFov;
      camera.updateProjectionMatrix();
    }
  }

  if (mode === "driver") {
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
    camera.rotateZ(vehicle.steer * speedFraction * DRIVER_MAX_LEAN);
    return;
  }

  const chaseHeight = stuntMode ? CHASE_HEIGHT_STUNT : CHASE_HEIGHT;
  const chaseFollow = stuntMode ? CHASE_FOLLOW_STUNT : CHASE_FOLLOW;
  const desiredCamera = new THREE.Vector3(
    vehicle.position.x - forwardX * CHASE_DISTANCE,
    vehicle.position.y + chaseHeight,
    vehicle.position.z - forwardZ * CHASE_DISTANCE,
  );
  camera.position.lerp(desiredCamera, chaseFollow);
  target.set(
    vehicle.position.x,
    vehicle.position.y + CHASE_LOOK_HEIGHT,
    vehicle.position.z,
  );
  camera.lookAt(target);
}
