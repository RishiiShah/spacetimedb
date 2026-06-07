import * as THREE from "three";
import type { CarId } from "./driving";
import { LOWPOLY_FRONT_WHEEL_NODE_NAMES } from "./driving";

export type DriverCameraAnchorSpec = {
  /** GLB node to anchor from. Omit to use a fixed rig-local position. */
  node?: string;
  /** Fixed position in the car rig's local space (meters). */
  position?: [number, number, number];
  /** Extra offset in rig-local space after resolving the anchor. */
  offset: [number, number, number];
};

export type CarDriverCameraMap = {
  fov: number;
  eye: DriverCameraAnchorSpec;
  lookAt: DriverCameraAnchorSpec;
  /** GLB mesh names kept visible in driver view. */
  visibleNodes: readonly string[];
};

export const CAR_DRIVER_CAMERA_MAPS: Record<CarId, CarDriverCameraMap> = {
  lowpoly: {
    fov: 74,
    eye: {
      node: "SteeringWheel_02",
      offset: [0, 0.14, -0.28],
    },
    lookAt: {
      node: "Front_Spoiler",
      offset: [0, -0.08, 0.35],
    },
    visibleNodes: [
      "SteeringWheel_02",
      "Main_body.COmmiting",
      "FrontWheels_bar",
      "Front_Wing3",
      "Front_Wing2.001",
      "Front_Spoiler",
      "Wheel_Holder",
      "Wheel_Holder.002",
      "intake",
      "intake2",
      ...LOWPOLY_FRONT_WHEEL_NODE_NAMES,
    ],
  },
  "open-wheel": {
    fov: 70,
    eye: {
      position: [0, 0.92, 0.14],
      offset: [0, 0, 0],
    },
    lookAt: {
      position: [0, 0.55, 2.4],
      offset: [0, 0, 0],
    },
    visibleNodes: [],
  },
};

export function getCarDriverCameraMap(carId: CarId | undefined) {
  return CAR_DRIVER_CAMERA_MAPS[carId ?? "lowpoly"];
}

export function resolveDriverAnchorInRig(
  rigRoot: THREE.Object3D,
  modelRoot: THREE.Object3D | null,
  spec: DriverCameraAnchorSpec,
  target: THREE.Vector3,
) {
  if (spec.node && modelRoot) {
    const node = modelRoot.getObjectByName(spec.node);
    if (node) {
      node.updateWorldMatrix(true, false);
      node.getWorldPosition(target);
      rigRoot.worldToLocal(target);
      target.x += spec.offset[0];
      target.y += spec.offset[1];
      target.z += spec.offset[2];
      return true;
    }
  }

  if (spec.position) {
    target.set(spec.position[0], spec.position[1], spec.position[2]);
    target.x += spec.offset[0];
    target.y += spec.offset[1];
    target.z += spec.offset[2];
    return true;
  }

  return false;
}

export function syncDriverCameraAnchors(
  rigRoot: THREE.Object3D,
  modelRoot: THREE.Object3D | null,
  map: CarDriverCameraMap,
  eye: THREE.Object3D,
  lookAt: THREE.Object3D,
) {
  rigRoot.updateWorldMatrix(true, true);
  const eyePoint = new THREE.Vector3();
  const lookPoint = new THREE.Vector3();
  const eyeOk = resolveDriverAnchorInRig(rigRoot, modelRoot, map.eye, eyePoint);
  const lookOk = resolveDriverAnchorInRig(
    rigRoot,
    modelRoot,
    map.lookAt,
    lookPoint,
  );
  if (!eyeOk || !lookOk) return false;

  eye.position.copy(eyePoint);
  lookAt.position.copy(lookPoint);
  return true;
}

export function applyDriverCamera(
  camera: THREE.Camera,
  eye: THREE.Object3D,
  lookAt: THREE.Object3D,
  fov: number,
  target: THREE.Vector3,
) {
  if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  eye.updateWorldMatrix(true, false);
  lookAt.updateWorldMatrix(true, false);
  eye.getWorldPosition(target);
  camera.position.copy(target);
  lookAt.getWorldPosition(target);
  camera.lookAt(target);
}

export function isDriverVisibleNode(
  carId: CarId | undefined,
  nodeName: string,
  chaseView: boolean,
) {
  if (chaseView) return true;
  return getCarDriverCameraMap(carId).visibleNodes.includes(nodeName);
}
