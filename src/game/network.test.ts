import { describe, expect, it } from 'vitest';
import { createSnapshot, interpolateSnapshot } from './network';

describe('network snapshots', () => {
  it('creates a compact transform snapshot', () => {
    const snapshot = createSnapshot({
      identity: 'player-a',
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

  it('interpolates positions between snapshots', () => {
    const a = createSnapshot({
      identity: 'player-a',
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

  it('clamps interpolation alpha', () => {
    const a = createSnapshot({
      identity: 'player-a',
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
});
