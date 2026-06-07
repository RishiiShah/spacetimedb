import * as THREE from "three";
import type { RouteFrameOptions } from "./routeGeometry";
import {
  createRouteRibbonGeometry,
  createRouteShoulderGeometry,
} from "./routeMesh";
import {
  getRouteCurbOuterOffset,
  getRouteShoulderOuterOffset,
  ROAD_SURFACE_Y,
  type Vec3,
} from "./track";

const ROAD_EDGE_Y = ROAD_SURFACE_Y + 0.018;
const ROAD_CURB_Y = ROAD_SURFACE_Y + 0.028;
const ROAD_SHOULDER_Y = ROAD_SURFACE_Y - 0.004;

export type RouteRoadGeometries = {
  asphalt: THREE.BufferGeometry;
  leftEdge: THREE.BufferGeometry;
  rightEdge: THREE.BufferGeometry;
  leftCurb: THREE.BufferGeometry;
  rightCurb: THREE.BufferGeometry;
  leftShoulder?: THREE.BufferGeometry;
  rightShoulder?: THREE.BufferGeometry;
};

export type RouteRoadGeometryOptions = {
  points: Vec3[];
  width: number;
  railHeight?: number;
  showShoulders?: boolean;
  routeLayout?: RouteFrameOptions;
};

export function createRouteRoadGeometries({
  points,
  width,
  railHeight,
  showShoulders = true,
  routeLayout,
}: RouteRoadGeometryOptions): RouteRoadGeometries {
  const shoulderInner = getRouteCurbOuterOffset(width);
  const shoulderOuter = getRouteShoulderOuterOffset(width);

  return {
    asphalt: createRouteRibbonGeometry(
      points,
      width,
      ROAD_SURFACE_Y,
      0,
      routeLayout,
    ),
    leftEdge: createRouteRibbonGeometry(
      points,
      1.35,
      ROAD_EDGE_Y,
      -width / 2 + 1.4,
      routeLayout,
    ),
    rightEdge: createRouteRibbonGeometry(
      points,
      1.35,
      ROAD_EDGE_Y,
      width / 2 - 1.4,
      routeLayout,
    ),
    leftCurb: createRouteRibbonGeometry(
      points,
      2.6,
      ROAD_CURB_Y,
      -width / 2 - 1.3,
      routeLayout,
    ),
    rightCurb: createRouteRibbonGeometry(
      points,
      2.6,
      ROAD_CURB_Y,
      width / 2 + 1.3,
      routeLayout,
    ),
    leftShoulder:
      railHeight && showShoulders
        ? createRouteShoulderGeometry(
            points,
            shoulderInner,
            shoulderOuter,
            -1,
            ROAD_SHOULDER_Y,
            routeLayout,
          )
        : undefined,
    rightShoulder:
      railHeight && showShoulders
        ? createRouteShoulderGeometry(
            points,
            shoulderInner,
            shoulderOuter,
            1,
            ROAD_SHOULDER_Y,
            routeLayout,
          )
        : undefined,
  };
}
