# SpaceTimeDB Schema Plan

## Tables

### `player`

Stores one row per SpaceTimeDB identity.

| Column | Type | Notes |
| --- | --- | --- |
| `identity` | `identity` | Primary key |
| `name` | `string optional` | Display name |
| `online` | `bool` | Updated by lifecycle callbacks |
| `last_seen` | `timestamp` | Updated on connect/disconnect |

### `room`

Stores multiplayer rooms.

| Column | Type | Notes |
| --- | --- | --- |
| `room_id` | `u64` | Primary key, auto increment |
| `slug` | `string` | Unique join code |
| `track_id` | `u64` | Active track |
| `created_by` | `identity` | Owner |
| `created_at` | `timestamp` | Creation time |

### `room_member`

Stores active room membership.

| Column | Type | Notes |
| --- | --- | --- |
| `member_id` | `u64` | Primary key, auto increment |
| `room_id` | `u64` | Indexed |
| `identity` | `identity` | Indexed |
| `joined_at` | `timestamp` | Join time |
| `ready` | `bool` | MVP can default true |

### `car_state`

Stores latest networked car transform.

| Column | Type | Notes |
| --- | --- | --- |
| `identity` | `identity` | Primary key |
| `room_id` | `u64` | Indexed |
| `track_id` | `u64` | Active track |
| `x`, `y`, `z` | `f64` | Position |
| `qx`, `qy`, `qz`, `qw` | `f64` | Rotation quaternion |
| `speed` | `f64` | HUD/interpolation hint |
| `checkpoint_index` | `u32` | Latest checkpoint |
| `run_started_at_ms` | `u64` | Client run clock |
| `updated_at` | `timestamp` | Server timestamp |

### `track`

Stores playable tracks and fixed MVP layout metadata.

| Column | Type | Notes |
| --- | --- | --- |
| `track_id` | `u64` | Primary key, auto increment |
| `slug` | `string` | Unique |
| `name` | `string` | Display name |
| `layout_json` | `string` | JSON encoded checkpoints/spawns/assets |
| `created_at` | `timestamp` | Creation time |

### `checkpoint_event`

Stores checkpoint pass events for debugging and validation.

| Column | Type | Notes |
| --- | --- | --- |
| `event_id` | `u64` | Primary key, auto increment |
| `identity` | `identity` | Indexed |
| `room_id` | `u64` | Indexed |
| `track_id` | `u64` | Indexed |
| `checkpoint_index` | `u32` | Sequence |
| `elapsed_ms` | `u64` | Client elapsed time |
| `created_at` | `timestamp` | Server timestamp |

### `lap_result`

Stores completed lap attempts.

| Column | Type | Notes |
| --- | --- | --- |
| `lap_id` | `u64` | Primary key, auto increment |
| `identity` | `identity` | Indexed |
| `room_id` | `u64` | Indexed |
| `track_id` | `u64` | Indexed |
| `elapsed_ms` | `u64` | Final time |
| `checkpoint_count` | `u32` | Completion validation |
| `created_at` | `timestamp` | Server timestamp |

### `ghost_frame`

Stores sampled replay frames for best laps.

| Column | Type | Notes |
| --- | --- | --- |
| `frame_id` | `u64` | Primary key, auto increment |
| `lap_id` | `u64` | Indexed |
| `elapsed_ms` | `u64` | Frame time |
| `x`, `y`, `z` | `f64` | Position |
| `qx`, `qy`, `qz`, `qw` | `f64` | Rotation |
| `speed` | `f64` | Replay hint |

## Reducers

### `set_player_name(name)`

Validates non-empty `name`, upserts the caller's player row name.

### `join_or_create_room(slug)`

Finds a room by slug or creates it using the default MVP track. Upserts room membership and creates an initial car state.

### `leave_room(room_id)`

Removes caller from the room and deletes or marks stale their car state.

### `publish_car_state(room_id, track_id, transform...)`

Requires caller to be a room member. Updates the caller's `car_state`.

### `record_checkpoint(room_id, track_id, checkpoint_index, elapsed_ms)`

Requires room membership. Inserts a checkpoint event.

### `finish_lap(room_id, track_id, elapsed_ms, checkpoint_count)`

Requires room membership. Inserts a lap result. Later tasks can add server-side sequence validation.

### `record_ghost_frame(lap_id, elapsed_ms, transform...)`

Requires the lap to belong to the caller. Inserts sampled ghost frames.

## Lifecycle Reducers

- `clientConnected`: upsert `player` with `online = true`.
- `clientDisconnected`: set `online = false`.
