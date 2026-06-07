import type { CarSnapshot } from "./network";
import {
  advanceSnapshot,
  interpolateSnapshot,
} from "./network";

export type TimestampedSnapshot = {
  serverTimeMs: number;
  snapshot: CarSnapshot;
};

/** Render this far behind the newest server snapshot for smooth interpolation. */
export const REMOTE_INTERPOLATION_DELAY_MS = 75;
const MAX_BUFFER = 32;
const MAX_EXTRAPOLATION_MS = 120;
const MAX_EXTRAPOLATION_ALPHA = 1.35;

export class RemoteCarSnapshotBuffer {
  private snapshots: TimestampedSnapshot[] = [];
  private clockOffsetMs = 0;
  private clockOffsetFrozen = false;

  push(snapshot: CarSnapshot, serverTimeMs: number) {
    const localNow = Date.now();
    if (!this.clockOffsetFrozen) {
      if (this.clockOffsetMs === 0) {
        this.clockOffsetMs = localNow - serverTimeMs;
      } else {
        this.clockOffsetMs =
          this.clockOffsetMs * 0.85 + (localNow - serverTimeMs) * 0.15;
      }
    }

    const last = this.snapshots[this.snapshots.length - 1];
    if (last) {
      if (serverTimeMs < last.serverTimeMs) {
        return;
      }
      if (
        serverTimeMs === last.serverTimeMs ||
        (last.snapshot.x === snapshot.x &&
          last.snapshot.z === snapshot.z &&
          last.snapshot.qy === snapshot.qy &&
          last.snapshot.qw === snapshot.qw &&
          serverTimeMs - last.serverTimeMs < 12)
      ) {
        last.snapshot = snapshot;
        last.serverTimeMs = serverTimeMs;
        return;
      }
    }

    this.snapshots.push({ serverTimeMs, snapshot });
    if (this.snapshots.length > MAX_BUFFER) {
      this.snapshots.shift();
    }
  }

  sample(clientNowMs: number = Date.now()): CarSnapshot | null {
    if (this.snapshots.length === 0) return null;

    const serverNow = clientNowMs - this.clockOffsetMs;
    const targetMs = serverNow - REMOTE_INTERPOLATION_DELAY_MS;
    const snaps = this.snapshots;
    const latest = snaps[snaps.length - 1];

    if (snaps.length === 1) {
      const aheadMs = targetMs - latest.serverTimeMs;
      if (aheadMs <= 0) return latest.snapshot;
      return advanceSnapshot(
        latest.snapshot,
        Math.min(aheadMs, MAX_EXTRAPOLATION_MS) / 1000,
      );
    }

    let index = 0;
    while (
      index + 1 < snaps.length &&
      snaps[index + 1].serverTimeMs <= targetMs
    ) {
      index += 1;
    }

    const from = snaps[index];
    const to = snaps[index + 1];

    if (!to) {
      const aheadMs = targetMs - from.serverTimeMs;
      if (aheadMs <= 0) return from.snapshot;
      return advanceSnapshot(
        from.snapshot,
        Math.min(aheadMs, MAX_EXTRAPOLATION_MS) / 1000,
      );
    }

    const span = to.serverTimeMs - from.serverTimeMs;
    if (span <= 0) return to.snapshot;

    const alpha = (targetMs - from.serverTimeMs) / span;
    if (alpha <= 0) return from.snapshot;
    if (alpha >= 1) {
      return extrapolate(from, to, targetMs);
    }

    return interpolateSnapshot(from.snapshot, to.snapshot, alpha);
  }

  reset() {
    this.snapshots.length = 0;
    this.clockOffsetMs = 0;
    this.clockOffsetFrozen = false;
  }

  /** Test helper — freeze client/server clock mapping. */
  setClockOffsetMs(offsetMs: number) {
    this.clockOffsetMs = offsetMs;
    this.clockOffsetFrozen = true;
  }
}

function extrapolate(
  from: TimestampedSnapshot,
  to: TimestampedSnapshot,
  targetMs: number,
): CarSnapshot {
  const span = to.serverTimeMs - from.serverTimeMs;
  if (span <= 0) return to.snapshot;
  const alpha = Math.min(
    MAX_EXTRAPOLATION_ALPHA,
    (targetMs - from.serverTimeMs) / span,
  );
  const blended = interpolateSnapshot(from.snapshot, to.snapshot, alpha);
  const aheadMs = targetMs - to.serverTimeMs;
  if (aheadMs <= 0) return blended;
  return advanceSnapshot(
    blended,
    Math.min(aheadMs, MAX_EXTRAPOLATION_MS) / 1000,
  );
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

export const REMOTE_VISUAL_SMOOTHING = 18;
