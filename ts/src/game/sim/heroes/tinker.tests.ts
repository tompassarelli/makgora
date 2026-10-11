import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { controls } from "../testWorld";
import { AUTHORED_PHYSICS } from "../tuning";
import { duelPair, stepDuel } from "../testDuel";

test("Tinker body preserves the named Ultimate ROB weight, run and air speed [k4 reference ssbu]", () => {
  const f = createFighter(Character.tinker, 0.0, 1);
  const reference = AUTHORED_PHYSICS.reference;
  assertNear(f.tuning.physics.weight, 106.0, f32(0.001));
  assertNear(f.tuning.physics.runSpeed / reference.runSpeed, f32(f32(1.725) / f32(2.2)), f32(0.00001));
  assertNear(f.tuning.physics.airSpeed / reference.airSpeed, f32(f32(1.134) / f32(0.83)), f32(0.00001));
});


/** The frame (1 = the press) Robo-Goblin first damages a still target `gap` units ahead, or 0 if it never does. */
function roboContact(gap: number, facing: number): number {
  const owner = createFighter(Character.tinker, -facing * gap * 0.5, facing);
  const victim = createReferenceContactFighter(facing * gap * 0.5, -facing);
  const { world } = duelPair(owner, victim);
  for (let f = 1; f <= 46; f++) {
    stepDuel(world, f === 1 ? controls({ specialPressed: true, specialZ: -1 }) : controls());
    if (victim.status.damage > 0) return f;
  }
  return 0;
}

// #414: Tom found Robo-Goblin fast and easy to hit (contact 14, a 177-unit gap); the tune holds it to 17 and 163.
test("Robo-Goblin connects no sooner than frame 17 and only inside a 163-unit gap, facing either way [k2 property]", () => {
  const gaps = [164];
  for (let gap = 40; gap <= 199; gap += 3) gaps.push(gap);
  for (const gap of gaps) {
    const right = roboContact(gap, 1);
    assertEquals(roboContact(gap, -1), right, `facing mirrors at gap ${gap}`);
    if (gap <= 151) assertEquals(right, 17, `point-blank contact at gap ${gap}`);
    else if (gap <= 163) assertEquals(right >= 17 && right <= 20, true, `charged contact at gap ${gap} on ${right}`);
    else assertEquals(right, 0, `no contact at gap ${gap}`);
  }
});
