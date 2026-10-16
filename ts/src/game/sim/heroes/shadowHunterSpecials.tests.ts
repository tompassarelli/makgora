import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { type Roster } from "../roster";
import { controls } from "../testWorld";
import { copyFighterState } from "../../../generated/state/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { duelPair, stepDuel } from "../testDuel";


function pair(gap: number, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.shadowHunter, -gap * f32(0.5) * facing, facing);
  owner.mana.points = 100;
  const target = createFighter(Character.rifleman, gap * f32(0.5) * facing, -facing);
  return duelPair(owner, target);
}

const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });

function placeWard(world: Roster): void {
  stepDuel(world, side);
  for (let f = 2; f <= 26; f++) stepDuel(world);
}

test("replaying a ward from a restored snapshot reproduces every fighter field [k1 scenario]", () => {
  const { world, owner, target } = pair(400.0);
  placeWard(world);
  const savedOwner = createFighter(Character.shadowHunter, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    for (let f = 0; f < 140; f++) stepDuel(world, f === 10 ? neutral : controls());
  };
  run();
  const endOwner = createFighter(Character.shadowHunter, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

test("Shadow Hunter's Serpent Ward and its recall stop his slide on the spot [k2 property]", () => {
  const hunter = createFighter(Character.shadowHunter, 0.0, 1);
  const { world } = duelPair(hunter, createFighter(Character.rifleman, 900.0, -1));
  const SIDE = controls({ specialPressed: true, specialX: 1, direction: 1 });
  for (const move of ["Serpent Ward", "Recall"]) {
    hunter.motion.vx = hunter.tuning.physics.runSpeed;
    stepDuel(world, SIDE);
    const x = hunter.motion.x;
    assertEquals(hunter.special.action, SpecialAction.heroSide, move);
    for (let tick = 0; tick < 60 && hunter.special.action !== SpecialAction.none; tick++) {
      stepDuel(world);
      assertEquals(hunter.motion.x, x, `${move} tick ${tick}`);
    }
  }
});
