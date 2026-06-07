export type ResultRow = {
  id: string;
  name: string;
  lapsDone: number;
  totalMs: number;
  bestLapMs?: number;
};

// Winner first: most laps completed, then lowest total race time.
export function orderResults(rows: ResultRow[]): ResultRow[] {
  return [...rows].sort((a, b) => {
    if (a.lapsDone !== b.lapsDone) return b.lapsDone - a.lapsDone;
    return a.totalMs - b.totalMs;
  });
}
