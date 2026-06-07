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

export function interpolateSnapshot(
  from: CarSnapshot,
  to: CarSnapshot,
  alpha: number
): CarSnapshot {
  const t = clamp(alpha, 0, 1);

  return {
    ...to,
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    z: lerp(from.z, to.z, t),
    qx: lerp(from.qx, to.qx, t),
    qy: lerp(from.qy, to.qy, t),
    qz: lerp(from.qz, to.qz, t),
    qw: lerp(from.qw, to.qw, t),
    speed: lerp(from.speed, to.speed, t),
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
