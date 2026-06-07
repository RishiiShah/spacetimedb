import { Group, Object3D, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  applyDriverCamera,
  getCarDriverCameraMap,
  resolveDriverAnchorInRig,
  syncDriverCameraAnchors,
} from "./carDriverRig";

describe("car driver camera rig", () => {
  it("maps low-poly anchors from steering wheel and front spoiler nodes", () => {
    const rig = new Group();
    const model = new Group();
    const wheel = new Object3D();
    wheel.name = "SteeringWheel_02";
    wheel.position.set(0, 0.55, 0.22);
    const nose = new Object3D();
    nose.name = "Front_Spoiler";
    nose.position.set(0, 0.18, 1.05);
    model.add(wheel, nose);
    rig.add(model);

    const eye = new Object3D();
    const lookAt = new Object3D();
    rig.add(eye, lookAt);

    const ok = syncDriverCameraAnchors(
      rig,
      model,
      getCarDriverCameraMap("lowpoly"),
      eye,
      lookAt,
    );

    expect(ok).toBe(true);
    expect(eye.position.y).toBeGreaterThan(wheel.position.y);
    expect(eye.position.z).toBeLessThan(wheel.position.z);
    expect(lookAt.position.z).toBeGreaterThan(nose.position.z);
  });

  it("uses fixed rig positions for the open-wheel car", () => {
    const rig = new Group();
    const point = new Vector3();
    const map = getCarDriverCameraMap("open-wheel");

    expect(
      resolveDriverAnchorInRig(rig, null, map.eye, point),
    ).toBe(true);
    expect(point.toArray()).toEqual(map.eye.position);
  });

  it("places the camera at the eye anchor world position", () => {
    const rig = new Group();
    rig.position.set(4, 0, -2);
    const eye = new Object3D();
    eye.position.set(0, 1, 0.5);
    const lookAt = new Object3D();
    lookAt.position.set(0, 0.6, 2);
    rig.add(eye, lookAt);

    const camera = new PerspectiveCamera();
    const target = new Vector3();
    applyDriverCamera(camera, eye, lookAt, 74, target);

    expect(camera.position.x).toBeCloseTo(4);
    expect(camera.position.y).toBeCloseTo(1);
    expect(camera.position.z).toBeCloseTo(-1.5);
  });
});
