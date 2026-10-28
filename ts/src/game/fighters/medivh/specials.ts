import { heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../../sim/specials/schema";
import { medivhHit } from "./moves";

const OMEN: AuthoredSpecial = {
  endFrame: 60, landingLag: 18,
  projectiles: [{ spawnFrame: 12, offsetX: 40.0, offsetZ: 55.0,
    velocityX: 8.0, velocityZ: 0.0, life: 40, radius: 32.0,
    effect: medivhHit(10.567800521850586, 80, 50.66062545776367, 50.0), reflectable: true, limit: 1,
    model: "Abilities\\Weapons\\PriestMissile\\PriestMissile.mdl" }],
};
const BLINK_PASS = heroRegion(11, 11, { x1: 0.0, z1: 55.0, x2: 0.0, z2: 55.0, radius: 24.0, path: true },
  medivhHit(5.87100076675415, 90, 50.66062545776367, 60.0));
const vanish = (retreat: boolean): AuthoredSpecial => {
  const arrival = heroRegion(retreat ? 13 : 12, retreat ? 15 : 14,
    { x1: retreat ? -35.0 : 15.0, z1: 50.0, x2: retreat ? 35.0 : 100.0, z2: 50.0, radius: retreat ? 28.0 : 14.0 },
    medivhHit(retreat ? 5.87100076675415 : 8.219401359558105, 80, 41.44960403442383, 106.25));
  return {
    endFrame: 38, landingLag: 20, intangible: frames(9, 10), defensiveUse: retreat, helplessOnMiss: true,
    motion: [{ ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0 },
      { ...frames(10, 10), velocityX: retreat ? -120.0 : 180.0, velocityZ: 0.0, throughEdge: true },
      { ...frames(11, 38), velocityX: 0.0, velocityZ: 0.0 }],
    regions: retreat ? [arrival] : [BLINK_PASS, arrival],
  };
};
const RAVEN: AuthoredSpecial = {
  endFrame: 36, aimFrames: 8, oncePerAirtime: true, helpless: true, landingLag: 24,
  motion: [{ ...frames(1, 8), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(9, 28), velocityX: 0.0, velocityZ: 15.0, aimedSpeed: 15.0 }],
  regions: [heroRegion(9, 15, { x1: -25.0, z1: 45.0, x2: 25.0, z2: 65.0, radius: 20.0 }, medivhHit(5.87100076675415, 70))],
};

export const MEDIVH_SPECIALS: FighterSpecials = {
  neutral: { name: "Arcane Omen", description: "Send a slow omen ahead. Shield it or jump over it.", ground: OMEN },
  side: { name: "Vanishing Act", description: "Blink forward, popping up anyone you pass through, and strike. Your arrival is open to a punish.", ground: vanish(false) },
  up: { name: "Raven Flight", description: "Aim and become a raven. Fall helpless after the flight.", ground: RAVEN },
  down: { name: "Last Word", description: "Blink back and burst outward. Bait an impatient chase.", ground: vanish(true) },
};
