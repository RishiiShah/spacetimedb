export const assets = {
  cars: {
    chassis: "/assets/cars/open-wheel-chassis.glb",
    wheel: "/assets/cars/open-wheel-wheel.glb",
    steeringWheel: "/assets/cars/sndcar-f1-steering-wheel.glb",
    lowPoly: "/assets/cars/lowpoly-f1.glb",
  },
  track: {
    startBanner: "/assets/track/start-banner.glb",
    checkpointBanner: "/assets/track/cp-banner.glb",
    arrowRight: "/assets/track/arrow-sign.glb",
    arrowLeft: "/assets/track/arrow-sign-left.glb",
  },
  city: {
    roadStraight: "/assets/city/road_001.glb",
    roadCurve: "/assets/city/road_003.glb",
    ecoGrid: "/assets/city/Eco_Building_Grid.glb",
    ecoSlope: "/assets/city/Eco_Building_Slope.glb",
    ecoTerrace: "/assets/city/Eco_Building_Terrace.glb",
    twistedTower: "/assets/city/Regular_Building_TwistedTower_Large.glb",
    trafficLight: "/assets/city/traffic_light_001.glb",
    busStop: "/assets/city/Bus_Stop_02.glb",
    palm: "/assets/city/Palm_03.glb",
  },
  audio: {
    engine: "/assets/audio/engine4.wav",
    brake: "/assets/audio/car-brake1.mp3",
    screech: "/assets/audio/car-screeching.wav",
    checkpoint: "/assets/audio/checkpoint_reached.wav",
    lap: "/assets/audio/lap_completed.wav",
    countdownBeeps: "/assets/audio/countdown.ogg",
    countdownRally: "/assets/audio/countdown-go.wav",
    impact: "/assets/audio/car-metal-impact.ogg",
    ui: {
      countdown5: "/assets/audio/ui/5.wav",
      countdown4: "/assets/audio/ui/4.wav",
      countdown3: "/assets/audio/ui/3.wav",
      countdown2: "/assets/audio/ui/2.wav",
      countdown1: "/assets/audio/ui/1.wav",
      go: "/assets/audio/ui/GO.wav",
      full: "/assets/audio/ui/54321GO.wav",
    },
    // CC0 alternates from Kenney Starter Kit Racing (github.com/KenneyNL/Starter-Kit-Racing)
    kenney: {
      engine: "/assets/audio/kenney-engine.ogg",
      skid: "/assets/audio/kenney-skid.ogg",
    },
  },
  skybox: {
    night: [
      "/assets/skybox/night/right.png",
      "/assets/skybox/night/left.png",
      "/assets/skybox/night/top.png",
      "/assets/skybox/night/bottom.png",
      "/assets/skybox/night/front.png",
      "/assets/skybox/night/back.png",
    ],
  },
} as const;
