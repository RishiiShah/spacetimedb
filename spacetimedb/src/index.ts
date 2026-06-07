import { schema, table, t, SenderError } from 'spacetimedb/server';

const player = table(
  { name: 'player', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.option(t.string()),
    online: t.bool(),
    lastSeen: t.timestamp(),
  }
);

const track = table(
  { name: 'track', public: true },
  {
    trackId: t.u64().primaryKey().autoInc(),
    slug: t.string().unique(),
    name: t.string(),
    layoutJson: t.string(),
    createdAt: t.timestamp(),
  }
);

const room = table(
  { name: 'room', public: true },
  {
    roomId: t.u64().primaryKey().autoInc(),
    slug: t.string().unique(),
    trackId: t.u64().index('btree'),
    createdBy: t.identity(),
    createdAt: t.timestamp(),
  }
);

const roomMember = table(
  {
    name: 'room_member',
    public: true,
    indexes: [
      {
        accessor: 'by_room_identity',
        algorithm: 'btree',
        columns: ['roomId', 'identity'],
      },
    ],
  },
  {
    memberId: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    identity: t.identity().index('btree'),
    joinedAt: t.timestamp(),
    ready: t.bool(),
  }
);

const carState = table(
  { name: 'car_state', public: true },
  {
    identity: t.identity().primaryKey(),
    roomId: t.u64().index('btree'),
    trackId: t.u64().index('btree'),
    x: t.f64(),
    y: t.f64(),
    z: t.f64(),
    qx: t.f64(),
    qy: t.f64(),
    qz: t.f64(),
    qw: t.f64(),
    speed: t.f64(),
    checkpointIndex: t.u32(),
    runStartedAtMs: t.u64(),
    updatedAt: t.timestamp(),
  }
);

const checkpointEvent = table(
  { name: 'checkpoint_event', public: true },
  {
    eventId: t.u64().primaryKey().autoInc(),
    identity: t.identity().index('btree'),
    roomId: t.u64().index('btree'),
    trackId: t.u64().index('btree'),
    checkpointIndex: t.u32(),
    elapsedMs: t.u64(),
    createdAt: t.timestamp(),
  }
);

const lapResult = table(
  { name: 'lap_result', public: true },
  {
    lapId: t.u64().primaryKey().autoInc(),
    identity: t.identity().index('btree'),
    roomId: t.u64().index('btree'),
    trackId: t.u64().index('btree'),
    elapsedMs: t.u64(),
    checkpointCount: t.u32(),
    createdAt: t.timestamp(),
  }
);

const ghostFrame = table(
  { name: 'ghost_frame', public: true },
  {
    frameId: t.u64().primaryKey().autoInc(),
    lapId: t.u64().index('btree'),
    elapsedMs: t.u64(),
    x: t.f64(),
    y: t.f64(),
    z: t.f64(),
    qx: t.f64(),
    qy: t.f64(),
    qz: t.f64(),
    qw: t.f64(),
    speed: t.f64(),
  }
);

const spacetimedb = schema({
  player,
  track,
  room,
  roomMember,
  carState,
  checkpointEvent,
  lapResult,
  ghostFrame,
});

export default spacetimedb;

const DEFAULT_TRACK_SLUG = 'city-sprint';
const DEFAULT_TRACK_NAME = 'City Sprint';
const DEFAULT_TRACK_LAYOUT = JSON.stringify({
  spawn: { x: 0, y: 0, z: 16, heading: 0 },
  checkpoints: [
    { index: 0, x: 0, y: 0, z: -52, radius: 12 },
    { index: 1, x: 42, y: 0, z: -126, radius: 12 },
    { index: 2, x: -34, y: 0, z: -196, radius: 12 },
    { index: 3, x: 0, y: 0, z: 16, radius: 14 },
  ],
});

export const init = spacetimedb.init(ctx => {
  if (!ctx.db.track.slug.find(DEFAULT_TRACK_SLUG)) {
    ctx.db.track.insert({
      trackId: 0n,
      slug: DEFAULT_TRACK_SLUG,
      name: DEFAULT_TRACK_NAME,
      layoutJson: DEFAULT_TRACK_LAYOUT,
      createdAt: ctx.timestamp,
    });
  }
});

export const onConnect = spacetimedb.clientConnected(ctx => {
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({
      ...existing,
      online: true,
      lastSeen: ctx.timestamp,
    });
  } else {
    ctx.db.player.insert({
      identity: ctx.sender,
      name: undefined,
      online: true,
      lastSeen: ctx.timestamp,
    });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({
      ...existing,
      online: false,
      lastSeen: ctx.timestamp,
    });
  }
});

export const setPlayerName = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    const trimmed = name.trim();
    if (!trimmed) throw new SenderError('Names must not be empty');
    const existing = ctx.db.player.identity.find(ctx.sender);
    if (!existing) throw new SenderError('Cannot set name before connecting');

    ctx.db.player.identity.update({ ...existing, name: trimmed });
  }
);

export const joinOrCreateRoom = spacetimedb.reducer(
  { slug: t.string() },
  (ctx, { slug }) => {
    const roomSlug = normalizeSlug(slug || 'demo');
    const defaultTrack = ctx.db.track.slug.find(DEFAULT_TRACK_SLUG);
    if (!defaultTrack) throw new SenderError('Default track is not initialized');

    let targetRoom = ctx.db.room.slug.find(roomSlug);
    if (!targetRoom) {
      ctx.db.room.insert({
        roomId: 0n,
        slug: roomSlug,
        trackId: defaultTrack.trackId,
        createdBy: ctx.sender,
        createdAt: ctx.timestamp,
      });
      targetRoom = ctx.db.room.slug.find(roomSlug);
    }
    if (!targetRoom) throw new SenderError('Room could not be created');

    const existingMembership = [
      ...ctx.db.roomMember.by_room_identity.filter([
        targetRoom.roomId,
        ctx.sender,
      ]),
    ][0];

    if (!existingMembership) {
      ctx.db.roomMember.insert({
        memberId: 0n,
        roomId: targetRoom.roomId,
        identity: ctx.sender,
        joinedAt: ctx.timestamp,
        ready: true,
      });
    }

    const existingCar = ctx.db.carState.identity.find(ctx.sender);
    const initialCar = {
      identity: ctx.sender,
      roomId: targetRoom.roomId,
      trackId: targetRoom.trackId,
      x: 0,
      y: 0,
      z: 16,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      speed: 0,
      checkpointIndex: 0,
      runStartedAtMs: 0n,
      updatedAt: ctx.timestamp,
    };

    if (existingCar) {
      ctx.db.carState.identity.update(initialCar);
    } else {
      ctx.db.carState.insert(initialCar);
    }
  }
);

export const leaveRoom = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const memberships = [
      ...ctx.db.roomMember.by_room_identity.filter([roomId, ctx.sender]),
    ];
    for (const membership of memberships) {
      ctx.db.roomMember.memberId.delete(membership.memberId);
    }

    const car = ctx.db.carState.identity.find(ctx.sender);
    if (car && car.roomId === roomId) {
      ctx.db.carState.identity.delete(ctx.sender);
    }
  }
);

export const publishCarState = spacetimedb.reducer(
  {
    roomId: t.u64(),
    trackId: t.u64(),
    x: t.f64(),
    y: t.f64(),
    z: t.f64(),
    qx: t.f64(),
    qy: t.f64(),
    qz: t.f64(),
    qw: t.f64(),
    speed: t.f64(),
    checkpointIndex: t.u32(),
    runStartedAtMs: t.u64(),
  },
  (ctx, state) => {
    requireMembership(ctx, state.roomId);
    const row = {
      identity: ctx.sender,
      ...state,
      updatedAt: ctx.timestamp,
    };
    const existing = ctx.db.carState.identity.find(ctx.sender);
    if (existing) {
      ctx.db.carState.identity.update(row);
    } else {
      ctx.db.carState.insert(row);
    }
  }
);

export const recordCheckpoint = spacetimedb.reducer(
  {
    roomId: t.u64(),
    trackId: t.u64(),
    checkpointIndex: t.u32(),
    elapsedMs: t.u64(),
  },
  (ctx, event) => {
    requireMembership(ctx, event.roomId);
    ctx.db.checkpointEvent.insert({
      eventId: 0n,
      identity: ctx.sender,
      ...event,
      createdAt: ctx.timestamp,
    });
  }
);

export const finishLap = spacetimedb.reducer(
  {
    roomId: t.u64(),
    trackId: t.u64(),
    elapsedMs: t.u64(),
    checkpointCount: t.u32(),
  },
  (ctx, result) => {
    requireMembership(ctx, result.roomId);
    ctx.db.lapResult.insert({
      lapId: 0n,
      identity: ctx.sender,
      ...result,
      createdAt: ctx.timestamp,
    });
  }
);

export const recordGhostFrame = spacetimedb.reducer(
  {
    lapId: t.u64(),
    elapsedMs: t.u64(),
    x: t.f64(),
    y: t.f64(),
    z: t.f64(),
    qx: t.f64(),
    qy: t.f64(),
    qz: t.f64(),
    qw: t.f64(),
    speed: t.f64(),
  },
  (ctx, frame) => {
    const lap = ctx.db.lapResult.lapId.find(frame.lapId);
    if (!lap || !lap.identity.equals(ctx.sender)) {
      throw new SenderError('Cannot record ghost frames for another player');
    }

    ctx.db.ghostFrame.insert({
      frameId: 0n,
      ...frame,
    });
  }
);

function requireMembership(ctx: any, roomId: bigint) {
  const membership = [
    ...ctx.db.roomMember.by_room_identity.filter([roomId, ctx.sender]),
  ][0];
  if (!membership) throw new SenderError('Player is not in this room');
}

function normalizeSlug(slug: string) {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);

  if (!normalized) throw new SenderError('Room code must contain a letter or number');
  return normalized;
}
