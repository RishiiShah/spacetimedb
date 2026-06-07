import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const reducerMock = vi.fn(async () => undefined);

vi.mock("spacetimedb/react", () => ({
  useSpacetimeDB: () => ({
    identity: {
      isEqual: () => false,
      toHexString: () => "localdriver000000",
    },
    isActive: true,
  }),
  useReducer: () => reducerMock,
  useTable: () => [[]],
}));

vi.mock("./game/RacingScene", () => ({
  RacingScene: ({ trackId }: { trackId?: bigint }) => (
    <div
      data-testid="racing-scene"
      data-track-id={trackId?.toString() ?? "none"}
    />
  ),
}));

describe("App start flow", () => {
  beforeEach(() => {
    reducerMock.mockClear();
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
    expect(screen.getByText(/open-wheel setup/i)).toBeInTheDocument();
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
});
