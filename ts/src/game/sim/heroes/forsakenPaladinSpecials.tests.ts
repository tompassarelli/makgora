import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { Character } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { type Roster } from "../roster";
import { controls } from "../testWorld";
import { duelPair, stepDuel } from "../testDuel";


function pair(gap: number, opponent: Character = Character.sylvanas): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.forsakenPaladin, f32(-gap * 0.5), 1);
  owner.mana.points = 100;
  const target = opponent === Character.sylvanas ? createReferenceContactFighter(f32(gap * 0.5), -1) : createFighter(opponent, f32(gap * 0.5), -1);
  return duelPair(owner, target);
}

const side = controls({ specialPressed: true, specialX: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

test("replaying Forsaken Paladin's Consecration and Righteous Fury restores every fighter field [k1 scenario]", () => {
  const { world, owner, target } = pair(70.0);
  stepDuel(world, down);
  const savedOwner = createFighter(Character.forsakenPaladin, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, -1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => { for (let f = 2; f <= 130; f++) stepDuel(world, f === 50 ? side : controls()); };
  run();
  const endOwner = createFighter(Character.forsakenPaladin, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, -1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  assertEquals(owner.mana.points, 100);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});
