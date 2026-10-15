import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type Roster } from "../roster";
import { controls } from "../testWorld";
import { copyFighterState } from "../../../generated/state/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { duelPair, stepDuel } from "../testDuel";

const H = HERO_REFERENCE_HEIGHT;
const down = controls({ specialPressed: true, specialZ: -1 });

function pitLord(x: number, facing: number): Fighter {
  const f = createFighter(Character.pitLord, x, facing);
  f.mana.points = 100;
  return f;
}



function pair(gap: number, facing = 1, opponent: Character = Character.rifleman): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = pitLord(f32(-gap * 0.5 * facing), facing);
  const target = createFighter(opponent, f32(gap * 0.5 * facing), -facing);
  return duelPair(owner, target);
}

test("rollback restores Pit Lord's falling fire and repeats the same contact [k1 scenario]", () => {
  const { world, owner, target } = pair(f32(H * f32(1.8)));
  for (let f = 1; f <= 30; f++) stepDuel(world, f === 1 ? down : controls());
  assertTrue(owner.projectiles.some(p => p.life > 0));
  const savedOwner = createFighter(Character.pitLord, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  for (let f = 0; f < 12; f++) stepDuel(world);
  const expectedOwner = createFighter(Character.pitLord, 0.0, 1);
  const expectedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(expectedOwner, owner, 3);
  copyFighterState(expectedTarget, target, 3);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  for (let f = 0; f < 12; f++) stepDuel(world);
  assertEquals(firstFighterDifference(expectedOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(expectedTarget, target, 3, 3), undefined);
});
