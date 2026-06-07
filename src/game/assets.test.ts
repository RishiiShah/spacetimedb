import { describe, expect, it } from 'vitest';
import { assets } from './assets';

describe('game asset manifest', () => {
  it('uses optimized neutral open-wheel GLBs as the first car model', () => {
    expect(assets.cars.chassis).toBe('/assets/cars/open-wheel-chassis.glb');
    expect(assets.cars.wheel).toBe('/assets/cars/open-wheel-wheel.glb');
  });
});
