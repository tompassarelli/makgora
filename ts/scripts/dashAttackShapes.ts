import { AttackStyle, type Character, GroundAction } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";
import { authoredTuning, WORLD_UNITS_PER_MELEE_UNIT } from "../src/game/sim/tuning";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { attackDurationFramesForGrounding } from "../src/game/sim/moves";
import { digitalShieldstunFrames } from "../src/game/sim/shield";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { advanceFighterMotion } from "../src/game/sim/step";
import { beginFighterAttack } from "../src/game/sim/attacks";
import { type DashAttack, MEASURES, type Measure, ruleRange } from "./meleeDashAttacks";

export interface DashAttackRow {
  readonly fighter: string;
  readonly measures: readonly { readonly measure: Measure; readonly value: number; readonly least: number; readonly greatest: number; readonly pass: boolean }[];
}

function dashAttackStyle(character: Character): AttackStyle {
  return authoredTuning(character).moves?.dashAttack ?? AttackStyle.demonHunterDashAttack;
}

function travelByFrame(character: Character, style: AttackStyle, total: number): number[] {
  const fighter = createFighter(character, 0, 1);
  const world = createRoster(1, [fighter]);
  fighter.ground.action = GroundAction.run;
  fighter.motion.vx = fighter.tuning.physics.runSpeed;
  beginFighterAttack(world, 0, AttackStyle.dashAttack, false);
  if (fighter.attack.style !== style) throw new Error(`${fighterSlug(character)} did not start its dash attack from a run`);
  const steps: number[] = [];
  for (let frame = 0; frame < total; frame++) {
    const before = fighter.motion.x;
    advanceFighterMotion(world, 0, 0, 0, neutralControls(), 0);
    steps.push((fighter.motion.x - before) / WORLD_UNITS_PER_MELEE_UNIT);
  }
  return steps;
}

export function ourDashAttack(character: Character): DashAttack {
  const moves = authoredTuning(character).moves;
  const style = dashAttackStyle(character);
  const total = attackDurationFramesForGrounding(style, true, moves);
  const damageByFrame = new Map<number, number>();
  for (let frame = 0; frame < total; frame++) {
    for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
      const damage = authoredHitRegion(emptyHitRegion(), character, style, frame, 0, index, moves).effect.damage;
      if (damage > 0) damageByFrame.set(frame + 1, Math.max(damage, damageByFrame.get(frame + 1) ?? 0));
    }
  }
  const frames = [...damageByFrame.keys()];
  if (frames.length === 0) throw new Error(`${fighterSlug(character)} dash attack has no hit`);
  const startup = Math.min(...frames), lastActive = Math.max(...frames);
  const physics = authoredTuning(character).physics;
  return {
    name: fighterSlug(character), startup, lastActive, actionable: total + 1,
    damage: Math.max(...damageByFrame.values()), shieldstun: digitalShieldstunFrames(Math.max(...damageByFrame.values())),
    run: physics.runSpeed / WORLD_UNITS_PER_MELEE_UNIT, weight: physics.weight, travel: travelByFrame(character, style, total),
  };
}

const CHECKED = MEASURES.filter((m) => m.label !== "Shieldstun");

export function judgeDashAttack(d: DashAttack): DashAttackRow {
  return {
    fighter: d.name,
    measures: CHECKED.map((measure) => {
      const value = measure.of(d) ?? Number.NaN, { least, greatest } = ruleRange(measure);
      return { measure, value, least, greatest, pass: value >= least && value <= greatest };
    }),
  };
}

export const rosterDashAttacks = (): DashAttackRow[] => SELECTABLE_CHARACTERS.map((c) => judgeDashAttack(ourDashAttack(c)));
