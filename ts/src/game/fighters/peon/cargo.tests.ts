import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { floorMod } from "wisp/src/sim/intMath";
import { createBufferedFrameControls } from "../../match/controls";
import { createPacingAndPresentation } from "../../match/pacingAndPresentation";
import { stepMatch } from "../../match/step";
import { Phase, createMatchState } from "../../lobby/lobbyState";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../../replay/snapshot";
import { AttackStyle, Character, GrabAction } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { type Controls, copyControls, createRoster } from "../../sim/roster";
import { controls, testBeginAttacks } from "../../sim/testWorld";
import { copyFighterState } from "../../../generated/state/fighterState";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";

const GAP = 40.0;
const idle = controls();
const mashing = (frame: number) => controls({ grabMashPressed: true, direction: floorMod(frame, 2) === 0 ? 1 : -1 });


const forwardThrow = (peon: Readonly<Fighter>): Controls => controls({ grabThrowX: peon.facing });





test("A rollback taken mid-hoist restores the hoist, and replaying the same inputs walks, carries and throws to the identical state [k1 scenario]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const peon = createFighter(Character.peon, 0.0, 1);
  const target = createFighter(Character.rifleman, GAP, -1);
  const world = createRoster(3, [peon, target]);
  const frameControls = createBufferedFrameControls();
  const runtime = createPacingAndPresentation();
  let frame = 0;
  const step = (input: Readonly<Controls>, held: Readonly<Controls>) => {
    frame++;
    copyControls(frameControls.inputs[0], input);
    copyControls(frameControls.inputs[1], held);
    stepMatch(game, world, frameControls, frame);
  };
  for (let i = 0; i < 3; i++) step(idle, idle);
  testBeginAttacks(world, AttackStyle.grab, undefined);
  while (peon.grab.action !== GrabAction.hold && frame < 60) step(idle, idle);
  step(forwardThrow(peon), idle);
  assertEquals(peon.grab.action, GrabAction.hoist);
  for (let i = 0; i < 4; i++) step(idle, idle);
  const snapshot = createReplaySnapshot();
  captureReplaySnapshot(snapshot, world, game, frameControls, runtime);
  const savedFrame = frame;
  const hoistFrame = peon.grab.frame;
  const script = (index: number): Controls => index < 20 ? controls({ direction: 1 }) : index < 26 ? controls({ direction: -1 }) : index === 26 ? controls({ cStickSideFlick: -1 }) : idle;
  const heldScript = (index: number): Controls => floorMod(index, 3) === 0 ? mashing(index) : idle;
  let sawCarry = false;
  for (let i = 0; i < 70; i++) {
    step(script(i), heldScript(i));
    sawCarry ||= peon.grab.action === GrabAction.carry && peon.motion.vx !== 0.0;
  }
  assertTrue(sawCarry);
  assertEquals(target.grab.owner, undefined);
  const expected = [createFighter(Character.peon, 0.0, 1), createFighter(Character.rifleman, 0.0, -1)];
  copyFighterState(expected[0]!, peon, world.mask);
  copyFighterState(expected[1]!, target, world.mask);
  restoreReplaySnapshot(snapshot, world, game, frameControls, runtime);
  frame = savedFrame;
  assertEquals(peon.grab.action, GrabAction.hoist);
  assertEquals(peon.grab.frame, hoistFrame);
  assertEquals(target.grab.owner, 0);
  for (let i = 0; i < 70; i++) step(script(i), heldScript(i));
  assertEquals(firstFighterDifference(expected[0]!, peon, world.mask, world.mask), undefined);
  assertEquals(firstFighterDifference(expected[1]!, target, world.mask, world.mask), undefined);
});
