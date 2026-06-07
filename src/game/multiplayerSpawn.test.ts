import { describe, expect, it } from "vitest";
import { cityLoopV1Track } from "./track";
import {
  getMultiplayerGridSpawn,
  sortRoomMembersForGrid,
} from "./multiplayerSpawn";

describe("getMultiplayerGridSpawn", () => {
  it("offsets slot 0 and slot 1 laterally from the base spawn", () => {
    const left = getMultiplayerGridSpawn(cityLoopV1Track, 0, 2);
    const right = getMultiplayerGridSpawn(cityLoopV1Track, 1, 2);

    expect(left.position).not.toEqual(right.position);
    expect(left.heading).toBe(cityLoopV1Track.spawn.heading);
    expect(right.heading).toBe(cityLoopV1Track.spawn.heading);
  });

  it("staggers row 1 behind row 0", () => {
    const row0 = getMultiplayerGridSpawn(cityLoopV1Track, 0, 4);
    const row1 = getMultiplayerGridSpawn(cityLoopV1Track, 2, 4);

    const heading = cityLoopV1Track.spawn.heading;
    const forwardX = -Math.sin(heading);
    const forwardZ = -Math.cos(heading);
    const deltaX = row1.position.x - row0.position.x;
    const deltaZ = row1.position.z - row0.position.z;
    const alongForward = deltaX * forwardX + deltaZ * forwardZ;

    expect(alongForward).toBeLessThan(-3);
  });
});

describe("sortRoomMembersForGrid", () => {
  it("orders by memberId then identity hex", () => {
    const members = sortRoomMembersForGrid([
      { memberId: 2n, identity: { toHexString: () => "b" } },
      { memberId: 1n, identity: { toHexString: () => "z" } },
      { memberId: 1n, identity: { toHexString: () => "a" } },
    ]);

    expect(members.map((m) => m.memberId)).toEqual([1n, 1n, 2n]);
    expect(members[0].identity.toHexString()).toBe("a");
  });
});
