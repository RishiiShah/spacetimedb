import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Minimap, type MinimapRacer } from "./Minimap";
import type { Vec3 } from "./track";

export type RaceHudProps = {
  speedKmh: number;
  gear: number;
  lap: number;
  totalLaps: number;
  currentLapMs: number;
  bestLapMs?: number;
  routePoints?: Vec3[];
  minimapRacers: MinimapRacer[];
  standings: { id: string; name: string; gapLabel: string }[];
  onLeaveRoom: () => void;
  countdown?: import("./countdown").CountdownState;
};

const VOLUME_KEY = "racer.volume";
type Volumes = { master: number; sfx: number; music: number; muted: boolean };
const DEFAULT_VOLUMES: Volumes = { master: 80, sfx: 80, music: 60, muted: false };

function loadVolumes(): Volumes {
  try {
    return {
      ...DEFAULT_VOLUMES,
      ...JSON.parse(localStorage.getItem(VOLUME_KEY) || "{}"),
    };
  } catch {
    return DEFAULT_VOLUMES;
  }
}

export function RaceHud(props: RaceHudProps) {
  const [paused, setPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [volumes, setVolumes] = useState<Volumes>(loadVolumes);

  useEffect(() => {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes));
  }, [volumes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "escape") setPaused((p) => !p);
      if (k === "i") setShowInstructions((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {props.countdown && (
        <div className="countdown-overlay">
          {props.countdown.phase === "controls" && (
            <div className="countdown-controls">
              <h2>Get Ready</h2>
              <ul className="instructions-list">
                <li><kbd>W</kbd>/<kbd>S</kbd> Throttle / Brake</li>
                <li><kbd>A</kbd>/<kbd>D</kbd> Steer · <kbd>Space</kbd> Handbrake</li>
                <li><kbd>C</kbd> Camera · <kbd>R</kbd> Reset</li>
              </ul>
            </div>
          )}
          {props.countdown.phase === "count" && (
            <div className="countdown-number">{props.countdown.count}</div>
          )}
          {props.countdown.phase === "go" && <div className="countdown-number">GO</div>}
        </div>
      )}
      <div className="hud-corner hud-top-left">
        <h3>Race</h3>
        <ol className="hud-standings">
          {props.standings.map((s, i) => (
            <li key={s.id}>
              <span>
                {i + 1}. {s.name}
              </span>
              <strong>{s.gapLabel}</strong>
            </li>
          ))}
        </ol>
      </div>

      <div className="hud-corner hud-top-right">
        <Minimap routePoints={props.routePoints} racers={props.minimapRacers} />
      </div>

      <div className="hud-corner hud-bottom-left">
        <span className="hud-label">
          Lap {props.lap}/{props.totalLaps}
        </span>
        <span className="hud-time">{formatMs(props.currentLapMs)}</span>
        <span className="hud-sub">
          Best {props.bestLapMs ? formatMs(props.bestLapMs) : "--:--"}
        </span>
      </div>

      <div className="hud-corner hud-bottom-right">
        <span className="hud-speed">{Math.round(props.speedKmh)}</span>
        <span className="hud-unit">km/h</span>
        <span className="hud-gear">Gear {props.gear}</span>
      </div>

      <button className="hud-help-tab" onClick={() => setShowInstructions(true)}>
        Press I for controls
      </button>

      {showInstructions && (
        <Modal onClose={() => setShowInstructions(false)} title="Controls">
          <ul className="instructions-list">
            <li>
              <kbd>W</kbd>/<kbd>S</kbd> Throttle / Brake
            </li>
            <li>
              <kbd>A</kbd>/<kbd>D</kbd> Steer
            </li>
            <li>
              <kbd>Space</kbd> Handbrake
            </li>
            <li>
              <kbd>C</kbd> Camera · <kbd>R</kbd> Reset
            </li>
            <li>
              <kbd>I</kbd> Controls · <kbd>Esc</kbd> Pause menu
            </li>
          </ul>
        </Modal>
      )}

      {paused && (
        <Modal onClose={() => setPaused(false)} title="Paused">
          <div className="pause-menu">
            <button onClick={() => setPaused(false)}>Resume</button>
            <button onClick={() => setShowInstructions(true)}>
              Instructions
            </button>
            <fieldset className="sound-options">
              <legend>Sound</legend>
              {(["master", "sfx", "music"] as const).map((key) => (
                <label key={key}>
                  {key}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volumes[key]}
                    onChange={(e) =>
                      setVolumes((v) => ({ ...v, [key]: Number(e.target.value) }))
                    }
                  />
                </label>
              ))}
              <label className="mute">
                <input
                  type="checkbox"
                  checked={volumes.muted}
                  onChange={(e) =>
                    setVolumes((v) => ({ ...v, muted: e.target.checked }))
                  }
                />
                Mute
              </label>
            </fieldset>
            <button className="danger" onClick={props.onLeaveRoom}>
              Leave room
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="hud-modal-backdrop" onClick={onClose}>
      <div className="hud-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function formatMs(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs
    .toString()
    .padStart(2, "0")}`;
}
