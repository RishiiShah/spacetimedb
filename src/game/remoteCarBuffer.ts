import type { CarSnapshot } from "./network";
import { interpolateSnapshot } from "./network";

export type TimestampedSnapshot = {
  receivedAtMs: number;
  snapshot: CarSnapshot;
};

/** Render this far behind the newest snapshot for smooth interpolation. */
export const REMOTE_INTERPOLATION_DELAY_MS = 100;
const MAX_BUFFER = 24;
const MAX_EXTRAPOLATION_ALPHA = 1.35;

export class RemoteCarSnapshotBuffer {
  private snapshots: TimestampedSnapshot[] = [];

  push(snapshot: CarSnapshot, receivedAtMs: number) {
    const last = this.snapshots[this.snapshots.length - 1];
    if (
      last &&
      last.snapshot.x === snapshot.x &&
      last.snapshot.z === snapshot.z &&
      last.snapshot.qy === snapshot.qy &&
      last.snapshot.qw === snapshot.qw &&
      receivedAtMs - last.receivedAtMs < 8
    ) {
      return;
    }

    this.snapshots.push({ receivedAtMs, snapshot });
    if (this.snapshots.length > MAX_BUFFER) {
      this.snapshots.shift();
    }
  }

  sample(nowMs: number): CarSnapshot | null {
    if (this.snapshots.length === 0) return null;
    if (this.snapshots.length === 1) {
      return this.snapshots[0].snapshot;
    }

    const targetMs = nowMs - REMOTE_INTERPOLATION_DELAY_MS;
    const snaps = this.snapshots;

    let index = 0;
    while (
      index + 1 < snaps.length &&
      snaps[index + 1].receivedAtMs <= targetMs
    ) {
      index += 1;
    }

    const from = snaps[index];
    const to = snaps[index + 1];

    if (!to) {
      if (index === 0) return from.snapshot;
      return extrapolate(snaps[index - 1], from, targetMs);
    }

    const span = to.receivedAtMs - from.receivedAtMs;
    if (span <= 0) return to.snapshot;

    const alpha = (targetMs - from.receivedAtMs) / span;
    if (alpha <= 0) return from.snapshot;
    if (alpha >= 1) {
      return extrapolate(from, to, targetMs);
    }

    return interpolateSnapshot(from.snapshot, to.snapshot, alpha);
  }

  reset() {
    this.snapshots.length = 0;
  }
}

function extrapolate(
  from: TimestampedSnapshot,
  to: TimestampedSnapshot,
  targetMs: number,
): CarSnapshot {
  const span = to.receivedAtMs - from.receivedAtMs;
  if (span <= 0) return to.snapshot;
  const alpha = Math.min(
    MAX_EXTRAPOLATION_ALPHA,
    (targetMs - from.receivedAtMs) / span,
  );
  return interpolateSnapshot(from.snapshot, to.snapshot, alpha);
}

export function carStateToSnapshot(car: {
  identity: { toHexString(): string };
  roomId: bigint;
  trackId: bigint;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  speed: number;
  checkpointIndex: number;
  runStartedAtMs: bigint;
}): CarSnapshot {
  return {
    identity: car.identity.toHexString(),
    roomId: Number(car.roomId),
    trackId: Number(car.trackId),
    x: car.x,
    y: car.y,
    z: car.z,
    qx: car.qx,
    qy: car.qy,
    qz: car.qz,
    qw: car.qw,
    speed: car.speed,
    checkpointIndex: car.checkpointIndex,
    elapsedMs: Number(car.runStartedAtMs),
  };
}

export function normalizeCarId(
  value: string | undefined,
): import("./driving").CarId {
  return value === "open-wheel" ? "open-wheel" : "lowpoly";
}
