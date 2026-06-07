# Asset Pipeline

## Runtime Asset Folder

Runtime assets live under:

```text
public/assets/
  cars/
  circuit/maps/
  city/
  track/
  audio/
  skybox/
```

Asset paths used by the client are defined in `src/game/assets.ts`.

## Bundled Assets

### Cars

- `public/assets/cars/open-wheel-chassis.glb`
- `public/assets/cars/open-wheel-wheel.glb`

### Circuit Maps

- `public/assets/circuit/maps/*.json` — route data for mapped circuits

### Track Props

- `public/assets/track/start-banner.glb`
- `public/assets/track/cp-banner.glb`
- `public/assets/track/arrow-sign.glb`
- `public/assets/track/arrow-sign-left.glb`

### City

- `public/assets/city/road_001.glb`
- `public/assets/city/road_003.glb`
- `public/assets/city/Eco_Building_Grid.glb`
- `public/assets/city/Eco_Building_Slope.glb`
- `public/assets/city/Eco_Building_Terrace.glb`
- `public/assets/city/Regular_Building_TwistedTower_Large.glb`
- `public/assets/city/traffic_light_001.glb`
- `public/assets/city/Bus_Stop_02.glb`
- `public/assets/city/Palm_03.glb`

### Audio

- `public/assets/audio/engine4.wav`
- `public/assets/audio/car-brake1.mp3`
- `public/assets/audio/checkpoint_reached.wav`
- `public/assets/audio/lap_completed.wav`

### Skybox

- `public/assets/skybox/night/front.png`
- `public/assets/skybox/night/back.png`
- `public/assets/skybox/night/left.png`
- `public/assets/skybox/night/right.png`
- `public/assets/skybox/night/top.png`
- `public/assets/skybox/night/bottom.png`

## Optimization Rules

- Prefer separate GLBs over one giant GLB.
- Avoid shipping 10 MB billboard/tile GLBs in the first scene unless visually necessary.
- Keep first asset payload under 25 MB if possible.
- Use asset IDs in SpaceTimeDB, not asset binary data.
- Add compression later with `gltf-transform` or Draco only after the scene is stable.
