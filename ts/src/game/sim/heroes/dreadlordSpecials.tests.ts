import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { type Roster } from "../roster";
import { controls } from "../testWorld";
import { copyFighterState } from "../../../generated/state/fighterState";
import { DREADLORD_SPECIALS } from "./dreadlordSpecials";
import { firstFighterDifference } from "../../replay/difference";
import { duelPair, stepDuel } from "../testDuel";

const H = HERO_REFERENCE_HEIGHT;
const BITE = DREADLORD_SPECIALS.side.ground.commandGrab!;


function pair(gap: number, target: Character = Character.sylvanas): { world: Roster; owner: Fighter; victim: Fighter } {
  const owner = createFighter(Character.dreadlord, -gap * 0.5, 1);
  owner.mana.points = 100;
  const victim = target === Character.sylvanas ? createReferenceContactFighter(gap * 0.5, -1) : createFighter(target, gap * 0.5, -1);
  const { world } = duelPair(owner, victim);
  return { world, owner, victim };
}

const side = controls({ specialPressed: true, specialX: 1, direction: 1 });

function play(world: Roster, last: number, first = controls(), second = controls()): void {
  for (let f = 2; f <= last; f++) stepDuel(world, first, second);
}

test("replaying Vampiric Pounce from a restored snapshot reproduces both fighters [k1 scenario]", () => {
  const { world, owner, victim } = pair(H);
  const savedOwner = createFighter(Character.dreadlord, 0.0, 1);
  const savedVictim = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedVictim, victim, 3);
  const run = () => {
    stepDuel(world, side);
    play(world, 70);
  };
  run();
  const endOwner = createFighter(Character.dreadlord, 0.0, 1);
  const endVictim = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endVictim, victim, 3);
  assertEquals(victim.status.damage, BITE.effect.damage);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(victim, savedVictim, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endVictim, victim, 3, 3), undefined);
});
