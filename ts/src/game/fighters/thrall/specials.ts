import { HitElement } from "../../sim/codes";
import { heroRegion, type MoveRegion } from "../../sim/heroMoves";
import { type AuthoredSpecial, type FighterSpecials } from "../../sim/specials/schema";
import { capsule, thrallHit } from "./moves";
import { GHOST_WOLF } from "./ghostWolf";
import { RISING_THUNDER } from "./risingThunder";
import { FERAL_SPIRIT } from "./wolves";

const CHAIN_ORIGIN_X = 42.0;
const CHAIN_ORIGIN_Z = 70.0;
const CHAIN_RANGE = 520.0;
const CHAIN_RADIUS = 14.0;
const chainRegion = (): MoveRegion => {
  const region = heroRegion(26, 31, capsule(CHAIN_ORIGIN_X, CHAIN_ORIGIN_Z, CHAIN_ORIGIN_X + CHAIN_RANGE, CHAIN_ORIGIN_Z, CHAIN_RADIUS),
    { ...thrallHit(9.0, 40, 78.87999725341797, 22.0, false, HitElement.electric), electric: true });
  return { ...region, hit: { ...region.hit, minZ: CHAIN_ORIGIN_Z - CHAIN_RANGE - CHAIN_RADIUS, maxZ: CHAIN_ORIGIN_Z + CHAIN_RANGE + CHAIN_RADIUS } };
};
const CHAIN_LIGHTNING: AuthoredSpecial = {
  endFrame: 58, beam: { originX: CHAIN_ORIGIN_X, originZ: CHAIN_ORIGIN_Z, range: CHAIN_RANGE, track: 0.0, chain: true },
  regions: [chainRegion()], landingLag: 18,
};

export const THRALL_SPECIALS: FighterSpecials = {
  neutral: { name: "Chain Lightning", description: "Call down a crackling bolt of lightning at where the nearest foe in front of him stood when he began; it does not follow them, so jump or shield it and punish the slow cast.", ground: CHAIN_LIGHTNING },
  side: GHOST_WOLF,
  up: { name: "Rising Thunder", description: "Erupt the earth under his palm and ride it skyward, sweeping the crackling Doomhammer up from level to straight overhead: the rise strikes again and again and the top launches. A hit leaves him free to swing again; a miss leaves him falling helpless.", ground: RISING_THUNDER },
  down: FERAL_SPIRIT,
};
