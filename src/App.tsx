import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { reducers, tables } from "./module_bindings";
import { useReducer, useSpacetimeDB, useTable } from "spacetimedb/react";
import { RacingScene, type RacingTelemetry } from "./game/RacingScene";
import type { CarSnapshot } from "./game/network";
import { RenderErrorBoundary } from "./game/RenderErrorBoundary";
import { RaceHud } from "./game/RaceHud";
import type { MinimapRacer } from "./game/Minimap";
import { orderByProgress, type RacerProgress } from "./game/raceStats";
import {
  CARS,
  DEFAULT_CAR_ID,
  DEFAULT_LIVERY_ID,
  LIVERIES,
  getCarById,
  getLiveryById,
} from "./game/driving";
import {
  GAME_MODES,
  getDefaultTrackForMode,
  getModeMeta,
  getTrackById,
  getTracksByMode,
  type GameMode,
  type TrackDef,
} from "./game/track";

const DEFAULT_ROOM = "demo";
const DEFAULT_MODE: GameMode = "circuit";
const DEFAULT_TRACK = getDefaultTrackForMode(DEFAULT_MODE);

function App() {
  const [raceStarted, setRaceStarted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>(DEFAULT_MODE);
  const [selectedTrackId, setSelectedTrackId] = useState(
    DEFAULT_TRACK.id.toString(),
  );
  const [roomSlug, setRoomSlug] = useState(DEFAULT_ROOM);
  const [selectedCarId, setSelectedCarId] = useState(DEFAULT_CAR_ID);
  const [selectedLiveryId, setSelectedLiveryId] = useState(DEFAULT_LIVERY_ID);
  const [displayName, setDisplayName] = useState("");
  const [telemetry, setTelemetry] = useState<RacingTelemetry>({
    speed: 0,
    checkpointIndex: 0,
    elapsedMs: 0,
  });
  const [lastError, setLastError] = useState("");
  const [lapState] = useState<{
    lap: number;
    totalLaps: number;
    bestLapMs?: number;
  }>({ lap: 1, totalLaps: 3 });

  const { identity, isActive: connected } = useSpacetimeDB();
  const setPlayerName = useReducer(reducers.setPlayerName);
  const createRoom = useReducer(reducers.createRoom);
  const joinRoom = useReducer(reducers.joinRoom);
  const leaveRoom = useReducer(reducers.leaveRoom);
  const startRoomRace = useReducer(reducers.startRoomRace);
  const publishCarState = useReducer(reducers.publishCarState);
  const recordCheckpoint = useReducer(reducers.recordCheckpoint);
  const finishLap = useReducer(reducers.finishLap);
  const configureRoom = useReducer(reducers.configureRoom);

  const [players] = useTable(tables.player);
  const [rooms] = useTable(tables.room);
  const [members] = useTable(tables.roomMember);
  const [cars] = useTable(tables.carState);
  const [raceStarts] = useTable(tables.roomRaceStart);
  const [laps] = useTable(tables.lapResult);

  const availableTracks = useMemo(
    () => getTracksByMode(selectedMode),
    [selectedMode],
  );
  const selectedTrack = useMemo(() => {
    const track = getTrackById(selectedTrackId);
    return track.mode === selectedMode
      ? track
      : getDefaultTrackForMode(selectedMode);
  }, [selectedMode, selectedTrackId]);
  const selectedModeMeta = getModeMeta(selectedMode);
  const selectedCar = getCarById(selectedCarId);
  const selectedLivery = getLiveryById(selectedLiveryId);

  const me = useMemo(() => {
    if (!identity) return undefined;
    return players.find((player) => player.identity.isEqual(identity));
  }, [identity, players]);

  const activeMembership = useMemo(() => {
    if (!identity) return undefined;
    return members.find((member) => member.identity.isEqual(identity));
  }, [identity, members]);

  const activeRoom = useMemo(() => {
    if (!activeMembership) return undefined;
    return rooms.find((room) => room.roomId === activeMembership.roomId);
  }, [activeMembership, rooms]);

  const activeRoomMembers = useMemo(() => {
    if (!activeRoom) return [];
    return members.filter((member) => member.roomId === activeRoom.roomId);
  }, [activeRoom, members]);

  const activeRaceStart = useMemo(() => {
    if (!activeRoom) return undefined;
    return raceStarts.find(
      (raceStart) => raceStart.roomId === activeRoom.roomId,
    );
  }, [activeRoom, raceStarts]);

  const isRoomHost = Boolean(
    activeRoom && identity && activeRoom.createdBy.isEqual(identity),
  );
  const canStartRoomRace = activeRoomMembers.length >= 2;

  const sessionTrack = useMemo(
    () => (activeRoom ? getTrackById(activeRoom.trackId) : selectedTrack),
    [activeRoom, selectedTrack],
  );
  const sessionModeMeta = getModeMeta(sessionTrack.mode);

  const roomCars = useMemo(() => {
    if (!activeRoom || !identity) return [];
    return cars.filter(
      (car) =>
        car.roomId === activeRoom.roomId &&
        car.trackId === sessionTrack.id &&
        !car.identity.isEqual(identity),
    );
  }, [activeRoom, cars, identity, sessionTrack.id]);

  const leaderboard = useMemo(() => {
    const nameFor = (lap: (typeof laps)[number]) => {
      const player = players.find((row) => row.identity.isEqual(lap.identity));
      return player?.name || lap.identity.toHexString().slice(0, 8);
    };
    return [...laps]
      .filter(
        (lap) =>
          !activeRoom ||
          (lap.roomId === activeRoom.roomId && lap.trackId === sessionTrack.id),
      )
      .sort((a, b) => Number(a.elapsedMs - b.elapsedMs))
      .slice(0, 8)
      .map((lap) => ({ ...lap, name: nameFor(lap) }));
  }, [activeRoom, laps, players, sessionTrack.id]);

  const setNameIfNeeded = async () => {
    if (displayName.trim()) await setPlayerName({ name: displayName.trim() });
  };

  const createMultiplayerRoom = async () => {
    setLastError("");
    try {
      await setNameIfNeeded();
      await createRoom({ slug: roomSlug, trackId: selectedTrack.id });
      setRaceStarted(false);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  };

  const joinMultiplayerRoom = async () => {
    setLastError("");
    try {
      await setNameIfNeeded();
      await joinRoom({ slug: roomSlug });
      setRaceStarted(false);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  };

  const leaveLobby = async () => {
    if (!activeRoom) return;
    setLastError("");
    try {
      await leaveRoom({ roomId: activeRoom.roomId });
      setRaceStarted(false);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  };

  const startMultiplayerRace = async () => {
    if (!activeRoom) return;
    setLastError("");
    try {
      await startRoomRace({ roomId: activeRoom.roomId });
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  };

  const applyRoomConfig = async (trackId: bigint, lapCount: number) => {
    if (!activeRoom) return;
    setLastError("");
    try {
      await configureRoom({ roomId: activeRoom.roomId, trackId, lapCount });
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  };

  const startRace = () => {
    setLastError("");
    setRaceStarted(true);
  };

  const selectMode = (mode: GameMode) => {
    setSelectedMode(mode);
    setSelectedTrackId(getDefaultTrackForMode(mode).id.toString());
  };

  const onSnapshot = (snapshot: CarSnapshot) => {
    if (!activeRoom) return;
    publishCarState({
      roomId: activeRoom.roomId,
      trackId: sessionTrack.id,
      x: snapshot.x,
      y: snapshot.y,
      z: snapshot.z,
      qx: snapshot.qx,
      qy: snapshot.qy,
      qz: snapshot.qz,
      qw: snapshot.qw,
      speed: snapshot.speed,
      checkpointIndex: snapshot.checkpointIndex,
      runStartedAtMs: BigInt(snapshot.elapsedMs),
    }).catch((error) => {
      setLastError(error instanceof Error ? error.message : String(error));
    });
  };

  const onCheckpoint = (checkpointIndex: number, elapsedMs: number) => {
    if (!activeRoom) return;
    recordCheckpoint({
      roomId: activeRoom.roomId,
      trackId: sessionTrack.id,
      checkpointIndex,
      elapsedMs: BigInt(elapsedMs),
    }).catch((error) => {
      setLastError(error instanceof Error ? error.message : String(error));
    });
  };

  const onFinishLap = (elapsedMs: number, checkpointCount: number) => {
    if (!activeRoom) return;
    finishLap({
      roomId: activeRoom.roomId,
      trackId: sessionTrack.id,
      elapsedMs: BigInt(elapsedMs),
      checkpointCount,
    }).catch((error) => {
      setLastError(error instanceof Error ? error.message : String(error));
    });
  };

  const myName = me?.name || identity?.toHexString().slice(0, 8) || "driver";

  useEffect(() => {
    if (activeRoom && activeRaceStart && !raceStarted) {
      setRaceStarted(true);
    }
  }, [activeRaceStart, activeRoom, raceStarted]);

  if (activeRoom && !raceStarted) {
    return (
      <LobbyScreen
        roomSlug={activeRoom.slug}
        trackName={sessionTrack.name}
        memberCount={activeRoomMembers.length}
        members={activeRoomMembers.map((member) => {
          const player = players.find((row) =>
            row.identity.isEqual(member.identity),
          );
          return {
            key: member.memberId.toString(),
            name: player?.name || member.identity.toHexString().slice(0, 8),
            isHost: activeRoom.createdBy.isEqual(member.identity),
            isMe: Boolean(identity && member.identity.isEqual(identity)),
          };
        })}
        connected={connected}
        isHost={isRoomHost}
        canStart={canStartRoomRace}
        lastError={lastError}
        onStart={() => void startMultiplayerRace()}
        onLeave={() => void leaveLobby()}
        lapCount={activeRoom.lapCount}
        trackId={activeRoom.trackId}
        availableTracks={getTracksByMode("circuit")}
        onConfigure={applyRoomConfig}
      />
    );
  }

  if (!raceStarted) {
    return (
      <main className="home-shell">
        <section className="home-panel">
          <div className="home-hero">
            <div className="hero-copy-block">
              <p className="eyebrow">SpaceTimeDB Multiplayer</p>
              <h1>Spacetime Racer</h1>
              <p className="home-copy">
                Stage the next run with a focused pre-race menu, then launch
                straight into the live WASD session.
              </p>

              <div className="hero-tags" aria-label="Driver briefing">
                <span>Driver briefing</span>
                <span>{selectedCar.name} setup</span>
                <span>{selectedModeMeta.label} session</span>
              </div>
            </div>

            <section
              className="hero-visual"
              aria-labelledby="grid-preview-title"
            >
              <div className="hero-visual-copy">
                <p className="eyebrow">Grid preview</p>
                <h2 id="grid-preview-title">Grid preview</h2>
                <p>
                  A front-row read on the selected route, with the driver and
                  chassis framed as the menu focal point.
                </p>
              </div>

              <div className="hero-illustration" aria-hidden="true">
                <svg viewBox="0 0 520 320" role="presentation">
                  <defs>
                    <linearGradient
                      id="bodyGlow"
                      x1="0%"
                      x2="100%"
                      y1="50%"
                      y2="50%"
                    >
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="50%" stopColor="#facc15" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                    <linearGradient
                      id="visorGlow"
                      x1="0%"
                      x2="100%"
                      y1="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#dbeafe" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>

                  <ellipse
                    cx="278"
                    cy="252"
                    rx="184"
                    ry="26"
                    fill="rgba(15, 23, 32, 0.78)"
                  />
                  <path
                    d="M118 224c22-38 62-66 121-83 10-29 33-49 67-49 24 0 44 10 58 29 23 0 47 9 74 31l38 31-32 13-19 32H109l9-26Z"
                    fill="#101923"
                    stroke="rgba(248,250,252,0.16)"
                    strokeWidth="4"
                  />
                  <path
                    d="M151 210c18-31 52-53 101-67 12-24 31-36 55-36 18 0 33 6 44 18 20 1 40 8 61 25l16 13-21 9-16 29H141l10-21Z"
                    fill="url(#bodyGlow)"
                    opacity="0.92"
                  />
                  <path
                    d="M259 112c15-16 31-24 49-24 19 0 35 7 49 22l8 10-16 13h-80l-17-10Z"
                    fill="#f8fafc"
                    opacity="0.16"
                  />
                  <path
                    d="M252 111c14-15 28-22 44-22 17 0 31 7 44 21l6 9-13 11h-71l-15-9Z"
                    fill="#0f1720"
                  />
                  <path
                    d="M261 112c13-12 24-18 36-18 13 0 24 5 35 17l-4 16h-58Z"
                    fill="url(#visorGlow)"
                  />
                  <circle
                    cx="294"
                    cy="88"
                    r="25"
                    fill="#f8fafc"
                    opacity="0.92"
                  />
                  <path
                    d="M274 82c6-9 12-14 20-14 9 0 16 4 23 13l-3 16h-34Z"
                    fill="#0f1720"
                  />
                  <path
                    d="M174 163h66l25 21h-114Z"
                    fill="rgba(248,250,252,0.16)"
                  />
                  <path
                    d="M118 183h44l-12 17H92Z"
                    fill="#38bdf8"
                    opacity="0.9"
                  />
                  <path
                    d="M383 171h63l31 24h-82Z"
                    fill="#38bdf8"
                    opacity="0.9"
                  />
                  <path d="M203 143h67v14h-84Z" fill="#f8fafc" opacity="0.2" />
                  <path
                    d="M130 221h284"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="4"
                  />
                  <circle cx="184" cy="224" r="34" fill="#020617" />
                  <circle cx="184" cy="224" r="17" fill="#94a3b8" />
                  <circle cx="394" cy="224" r="34" fill="#020617" />
                  <circle cx="394" cy="224" r="17" fill="#94a3b8" />
                  <path
                    d="M94 254h342"
                    stroke="rgba(56,189,248,0.38)"
                    strokeWidth="3"
                  />
                  <path
                    d="M112 266h304"
                    stroke="rgba(249,115,22,0.34)"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="hero-stats" aria-label="Selected run summary">
                <div>
                  <span>Track</span>
                  <strong>{selectedTrack.name}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>{selectedModeMeta.label}</strong>
                </div>
                <div>
                  <span>Room</span>
                  <strong>{roomSlug}</strong>
                </div>
              </div>
            </section>
          </div>

          <div className="home-controls">
            <div className="mode-switch" aria-label="Race mode">
              {GAME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={selectedMode === mode.id}
                  onClick={() => selectMode(mode.id)}
                >
                  <strong>{mode.label}</strong>
                  <span>{mode.summary}</span>
                </button>
              ))}
            </div>

            <label className="home-select">
              Track
              <select
                value={selectedTrack.id.toString()}
                onChange={(event) => setSelectedTrackId(event.target.value)}
              >
                {availableTracks.map((track) => (
                  <option key={track.id.toString()} value={track.id.toString()}>
                    {track.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="home-select">
              Car
              <select
                value={selectedCarId}
                onChange={(event) =>
                  setSelectedCarId(getCarById(event.target.value).id)
                }
              >
                {CARS.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="selected-track">
              <span>{selectedModeMeta.label}</span>
              <strong>{selectedTrack.name}</strong>
              <p>{selectedTrack.summary}</p>
            </div>

            <label className="home-select">
              Livery
              <select
                value={selectedLiveryId}
                onChange={(event) =>
                  setSelectedLiveryId(getLiveryById(event.target.value).id)
                }
              >
                {LIVERIES.map((livery) => (
                  <option key={livery.id} value={livery.id}>
                    {livery.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="selected-track">
              <span>Car</span>
              <strong>{selectedCar.name}</strong>
              <p>{selectedCar.summary}</p>
              <span
                className="livery-swatch"
                aria-label={`Livery: ${selectedLivery.name}`}
                style={{
                  display: "inline-flex",
                  gap: 6,
                  marginTop: 6,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: selectedLivery.body,
                    border: `2px solid ${selectedLivery.accent}`,
                  }}
                />
                {selectedLivery.name}
              </span>
            </div>

            <form
              className="join-form"
              onSubmit={(event) => {
                event.preventDefault();
                void joinMultiplayerRoom();
              }}
            >
              <label>
                Driver
                <input
                  value={displayName}
                  placeholder={myName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <label>
                Room
                <input
                  value={roomSlug}
                  onChange={(event) => setRoomSlug(event.target.value)}
                />
              </label>
              <div className="room-actions">
                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => void createMultiplayerRoom()}
                >
                  {connected ? "Create room" : "Connecting"}
                </button>
                <button type="submit" disabled={!connected}>
                  {connected ? "Join room" : "Connecting"}
                </button>
              </div>
            </form>

            <button className="start-button" type="button" onClick={startRace}>
              Start race
            </button>

            {lastError && <p className="error">{lastError}</p>}
          </div>
        </section>
      </main>
    );
  }

  const minimapRacers: MinimapRacer[] = [
    {
      id: "me",
      x: telemetry.x ?? sessionTrack.spawn.position.x,
      z: telemetry.z ?? sessionTrack.spawn.position.z,
      color: selectedLivery.body,
      isMe: true,
    },
    ...roomCars.map((car) => ({
      id: car.identity.toHexString(),
      x: car.x,
      z: car.z,
      color: "#38bdf8",
      isMe: false,
    })),
  ];

  const racerProgress: RacerProgress[] = [
    {
      id: "me",
      name: myName,
      lap: lapState.lap,
      checkpointIndex: telemetry.checkpointIndex,
      distanceToNext: 0,
      bestLapMs: lapState.bestLapMs,
    },
    ...roomCars.map((car) => {
      const player = players.find((p) => p.identity.isEqual(car.identity));
      return {
        id: car.identity.toHexString(),
        name: player?.name || car.identity.toHexString().slice(0, 8),
        lap: 0,
        checkpointIndex: car.checkpointIndex,
        distanceToNext: 0,
      };
    }),
  ];

  const standings = orderByProgress(racerProgress).map((r, i) => ({
    id: r.id,
    name: r.name,
    gapLabel: i === 0 ? "Leader" : `-${standingsCheckpointGap(racerProgress, r)} CP`,
  }));

  return (
    <main className="app-shell race-shell">
      <section className="stage stage-full">
        <RenderErrorBoundary>
          <RacingScene
            localIdentity={identity?.toHexString() || "offline-preview"}
            roomId={activeRoom?.roomId}
            trackId={sessionTrack.id}
            carId={selectedCarId}
            liveryId={selectedLiveryId}
            remoteCars={roomCars}
            onSnapshot={onSnapshot}
            onCheckpoint={onCheckpoint}
            onFinishLap={onFinishLap}
            onTelemetry={setTelemetry}
          />
        </RenderErrorBoundary>
        <RaceHud
          speedKmh={telemetry.speed * 3.6}
          gear={Math.max(1, Math.min(7, Math.ceil(Math.abs(telemetry.speed) / 10)))}
          lap={lapState.lap}
          totalLaps={lapState.totalLaps}
          currentLapMs={telemetry.elapsedMs}
          bestLapMs={lapState.bestLapMs}
          routePoints={sessionTrack.routePoints}
          minimapRacers={minimapRacers}
          standings={standings}
          onLeaveRoom={() => void leaveLobby()}
        />
        <p className="hint">
          Press R to Reset, C for Camera, Space for Handbrake
        </p>
        <ol className="leaderboard sr-only" aria-label="Lap records">
          {leaderboard.map((lap) => (
            <li key={lap.lapId.toString()}>
              <span>{lap.name}</span>
              <strong>{formatMs(Number(lap.elapsedMs))}</strong>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function LobbyScreen({
  roomSlug,
  trackName,
  memberCount,
  members,
  connected,
  isHost,
  canStart,
  lastError,
  onStart,
  onLeave,
  lapCount,
  trackId,
  availableTracks,
  onConfigure,
}: {
  roomSlug: string;
  trackName: string;
  memberCount: number;
  members: { key: string; name: string; isHost: boolean; isMe: boolean }[];
  connected: boolean;
  isHost: boolean;
  canStart: boolean;
  lastError: string;
  onStart: () => void;
  onLeave: () => void;
  lapCount: number;
  trackId: bigint;
  availableTracks: TrackDef[];
  onConfigure: (trackId: bigint, lapCount: number) => void;
}) {
  return (
    <main className="lobby-shell">
      <section className="lobby-panel" aria-label="Room lobby">
        <div className="lobby-header">
          <div>
            <p className="eyebrow">Lobby waiting</p>
            <h1>Room {roomSlug}</h1>
          </div>
          <button className="secondary-button" type="button" onClick={onLeave}>
            Leave lobby
          </button>
        </div>

        <div className="hud-grid">
          <Metric label="Track" value={trackName} />
          <Metric label="Drivers" value={memberCount.toString()} />
          <Metric label="Host" value={isHost ? "You" : "Waiting"} />
          <Metric label="Status" value={canStart ? "Ready" : "Need 2"} />
        </div>

        <section className="driver-panel" aria-label="Lobby drivers">
          <h2>Drivers</h2>
          <div className="lobby-driver-list">
            {members.map((member) => (
              <div key={member.key} className="lobby-driver">
                <span>{member.name}</span>
                <strong>
                  {member.isHost ? "Host" : "Driver"}
                  {member.isMe ? " / You" : ""}
                </strong>
              </div>
            ))}
          </div>
        </section>

        {isHost && (
          <section className="lobby-settings">
            <label>
              Map
              <select
                value={trackId.toString()}
                onChange={(e) => onConfigure(BigInt(e.target.value), lapCount)}
              >
                {availableTracks.map((t) => (
                  <option key={t.id.toString()} value={t.id.toString()}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Laps
              <select
                value={lapCount}
                onChange={(e) => onConfigure(trackId, Number(e.target.value))}
              >
                {[1, 2, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        {isHost ? (
          <button
            className="start-button"
            type="button"
            disabled={!connected || !canStart}
            onClick={onStart}
          >
            Start race
          </button>
        ) : (
          <p className="lobby-waiting">Waiting for the host to start.</p>
        )}

        {lastError && <p className="error">{lastError}</p>}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMs(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(2, "0")}`;
}

function standingsCheckpointGap(all: RacerProgress[], r: RacerProgress) {
  const leader = [...all].sort((a, b) => b.checkpointIndex - a.checkpointIndex)[0];
  return Math.max(0, leader.checkpointIndex - r.checkpointIndex);
}

export default App;
