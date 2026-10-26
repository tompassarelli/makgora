import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { canAttack, canShieldGrab } from "../conditions";
import { type Fighter, createFighter } from "../fighter";
import { hurtCapsule } from "../geometry/contactGeometry";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { applyHeroStatus } from "../heroStatus";
import { lift, duelPair, stepDuel } from "../testDuel";
import { controls } from "../testWorld";
import { POISON, WARDEN_SPECIALS } from "./wardenSpecials";

const H = HERO_REFERENCE_HEIGHT;
const MIN_ADVANTAGE = 14;
const PERCENTS = [0.0, 50.0, 100.0];
const BODY_WIDTH = f32(2.0 * hurtCapsule(Character.rifleman).radius);
const side = controls({ specialPressed: true, specialX: 1 });

interface Outcome {
  readonly hit: boolean;
  readonly advantage: number;
  readonly maievFree: number;
  readonly stayedGrounded: boolean;
  readonly drift: number;
  readonly behind: boolean;
  readonly facesTarget: boolean;
  readonly facing: number;
}

const actionable = (f: Fighter): boolean => !f.status.out && (canAttack(f) || canShieldGrab(f));

function sideSpecial(gap: number, percent: number, setUp: (maiev: Fighter, target: Fighter) => void = () => {}): Outcome {
  const maiev = createFighter(Character.warden, 0.0, 1);
  maiev.mana.points = 100;
  const target = createFighter(Character.rifleman, gap, -1);
  const { world } = duelPair(maiev, target);
  target.status.damage = percent;
  setUp(maiev, target);
  const startX = target.motion.x;
  const grounded = target.motion.grounded;
  let hitFrame: number | undefined;
  let maievFree: number | undefined;
  let targetFree: number | undefined;
  let stayedGrounded = true;
  let drift = 0.0;
  let behind = false;
  let facesTarget = false;
  stepDuel(world, side);
  for (let frame = 1; frame < 240 && (maievFree === undefined || (hitFrame !== undefined && targetFree === undefined)); frame++) {
    if (hitFrame === undefined && target.status.damage > percent) hitFrame = frame;
    if (hitFrame !== undefined && targetFree === undefined) {
      stayedGrounded &&= !grounded || target.motion.grounded;
      drift = Math.max(drift, Math.abs(f32(target.motion.x - startX)));
      if (actionable(target)) targetFree = frame;
    }
    if (maievFree === undefined && actionable(maiev)) {
      maievFree = frame;
      behind = f32(maiev.motion.x - target.motion.x) > 0.0;
      facesTarget = f32(f32(target.motion.x - maiev.motion.x) * maiev.facing) > 0.0;
    }
    stepDuel(world);
  }
  return {
    hit: hitFrame !== undefined, advantage: (targetFree ?? 0) - (maievFree ?? 0), maievFree: maievFree ?? 0,
    stayedGrounded, drift, behind, facesTarget, facing: maiev.facing,
  };
}

const marked = (_maiev: Fighter, target: Fighter): void => { applyHeroStatus(target, POISON); };

test("Maiev's side special stuns a grounded foe in place long enough for her grab or down special, in both forms, at 0, 50 and 100% [k3 measure #273]", () => {
  for (const percent of PERCENTS) {
    for (const outcome of [sideSpecial(f32(H * f32(0.9)), percent), sideSpecial(f32(H * f32(2.0)), percent, marked)]) {
      assertTrue(outcome.hit);
      assertTrue(outcome.stayedGrounded);
      assertTrue(outcome.drift <= BODY_WIDTH);
      assertTrue(outcome.advantage >= MIN_ADVANTAGE);
      assertTrue(outcome.facesTarget);
    }
  }
});

test("Pursuit Lunge passes through a close or mid-range foe, stuns it and ends behind it, turned to face it; a whiff keeps her facing and full recovery [k3 measure #273]", () => {
  for (const gap of [f32(H * f32(0.2)), f32(H * f32(0.5))]) {
    const outcome = sideSpecial(gap, 0.0);
    assertTrue(outcome.hit);
    assertTrue(outcome.behind);
    assertTrue(outcome.facesTarget);
    assertTrue(outcome.advantage >= MIN_ADVANTAGE);
  }
  const whiff = sideSpecial(f32(H * f32(3.0)), 0.0);
  assertTrue(!whiff.hit);
  assertEquals(whiff.facing, 1);
  assertTrue(whiff.maievFree >= WARDEN_SPECIALS.side.ground.endFrame);
});

test("Pursuit Lunge holds its windup in place through frame 13, travels from frame 14 and first cuts a close foe on frame 14 [k3 measure #487]", () => {
  const firstFrames = (gap: number): { readonly moved: number; readonly hit: number } => {
    const maiev = createFighter(Character.warden, 0.0, 1);
    maiev.mana.points = 100;
    const target = createFighter(Character.rifleman, gap, -1);
    const { world } = duelPair(maiev, target);
    stepDuel(world, side);
    const startX = maiev.motion.x;
    let moved = 0;
    let hit = 0;
    while ((moved === 0 || hit === 0) && maiev.special.frame > 0 && maiev.special.frame < 30) {
      const frame = maiev.special.frame;
      stepDuel(world);
      if (moved === 0 && maiev.motion.x !== startX) moved = frame;
      if (hit === 0 && target.status.damage > 0.0) hit = frame;
    }
    return { moved, hit };
  };
  assertEquals(firstFrames(f32(H * f32(3.0))).moved, 14);
  assertEquals(firstFrames(f32(H * f32(0.2))).hit, 14);
  assertEquals(WARDEN_SPECIALS.side.ground.endFrame, 49);
  assertEquals(WARDEN_SPECIALS.side.air?.endFrame, 49);
});

test("An airborne foe barely drifts from the stun, and a second stun within 120 frames is an ordinary launch [k3 measure #273]", () => {
  const air = sideSpecial(f32(H * f32(0.9)), 0.0, (_maiev, target) => lift(target, 30.0));
  assertTrue(air.hit);
  assertTrue(air.drift <= BODY_WIDTH);

  const maiev = createFighter(Character.warden, 0.0, 1);
  maiev.mana.points = 100;
  const target = createFighter(Character.rifleman, f32(H * f32(0.9)), -1);
  const { world } = duelPair(maiev, target);
  stepDuel(world, side);
  while (target.status.damage <= 0.0) stepDuel(world);
  const firstStun = target.launch.hitstun;
  while (!actionable(maiev)) stepDuel(world);
  const before = target.status.damage;
  maiev.mana.points = 100;
  stepDuel(world, controls({ specialPressed: true, specialX: maiev.facing }));
  let launched = false;
  for (let frame = 0; frame < 40 && !launched; frame++) {
    stepDuel(world);
    launched = target.status.damage > before && !target.motion.grounded;
  }
  assertTrue(launched);
  assertTrue(target.launch.hitstun < firstStun);
});
