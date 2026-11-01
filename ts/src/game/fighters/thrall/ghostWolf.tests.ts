import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../../sim/codes";
import { mainDeckRight, mainDeckZ } from "../../sim/stage";
import { type Duel, lift, stickDuel, step } from "../stickDuel";
import { fighterModelReplaced } from "../../presentation/fighterForm";
import { recovered } from "../../match/recoveryEnvelope";
import { GHOST_DASH, GHOST_END_FRAME, GHOST_GLIDE, GHOST_LEAP } from "./ghostWolf";

const FAR = 3000.0;
const DESIGNED_DASH = 270.0;
const DESIGNED_POUNCE = 110.0;

function ghostDuel(foeAhead = FAR, facing = 1, casterX = 0.0): Duel {
  return stickDuel(Character.thrall, Character.peon, foeAhead, facing, casterX);
}

function pressGhostWolf(d: Duel, facing: number): void {
  step(d, "down", { x: facing, z: 0 });
}

test("Ghost Wolf dashes 18 frames at 15 units a frame, then pounces 10 frames at 11, facing either way [k3 measure docs/design/thrall.md]", () => {
  for (const facing of [1, -1]) {
    const d = ghostDuel(FAR, facing);
    step(d, "none");
    pressGhostWolf(d, facing);
    const xAt = (frame: number): number => {
      while (d.caster.special.frame < frame) step(d, "none");
      return d.caster.motion.x;
    };
    const dashStart = xAt(GHOST_DASH.first);
    const leapStart = xAt(GHOST_LEAP.first);
    const pounceEnd = xAt(GHOST_GLIDE.last + 1);
    const dashEnd = f32(f32(leapStart - dashStart) * facing);
    const pounce = f32(f32(pounceEnd - leapStart) * facing);
    assertNear(dashEnd, DESIGNED_DASH, 1.0);
    assertNear(pounce, DESIGNED_POUNCE, 1.0);
    assertEquals(d.caster.special.action, SpecialAction.heroSide);
  }
});

test("Ghost Wolf's dash passes through a foe without a hit and its pounce strikes one standing in its path [k3 measure docs/design/thrall.md]", () => {
  for (const facing of [1, -1]) {
    const near = ghostDuel(120.0, facing);
    step(near, "none");
    pressGhostWolf(near, facing);
    for (let tick = 0; tick < GHOST_DASH.last - 2; tick++) step(near, "none");
    assertEquals(near.foe.status.damage, 0.0);
    const far = ghostDuel(330.0, facing);
    step(far, "none");
    pressGhostWolf(far, facing);
    for (let tick = 0; tick < GHOST_END_FRAME; tick++) step(far, "none");
    assertGreaterThan(far.foe.status.damage, 0.0);
  }
});

test("From 400 units past the ledge and 150 below it, a jump and Ghost Wolf toward the stage recovers, where a jump alone does not [k3 measure docs/design/thrall.md]", () => {
  const reaches = (ghost: boolean): boolean => {
    const ledge = mainDeckRight(0);
    const d = ghostDuel(FAR, -1, f32(ledge + 400.0));
    lift(d.caster, f32(mainDeckZ(0) - 150.0));
    d.caster.jump.remaining = 1;
    const towardX = -1;
    for (let tick = 0; tick < 240; tick++) {
      const jump = tick === 0;
      const cast = ghost && tick === 14;
      step(d, cast ? "down" : "none", { x: towardX, z: 0 }, cast ? { x: towardX, z: 0 } : undefined);
      if (jump) d.caster.motion.vz = d.caster.tuning.physics.aerialJumpSpeed;
      if (recovered(d.caster)) return true;
      if (d.caster.status.out) return false;
    }
    return false;
  };
  assertTrue(reaches(true));
  assertTrue(!reaches(false));
});

test("Ghost Wolf turns Thrall into the wolf only from the dash through the pounce and returns him to his own body after, helpless in the air [k3 measure docs/design/thrall.md]", () => {
  const d = ghostDuel(FAR, 1);
  step(d, "none");
  lift(d.caster, f32(mainDeckZ(0) + 400.0));
  pressGhostWolf(d, 1);
  let wolfFrames = 0;
  let wrongFrame = false;
  for (let tick = 0; tick < GHOST_END_FRAME + 4; tick++) {
    lift(d.caster, f32(mainDeckZ(0) + 400.0), d.caster.motion.x);
    step(d, "none");
    const frame = d.caster.special.frame;
    const wolf = fighterModelReplaced(d.caster);
    if (wolf) wolfFrames++;
    if (wolf !== (d.caster.special.action === SpecialAction.heroSide && frame >= GHOST_DASH.first && frame <= GHOST_GLIDE.last)) wrongFrame = true;
  }
  assertTrue(!wrongFrame);
  assertEquals(wolfFrames, GHOST_GLIDE.last - GHOST_DASH.first + 1);
  assertEquals(d.caster.special.action, SpecialAction.none);
  assertTrue(d.caster.special.fall);
  assertTrue(!fighterModelReplaced(d.caster));
});
