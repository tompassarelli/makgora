import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { copyFighterState, sameFighterState } from "../../../generated/state/fighterState";
import { Character } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { applyHeroStatus } from "../../sim/heroStatus";
import { duelPair, stepDuel } from "../../sim/testDuel";
import { SHADOW_POISON, SHADOW_POISON_FRAMES } from "./specials";

const GAP = 90.0;






function stacked(stacks: number): { world: ReturnType<typeof duelPair>["world"]; maiev: Fighter; target: Fighter } {
  const maiev = createFighter(Character.warden, 0.0, 1);
  const target = createFighter(Character.rifleman, GAP, -1);
  const { world } = duelPair(maiev, target);
  for (let stack = 0; stack < stacks; stack++) applyHeroStatus(target, SHADOW_POISON);
  return { world, maiev, target };
}

test("The poison stacks roll back: restoring a saved fighter replays the same stacks, timer, burst damage and burst count [k1 scenario]", () => {
  const { world, target } = stacked(3);
  for (let frame = 0; frame < 50; frame++) stepDuel(world);
  const saved = createFighter(Character.rifleman, GAP, -1);
  copyFighterState(saved, target, 3);
  for (let frame = 0; frame < 80; frame++) stepDuel(world);
  const after = createFighter(Character.rifleman, GAP, -1);
  copyFighterState(after, target, 3);
  assertEquals(after.status.damage, 3.0);
  assertEquals(after.visuals.poisonBursts, 1);
  copyFighterState(target, saved, 3);
  assertTrue(sameFighterState(target, saved));
  assertEquals(target.status.poisonStacks, 3);
  assertEquals(target.status.poisonStackFrames, SHADOW_POISON_FRAMES - 50);
  assertEquals(target.visuals.poisonBursts, 0);
  for (let frame = 0; frame < 80; frame++) stepDuel(world);
  assertEquals(target.status.damage, after.status.damage);
  assertEquals(target.status.poisonStacks, after.status.poisonStacks);
  assertEquals(target.status.poisonStackFrames, after.status.poisonStackFrames);
  assertEquals(target.visuals.poisonBursts, after.visuals.poisonBursts);
});
