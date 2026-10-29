import { heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../../sim/specials/schema";
import { standinCastBody, standinHit, strike } from "./moves";

export interface StandinEffects {
  readonly bolt: string;
  readonly burst: string;
}

export function standinSpecials(character: number, effects: StandinEffects): FighterSpecials {
  const bolt: SpecialProjectile = {
    model: effects.bolt, spawnFrame: 16, offsetX: 40.0, offsetZ: 60.0, velocityX: 10.0, velocityZ: 0.0,
    life: 50, radius: 14.0, effect: standinHit(7.0, 35, 70.0, 22.0), reflectable: true, limit: 2,
  };
  const boltCast = (air: boolean): AuthoredSpecial => ({ endFrame: 40, landingLag: air ? 16 : undefined, hurt: standinCastBody(character, 6, 30), projectiles: [bolt] });
  const lunge = (air: boolean): AuthoredSpecial => ({
    endFrame: 42, landingLag: 22,
    motion: [{ ...frames(10, 18), velocityX: 16.0, velocityZ: air ? 1.5 : 0.0, stopsAtShield: true }],
    regions: [heroRegion(10, 18, strike(18.0, 40.0, 80.0, 52.0, 14.0), standinHit(10.0, 40, 90.0, 26.0))],
  });
  const rise: AuthoredSpecial = {
    endFrame: 40, landingLag: 24, oncePerAirtime: true, helpless: true,
    motion: [{ ...frames(10, 23), velocityX: 5.0, velocityZ: 23.0, driftSpeed: 2.0 }],
    regions: [heroRegion(10, 23, strike(-20.0, 50.0, 20.0, 125.0, 18.0), standinHit(7.0, 80, 75.0, 24.0))],
  };
  const burst = (air: boolean): AuthoredSpecial => ({
    endFrame: 46, landingLag: air ? 22 : undefined, hurt: standinCastBody(character, 8, 32),
    projectiles: [{ model: effects.burst, spawnFrame: 14, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
      life: 16, radius: 1.0, activeFrom: 17, effect: standinHit(0.0, 90), reflectable: false, limit: 2 }],
    regions: [heroRegion(16, 19, strike(-70.0, 24.0, 70.0, 24.0, 28.0), standinHit(12.0, 70, 92.0, 30.0))],
  });
  return {
    neutral: { name: "Bolt", description: "A straight shot across the stage. Shield it or jump it.", ground: boltCast(false), air: boltCast(true) },
    side: { name: "Lunge", description: "A short rush with a strike at the end. A shield stops the rush.", ground: lunge(false), air: lunge(true) },
    up: { name: "Rising Strike", description: "A hit that carries him upward, then he falls helpless.", ground: rise },
    down: { name: "Burst", description: "A blast on both sides of him. Stay out of reach or shield it.", ground: burst(false), air: burst(true) },
  };
}
