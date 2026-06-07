import { assets } from "./assets";

const MAX_SPEED = 72;

export type DrivingAudioInput = {
  speed: number;
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
};

export function enginePlaybackRate(speed: number): number {
  const normalized = Math.min(Math.abs(speed) / MAX_SPEED, 1);
  return 0.55 + normalized * 1.85;
}

export function engineVolume(throttle: number, speed: number): number {
  const idle = 0.32;
  const load =
    throttle * 0.42 + Math.min(Math.abs(speed) / MAX_SPEED, 1) * 0.38;
  return Math.min(1, idle + load);
}

export function brakeVolume(brake: number, speed: number): number {
  if (Math.abs(speed) < 2 || brake <= 0) return 0;
  return Math.min(1, brake * Math.min(Math.abs(speed) / 36, 1));
}

export function screechVolume(
  steer: number,
  speed: number,
  handbrake: boolean,
): number {
  const steerMag = Math.abs(steer);
  if (handbrake && Math.abs(speed) > 8) {
    return Math.min(1, 0.45 + steerMag * 0.55);
  }
  if (steerMag < 0.2 || Math.abs(speed) < 16) return 0;
  return Math.min(1, steerMag * Math.min(Math.abs(speed) / 50, 1));
}

type LoopChannel = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

export class RaceAudioController {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loops: Partial<Record<"engine" | "brake" | "screech", LoopChannel>> =
    {};
  private countdownTimeouts: number[] = [];
  private unlocked = false;
  private countdownStarted = false;
  private disposed = false;
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && this.masterGain) {
      this.masterGain.gain.value = 0;
    } else if (enabled && this.masterGain) {
      this.masterGain.gain.value = 1;
    }
  }

  hasStartedCountdown() {
    return this.countdownStarted;
  }

  async preload(): Promise<void> {
    if (typeof window === "undefined") return;

    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.context.destination);

    const urls = [
      assets.audio.engine,
      assets.audio.brake,
      assets.audio.screech,
      assets.audio.checkpoint,
      assets.audio.lap,
      assets.audio.ui.countdown3,
      assets.audio.ui.countdown2,
      assets.audio.ui.countdown1,
      assets.audio.ui.go,
    ];

    await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          const buffer = await this.context!.decodeAudioData(data);
          this.buffers.set(url, buffer);
        } catch {
          // Missing assets should not break the race session.
        }
      }),
    );
  }

  async unlock(): Promise<boolean> {
    if (!this.context || this.disposed) return false;
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }
    if (this.context.state !== "running") return false;

    if (!this.unlocked) {
      this.unlocked = true;
      this.startLoops();
    }
    return true;
  }

  startCountdown() {
    if (this.disposed || this.countdownStarted) return;
    this.countdownStarted = true;
    this.clearCountdown();

    const sequence = [
      { delayMs: 0, url: assets.audio.ui.countdown3 },
      { delayMs: 1000, url: assets.audio.ui.countdown2 },
      { delayMs: 2000, url: assets.audio.ui.countdown1 },
      { delayMs: 3000, url: assets.audio.ui.go },
    ];

    for (const step of sequence) {
      const timeoutId = window.setTimeout(() => {
        this.playOneShot(step.url, 0.95);
      }, step.delayMs);
      this.countdownTimeouts.push(timeoutId);
    }
  }

  playCheckpoint() {
    this.playOneShot(assets.audio.checkpoint, 0.85);
  }

  playLap() {
    this.playOneShot(assets.audio.lap, 0.9);
  }

  updateDriving(input: DrivingAudioInput) {
    if (!this.enabled || !this.unlocked || this.disposed) return;

    const engine = this.loops.engine;
    if (engine) {
      engine.source.playbackRate.value = enginePlaybackRate(input.speed);
      engine.gain.gain.value = engineVolume(input.throttle, input.speed);
    }

    const brake = this.loops.brake;
    if (brake) {
      const volume = brakeVolume(input.brake, input.speed);
      brake.gain.gain.value = volume;
      if (volume > 0.01) {
        this.ensureLoopPlaying("brake");
      } else if (brake.source.buffer) {
        brake.gain.gain.value = 0;
      }
    }

    const screech = this.loops.screech;
    if (screech) {
      const volume = screechVolume(
        input.steer,
        input.speed,
        input.handbrake,
      );
      screech.gain.gain.value = volume;
      screech.source.playbackRate.value = Math.max(
        0.8,
        Math.min(2.4, 0.7 + Math.abs(input.speed) / 40),
      );
      if (volume > 0.01) {
        this.ensureLoopPlaying("screech");
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.clearCountdown();

    for (const channel of Object.values(this.loops)) {
      if (!channel) continue;
      try {
        channel.source.stop();
      } catch {
        // already stopped
      }
      channel.source.disconnect();
      channel.gain.disconnect();
    }
    this.loops = {};

    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.buffers.clear();
    this.unlocked = false;
    this.countdownStarted = false;
  }

  private clearCountdown() {
    for (const timeoutId of this.countdownTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.countdownTimeouts = [];
  }

  private startLoops() {
    this.ensureLoop("engine", assets.audio.engine, 0.35);
    this.ensureLoop("brake", assets.audio.brake, 0);
    this.ensureLoop("screech", assets.audio.screech, 0);
  }

  private ensureLoop(
    key: "engine" | "brake" | "screech",
    url: string,
    initialVolume: number,
  ) {
    if (!this.context || !this.masterGain || this.loops[key]) return;
    const buffer = this.buffers.get(url);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.context.createGain();
    gain.gain.value = initialVolume;

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);

    this.loops[key] = { source, gain };
  }

  private ensureLoopPlaying(key: "brake" | "screech") {
    const channel = this.loops[key];
    if (!channel) return;
    // BufferSourceNode has no isPlaying; gain handles audibility.
    channel.gain.gain.value = Math.max(channel.gain.gain.value, 0.01);
  }

  private playOneShot(url: string, volume: number) {
    if (!this.enabled || !this.context || !this.masterGain || this.disposed) {
      return;
    }
    const buffer = this.buffers.get(url);
    if (!buffer) return;

    if (this.context.state === "suspended") {
      void this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gain = this.context.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);
  }
}
