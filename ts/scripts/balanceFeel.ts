import { BALANCE_SPEC } from "./balance";
import { AttackStyle, Character, GrabAction, ProjectileKind } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { openDamageContacts, finishDamageContacts } from "../src/game/sim/contacts";
import { applyAttackHit } from "../src/game/sim/hits";
import { advanceFighter } from "../src/game/sim/step";
import { digitalShieldstunFrames } from "../src/game/sim/shield";
import { isAerialAttack } from "../src/game/sim/moves";
import { authoredTuning } from "../src/game/sim/tuning";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion, type HitEffect } from "../src/game/sim/hitRegions";
import { attackStartupFrames, attackDurationFramesForGrounding, attackLandingLag } from "../src/game/sim/moves";
import { authoredThrowEffect } from "../src/game/sim/grabs";
import { BEAR_SWIPE } from "../src/game/sim/summons";
import { originalProjectileEffect } from "../src/game/sim/projectiles";
import * as specials from "../src/game/sim/specials";
import { EYE_BEAM_GROUND_FRAMES, EYE_BEAM_GROUND_SHOT } from "../src/game/sim/eyeBeam";
import { currentKit } from "./balanceKit";
import type { FeelValues, FeelSample } from "./balanceKit";

const outcomes = new Map<string, boolean>();
const cache = new Map<string, number | undefined>();

function kills(effect: Readonly<HitEffect>, percent: number): boolean {
  const key = `${JSON.stringify(effect)}@${percent}`;
  const known = outcomes.get(key);
  if (known !== undefined) return known;
  const attacker = createFighter(Character.rifleman, -50, 1);
  const target = createFighter(Character.rifleman, 0, -1);
  target.motion.grounded = true;
  target.motion.z = 0;
  target.status.damage = percent;
  const world = createRoster(2, [attacker, target]);
  openDamageContacts();
  applyAttackHit(world, 0, 1, AttackStyle.jab, 1, effect, true, false);
  finishDamageContacts(world);
  const input = neutralControls();
  let out = false;
  for (let frame = 0; frame < BALANCE_SPEC.feelFlightFrames && !out; frame++) {
    advanceFighter(world, 1, 0, input, 0, frame);
    out = target.status.out;
  }
  outcomes.set(key, out);
  return out;
}

export function killPercent(effect: Readonly<HitEffect>): number | undefined {
  const key = JSON.stringify(effect);
  if (cache.has(key)) return cache.get(key);
  if (!kills(effect, BALANCE_SPEC.feelMaxPercent)) { cache.set(key, undefined); return undefined; }
  let low = 0;
  let high: number = BALANCE_SPEC.feelMaxPercent;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (kills(effect, middle)) high = middle; else low = middle + 1; }
  cache.set(key, low);
  return low;
}

export type KillMeasure = (path: string, effect: Readonly<HitEffect>) => number | undefined;

export function killPercentNear(baseline: FeelValues): KillMeasure {
  return (path, effect) => {
    const before = baseline[path]?.killPercent;
    if (before === undefined) return killPercent(effect);
    const low = Math.ceil(before - before * BALANCE_SPEC.killFraction - 1e-8);
    const high = Math.min(BALANCE_SPEC.feelMaxPercent, Math.floor(before + before * BALANCE_SPEC.killFraction + 1e-8));
    return kills(effect, high) && (low === 0 || !kills(effect, low - 1)) ? before : killPercent(effect);
  };
}

export function currentFeel(character: Character, measure: KillMeasure = (_, effect) => killPercent(effect)): FeelValues {
  const tuning = authoredTuning(character);
  const out: Record<string, FeelSample> = {};
  const put = (path: string, effect: Readonly<HitEffect>, recovery: number, aerial: boolean): void => {
    const kill = measure(path, effect);
    out[path] = { advantage: digitalShieldstunFrames(effect.damage, aerial) - recovery, ...(kill === undefined ? {} : { killPercent: kill }) };
  };
  for (const style of Object.values(AttackStyle)) {
    if (style === AttackStyle.grab) continue;
    const aerial = isAerialAttack(style);
    const startup = attackStartupFrames(style, tuning.moves);
    const total = attackDurationFramesForGrounding(style, !aerial, tuning.moves);
    for (let index = 0; index < authoredHitRegionCount(style, tuning.moves); index++) for (let frame = startup; frame < total; frame++) {
      const hit = authoredHitRegion(emptyHitRegion(), character, style, frame, 0, index, tuning.moves);
      if (hit.effect.damage > 0) {
        put(`normal.${style}.hit.${index}`, hit.effect, aerial ? attackLandingLag(style, tuning.moves) : total - frame - 1, aerial);
        if (hit.groundedEffect !== undefined) put(`normal.${style}.hit.${index}.grounded`, hit.groundedEffect, aerial ? attackLandingLag(style, tuning.moves) : total - frame - 1, aerial);
        break;
      }
    }
  }
  const isEffect = (value: unknown): value is Readonly<HitEffect> => typeof value === "object" && value !== null
    && "damage" in value && typeof value.damage === "number" && "growth" in value && typeof value.growth === "number"
    && "base" in value && typeof value.base === "number" && "launchX" in value && typeof value.launchX === "number"
    && "launchZ" in value && typeof value.launchZ === "number" && "electric" in value && typeof value.electric === "boolean";
  const visit = (row: unknown, path: string, end: number): void => {
    if (row === null || typeof row !== "object") return;
    const actionEnd = "endFrame" in row && typeof row.endFrame === "number" ? row.endFrame : end;
    if ("firstFrame" in row && typeof row.firstFrame === "number" && "hit" in row && typeof row.hit === "object" && row.hit !== null) {
      const hit = row.hit;
      if ("effect" in hit && isEffect(hit.effect) && hit.effect.damage > 0) put(path, hit.effect, actionEnd - row.firstFrame - 1, false);
      if ("groundedEffect" in hit && isEffect(hit.groundedEffect)) put(`${path}.grounded`, hit.groundedEffect, actionEnd - row.firstFrame - 1, false);
    }
    if ("spawnFrame" in row && typeof row.spawnFrame === "number" && "effect" in row && isEffect(row.effect)) put(path, row.effect, Math.max(0, actionEnd - row.spawnFrame), false);
    for (const [name, child] of Object.entries(row)) visit(child, `${path}.${name}`, actionEnd);
  };
  visit(tuning.specials, "special", 0);
  for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const kill = measure(`throw.${action}`, authoredThrowEffect(action, tuning.moves));
    out[`throw.${action}`] = { advantage: 0, ...(kill === undefined ? {} : { killPercent: kill }) };
  }
  if (character === Character.rifleman || character === Character.demonHunter) {
    const values = currentKit(character).values;
    const number = (name: string): number => Object.entries(values).find(([path]) => path.endsWith(`.${name}`))?.[1] ?? 0;
    const firstProjectile = createFighter(character, 0, 1).projectiles[0];
    if (firstProjectile === undefined) throw new Error("Original fighter has no projectile slot");
    const projectile = { ...firstProjectile };
    for (const kind of character === Character.rifleman ? [ProjectileKind.blaster, ProjectileKind.recoil] : [ProjectileKind.eyeBeam]) {
      projectile.kind = kind;
      projectile.damageMultiplier = 1;
      const duration = kind === ProjectileKind.blaster ? number("RIFLEMAN_BLASTER_GROUND_FRAMES") : kind === ProjectileKind.recoil ? number("RIFLEMAN_RECOVERY_FRAMES") : EYE_BEAM_GROUND_FRAMES;
      const spawn = kind === ProjectileKind.blaster ? number("RIFLEMAN_BLASTER_GROUND_SHOT_FRAME") : kind === ProjectileKind.recoil ? specials.RIFLEMAN_RECOVERY_STARTUP_FRAMES : EYE_BEAM_GROUND_SHOT;
      put(`special.projectile.${kind}`, originalProjectileEffect(projectile), duration - spawn, false);
    }
    if (character === Character.rifleman) {
      put("special.bear", BEAR_SWIPE, specials.RIFLEMAN_BEAR_SUMMON_FRAMES - specials.RIFLEMAN_BEAR_CAST_FRAMES, false);
    } else {
      const rush = specials.felRushRegion(specials.FEL_RUSH_FIRST);
      put("special.rush", rush.effect, specials.FEL_RUSH_FRAMES - specials.FEL_RUSH_FIRST, false);
      for (const grounded of [false,true]) put(`special.immolate.${grounded}`, specials.immolationRegion(grounded).effect, specials.DEMONHUNTER_IMMOLATE_DURATION - specials.DEMONHUNTER_IMMOLATE_STARTUP, false);
      put("special.dive", specials.wingDiveRegion(specials.DEMONHUNTER_DIVE_FORM, 0).effect, specials.DEMONHUNTER_DIVE_FRAMES, false);
    }
  }
  return out;
}
