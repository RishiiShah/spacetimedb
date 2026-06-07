import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const reducerMock = vi.fn(async () => undefined);
const setPlayerNameMock = vi.fn(async () => undefined);
const createRoomMock = vi.fn(async () => undefined);
const joinRoomMock = vi.fn(async () => undefined);
const leaveRoomMock = vi.fn(async () => undefined);
const startRoomRaceMock = vi.fn(async () => undefined);
const localIdentity = {
  isEqual: (other: unknown) => other === localIdentity,
  toHexString: () => "localdriver000000",
};
let mockTables: unknown[][] = [];
let mockTableIndex = 0;
let mockReducerIndex = 0;
const reducerMocks = [
  setPlayerNameMock,
  createRoomMock,
  joinRoomMock,
  leaveRoomMock,
  startRoomRaceMock,
  reducerMock,
  reducerMock,
  reducerMock,
  reducerMock,
  reducerMock,
  reducerMock,
  reducerMock,
];

vi.mock("spacetimedb/react", () => ({
  useSpacetimeDB: () => ({
    identity: localIdentity,
    isActive: true,
  }),
  useReducer: () => reducerMocks[mockReducerIndex++ % reducerMocks.length],
  useTable: () => [mockTables[mockTableIndex++ % 7] ?? []],
}));

vi.mock("./game/RetroGridMenuScene", () => ({
  RetroGridMenuScene: () => <div data-testid="retro-menu-scene" />,
}));

vi.mock("./game/RacingScene", () => ({
  RacingScene: ({
    trackId,
    remoteCars,
  }: {
    trackId?: bigint;
    remoteCars?: unknown[];
  }) => (
    <div
      data-testid="racing-scene"
      data-track-id={trackId?.toString() ?? "none"}
      data-remote-count={remoteCars?.length.toString() ?? "0"}
    />
  ),
}));

describe("App start flow", () => {
  beforeEach(() => {
    reducerMock.mockClear();
    setPlayerNameMock.mockClear();
    createRoomMock.mockClear();
    joinRoomMock.mockClear();
    leaveRoomMock.mockClear();
    startRoomRaceMock.mockClear();
    mockTables = [];
    mockTableIndex = 0;
    mockReducerIndex = 0;
  });

  it("opens on a mode and track home screen before mounting the race", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /spacetime racer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /grid preview/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/driver briefing/i)).toBeInTheDocument();
    expect(screen.getByText(/veloce lp setup/i)).toBeInTheDocument();
    expect(
      screen.getByText(/full-body f1 with rear wing/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /circuit/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /stunt/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /practice/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start race/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("racing-scene")).not.toBeInTheDocument();
  });

  it("mounts the selected race after Start", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /start race/i }));

    expect(screen.getByTestId("racing-scene")).toHaveAttribute(
      "data-track-id",
      "1",
    );
    expect(screen.getByText(/press r to reset/i)).toBeInTheDocument();
  });

  it("lets the user start the Stunt mode track", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /stunt/i }));
    await user.click(screen.getByRole("button", { name: /start race/i }));

    expect(screen.getByTestId("racing-scene")).toHaveAttribute(
      "data-track-id",
      "2",
    );
  });

  it("lets the user start the flat practice track", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /practice/i }));
    await user.click(screen.getByRole("button", { name: /start race/i }));

    expect(screen.getByTestId("racing-scene")).toHaveAttribute(
      "data-track-id",
      "3",
    );
  });

  it("creates multiplayer rooms with the selected track", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /stunt/i }));
    await user.click(screen.getByRole("button", { name: /^options$/i }));
    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(createRoomMock).toHaveBeenCalledWith({ slug: "demo", trackId: 2n });
    expect(joinRoomMock).not.toHaveBeenCalled();
  });

  it("joins existing multiplayer rooms without changing their track", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /stunt/i }));
    await user.click(screen.getByRole("button", { name: /^options$/i }));
    await user.click(screen.getByRole("button", { name: /^join room$/i }));

    expect(joinRoomMock).toHaveBeenCalledWith({ slug: "demo" });
    expect(createRoomMock).not.toHaveBeenCalled();
  });

  it("uses the room track once multiplayer membership exists", async () => {
    mockTables = [
      [],
      [
        {
          roomId: 7n,
          slug: "demo",
          trackId: 2n,
          createdBy: localIdentity,
          createdAt: {},
        },
      ],
      [
        {
          memberId: 1n,
          roomId: 7n,
          identity: localIdentity,
          joinedAt: {},
          ready: true,
        },
      ],
      [],
      [{ roomId: 7n, startedBy: localIdentity, startedAtMs: 1n }],
      [],
    ];

    render(<App />);

    expect(await screen.findByTestId("racing-scene")).toHaveAttribute(
      "data-track-id",
      "2",
    );
  });

  it("renders only remote cars on the active room track", async () => {
    const remoteIdentityA = {
      isEqual: (other: unknown) => other === remoteIdentityA,
      toHexString: () => "remote-a",
    };
    const remoteIdentityB = {
      isEqual: (other: unknown) => other === remoteIdentityB,
      toHexString: () => "remote-b",
    };
    mockTables = [
      [],
      [
        {
          roomId: 7n,
          slug: "demo",
          trackId: 2n,
          createdBy: localIdentity,
          createdAt: {},
        },
      ],
      [
        {
          memberId: 1n,
          roomId: 7n,
          identity: localIdentity,
          joinedAt: {},
          ready: true,
        },
      ],
      [
        { roomId: 7n, trackId: 2n, identity: remoteIdentityA },
        { roomId: 7n, trackId: 1n, identity: remoteIdentityB },
      ],
      [{ roomId: 7n, startedBy: localIdentity, startedAtMs: 1n }],
      [],
    ];

    render(<App />);

    expect(await screen.findByTestId("racing-scene")).toHaveAttribute(
      "data-remote-count",
      "1",
    );
  });

  it("shows the lobby after room membership exists", () => {
    mockTables = [
      [],
      [
        {
          roomId: 7n,
          slug: "demo",
          trackId: 2n,
          createdBy: localIdentity,
          createdAt: {},
        },
      ],
      [
        {
          memberId: 1n,
          roomId: 7n,
          identity: localIdentity,
          joinedAt: {},
          ready: true,
        },
        {
          memberId: 2n,
          roomId: 7n,
          identity: {
            isEqual: () => false,
            toHexString: () => "remote-driver",
          },
          joinedAt: {},
          ready: true,
        },
      ],
      [],
      [],
      [],
    ];

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /room demo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/lobby waiting/i)).toBeInTheDocument();
    expect(screen.getByText(/localdri/i)).toBeInTheDocument();
  });

  it("lets only the room host start the multiplayer race", async () => {
    const user = userEvent.setup();
    mockTables = [
      [],
      [
        {
          roomId: 7n,
          slug: "demo",
          trackId: 2n,
          createdBy: localIdentity,
          createdAt: {},
        },
      ],
      [
        {
          memberId: 1n,
          roomId: 7n,
          identity: localIdentity,
          joinedAt: {},
          ready: true,
        },
        {
          memberId: 2n,
          roomId: 7n,
          identity: {
            isEqual: () => false,
            toHexString: () => "remote-driver",
          },
          joinedAt: {},
          ready: true,
        },
      ],
      [],
      [],
      [],
    ];

    render(<App />);

    await user.click(screen.getByRole("button", { name: /start race/i }));

    expect(startRoomRaceMock).toHaveBeenCalledWith({ roomId: 7n });
  });

  it("does not show start controls to non-host lobby members", () => {
    const remoteHost = {
      isEqual: (other: unknown) => other === remoteHost,
      toHexString: () => "remote-host",
    };
    mockTables = [
      [],
      [
        {
          roomId: 7n,
          slug: "demo",
          trackId: 2n,
          createdBy: remoteHost,
          createdAt: {},
        },
      ],
      [
        {
          memberId: 1n,
          roomId: 7n,
          identity: localIdentity,
          joinedAt: {},
          ready: true,
        },
        {
          memberId: 2n,
          roomId: 7n,
          identity: remoteHost,
          joinedAt: {},
          ready: true,
        },
      ],
      [],
      [],
      [],
    ];

    render(<App />);

    expect(
      screen.queryByRole("button", { name: /start race/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it("lets lobby members leave", async () => {
    const user = userEvent.setup();
    mockTables = [
      [],
      [
        {
          roomId: 7n,
          slug: "demo",
          trackId: 2n,
          createdBy: localIdentity,
          createdAt: {},
        },
      ],
      [
        {
          memberId: 1n,
          roomId: 7n,
          identity: localIdentity,
          joinedAt: {},
          ready: true,
        },
      ],
      [],
      [],
      [],
    ];

    render(<App />);

    await user.click(screen.getByRole("button", { name: /leave lobby/i }));

    expect(leaveRoomMock).toHaveBeenCalledWith({ roomId: 7n });
  });

  it("starts the shared room race when a race-start row exists", async () => {
    mockTables = [
      [],
      [
        {
          roomId: 7n,
          slug: "demo",
          trackId: 2n,
          createdBy: localIdentity,
          createdAt: {},
        },
      ],
      [
        {
          memberId: 1n,
          roomId: 7n,
          identity: localIdentity,
          joinedAt: {},
          ready: true,
        },
      ],
      [],
      [{ roomId: 7n, startedBy: localIdentity, startedAtMs: 1n }],
      [],
    ];

    render(<App />);

    expect(await screen.findByTestId("racing-scene")).toHaveAttribute(
      "data-track-id",
      "2",
    );
  });
});
