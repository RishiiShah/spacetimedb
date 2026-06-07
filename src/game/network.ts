export type SnapshotInput = {
  identity: string;
  roomId: number;
  trackId: number;
  position: { x: number; y: number; z: number };
  heading: number;
  speed: number;
  checkpointIndex: number;
  elapsedMs: number;
};

export type CarSnapshot = {
  identity: string;
  roomId: number;
  trackId: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  speed: number;
  checkpointIndex: number;
  elapsedMs: number;
};

export function createSnapshot(input: SnapshotInput): CarSnapshot {
  // The renderer orients cars with rotation.y = -heading (see RacingScene), so
  // the broadcast quaternion encodes -heading to keep remote cars consistent.
  const halfYaw = -input.heading / 2;

  return {
    identity: input.identity,
    roomId: input.roomId,
    trackId: input.trackId,
    x: input.position.x,
    y: input.position.y,
    z: input.position.z,
    qx: 0,
    qy: Math.sin(halfYaw),
    qz: 0,
    qw: Math.cos(halfYaw),
    speed: input.speed,
    checkpointIndex: input.checkpointIndex,
    elapsedMs: input.elapsedMs,
  };
}

export function headingFromSnapshot(snapshot: CarSnapshot): number {
  return -2 * Math.atan2(snapshot.qy, snapshot.qw);
}

/** Predict motion between network updates using last published speed + heading. */
export function advanceSnapshot(
  snapshot: CarSnapshot,
  dtSeconds: number,
): CarSnapshot {
  if (dtSeconds <= 0) return snapshot;
  const heading = headingFromSnapshot(snapshot);
  return {
    ...snapshot,
    x: snapshot.x + Math.sin(heading) * snapshot.speed * dtSeconds,
    z: snapshot.z - Math.cos(heading) * snapshot.speed * dtSeconds,
  };
}

export function interpolateSnapshot(
  from: CarSnapshot,
  to: CarSnapshot,
  alpha: number,
): CarSnapshot {
  const t = clamp(alpha, 0, 1);
  const [qx, qy, qz, qw] = slerpQuat(from, to, t);

  return {
    ...to,
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    z: lerp(from.z, to.z, t),
    qx,
    qy,
    qz,
    qw,
    speed: lerp(from.speed, to.speed, t),
  };
}

function slerpQuat(
  from: Pick<CarSnapshot, "qx" | "qy" | "qz" | "qw">,
  to: Pick<CarSnapshot, "qx" | "qy" | "qz" | "qw">,
  t: number,
): [number, number, number, number] {
  const ax = from.qx;
  const ay = from.qy;
  const az = from.qz;
  const aw = from.qw;
  let bx = to.qx;
  let by = to.qy;
  let bz = to.qz;
  let bw = to.qw;

  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }

  if (dot > 0.9995) {
    const rx = ax + t * (bx - ax);
    const ry = ay + t * (by - ay);
    const rz = az + t * (bz - az);
    const rw = aw + t * (bw - aw);
    const len = Math.hypot(rx, ry, rz, rw) || 1;
    return [rx / len, ry / len, rz / len, rw / len];
  }

  const theta = Math.acos(Math.min(1, dot));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return [
    ax * wa + bx * wb,
    ay * wa + by * wb,
    az * wa + bz * wb,
    aw * wa + bw * wb,
  ];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
