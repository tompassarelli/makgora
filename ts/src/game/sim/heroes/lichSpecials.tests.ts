import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
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


function lichPair(gap: number, opponent: Character = Character.rifleman): { world: Roster; lich: Fighter; target: Fighter } {
  const lich = createFighter(Character.lich, f32(-gap * 0.5), 1);
  lich.mana.points = 100;
  const target = createFighter(opponent, f32(gap * 0.5), -1);
  const { world } = duelPair(lich, target);
  return { world, lich, target };
}

const sideForward = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

test("replaying Lich's nova, armor and ascent from a restored snapshot reproduces both fighters [k1 scenario]", () => {
  const { world, lich, target } = lichPair(f32(H * f32(1.5)));
  const savedLich = createFighter(Character.lich, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedLich, lich, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    stepDuel(world, sideForward);
    for (let f = 2; f <= 60; f++) stepDuel(world);
    stepDuel(world, down);
    for (let f = 2; f <= 50; f++) stepDuel(world);
    stepDuel(world, up);
    for (let f = 2; f <= 40; f++) stepDuel(world, controls({ direction: 1 }));
  };
  run();
  assertGreaterThan(target.status.damage, 0.0);
  assertGreaterThan(lich.status.armorFrames, 0);
  const endLich = createFighter(Character.lich, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endLich, lich, 3);
  copyFighterState(endTarget, target, 3);
  copyFighterState(lich, savedLich, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endLich, lich, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

