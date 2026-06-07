import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { reducers, tables } from "./module_bindings";
import { countdownPhase } from "./game/countdown";
import { useReducer, useSpacetimeDB, useTable } from "spacetimedb/react";
import { RetroGridHomeScreen } from "./game/RetroGridHomeScreen";
import { RacingScene } from "./game/RacingScene";
import type { RacingTelemetry } from "./game/racingTelemetry";
import type { CarSnapshot } from "./game/network";
import { RenderErrorBoundary } from "./game/RenderErrorBoundary";
import { RaceHud } from "./game/RaceHud";
import { orderResults } from "./game/results";
import type { MinimapRacer } from "./game/Minimap";
import { orderByProgress, type RacerProgress } from "./game/raceStats";
import {
  DEFAULT_CAR_ID,
  DEFAULT_LIVERY_ID,
  getCarById,
  getLiveryById,
} from "./game/driving";
import {
  getDefaultTrackForMode,
  getModeMeta,
  getTrackById,
  getTracksByMode,
  type GameMode,
  type TrackDef,
} from "./game/track";
import { sortRoomMembersForGrid } from "./game/multiplayerSpawn";
import { useResolvedTrackRoute } from "./game/resolvedTrackRoute";
import {
  redirectHomeFromRaceRefresh,
  screenFromPath,
  syncAppPath,
} from "./game/appNavigation";

const DEFAULT_ROOM = "demo";
const DEFAULT_MODE: GameMode = "circuit";
const DEFAULT_TRACK = getDefaultTrackForMode(DEFAULT_MODE);

const redirectedFromRaceRefresh = redirectHomeFromRaceRefresh();

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
  const [preferHome, setPreferHome] = useState(redirectedFromRaceRefresh);
  const [lapState, setLapState] = useState<{
    lap: number;
    totalLaps: number;
    bestLapMs?: number;
  }>({ lap: 1, totalLaps: 3 });

  const userExitedRaceRef = useRef(redirectedFromRaceRefresh);

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
  const markLoaded = useReducer(reducers.markLoaded);
  const beginCountdown = useReducer(reducers.beginCountdown);
  const resetRoomRace = useReducer(reducers.resetRoomRace);

  const [players] = useTable(tables.player);
  const [rooms] = useTable(tables.room);
  const [myMembershipRows] = useTable(
    identity
      ? tables.roomMember.where((member) => member.identity.eq(identity))
      : tables.roomMember.where((member) => member.roomId.eq(0n)),
  );
  const myRoomId = myMembershipRows[0]?.roomId ?? 0n;
  const [roomMembers] = useTable(
    tables.roomMember.where((member) => member.roomId.eq(myRoomId)),
  );
  // car_state / lap_result are the high-volume tables; scope their subscription
  // to the active room so the roomId btree index is used instead of a full
  // sequential scan. roomId 0n never matches (autoInc starts at 1), so outside a
  // room these stay empty.
  const roomIdForSub = myRoomId;
  const [cars] = useTable(
    tables.carState.where((r) => r.roomId.eq(roomIdForSub)),
  );
  const [raceStarts] = useTable(tables.roomRaceStart);
  const [laps] = useTable(
    tables.lapResult.where((r) => r.roomId.eq(roomIdForSub)),
  );
  const [countdowns] = useTable(tables.roomCountdown);

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

  const activeMembership = myMembershipRows[0];

  const activeRoom = useMemo(() => {
    if (!activeMembership) return undefined;
    return rooms.find((room) => room.roomId === activeMembership.roomId);
  }, [activeMembership, rooms]);

  const activeRoomMembers = roomMembers;

  const activeRaceStart = useMemo(() => {
    if (!activeRoom) return undefined;
    return raceStarts.find(
      (raceStart) => raceStart.roomId === activeRoom.roomId,
    );
  }, [activeRoom, raceStarts]);

  const activeCountdown = useMemo(
    () =>
      activeRoom
        ? countdowns.find((c) => c.roomId === activeRoom.roomId)
        : undefined,
    [activeRoom, countdowns],
  );
  const goMs = activeCountdown ? Number(activeCountdown.startsAtMs) : undefined;
  const startMs = activeCountdown
    ? Number(activeCountdown.startedAtMs)
    : undefined;
  const isMultiplayer = Boolean(activeRoom);
  const racing = !isMultiplayer || (goMs !== undefined && Date.now() >= goMs);

  const isRoomHost = Boolean(
    activeRoom && identity && activeRoom.createdBy.isEqual(identity),
  );
  const canStartRoomRace = activeRoomMembers.length >= 1;

  const sessionTrack = useMemo(
    () => (activeRoom ? getTrackById(activeRoom.trackId) : selectedTrack),
    [activeRoom, selectedTrack],
  );
  const resolvedSessionTrack = useResolvedTrackRoute(sessionTrack);
  const roomCars = useMemo(() => {
    if (!activeRoom || !identity) return [];
    return cars.filter(
      (car) =>
        car.roomId === activeRoom.roomId &&
        car.trackId === sessionTrack.id &&
        !car.identity.isEqual(identity),
    );
  }, [activeRoom, cars, identity, sessionTrack.id]);

  const sortedRoomMembers = useMemo(
    () => sortRoomMembersForGrid(activeRoomMembers),
    [activeRoomMembers],
  );
  const myGridSlot = useMemo(() => {
    if (!identity || !activeRoom) return 0;
    const slot = sortedRoomMembers.findIndex((member) =>
      member.identity.isEqual(identity),
    );
    return slot >= 0 ? slot : 0;
  }, [sortedRoomMembers, identity, activeRoom]);
  const gridSize = Math.max(1, sortedRoomMembers.length);

  const setNameIfNeeded = async () => {
    if (displayName.trim()) await setPlayerName({ name: displayName.trim() });
  };

  const createMultiplayerRoom = async () => {
    setLastError("");
    userExitedRaceRef.current = false;
    setPreferHome(false);
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
    userExitedRaceRef.current = false;
    setPreferHome(false);
    try {
      await setNameIfNeeded();
      await joinRoom({ slug: roomSlug });
      setRaceStarted(false);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  };

  const exitRace = async () => {
    userExitedRaceRef.current = true;
    setLastError("");
    setRaceStarted(false);
    setPreferHome(true);
    syncAppPath("home");
    if (!activeRoom) return;
    try {
      await leaveRoom({ roomId: activeRoom.roomId });
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  };

  const leaveLobby = () => void exitRace();

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
    userExitedRaceRef.current = false;
    setPreferHome(false);
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
      carId: selectedCarId,
      liveryId: selectedLiveryId,
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
    setLapState((prev) => ({
      ...prev,
      lap: prev.lap + 1,
      bestLapMs: prev.bestLapMs
        ? Math.min(prev.bestLapMs, elapsedMs)
        : elapsedMs,
    }));
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

  // Reset the lap counter from the room's configured lap count when entering a
  // race. Solo sessions keep the default of 3.
  useEffect(() => {
    setLapState({
      lap: 1,
      totalLaps: activeRoom?.lapCount ?? 3,
      bestLapMs: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.roomId, raceStarted]);

  // A player is finished once they complete the configured number of laps.
  const finished = lapState.lap > lapState.totalLaps;

  const resultRows = useMemo(() => {
    if (!activeRoom) return [];
    const byId = new Map<
      string,
      { name: string; lapsDone: number; totalMs: number; bestLapMs?: number }
    >();
    for (const lap of laps) {
      if (lap.roomId !== activeRoom.roomId || lap.trackId !== sessionTrack.id)
        continue;
      const key = lap.identity.toHexString();
      const player = players.find((p) => p.identity.isEqual(lap.identity));
      const cur = byId.get(key) ?? {
        name: player?.name || key.slice(0, 8),
        lapsDone: 0,
        totalMs: 0,
        bestLapMs: undefined as number | undefined,
      };
      cur.lapsDone += 1;
      cur.totalMs += Number(lap.elapsedMs);
      cur.bestLapMs = cur.bestLapMs
        ? Math.min(cur.bestLapMs, Number(lap.elapsedMs))
        : Number(lap.elapsedMs);
      byId.set(key, cur);
    }
    return orderResults([...byId.entries()].map(([id, v]) => ({ id, ...v })));
  }, [activeRoom, laps, players, sessionTrack.id]);

  const returnToLobby = async () => {
    if (activeRoom && isRoomHost) {
      try {
        await resetRoomRace({ roomId: activeRoom.roomId });
      } catch (error) {
        setLastError(error instanceof Error ? error.message : String(error));
      }
    }
    setPreferHome(false);
    setRaceStarted(false);
  };

  const myName = me?.name || identity?.toHexString().slice(0, 8) || "driver";

  useEffect(() => {
    if (!activeRoom && preferHome) {
      setPreferHome(false);
    }
  }, [activeRoom, preferHome]);

  useEffect(() => {
    if (preferHome) {
      syncAppPath("home");
      return;
    }
    if (raceStarted) {
      syncAppPath("race");
      return;
    }
    if (activeRoom) {
      syncAppPath("lobby", activeRoom.slug);
    } else {
      syncAppPath("home");
    }
  }, [preferHome, raceStarted, activeRoom?.slug, activeRoom]);

  useEffect(() => {
    const onPopState = () => {
      if (screenFromPath(window.location.pathname) === "home") {
        setPreferHome(true);
        setRaceStarted(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (userExitedRaceRef.current) return;
    if (activeRoom && activeRaceStart && !raceStarted) {
      setRaceStarted(true);
    }
  }, [activeRaceStart, activeRoom, raceStarted]);

  useEffect(() => {
    if (!activeRoom || !isRoomHost) return;
    if (activeCountdown) return;
    if (
      activeRoomMembers.length >= 1 &&
      activeRoomMembers.every((m) => m.ready)
    ) {
      void beginCountdown({ roomId: activeRoom.roomId });
    }
  }, [
    activeRoom,
    isRoomHost,
    activeRoomMembers,
    activeCountdown,
    beginCountdown,
  ]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!isMultiplayer || racing || goMs === undefined) return;
    const id = setInterval(() => forceTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [isMultiplayer, racing, goMs]);

  if (preferHome) {
    return (
      <RetroGridHomeScreen
        displayName={displayName}
        roomSlug={roomSlug}
        selectedMode={selectedMode}
        selectedTrackId={selectedTrackId}
        selectedCarId={selectedCarId}
        selectedLiveryId={selectedLiveryId}
        selectedTrack={selectedTrack}
        selectedModeMeta={selectedModeMeta}
        selectedCar={selectedCar}
        selectedLivery={selectedLivery}
        availableTracks={availableTracks}
        connected={connected}
        myName={myName}
        lastError={lastError}
        onDisplayNameChange={setDisplayName}
        onRoomSlugChange={setRoomSlug}
        onSelectMode={selectMode}
        onSelectTrackId={setSelectedTrackId}
        onSelectCarId={setSelectedCarId}
        onSelectLiveryId={setSelectedLiveryId}
        onCreateRoom={() => void createMultiplayerRoom()}
        onJoinRoom={() => void joinMultiplayerRoom()}
        onStartRace={startRace}
      />
    );
  }

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
      <RetroGridHomeScreen
        displayName={displayName}
        roomSlug={roomSlug}
        selectedMode={selectedMode}
        selectedTrackId={selectedTrackId}
        selectedCarId={selectedCarId}
        selectedLiveryId={selectedLiveryId}
        selectedTrack={selectedTrack}
        selectedModeMeta={selectedModeMeta}
        selectedCar={selectedCar}
        selectedLivery={selectedLivery}
        availableTracks={availableTracks}
        connected={connected}
        myName={myName}
        lastError={lastError}
        onDisplayNameChange={setDisplayName}
        onRoomSlugChange={setRoomSlug}
        onSelectMode={selectMode}
        onSelectTrackId={setSelectedTrackId}
        onSelectCarId={setSelectedCarId}
        onSelectLiveryId={setSelectedLiveryId}
        onCreateRoom={() => void createMultiplayerRoom()}
        onJoinRoom={() => void joinMultiplayerRoom()}
        onStartRace={startRace}
      />
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
    gapLabel:
      i === 0 ? "Leader" : `-${standingsCheckpointGap(racerProgress, r)} CP`,
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
            gridSlot={isMultiplayer ? myGridSlot : undefined}
            gridSize={gridSize}
            remoteCars={roomCars}
            onSnapshot={onSnapshot}
            onCheckpoint={onCheckpoint}
            onFinishLap={onFinishLap}
            onTelemetry={setTelemetry}
            racing={racing && !finished}
            goMs={goMs}
            onLoaded={() => {
              if (activeRoom) void markLoaded({ roomId: activeRoom.roomId });
            }}
          />
        </RenderErrorBoundary>
        <RaceHud
          speedKmh={telemetry.speed * 3.6}
          gear={Math.max(
            1,
            Math.min(7, Math.ceil(Math.abs(telemetry.speed) / 10)),
          )}
          lap={lapState.lap}
          totalLaps={lapState.totalLaps}
          currentLapMs={telemetry.elapsedMs}
          bestLapMs={lapState.bestLapMs}
          routePoints={resolvedSessionTrack.routePoints}
          minimapRacers={minimapRacers}
          standings={standings}
          onLeaveRoom={() => void exitRace()}
          isMultiplayer={isMultiplayer}
          countdown={
            isMultiplayer &&
            goMs !== undefined &&
            startMs !== undefined &&
            !racing
              ? countdownPhase(Date.now(), startMs, goMs)
              : undefined
          }
          finished={finished}
          results={resultRows}
          onReturnToLobby={() => void returnToLobby()}
        />
        <p className="hint">
          Press R to Reset, C for Camera, Space for Handbrake
        </p>
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
          <Metric label="Status" value={canStart ? "Ready" : "Waiting"} />
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
          <>
            <button
              className="start-button"
              type="button"
              disabled={!connected || !canStart}
              onClick={onStart}
            >
              Start race
            </button>
            {memberCount === 1 && (
              <p className="lobby-waiting">
                Solo start is allowed — others can join before you launch.
              </p>
            )}
          </>
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

function standingsCheckpointGap(all: RacerProgress[], r: RacerProgress) {
  const leader = [...all].sort(
    (a, b) => b.checkpointIndex - a.checkpointIndex,
  )[0];
  return Math.max(0, leader.checkpointIndex - r.checkpointIndex);
}

export default App;
