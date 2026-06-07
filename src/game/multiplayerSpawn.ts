import type { TrackDef } from "./track";

export type GridSpawn = {
  position: { x: number; y: number; z: number };
  heading: number;
};

/** Side-by-side grid: even slots on the left, odd on the right, rows staggered back. */
export function getMultiplayerGridSpawn(
  track: TrackDef,
  slotIndex: number,
  _gridSize: number,
): GridSpawn {
  const base = track.spawn;
  const heading = base.heading;
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const forwardX = -Math.sin(heading);
  const forwardZ = -Math.cos(heading);

  const row = Math.floor(slotIndex / 2);
  const lateralSign = slotIndex % 2 === 0 ? -1 : 1;
  const laneSpacing = Math.min(track.roadWidth ?? 18, 24) * 0.22;
  const rowSpacing = 4.2;

  return {
    position: {
      x: base.position.x + rightX * lateralSign * laneSpacing - forwardX * row * rowSpacing,
      y: base.position.y,
      z: base.position.z + rightZ * lateralSign * laneSpacing - forwardZ * row * rowSpacing,
    },
    heading: base.heading,
  };
}

export function sortRoomMembersForGrid<
  T extends { memberId: bigint; identity: { toHexString(): string } },
>(members: readonly T[]): T[] {
  return [...members].sort(
    (a, b) =>
      Number(a.memberId - b.memberId) ||
      a.identity.toHexString().localeCompare(b.identity.toHexString()),
  );
}
