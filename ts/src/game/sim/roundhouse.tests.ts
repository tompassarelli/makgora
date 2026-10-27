import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { beginFighterAttack } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { createFighter } from "./fighter";
import { hurtCapsule } from "./geometry/contactGeometry";
import { ILLIDAN_MOVES, ROUNDHOUSE_STEP } from "./originalMoves";
import { type Controls } from "./roster";
import { mainDeckLeft, mainDeckRight } from "./stage";
import { duelPair, lift, stepDuel } from "./testDuel";
import { controls } from "./testWorld";

const KICK = ILLIDAN_MOVES.normals[AttackStyle.forwardSmash]!;
const FULL_CHARGE = 60;
const SHIELD = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const VICTIM_CHARACTER = Character.demonHunter;
const VICTIM = hurtCapsule(VICTIM_CHARACTER);
const REGIONS_PER_FRAME = 3;
const BALL = 2;

interface Kick { readonly damage: number; readonly hitstun: number; readonly moved: number; readonly end: number; readonly grounded: boolean; readonly frames: number }

function kick(gap: number, charge = 0, victim: Readonly<Controls> = controls(), liftedTo?: number, startX = 0.0, facing = 1): Kick {
  const { world, owner, target } = duelPair(createFighter(Character.demonHunter, startX, facing), createFighter(VICTIM_CHARACTER, f32(startX + gap * facing), -facing));
  for (let settle = 0; settle < 12; settle++) stepDuel(world, controls(), victim);
  beginFighterAttack(world, 0, AttackStyle.forwardSmash, charge > 0);
  let grounded = true, frames = 0, hitstun = 0, furthest = 0.0;
  for (let frame = 0; frame < KICK.totalFrames + charge + 4; frame++) {
    if (liftedTo !== undefined && target.status.damage === 0.0) lift(target, liftedTo);
    stepDuel(world, controls({ attackHeld: frame <= KICK.startupFrames + charge }), victim);
    grounded &&= owner.motion.grounded;
    furthest = Math.max(furthest, f32(f32(owner.motion.x - startX) * facing));
    if (owner.attack.style === AttackStyle.forwardSmash) frames++;
    hitstun = Math.max(hitstun, target.launch.hitstun);
  }
  return { damage: target.status.damage, hitstun, moved: furthest, end: owner.motion.x, grounded, frames };
}

const farEdge = Math.max(...KICK.regions.map((region) => region.hit.maxX));
const reach = f32(farEdge + ROUNDHOUSE_STEP);

test("Illidan's roundhouse heel hit deals more damage and knockback than the ball of his foot, uncharged and fully charged [k3 measure docs/design/illidan.md]", () => {
  const belowBall = Math.max(...KICK.regions.filter((_, index) => imod(index, REGIONS_PER_FRAME) !== BALL).map((region) => region.hit.maxZ));
  const overHeelAndShin = f32(f32(belowBall + 2.0) - f32(VICTIM.z1 - VICTIM.radius));
  for (const charge of [0, FULL_CHARGE]) {
    const heel = kick(115.0, charge);
    const ball = kick(115.0, charge, controls(), overHeelAndShin);
    assertGreaterThan(ball.damage, 0.0);
    assertGreaterThan(heel.damage, ball.damage);
    assertGreaterThan(heel.hitstun, ball.hitstun);
  }
});

test("Illidan's roundhouse reaches the far edge of his drawn foot plus its step from where he starts, uncharged and fully charged, inside the roster's forward-smash band [k3 measure docs/design/illidan.md]", () => {
  assertTrue(reach >= 62.0 && reach <= 195.0);
  for (const charge of [0, FULL_CHARGE]) {
    assertGreaterThan(kick(f32(f32(reach - 2.0) + VICTIM.radius), charge).damage, 0.0);
    assertEquals(kick(f32(f32(reach + 2.0) + VICTIM.radius), charge).damage, 0.0);
  }
});

test("Illidan's roundhouse steps forward its full step into open space, uncharged and fully charged, and stops short at a raised shield [k3 measure docs/design/illidan.md]", () => {
  for (const charge of [0, FULL_CHARGE]) assertNear(kick(900.0, charge).moved, ROUNDHOUSE_STEP, f32(0.01));
  const shielded = kick(110.0, 0, SHIELD);
  assertLessThan(shielded.moved, ROUNDHOUSE_STEP);
  assertGreaterThan(shielded.moved, 0.0);
});

test("Illidan's roundhouse step stops at the ledge in either facing and he finishes the kick standing on the stage [k3 measure docs/design/illidan.md]", () => {
  for (const facing of [1, -1]) {
    const edge = facing > 0 ? mainDeckRight(0) : mainDeckLeft(0);
    const start = f32(edge - 10.0 * facing);
    const atLedge = kick(900.0, 0, controls(), undefined, start, facing);
    assertNear(atLedge.moved, 10.0, f32(0.01));
    assertNear(f32(f32(atLedge.end - start) * facing), 10.0, f32(0.01));
    assertTrue(atLedge.grounded);
    assertEquals(atLedge.frames, KICK.totalFrames - 1);
  }
});
