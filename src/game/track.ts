export type Vec3 = { x: number; y: number; z: number };

export const ROUTE_CURB_WIDTH = 2.6;
export const ROUTE_RAIL_WIDTH = 1.6;
export const ROUTE_WALL_HEIGHT = 1.4;

export function getRouteRailOffset(roadWidth: number) {
  return roadWidth / 2 + ROUTE_CURB_WIDTH + ROUTE_RAIL_WIDTH / 2;
}

export function getRouteFenceInnerOffset(
  roadWidth: number,
  railOffset = getRouteRailOffset(roadWidth),
) {
  return railOffset - ROUTE_RAIL_WIDTH / 2;
}

export type GameMode = "circuit" | "stunt" | "practice";

export type GameModeMeta = {
  id: GameMode;
  label: string;
  summary: string;
};

export type Checkpoint = {
  index: number;
  position: Vec3;
  rotationY: number;
  width: number;
  height: number;
  depth: number;
};

export type AssetPlacement = {
  assetId: keyof typeof cityAssetPaths;
  position: Vec3;
  rotationY: number;
  scale: number;
};

export type TrackDef = {
  id: bigint;
  slug: string;
  name: string;
  mode: GameMode;
  type: "circuit" | "stunt" | "practice";
  summary: string;
  origin: "mapped-circuit" | "stunt-route" | "local";
  environment: "city" | "flat";
  spawn: { position: Vec3; heading: number };
  checkpoints: Checkpoint[];
  placements: AssetPlacement[];
  surfaceGrip?: number;
  routePoints?: Vec3[];
  roadWidth?: number;
  railOffset?: number;
  railHeight?: number;
  railColor?: string;
  circuitMapPath?: string;
  circuitMapScale?: number;
};

export const GAME_MODES: GameModeMeta[] = [
  {
    id: "circuit",
    label: "Circuit",
    summary:
      "Open-wheel car, mapped routes, checkpoints, and fast circuit laps.",
  },
  {
    id: "stunt",
    label: "Stunt",
    summary: "Elevated stunt routes with WASD time-trial flow.",
  },
  {
    id: "practice",
    label: "Practice",
    summary: "Flat road-only world for testing car feel.",
  },
];

export const cityAssetPaths = {
  roadStraight: "/assets/city/road_001.glb",
  roadCurve: "/assets/city/road_003.glb",
  ecoGrid: "/assets/city/Eco_Building_Grid.glb",
  ecoSlope: "/assets/city/Eco_Building_Slope.glb",
  ecoTerrace: "/assets/city/Eco_Building_Terrace.glb",
  twistedTower: "/assets/city/Regular_Building_TwistedTower_Large.glb",
  trafficLight: "/assets/city/traffic_light_001.glb",
  busStop: "/assets/city/Bus_Stop_02.glb",
  palm: "/assets/city/Palm_03.glb",
} as const;

const CIRCUIT_MAP_SCALE = 0.08;
const CIRCUIT_GATE_HEIGHT = 8;
const CIRCUIT_GATE_WIDTH = 34;
const CIRCUIT_GATE_DEPTH = 4;

function checkpoint(
  index: number,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): Checkpoint {
  return {
    index,
    position: { x, y, z },
    rotationY,
    width: CIRCUIT_GATE_WIDTH,
    height: CIRCUIT_GATE_HEIGHT,
    depth: CIRCUIT_GATE_DEPTH,
  };
}

function circuitTrack({
  id,
  slug,
  name,
  summary,
  spawn,
  checkpoints,
}: {
  id: bigint;
  slug: string;
  name: string;
  summary: string;
  spawn: { position: Vec3; heading: number };
  checkpoints: Checkpoint[];
}): TrackDef {
  return {
    id,
    slug: `circuit-${slug}`,
    name,
    mode: "circuit",
    type: "circuit",
    summary,
    origin: "mapped-circuit",
    environment: "flat",
    spawn,
    checkpoints,
    placements: [],
    surfaceGrip: 1,
    circuitMapPath: `/assets/circuit/maps/${slug}.json`,
    circuitMapScale: CIRCUIT_MAP_SCALE,
  };
}

export const circuitMonzaTrack = circuitTrack({
  id: 10n,
  slug: "monza",
  name: "Circuit Monza",
  summary: "High-speed circuit with long straights and sweeping corners.",
  spawn: { position: { x: 9.6, y: 0, z: 16.8 }, heading: -Math.PI / 2 },
  checkpoints: [
    checkpoint(0, 9.6, 4, 16.8, -Math.PI / 2),
    checkpoint(1, -64.8, 4, 13.6, -Math.PI / 2),
    checkpoint(2, -71.2, 4, -64),
    checkpoint(3, -12.8, 4, -5.6, Math.PI / 2),
  ],
});

export const circuitAustriaTrack = circuitTrack({
  id: 11n,
  slug: "austria",
  name: "Circuit Austria",
  summary: "Elevated layout with climbs and fast direction changes.",
  spawn: { position: { x: 0, y: 0, z: -4 }, heading: Math.PI },
  checkpoints: [
    checkpoint(0, 0, 4, -4, Math.PI),
    checkpoint(1, -52.8, 6.24, 25.6, -Math.PI / 2),
    checkpoint(2, -40.8, 5.6, -15.2),
    checkpoint(3, -18.4, 4.96, -4.8, Math.PI / 2),
  ],
});

export const circuitBrandsTrack = circuitTrack({
  id: 12n,
  slug: "brands",
  name: "Circuit Brands",
  summary: "Compact circuit with flowing bends.",
  spawn: { position: { x: 0, y: 0.8, z: -2.4 }, heading: -2.976 },
  checkpoints: [
    checkpoint(0, 0, 4.8, -2.4, -2.976),
    checkpoint(1, -16, 4, 6.4, -Math.PI / 2),
    checkpoint(2, -40, 5.6, -16),
    checkpoint(3, -23.2, 4.8, -31.2, Math.PI / 2),
  ],
});

export const circuitInterlagosTrack = circuitTrack({
  id: 13n,
  slug: "interlagos",
  name: "Circuit Interlagos",
  summary: "Circuit with linked bends and a broad final sector.",
  spawn: { position: { x: 0, y: 0, z: -2.4 }, heading: Math.PI },
  checkpoints: [
    checkpoint(0, 0, 4, -2.4, Math.PI),
    checkpoint(1, 8.8, 3.52, 29.6, Math.PI / 2),
    checkpoint(2, 39.2, 3.68, 20, Math.PI / 2),
    checkpoint(3, 29.6, 4, 1.6),
  ],
});

export const circuitIndyTrack = circuitTrack({
  id: 14n,
  slug: "indy",
  name: "Circuit Indy",
  summary: "Short layout for quick testing and multiplayer sync.",
  spawn: { position: { x: -2.4, y: 0, z: -10.4 }, heading: Math.PI },
  checkpoints: [
    checkpoint(0, -2.4, 4, -10.4, Math.PI),
    checkpoint(1, 0, 4, 14.4, Math.PI),
    checkpoint(2, -20.8, 4, 12.8, -Math.PI / 2),
    checkpoint(3, -21.6, 4, -18.4),
  ],
});

export const circuitFundaTrack = circuitTrack({
  id: 15n,
  slug: "funda",
  name: "Circuit Funda",
  summary: "Downtown loop with a balanced technical rhythm.",
  spawn: { position: { x: 4, y: 0, z: 2.4 }, heading: -Math.PI / 2 },
  checkpoints: [
    checkpoint(0, 4, 4, 2.4, -Math.PI / 2),
    checkpoint(1, -20.8, 4, 22.4, -Math.PI / 2),
    checkpoint(2, -24.8, 4, -14.4),
    checkpoint(3, 23.2, 4, -8.8, Math.PI / 2),
  ],
});

export const circuitSuburbanTrack = circuitTrack({
  id: 16n,
  slug: "suburban",
  name: "Circuit Suburban",
  summary: "Map with extra route pieces and city background potential.",
  spawn: { position: { x: 0, y: 0.8, z: -2.4 }, heading: Math.PI },
  checkpoints: [
    checkpoint(0, 0, 4.8, -2.4, Math.PI),
    checkpoint(1, 0, 4.8, 44, Math.PI),
    checkpoint(2, -28.8, 7.2, 6.4, -Math.PI / 2),
    checkpoint(3, -12, 6.4, 24.8, Math.PI / 2),
  ],
});

export const cityLoopV1Track: TrackDef = {
  id: 1n,
  slug: "city-loop-v1",
  name: "City Loop V1",
  mode: "circuit",
  type: "circuit",
  summary:
    "Wide city loop with long sweepers, broad return bends, rails, and room for driving mechanics.",
  origin: "local",
  environment: "city",
  spawn: { position: { x: -216, y: 0, z: 204 }, heading: Math.atan2(170, 30) },
  routePoints: [
    { x: -390, y: 0, z: 210 },
    { x: -250, y: 0, z: 210 },
    { x: -80, y: 0, z: 180 },
    { x: 100, y: 0, z: 150 },
    { x: 270, y: 0, z: 170 },
    { x: 430, y: 0, z: 100 },
    { x: 470, y: 0, z: -25 },
    { x: 420, y: 0, z: -150 },
    { x: 280, y: 0, z: -215 },
    { x: 120, y: 0, z: -245 },
    { x: -40, y: 0, z: -300 },
    { x: -205, y: 0, z: -270 },
    { x: -335, y: 0, z: -190 },
    { x: -455, y: 0, z: -80 },
    { x: -485, y: 0, z: 70 },
  ],
  roadWidth: 40.5,
  railOffset: getRouteRailOffset(40.5),
  railHeight: ROUTE_WALL_HEIGHT,
  railColor: "#d8dde4",
  checkpoints: [
    {
      index: 0,
      position: { x: -134.4, y: 4, z: 189.6 },
      rotationY: Math.atan2(170, 30),
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 1,
      position: { x: 100, y: 4, z: 150 },
      rotationY: Math.PI / 2,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 2,
      position: { x: 430, y: 4, z: 100 },
      rotationY: 0.82,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 3,
      position: { x: 280, y: 4, z: -215 },
      rotationY: Math.PI / 2,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 4,
      position: { x: -40, y: 4, z: -300 },
      rotationY: Math.PI / 2,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 5,
      position: { x: -335, y: 4, z: -190 },
      rotationY: -0.82,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 6,
      position: { x: -485, y: 4, z: 70 },
      rotationY: -0.2,
      width: 42,
      height: 8,
      depth: 2,
    },
  ],
  placements: [
    {
      assetId: "ecoGrid",
      position: { x: -300, y: 0, z: 120 },
      rotationY: 0.18,
      scale: 1.6,
    },
    {
      assetId: "ecoSlope",
      position: { x: -35, y: 0, z: 72 },
      rotationY: -0.18,
      scale: 1.45,
    },
    {
      assetId: "ecoTerrace",
      position: { x: 170, y: 0, z: 48 },
      rotationY: 0.55,
      scale: 1.75,
    },
    {
      assetId: "twistedTower",
      position: { x: 10, y: 0, z: -58 },
      rotationY: -0.35,
      scale: 1.6,
    },
    {
      assetId: "ecoGrid",
      position: { x: 340, y: 0, z: -48 },
      rotationY: Math.PI / 5,
      scale: 1.55,
    },
    {
      assetId: "ecoSlope",
      position: { x: 520, y: 0, z: 75 },
      rotationY: -0.95,
      scale: 1.35,
    },
    {
      assetId: "ecoTerrace",
      position: { x: 398, y: 0, z: -250 },
      rotationY: 1.1,
      scale: 1.45,
    },
    {
      assetId: "busStop",
      position: { x: -428, y: 0, z: 286 },
      rotationY: Math.PI / 2,
      scale: 1,
    },
    {
      assetId: "trafficLight",
      position: { x: -356, y: 0, z: 278 },
      rotationY: 0.12,
      scale: 1,
    },
    {
      assetId: "trafficLight",
      position: { x: 500, y: 0, z: 145 },
      rotationY: -0.7,
      scale: 1,
    },
    {
      assetId: "palm",
      position: { x: -458, y: 0, z: 250 },
      rotationY: 0,
      scale: 1.35,
    },
    {
      assetId: "palm",
      position: { x: -118, y: 0, z: 252 },
      rotationY: 0,
      scale: 1.35,
    },
    {
      assetId: "palm",
      position: { x: 292, y: 0, z: 244 },
      rotationY: 0,
      scale: 1.35,
    },
    {
      assetId: "palm",
      position: { x: 462, y: 0, z: -218 },
      rotationY: 0,
      scale: 1.35,
    },
    {
      assetId: "palm",
      position: { x: -274, y: 0, z: -318 },
      rotationY: 0,
      scale: 1.35,
    },
  ],
};

export const stuntShowcaseTrack: TrackDef = {
  id: 2n,
  slug: "stunt-showcase",
  name: "Stunt Showcase",
  mode: "stunt",
  type: "stunt",
  summary: "Elevated stunt route with loops and corkscrews.",
  origin: "stunt-route",
  environment: "flat",
  spawn: { position: { x: 0, y: 1.1, z: 0 }, heading: 0 },
  checkpoints: [
    {
      index: 0,
      position: { x: 0, y: 5, z: -100 },
      rotationY: 0,
      width: 40,
      height: 20,
      depth: 5,
    },
    {
      index: 1,
      position: { x: 0, y: 50, z: -250 },
      rotationY: 0,
      width: 60,
      height: 40,
      depth: 10,
    },
    {
      index: 2,
      position: { x: 0, y: 5, z: -400 },
      rotationY: 0,
      width: 40,
      height: 20,
      depth: 5,
    },
    {
      index: 3,
      position: { x: 0, y: 5, z: 0 },
      rotationY: 0,
      width: 40,
      height: 20,
      depth: 5,
    },
  ],
  placements: [],
};

export const flatRoadPracticeTrack: TrackDef = {
  id: 3n,
  slug: "flat-road-practice",
  name: "Flat Road Practice",
  mode: "practice",
  type: "practice",
  summary:
    "Wide flat road-only loop for testing throttle, braking, steering, and camera feel.",
  origin: "local",
  environment: "flat",
  spawn: { position: { x: -150, y: 0, z: 70 }, heading: Math.PI / 2 },
  routePoints: [
    { x: -150, y: 0, z: 70 },
    { x: -70, y: 0, z: 70 },
    { x: 70, y: 0, z: 70 },
    { x: 150, y: 0, z: 40 },
    { x: 170, y: 0, z: -20 },
    { x: 120, y: 0, z: -80 },
    { x: 0, y: 0, z: -92 },
    { x: -120, y: 0, z: -80 },
    { x: -170, y: 0, z: -20 },
  ],
  roadWidth: 39,
  checkpoints: [
    {
      index: 0,
      position: { x: -70, y: 4, z: 70 },
      rotationY: Math.PI / 2,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 1,
      position: { x: 150, y: 4, z: 40 },
      rotationY: 0.5,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 2,
      position: { x: 0, y: 4, z: -92 },
      rotationY: Math.PI / 2,
      width: 42,
      height: 8,
      depth: 2,
    },
    {
      index: 3,
      position: { x: -170, y: 4, z: -20 },
      rotationY: -0.5,
      width: 42,
      height: 8,
      depth: 2,
    },
  ],
  placements: [],
};

export const cityMonacoTrack: TrackDef = {
  id: 17n,
  slug: "monaco",
  name: "Circuit de Monaco",
  mode: "circuit",
  type: "circuit",
  summary:
    "Tight, twisting street circuit winding through Casino Square, a narrow hairpin, and harbor sweepers.",
  origin: "local",
  environment: "city",
  spawn: { position: { x: -80, y: 0, z: 160 }, heading: Math.PI / 2 },
  roadWidth: 19.5,
  railOffset: getRouteRailOffset(19.5),
  railHeight: ROUTE_WALL_HEIGHT,
  railColor: "#d8dde4",
  routePoints: [
    // Main Straight (z = 160)
    { x: -80, y: 0, z: 160 },
    { x: 40, y: 0, z: 160 },
    // Sainte Devote (Turn 1 - tight right)
    { x: 100, y: 0, z: 135 },
    // Beau Rivage (Uphill climb)
    { x: 130, y: 0, z: 60 },
    { x: 140, y: 0, z: -30 },
    // Massenet (Left sweep)
    { x: 110, y: 0, z: -100 },
    // Casino Square (Right sweep)
    { x: 50, y: 0, z: -130 },
    // Mirabeau (Downhill right)
    { x: -10, y: 0, z: -110 },
    // Grand Hotel Hairpin (Tightest left hairpin)
    { x: -50, y: 0, z: -70 },
    { x: -80, y: 0, z: -100 },
    // Portier (Right turn)
    { x: -110, y: 0, z: -60 },
    // Tunnel & Lower Promenade (Winding curve)
    { x: -155, y: 0, z: 0 },
    { x: -175, y: 0, z: 70 },
    // Chicane & Tabac (Left-right chicanes near harbor)
    { x: -135, y: 0, z: 95 },
    { x: -100, y: 0, z: 115 },
  ],
  checkpoints: [
    {
      index: 0,
      position: { x: -80, y: 4, z: 160 },
      rotationY: Math.PI / 2,
      width: 32,
      height: 8,
      depth: 2,
    },
    {
      index: 1,
      position: { x: 110, y: 4, z: -100 },
      rotationY: Math.atan2(-30, -60),
      width: 32,
      height: 8,
      depth: 2,
    },
    {
      index: 2,
      position: { x: -50, y: 4, z: -70 },
      rotationY: Math.atan2(-30, -30),
      width: 32,
      height: 8,
      depth: 2,
    },
    {
      index: 3,
      position: { x: -155, y: 4, z: 0 },
      rotationY: Math.atan2(-20, 70),
      width: 32,
      height: 8,
      depth: 2,
    },
  ],
  placements: [
    {
      assetId: "ecoGrid",
      position: {
        x: 74,
        y: 0,
        z: -176,
      },
      rotationY: 3.46,
      scale: 1.66,
    },
    {
      assetId: "palm",
      position: {
        x: 83,
        y: 0,
        z: -180,
      },
      rotationY: 4.89,
      scale: 1,
    },
    {
      assetId: "ecoTerrace",
      position: {
        x: 80,
        y: 0,
        z: -179,
      },
      rotationY: 2.94,
      scale: 1.69,
    },
    {
      assetId: "twistedTower",
      position: {
        x: 74,
        y: 0,
        z: -173,
      },
      rotationY: 5.34,
      scale: 1.65,
    },
    {
      assetId: "ecoGrid",
      position: {
        x: 203,
        y: 0,
        z: 1,
      },
      rotationY: 3.89,
      scale: 1.51,
    },
    {
      assetId: "trafficLight",
      position: {
        x: 185,
        y: 0,
        z: 21,
      },
      rotationY: 2.21,
      scale: 1,
    },
    {
      assetId: "ecoGrid",
      position: {
        x: 183,
        y: 0,
        z: 37,
      },
      rotationY: 1.81,
      scale: 1.29,
    },
    {
      assetId: "ecoTerrace",
      position: {
        x: 196,
        y: 0,
        z: 27,
      },
      rotationY: 4.68,
      scale: 1.5,
    },
    {
      assetId: "ecoGrid",
      position: {
        x: -224,
        y: 0,
        z: 19,
      },
      rotationY: 1.5,
      scale: 1.59,
    },
    {
      assetId: "twistedTower",
      position: {
        x: -231,
        y: 0,
        z: 17,
      },
      rotationY: 4.19,
      scale: 1.42,
    },
    {
      assetId: "trafficLight",
      position: {
        x: -233,
        y: 0,
        z: 23,
      },
      rotationY: 1.69,
      scale: 1,
    },
    {
      assetId: "twistedTower",
      position: {
        x: -223,
        y: 0,
        z: 55,
      },
      rotationY: 5.47,
      scale: 1.69,
    },
    {
      assetId: "twistedTower",
      position: {
        x: -227,
        y: 0,
        z: 32,
      },
      rotationY: 5.5,
      scale: 1.21,
    },
    {
      assetId: "palm",
      position: {
        x: -60,
        y: 0,
        z: 215,
      },
      rotationY: 0,
      scale: 1.3,
    },
    {
      assetId: "palm",
      position: {
        x: -10,
        y: 0,
        z: 215,
      },
      rotationY: 0,
      scale: 1.35,
    },
    {
      assetId: "palm",
      position: {
        x: 30,
        y: 0,
        z: 215,
      },
      rotationY: 0,
      scale: 1.25,
    },
    {
      assetId: "trafficLight",
      position: {
        x: -45,
        y: 0,
        z: 215,
      },
      rotationY: 0,
      scale: 1,
    },
  ],
};

export const TRACK_REGISTRY: Record<string, TrackDef> = {
  [cityLoopV1Track.slug]: cityLoopV1Track,
  [cityMonacoTrack.slug]: cityMonacoTrack,
  [circuitMonzaTrack.slug]: circuitMonzaTrack,
  [circuitAustriaTrack.slug]: circuitAustriaTrack,
  [circuitBrandsTrack.slug]: circuitBrandsTrack,
  [circuitInterlagosTrack.slug]: circuitInterlagosTrack,
  [circuitIndyTrack.slug]: circuitIndyTrack,
  [circuitFundaTrack.slug]: circuitFundaTrack,
  [circuitSuburbanTrack.slug]: circuitSuburbanTrack,
  [stuntShowcaseTrack.slug]: stuntShowcaseTrack,
  [flatRoadPracticeTrack.slug]: flatRoadPracticeTrack,
};

export function getTracksByMode(mode: GameMode) {
  return Object.values(TRACK_REGISTRY).filter((track) => track.mode === mode);
}

export function getDefaultTrackForMode(mode: GameMode) {
  if (mode === "circuit") return cityLoopV1Track;
  if (mode === "stunt") return stuntShowcaseTrack;
  if (mode === "practice") return flatRoadPracticeTrack;
  return getTracksByMode(mode)[0] ?? cityLoopV1Track;
}

export function getTrackById(trackId?: bigint | number | string) {
  if (trackId === undefined || trackId === null)
    return getDefaultTrackForMode("circuit");
  const normalized = BigInt(trackId);
  return (
    Object.values(TRACK_REGISTRY).find((track) => track.id === normalized) ??
    getDefaultTrackForMode("circuit")
  );
}

export function getModeMeta(mode: GameMode) {
  return GAME_MODES.find((meta) => meta.id === mode) ?? GAME_MODES[0];
}

export const mvpTrack = cityLoopV1Track;
