import { useEffect, useMemo, useState } from "react";
import {
  buildCircuitCollisionTrack,
  parseCircuitMapData,
  type CircuitMapData,
  type ParsedCircuitTrack,
} from "./circuitTrackData";
import type { TrackDef } from "./track";

export function useResolvedTrackRoute(track: TrackDef): TrackDef {
  const [parsed, setParsed] = useState<ParsedCircuitTrack | null>(null);

  useEffect(() => {
    if (!track.circuitMapPath) {
      setParsed(null);
      return;
    }

    let cancelled = false;
    fetch(track.circuitMapPath)
      .then((response) => response.json())
      .then((data: CircuitMapData) => {
        if (!cancelled) setParsed(parseCircuitMapData(data, track));
      })
      .catch(() => {
        if (!cancelled) setParsed(null);
      });

    return () => {
      cancelled = true;
    };
  }, [track]);

  return useMemo(() => {
    if (track.routePoints?.length) return track;
    if (!parsed?.points.length) return track;
    return buildCircuitCollisionTrack(track, parsed);
  }, [parsed, track]);
}
