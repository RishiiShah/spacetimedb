# Runtime Assets

Curated assets bundled for the browser MVP. All paths are served from `/assets/...` at runtime.

## Layout

- `cars/` — open-wheel chassis and wheel GLBs
- `circuit/maps/` — JSON route data for mapped circuits
- `track/` — start/checkpoint banners and arrow signs
- `city/` — road segments, buildings, and props
- `audio/` — engine, brake, checkpoint, and lap sounds
- `skybox/night/` — cubemap faces for the night sky

Asset paths used by the client are defined in `src/game/assets.ts`.

## Adding Assets

Copy new files into the appropriate subfolder here. Keep the runtime payload small and add assets deliberately.
