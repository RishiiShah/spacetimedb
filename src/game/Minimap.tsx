import { useMemo } from "react";
import type { Vec3 } from "./track";

export type MinimapRacer = {
  id: string;
  x: number;
  z: number;
  color: string;
  isMe: boolean;
};

const SIZE = 140;
const PAD = 10;

export function Minimap({
  routePoints,
  racers,
}: {
  routePoints?: Vec3[];
  racers: MinimapRacer[];
}) {
  const projection = useMemo(() => {
    if (!routePoints || routePoints.length < 2) return undefined;
    const xs = routePoints.map((p) => p.x);
    const zs = routePoints.map((p) => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const span = Math.max(maxX - minX, maxZ - minZ) || 1;
    const scale = (SIZE - PAD * 2) / span;
    const project = (x: number, z: number): [number, number] => [
      PAD + (x - minX) * scale + (SIZE - PAD * 2 - (maxX - minX) * scale) / 2,
      // North-up: world +z maps downward in screen space.
      PAD + (z - minZ) * scale + (SIZE - PAD * 2 - (maxZ - minZ) * scale) / 2,
    ];
    const path = routePoints.map((p) => project(p.x, p.z).join(",")).join(" ");
    return { project, path };
  }, [routePoints]);

  if (!projection) return null;

  return (
    <svg
      className="minimap"
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
    >
      <polygon className="minimap-track" points={projection.path} fill="none" />
      {racers.map((r) => {
        const [cx, cy] = projection.project(r.x, r.z);
        return (
          <circle
            key={r.id}
            cx={cx}
            cy={cy}
            r={r.isMe ? 4.5 : 3}
            fill={r.color}
            stroke={r.isMe ? "#fff" : "none"}
            strokeWidth={r.isMe ? 1.5 : 0}
          />
        );
      })}
    </svg>
  );
}
