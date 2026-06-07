export type CountdownState =
  | { phase: "controls" }
  | { phase: "count"; count: 1 | 2 | 3 }
  | { phase: "go" };

export type CountdownBeat = 3 | 2 | 1 | "go";

export type CountdownAudioStep = {
  beat: CountdownBeat;
  atMs: number;
  delayMs: number;
};

// nowMs/startMs/goMs are all in the same clock (server-derived). 5s controls
// modal, then 3..2..1 over the final 3 seconds, then GO.
export function countdownPhase(
  nowMs: number,
  startMs: number,
  goMs: number,
): CountdownState {
  if (nowMs >= goMs) return { phase: "go" };
  const remaining = goMs - nowMs;
  if (remaining > 3000) return { phase: "controls" };
  const count = Math.ceil(remaining / 1000) as 1 | 2 | 3;
  return { phase: "count", count };
}

export function countdownAudioSteps(
  goMs: number,
  nowMs: number,
): CountdownAudioStep[] {
  const beats: CountdownBeat[] = [3, 2, 1, "go"];
  return beats.flatMap((beat, index) => {
    const atMs = goMs - (3000 - index * 1000);
    if (atMs <= nowMs) return [];
    return [{ beat, atMs, delayMs: atMs - nowMs }];
  });
}
