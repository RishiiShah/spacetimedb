export type CountdownState =
  | { phase: "controls" }
  | { phase: "count"; count: 1 | 2 | 3 }
  | { phase: "go" };

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
