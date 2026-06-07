import { useState, type FormEvent } from "react";
import "./RetroGridMenu.css";
import { RetroGridMenuScene } from "./RetroGridMenuScene";
import {
  CARS,
  LIVERIES,
  getCarById,
  getLiveryById,
  type CarId,
} from "./driving";
import { GAME_MODES, type GameMode, type TrackDef } from "./track";

type Panel = "home" | "garage" | "options";

type RetroGridHomeScreenProps = {
  displayName: string;
  roomSlug: string;
  selectedMode: GameMode;
  selectedTrackId: string;
  selectedCarId: CarId;
  selectedLiveryId: string;
  selectedTrack: TrackDef;
  selectedModeMeta: { label: string; summary: string };
  selectedCar: { id: CarId; name: string; summary: string };
  selectedLivery: { id: string; name: string; body: string; accent: string };
  availableTracks: TrackDef[];
  connected: boolean;
  myName: string;
  lastError: string;
  onDisplayNameChange: (value: string) => void;
  onRoomSlugChange: (value: string) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectTrackId: (trackId: string) => void;
  onSelectCarId: (carId: CarId) => void;
  onSelectLiveryId: (liveryId: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onStartRace: () => void;
};

export function RetroGridHomeScreen({
  displayName,
  roomSlug,
  selectedMode,
  selectedTrackId,
  selectedCarId,
  selectedLiveryId,
  selectedTrack,
  selectedModeMeta,
  selectedCar,
  selectedLivery,
  availableTracks,
  connected,
  myName,
  lastError,
  onDisplayNameChange,
  onRoomSlugChange,
  onSelectMode,
  onSelectTrackId,
  onSelectCarId,
  onSelectLiveryId,
  onCreateRoom,
  onJoinRoom,
  onStartRace,
}: RetroGridHomeScreenProps) {
  const [panel, setPanel] = useState<Panel>("home");

  const joinRoom = (event: FormEvent) => {
    event.preventDefault();
    onJoinRoom();
  };

  const driverName = displayName.trim() || myName;

  return (
    <div className="retro-shell">
      <header className="retro-preview-band" aria-hidden="true">
        <RetroGridMenuScene liveryId={selectedLiveryId} />
        <div className="retro-preview-fade" />
      </header>

      <div className="retro-menu-frame">
        <div className="retro-status-row">
          <div className="retro-time">
            {new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="retro-credits">5000 CREDITS</div>
          <div className="retro-signal" aria-hidden="true">
            <span className="retro-signal-bars" />
          </div>
        </div>

        <div className="retro-body">
          <aside className="retro-sidebar">
            <div className="retro-brand">
              <h1 className="sr-only">Spacetime Racer</h1>
              <h2 className="sr-only">Grid preview</h2>
              <div className="retro-game-title" aria-hidden="true">
                <span className="retro-title-line">RETRO</span>
                <span className="retro-title-line retro-highlight">
                  GRID <span className="retro-flag">🏁</span>
                </span>
                <span className="retro-title-sub">GRAND PRIX</span>
              </div>
              <p className="retro-subtitle">
                Driver briefing · {selectedCar.name} setup
              </p>
            </div>

            <nav className="retro-nav" aria-label="Main menu">
              <button
                type="button"
                className="retro-btn retro-btn-start"
                onClick={onStartRace}
              >
                START RACE
              </button>
              <button
                type="button"
                className={`retro-btn ${panel === "garage" ? "retro-btn-active" : ""}`}
                onClick={() => setPanel(panel === "garage" ? "home" : "garage")}
              >
                GARAGE
              </button>
              <button type="button" className="retro-btn" disabled>
                LEADERBOARD
              </button>
              <button
                type="button"
                className={`retro-btn ${panel === "options" ? "retro-btn-active" : ""}`}
                onClick={() =>
                  setPanel(panel === "options" ? "home" : "options")
                }
              >
                OPTIONS
              </button>
              <button
                type="button"
                className="retro-btn retro-btn-exit"
                disabled
              >
                EXIT
              </button>
            </nav>

            <div className="retro-mode-list" aria-label="Race mode">
              {GAME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className="retro-mode-card"
                  aria-pressed={selectedMode === mode.id}
                  onClick={() => onSelectMode(mode.id)}
                >
                  <strong>{mode.label}</strong>
                  <span>{mode.summary}</span>
                </button>
              ))}
            </div>

            <footer className="retro-icon-footer">
              <button
                type="button"
                className="retro-icon-btn"
                aria-label="Settings"
              >
                ⚙
              </button>
              <button
                type="button"
                className="retro-icon-btn"
                aria-label="Profile"
              >
                👤
              </button>
            </footer>
          </aside>

          <main className="retro-stage">
            {panel === "garage" && (
              <section className="retro-stage-panel" aria-label="Garage">
                <header className="retro-stage-header">
                  <p className="retro-stage-eyebrow">Garage</p>
                  <h3>{selectedCar.name}</h3>
                </header>
                <p className="retro-stage-copy">{selectedCar.summary}</p>
                <div className="retro-livery-row">
                  <span
                    className="retro-livery-swatch"
                    style={{
                      background: selectedLivery.body,
                      borderColor: selectedLivery.accent,
                    }}
                  />
                  <div>
                    <strong>{selectedLivery.name}</strong>
                    <p>Active livery</p>
                  </div>
                </div>
                <label className="retro-field">
                  Car
                  <select
                    value={selectedCarId}
                    onChange={(event) =>
                      onSelectCarId(getCarById(event.target.value).id)
                    }
                  >
                    {CARS.map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="retro-field">
                  Livery
                  <select
                    value={selectedLiveryId}
                    onChange={(event) =>
                      onSelectLiveryId(getLiveryById(event.target.value).id)
                    }
                  >
                    {LIVERIES.map((livery) => (
                      <option key={livery.id} value={livery.id}>
                        {livery.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )}

            {panel === "options" && (
              <section className="retro-stage-panel" aria-label="Race setup">
                <header className="retro-stage-header">
                  <p className="retro-stage-eyebrow">Options</p>
                  <h3>Session setup</h3>
                </header>

                <label className="retro-field">
                  Track
                  <select
                    value={selectedTrackId}
                    onChange={(event) => onSelectTrackId(event.target.value)}
                  >
                    {availableTracks.map((track) => (
                      <option
                        key={track.id.toString()}
                        value={track.id.toString()}
                      >
                        {track.name}
                      </option>
                    ))}
                  </select>
                </label>

                <form className="retro-join-form" onSubmit={joinRoom}>
                  <label className="retro-field">
                    Driver
                    <input
                      value={displayName}
                      placeholder={myName}
                      onChange={(event) =>
                        onDisplayNameChange(event.target.value)
                      }
                    />
                  </label>
                  <label className="retro-field">
                    Room
                    <input
                      value={roomSlug}
                      onChange={(event) => onRoomSlugChange(event.target.value)}
                    />
                  </label>
                  <div className="retro-room-actions">
                    <button
                      type="button"
                      disabled={!connected}
                      onClick={onCreateRoom}
                    >
                      {connected ? "Create room" : "Connecting"}
                    </button>
                    <button type="submit" disabled={!connected}>
                      {connected ? "Join room" : "Connecting"}
                    </button>
                  </div>
                </form>

                {lastError && <p className="retro-error">{lastError}</p>}
              </section>
            )}

            <aside className="retro-driver-stats" aria-label="Driver summary">
              <p>
                <span>SELECTED DRIVER:</span> {driverName}
              </p>
              <p>
                <span>CAR CLASS:</span> {selectedCar.name.toUpperCase()}
              </p>
              <p>
                <span>TRACK:</span> {selectedTrack.name.toUpperCase()}
              </p>
              <p>
                <span>MODE:</span> {selectedModeMeta.label.toUpperCase()}
              </p>
              <p className="retro-car-summary">{selectedCar.summary}</p>
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}
