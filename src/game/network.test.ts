import { describe, expect, it } from "vitest";
import { createSnapshot, interpolateSnapshot, advanceSnapshot } from "./network";
import {
  RemoteCarSnapshotBuffer,
  REMOTE_INTERPOLATION_DELAY_MS,
} from "./remoteCarBuffer";

describe("network snapshots", () => {
  it("creates a compact transform snapshot", () => {
    const snapshot = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 1, y: 2, z: 3 },
      heading: Math.PI / 2,
      speed: 42,
      checkpointIndex: 2,
      elapsedMs: 1234,
    });

    expect(snapshot.qy).toBeLessThan(-0.7);
    expect(snapshot.qw).toBeLessThan(0.8);
    expect(snapshot.speed).toBe(42);
  });

  it("interpolates positions between snapshots", () => {
    const a = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 10,
      checkpointIndex: 0,
      elapsedMs: 0,
    });
    const b = { ...a, x: 10, z: -10, elapsedMs: 1000 };

    const mid = interpolateSnapshot(a, b, 0.5);

    expect(mid.x).toBe(5);
    expect(mid.z).toBe(-5);
  });

  it("clamps interpolation alpha", () => {
    const a = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      checkpointIndex: 0,
      elapsedMs: 0,
    });
    const b = { ...a, x: 10 };

    expect(interpolateSnapshot(a, b, -1).x).toBe(0);
    expect(interpolateSnapshot(a, b, 2).x).toBe(10);
  });

  it("slerps rotation instead of lerping quaternion components", () => {
    const a = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      checkpointIndex: 0,
      elapsedMs: 0,
    });
    const b = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 0, y: 0, z: 0 },
      heading: Math.PI / 2,
      speed: 0,
      checkpointIndex: 0,
      elapsedMs: 50,
    });

    const mid = interpolateSnapshot(a, b, 0.5);
    const length = Math.hypot(mid.qx, mid.qy, mid.qz, mid.qw);

    expect(length).toBeCloseTo(1, 5);
    expect(Math.abs(mid.qy)).toBeGreaterThan(0.3);
  });
});

describe("RemoteCarSnapshotBuffer", () => {
  it("interpolates between buffered snapshots at a render delay", () => {
    const buffer = new RemoteCarSnapshotBuffer();
    const a = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      checkpointIndex: 0,
      elapsedMs: 0,
    });
    const b = { ...a, x: 10, z: 10 };

    buffer.setClockOffsetMs(0);
    buffer.push(a, 1000);
    buffer.push(b, 1200);

    const mid = buffer.sample(1050 + REMOTE_INTERPOLATION_DELAY_MS);
    expect(mid?.x).toBeCloseTo(2.5, 1);
  });

  it("dead-reckons briefly when the render clock runs ahead", () => {
    const buffer = new RemoteCarSnapshotBuffer();
    const snapshot = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 20,
      checkpointIndex: 0,
      elapsedMs: 0,
    });

    buffer.setClockOffsetMs(0);
    buffer.push(snapshot, 1000);

    const ahead = buffer.sample(1300 + REMOTE_INTERPOLATION_DELAY_MS);
    expect(ahead?.z).toBeLessThan(0);
  });
});

describe("advanceSnapshot", () => {
  it("moves forward using speed and heading", () => {
    const snapshot = createSnapshot({
      identity: "player-a",
      roomId: 1,
      trackId: 1,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 10,
      checkpointIndex: 0,
      elapsedMs: 0,
    });

    const next = advanceSnapshot(snapshot, 1);
    expect(next.z).toBeCloseTo(-10, 5);
  });
});
