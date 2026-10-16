import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { floorMod } from "wisp/src/sim/intMath";
import { queueAttack } from "../input/attackBuffer";
import { stateChecksum } from "../replay/canonical";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, GrabAction } from "../sim/codes";
import { PUMMEL_HOLD_COST, PUMMEL_TOTAL_FRAMES } from "../sim/moves";
import { copyControls, fighterAt } from "../sim/roster";
import { controls } from "../sim/testWorld";
import { type TestMatch, executeNext, testMatch } from "./testMatch";

function caught(character: Character): TestMatch {
  const match = testMatch(3, character);
  fighterAt(match.world, 0).motion.x = -40.0;
  fighterAt(match.world, 1).motion.x = 40.0;
  queueAttack(match.inputs.commands[0], { style: AttackStyle.grab, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 0; frame < 120 && fighterAt(match.world, 1).grab.owner !== 0; frame++) executeNext(match);
  assertEquals(fighterAt(match.world, 1).grab.owner, 0);
  return match;
}

function step(match: TestMatch, attack: boolean): void {
  copyControls(match.inputs.inputs[0], controls({ attackPressed: attack }));
  executeNext(match);
}

test("attack during a grab hold plays the pummel jab for about 3% a hit and returns to the hold, repeatedly [k3 measure #81]", () => {
  const match = caught(Character.rifleman);
  const owner = fighterAt(match.world, 0);
  const victim = fighterAt(match.world, 1);
  assertEquals(owner.grab.action, GrabAction.hold);
  let hits = 0;
  let played = false;
  let last = victim.status.damage;
  for (let frame = 0; frame < 40 && victim.grab.owner === 0; frame++) {
    step(match, true);
    played = played || owner.grab.action === GrabAction.pummel;
    if (victim.status.damage > last) {
      assertTrue(Math.abs(victim.status.damage - last - 3.0) < 0.5);
      hits++;
    }
    last = victim.status.damage;
  }
  assertTrue(played);
  assertTrue(hits >= 3);
  assertEquals(victim.grab.owner, 0);
});

test("a pummel cycle is six to eight frames and each hit spends grab time [k3 measure #81]", () => {
  assertTrue(PUMMEL_TOTAL_FRAMES >= 6 && PUMMEL_TOTAL_FRAMES <= 8);
  const match = caught(Character.rifleman);
  const victim = fighterAt(match.world, 1);
  const remaining = victim.grab.grabbedFrames;
  let frames = 0;
  while (victim.status.damage === 0 && frames < 30) {
    step(match, true);
    frames++;
  }
  assertTrue(victim.status.damage > 0);
  assertEquals(remaining - victim.grab.grabbedFrames, frames + PUMMEL_HOLD_COST);
});

test("a rollback replay of a pummel sequence matches bit for bit [k1 scenario]", () => {
  const match = caught(Character.rifleman);
  for (let frame = 0; frame < 10; frame++) step(match, floorMod(frame, 2) === 0);
  const saved = createReplaySnapshot();
  captureReplaySnapshot(saved, match.world, match.game, match.inputs, match.runtime);
  const probe = createReplaySnapshot();
  const first: string[] = [];
  const press = (frame: number) => floorMod(frame, 3) !== 1;
  for (let frame = 0; frame < 60; frame++) {
    step(match, press(frame));
    captureReplaySnapshot(probe, match.world, match.game, match.inputs, match.runtime);
    first.push(stateChecksum(probe));
  }
  const damage = fighterAt(match.world, 1).status.damage;
  assertTrue(damage > 0);
  restoreReplaySnapshot(saved, match.world, match.game, match.inputs, match.runtime);
  for (let frame = 0; frame < 60; frame++) {
    step(match, press(frame));
    captureReplaySnapshot(probe, match.world, match.game, match.inputs, match.runtime);
    assertEquals(stateChecksum(probe), first[frame], `frame ${frame}`);
  }
  assertEquals(fighterAt(match.world, 1).status.damage, damage);
});
