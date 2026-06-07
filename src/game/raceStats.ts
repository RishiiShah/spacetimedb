export type RacerProgress = {
  id: string;
  name: string;
  lap: number;
  checkpointIndex: number;
  // Distance (world units) from the racer to its next checkpoint. Smaller is
  // further along, so it breaks ties within the same checkpoint segment.
  distanceToNext: number;
  bestLapMs?: number;
};

// Leader first. Compare lap, then checkpoint reached, then proximity to the
// next checkpoint (closer = ahead).
export function orderByProgress(racers: RacerProgress[]): RacerProgress[] {
  return [...racers].sort((a, b) => {
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.checkpointIndex !== b.checkpointIndex)
      return b.checkpointIndex - a.checkpointIndex;
    return a.distanceToNext - b.distanceToNext;
  });
}
