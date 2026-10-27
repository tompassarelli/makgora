import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { type Scene, fighter, frame, scene } from "../../match/padScene";
import { canAct } from "../../match/training";
import { Character } from "../../sim/codes";

const POUNCE = [Action.special, Action.moveRight];
const TOUCHING_GAP = 60.0;
const DIVE_GAP = 150.0;
const WATCHED_FRAMES = 100;
const LAST_PRESS_DELAY = 20;
const JUMP_HOLD_FRAMES = 3;
const MINIMUM_UPWARD_REACH = 100.0;
const MAXIMUM_SIDEWAYS_DRIFT = 20.0;
const BITE_HEAL = 4.0;
const OWNER_DAMAGE = 20.0;

function pounceScene(gap: number, victimDamage: number): Scene {
  const s = scene(0, [{ character: Character.dreadlord, x: 0.0, facing: 1 }, { character: Character.rifleman, x: gap, facing: -1 }]);
  fighter(s, 1).status.damage = victimDamage;
  frame(s, [], []);
  frame(s, POUNCE, []);
  return s;
}

interface Followed {
  readonly freeAt: number;
  readonly victimFreeAt: number;
  readonly reachedAt: number;
  readonly peak: number;
  readonly drift: number;
}

function followUp(victimDamage: number, delay: number): Followed {
  const s = pounceScene(DIVE_GAP, victimDamage);
  const owner = fighter(s, 0);
  const victim = fighter(s, 1);
  let biteAt = 0;
  let biteX = 0.0;
  let freeAt = 0;
  let victimFreeAt = 0;
  let reachedAt = 0;
  let peak = 0.0;
  let peakX = 0.0;
  for (let tick = 1; tick <= WATCHED_FRAMES; tick++) {
    if (biteAt === 0 && victim.launch.hitstun > 0) { biteAt = tick; biteX = victim.motion.x; }
    if (freeAt === 0 && canAct(owner)) freeAt = tick;
    const damage = victim.status.damage;
    const held = freeAt === 0 ? [] : tick < freeAt + JUMP_HOLD_FRAMES ? [Action.jump] : tick === freeAt + delay ? [Action.attack] : [];
    frame(s, held, []);
    if (biteAt > 0 && reachedAt === 0 && victim.motion.z > peak) { peak = victim.motion.z; peakX = victim.motion.x; }
    if (reachedAt === 0 && freeAt > 0 && victim.status.damage > damage && victim.launch.hitstun > 0) reachedAt = tick;
    if (victimFreeAt === 0 && biteAt > 0 && victim.launch.hitstun === 0) victimFreeAt = tick;
  }
  return { freeAt, victimFreeAt, reachedAt, peak, drift: Math.abs(peakX - biteX) };
}

test("Vampiric Pounce catches a fighter the dive touches on its first frame and bites a few frames later, healing the Dreadlord [k1 scenario]", () => {
  const s = pounceScene(TOUCHING_GAP, 0.0);
  const owner = fighter(s, 0);
  const victim = fighter(s, 1);
  owner.status.damage = OWNER_DAMAGE;
  let caughtAt = 0;
  let bitAt = 0;
  for (let tick = 1; tick <= WATCHED_FRAMES; tick++) {
    frame(s, [], []);
    if (caughtAt === 0 && owner.special.grabFrame > 0) caughtAt = tick;
    if (bitAt === 0 && victim.status.damage > 0) bitAt = tick;
  }
  assertEquals(caughtAt, 1, "caught on the first frame of the dive");
  assertGreaterThan(bitAt - caughtAt, 2);
  assertLessThan(bitAt - caughtAt, 6);
  assertEquals(owner.status.damage, OWNER_DAMAGE - BITE_HEAL);
});

test("Vampiric Pounce's bite launches nearly straight up and leaves the Dreadlord free to jump and strike the victim before hitstun ends at 0%, 40% and 80% [k1 scenario]", () => {
  for (const damage of [0.0, 40.0, 80.0]) {
    let best: Followed | undefined;
    for (let delay = JUMP_HOLD_FRAMES; delay <= LAST_PRESS_DELAY && best === undefined; delay++) {
      const run = followUp(damage, delay);
      if (run.reachedAt > 0) best = run;
    }
    assertTrue(best !== undefined);
    if (best === undefined) continue;
    assertLessThan(best.freeAt, best.victimFreeAt);
    assertLessThan(best.reachedAt, best.victimFreeAt);
    assertGreaterThan(best.peak, MINIMUM_UPWARD_REACH);
    assertLessThan(best.drift, MAXIMUM_SIDEWAYS_DRIFT);
  }
});
