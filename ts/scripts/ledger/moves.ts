import { AttackStyle } from "../../src/game/sim/codes";
import { MURLOC_MOVES } from "../../src/game/fighters/murloc/moves";
import { WARDEN_MOVES } from "../../src/game/fighters/warden/moves";
import { WARDEN_SPECIALS } from "../../src/game/fighters/warden/specials";
import { ILLIDAN_MOVES } from "../../src/game/sim/originalMoves";
import { EYE_BEAM_AIR_FRAMES, EYE_BEAM_AIR_SHOT, EYE_BEAM_GROUND_FRAMES, EYE_BEAM_GROUND_SHOT, EYE_BEAM_LANDING_LAG } from "../../src/game/sim/eyeBeam";
import type { AuthoredSpecial } from "../../src/game/sim/specials/schema";
import type { FighterMoves } from "../../src/game/sim/heroMoves";
import type { HitEffect } from "../../src/game/sim/hitRegions";
import { type LedgerRow, PARITY, shortNumber } from "./row";

export const FOX_NEUTRAL_AIR = { damage: 12, base: 10, growth: 100, angle: "361" } as const;

const FOX_NEUTRAL_AIR_PAGE = "https://www.ssbwiki.com/Fox_(SSBM)/Neutral_aerial";
const WARDEN = "ts/src/game/fighters/warden/moves.ts";
const WARDEN_SPECIALS_FILE = "ts/src/game/fighters/warden/specials.ts";
const FOX_SHINE = "set 80, growth 100, base 0";
const FOX_SHINE_PAGE = "https://www.ssbwiki.com/Fox_(SSBM)/Down_special";
const ILLIDAN = "ts/src/game/sim/originalMoves.ts";
const SPLIT_TIMING = "active 6-10, interruptible 46, charge between 2-3";
const SPLIT_ANGLE = "25°";
const FOX_DOWN_SMASH_PAGE = "https://www.ssbwiki.com/Fox_(SSBM)/Down_smash";
const FALCO_DOWN_SMASH_PAGE = "https://www.ssbwiki.com/Falco_(SSBM)/Down_smash";
const FOX_BLASTER_PAGE = "https://www.ssbwiki.com/Blaster_(Fox)";
const FALCO_BLASTER_PAGE = "https://www.ssbwiki.com/Blaster_(Falco)";
const EYE_BEAM_FILE = "ts/src/game/sim/eyeBeam.ts";

function laserTiming(special: AuthoredSpecial | undefined): string {
  const shot = special?.projectiles?.[0];
  if (special === undefined || shot === undefined) throw new Error("Maiev's Shadow Strike has no dagger");
  return `${shot.spawnFrame} of ${special.endFrame}`;
}

const MURLOC = "ts/src/game/fighters/murloc/moves.ts";
const FOX_DOWN_TILT = { undocumented: "Fox's down tilt sweeps his tail along the floor, and no Melee page gives its reach in units", source: "https://www.ssbwiki.com/Fox_(SSBM)/Down_tilt" } as const;
const LEG_SWEEP = { kind: "deviation", reason: "her down tilt is a low leg sweep, so its region follows the sweeping leg along the floor in front and keeps the old reach; frame data, damage and knockback are unchanged", decided: "2026-10-26", issue: 517 } as const;
const SQUIRTLE_JAB = { undocumented: "Murloc's jab follows Squirtle's, who is not in Melee, and no Melee page gives a jab's reach in units", source: "https://www.ssbwiki.com/Squirtle_(SSBB)/Neutral_attack" } as const;
const SPEAR_POINT = { kind: "deviation", reason: "his jab regions run to the spear point, so the point-first stabs hit where the point lands; frame data, damage and knockback are unchanged", decided: "2026-10-26", issue: 497 } as const;
const FLAT_SLIDE = { kind: "deviation", reason: "Fox's 12% at base 10, growth 100 passes the Sakurai angle's 32 at 0% and lifts a grounded victim at 44 degrees, so it techs before her jab or grab; on Fox's falls she lands 3 frames later than on Falco's, so the 12 frames of hitstun the Sakurai angle allows under 32 no longer cover her landing; 6.1% at base 37, growth 8 and a flat 0 degrees makes 39-40 from 0 to 30% with 15-16 frames of hitstun and slides a grounded victim along the floor, which makes her neutral air into grab true and into jab DI-dependent", decided: "2026-10-27", issue: 580 } as const;

function fanKnockback(form: "ground" | "air"): string {
  const effect = WARDEN_SPECIALS.down?.[form]?.regions?.[0]?.hit.effect;
  if (effect === undefined) throw new Error(`Maiev's ${form} Fan of Knives has no hit`);
  return `set ${shortNumber(effect.setKnockback ?? 0)}, growth ${shortNumber(effect.growth)}, base ${shortNumber(effect.base)}`;
}

export function maievNeutralAir(): HitEffect[] {
  const regions = WARDEN_MOVES.normals[AttackStyle.neutralAir]?.regions ?? [];
  return [...new Set(regions.flatMap((region) => [region.hit.effect, ...(region.hit.groundedEffect === undefined ? [] : [region.hit.groundedEffect as HitEffect])]))];
}

function only<T>(read: (effect: HitEffect) => T): T {
  const values = [...new Set(maievNeutralAir().map(read))];
  const [value] = values;
  if (values.length !== 1 || value === undefined) throw new Error(`Maiev's neutral air hits disagree: ${values.join(", ")}`);
  return value;
}

function murlocReach(style: AttackStyle): number {
  const region = MURLOC_MOVES.normals[style]?.regions[0];
  if (region === undefined) throw new Error(`Murloc's attack style ${style} has no hit region`);
  return region.hit.maxX;
}

function downSmashTiming(moves: FighterMoves): string {
  const move = moves.normals[AttackStyle.downSmash];
  if (move === undefined) throw new Error("no authored down smash");
  const charge = move.chargeFrame ?? move.startupFrames - 1;
  return `active ${move.startupFrames + 1}-${move.startupFrames + move.activeFrames}, interruptible ${move.totalFrames + 1}, charge between ${charge + 1}-${charge + 2}`;
}

function downSmashAngle(moves: FighterMoves): string {
  const angles = [...new Set((moves.normals[AttackStyle.downSmash]?.regions ?? []).map((region) => angle(region.hit.effect)))];
  const [value] = angles;
  if (angles.length !== 1 || value === undefined) throw new Error(`down smash angles disagree: ${angles.join(", ")}`);
  return value;
}

function maievDownTiltReach(): number {
  const regions = WARDEN_MOVES.normals[AttackStyle.downTilt]?.regions ?? [];
  if (regions.length === 0) throw new Error("Maiev's down tilt has no hit region");
  return Math.max(...regions.map((region) => region.hit.maxX));
}

const angle = (effect: HitEffect): string => (effect.sakurai === true ? FOX_NEUTRAL_AIR.angle : `${Math.round((Math.atan2(effect.launchZ, Math.abs(effect.launchX)) * 180) / Math.PI)}°`);

export const MOVE_ROWS: readonly LedgerRow[] = [
  {
    id: "maiev-shadow-strike-timing", family: "moves", name: "Maiev's Shadow Strike startup and total frames",
    melee: { value: "ground 10 of 36, air 10 of 36", source: FOX_BLASTER_PAGE },
    ours: () => `ground ${laserTiming(WARDEN_SPECIALS.neutral.ground)}, air ${laserTiming(WARDEN_SPECIALS.neutral.air)}`,
    anchor: { file: WARDEN_SPECIALS_FILE, symbol: "WARDEN_SPECIALS" }, status: { kind: "parity", reason: "the dagger leaves on Fox's laser frame and she acts when his laser ends, one after another with nothing in between; the dagger's speed, damage, mark and poison are hers", decided: "2026-10-28" },
  },
  {
    id: "maiev-shadow-strike-landing", family: "moves", name: "Maiev's aerial Shadow Strike landing",
    melee: { value: "0 frames, landing ends the laser", source: FOX_BLASTER_PAGE },
    ours: () => `${WARDEN_SPECIALS.neutral.air?.landingLag} frames, landing ends the laser`,
    anchor: { file: WARDEN_SPECIALS_FILE, symbol: "WARDEN_SPECIALS" }, status: { kind: "parity", reason: "an aerial dagger landing cancels the move at once with no landing lag, as Fox's short-hop laser does", decided: "2026-10-28" },
  },
  {
    id: "illidan-eye-beam-timing", family: "moves", name: "Illidan's Eye Beam startup and total frames",
    melee: { value: "ground 23 of 57, air 13 of 42", source: FALCO_BLASTER_PAGE },
    ours: () => `ground ${EYE_BEAM_GROUND_SHOT} of ${EYE_BEAM_GROUND_FRAMES}, air ${EYE_BEAM_AIR_SHOT} of ${EYE_BEAM_AIR_FRAMES}`,
    anchor: { file: EYE_BEAM_FILE, symbol: "EYE_BEAM_GROUND_SHOT" }, status: { kind: "parity", reason: "the beam leaves on Falco's laser frame and he acts when it ends, with no cooldown and no cap on beams in flight; the beam's reach and hit are his own", decided: "2026-10-28" },
  },
  {
    id: "illidan-eye-beam-landing", family: "moves", name: "Illidan's aerial Eye Beam landing",
    melee: { value: "0 frames, landing ends the laser", source: FALCO_BLASTER_PAGE },
    ours: () => `${EYE_BEAM_LANDING_LAG} frames, landing ends the laser`,
    anchor: { file: EYE_BEAM_FILE, symbol: "EYE_BEAM_LANDING_LAG" }, status: { kind: "parity", reason: "an aerial beam landing cancels the move at once with no landing lag, as Falco's short-hop laser does", decided: "2026-10-28" },
  },
  {
    id: "maiev-fan-of-knives-ground-knockback", family: "moves", name: "Maiev's ground Fan of Knives knockback",
    melee: { value: FOX_SHINE, source: FOX_SHINE_PAGE }, ours: () => fanKnockback("ground"),
    anchor: { file: WARDEN_SPECIALS_FILE, symbol: "WARDEN_SPECIALS" }, status: { kind: "parity", reason: "set knockback gives the same knockback and hitstun at every percent and varies only with the foe's weight, so her ground Fan of Knives stuns a foe for the frames Fox's shine does, a light foe tumbling from it and an average or heavy one not", decided: "2026-10-27" },
  },
  {
    id: "maiev-fan-of-knives-air-knockback", family: "moves", name: "Maiev's air Fan of Knives knockback",
    melee: { value: FOX_SHINE, source: FOX_SHINE_PAGE }, ours: () => fanKnockback("air"),
    anchor: { file: WARDEN_SPECIALS_FILE, symbol: "WARDEN_SPECIALS" }, status: PARITY,
  },
  {
    id: "maiev-neutral-air-angle", family: "moves", name: "Maiev's neutral air launch angle",
    melee: { value: FOX_NEUTRAL_AIR.angle, source: FOX_NEUTRAL_AIR_PAGE }, ours: () => only(angle),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: FLAT_SLIDE,
  },
  {
    id: "maiev-neutral-air-damage", family: "moves", name: "Maiev's neutral air damage",
    melee: { value: FOX_NEUTRAL_AIR.damage, source: FOX_NEUTRAL_AIR_PAGE }, ours: () => only((effect) => effect.damage),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: FLAT_SLIDE,
  },
  {
    id: "maiev-neutral-air-knockback", family: "moves", name: "Maiev's neutral air base knockback and growth",
    melee: { value: `base ${FOX_NEUTRAL_AIR.base}, growth ${FOX_NEUTRAL_AIR.growth}`, source: FOX_NEUTRAL_AIR_PAGE },
    ours: () => only((effect) => `base ${shortNumber(effect.base)}, growth ${shortNumber(effect.growth)}`),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: FLAT_SLIDE,
  },
  {
    id: "maiev-down-smash-timing", family: "moves", name: "Maiev's down smash, the splits: active frames, interruptible frame and charge frame",
    melee: { value: SPLIT_TIMING, source: FOX_DOWN_SMASH_PAGE }, ours: () => downSmashTiming(WARDEN_MOVES),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: PARITY,
  },
  {
    id: "maiev-down-smash-angle", family: "moves", name: "Maiev's down smash launch angle, front and back",
    melee: { value: SPLIT_ANGLE, source: FOX_DOWN_SMASH_PAGE }, ours: () => downSmashAngle(WARDEN_MOVES),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: PARITY,
  },
  {
    id: "illidan-down-smash-timing", family: "moves", name: "Illidan's down smash, the splits: active frames, interruptible frame and charge frame",
    melee: { value: SPLIT_TIMING, source: FALCO_DOWN_SMASH_PAGE }, ours: () => downSmashTiming(ILLIDAN_MOVES),
    anchor: { file: ILLIDAN, symbol: "ILLIDAN_MOVES" }, status: PARITY,
  },
  {
    id: "illidan-down-smash-angle", family: "moves", name: "Illidan's down smash launch angle, front and back",
    melee: { value: SPLIT_ANGLE, source: "https://www.fightcore.gg/characters/218/falco/moves/1330/dsmash/" }, ours: () => downSmashAngle(ILLIDAN_MOVES),
    anchor: { file: ILLIDAN, symbol: "ILLIDAN_MOVES" }, status: PARITY,
  },
  {
    id: "murloc-jab-reach", family: "moves", name: "Murloc's jab 1 reach",
    melee: SQUIRTLE_JAB, ours: () => murlocReach(AttackStyle.jab),
    anchor: { file: MURLOC, symbol: "MURLOC_MOVES" }, status: SPEAR_POINT,
  },
  {
    id: "murloc-jab2-reach", family: "moves", name: "Murloc's jab 2 reach",
    melee: SQUIRTLE_JAB, ours: () => murlocReach(AttackStyle.jab2),
    anchor: { file: MURLOC, symbol: "MURLOC_MOVES" }, status: SPEAR_POINT,
  },
  {
    id: "maiev-down-tilt-reach", family: "moves", name: "Maiev's down tilt reach",
    melee: FOX_DOWN_TILT, ours: maievDownTiltReach,
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: LEG_SWEEP,
  },
];
