import { describe, expect, it } from 'vitest';
import { assets } from './assets';

describe('game asset manifest', () => {
  it('uses optimized neutral open-wheel GLBs as the first car model', () => {
    expect(assets.cars.chassis).toBe('/assets/cars/open-wheel-chassis.glb');
    expect(assets.cars.wheel).toBe('/assets/cars/open-wheel-wheel.glb');
  });

  it('includes a cockpit steering wheel model', () => {
    expect(assets.cars.steeringWheel).toBe(
      '/assets/cars/sndcar-f1-steering-wheel.glb',
    );
  });
});
