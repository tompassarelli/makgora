import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { createFighter } from "./fighter";
import { hurtCapsule } from "./geometry/contactGeometry";
import { smashDamageMultiplier } from "./moves";
import { ILLIDAN_MOVES, ROUNDHOUSE_CLEAN, ROUNDHOUSE_SOUR, ROUNDHOUSE_STEP } from "./originalMoves";
import { type Controls } from "./roster";
import { mainDeckLeft, mainDeckRight } from "./stage";
import { duelPair, stepDuel } from "./testDuel";
import { controls } from "./testWorld";

const KICK = ILLIDAN_MOVES.normals[AttackStyle.forwardSmash]!;
const FULL_CHARGE = 60;
const SHIELD = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const VICTIM_CHARACTER = Character.demonHunter;
const VICTIM = hurtCapsule(VICTIM_CHARACTER);
const CLEAN_DAMAGE = ROUNDHOUSE_CLEAN.damage;
const SOUR_DAMAGE = ROUNDHOUSE_SOUR.damage;
const CLOSE_GAP = 60.0;
const TYPICAL_SHARE = 0.75;
const BODY_SIDE_SHARE = f32(0.6);
const SHORT_FOES = [Character.rifleman, Character.mountainKing, Character.peon];
const SHIN_CLEARANCE = 6.0;
const FOES = [Character.rifleman, Character.demonHunter, Character.blademaster, Character.mountainKing, Character.jaina, Character.pitLord];

interface Kick { readonly damage: number; readonly hitstun: number; readonly moved: number; readonly end: number; readonly grounded: boolean; readonly frames: number }

function kick(gap: number, charge = 0, victim: Readonly<Controls> = controls(), startX = 0.0, facing = 1, foe: Character = VICTIM_CHARACTER): Kick {
  const { world, owner, target } = duelPair(createFighter(Character.demonHunter, startX, facing), createFighter(foe, f32(startX + gap * facing), -facing));
  for (let settle = 0; settle < 12; settle++) stepDuel(world, controls(), victim);
  beginFighterAttack(world, 0, AttackStyle.forwardSmash, charge > 0);
  let grounded = true, frames = 0, hitstun = 0, furthest = 0.0;
  for (let frame = 0; frame < KICK.totalFrames + charge + 4; frame++) {
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
const isPoint = ({ hit: { strike } }: (typeof KICK.regions)[number]): boolean => strike !== undefined && strike.x1 === strike.x2;
const heelBackEdge = Math.min(...KICK.regions.filter((region) => region.hit.effect.damage === CLEAN_DAMAGE && isPoint(region)).map((region) => region.hit.minX));
const shinOnlyGap = (foe: Character): number => f32(f32(f32(heelBackEdge + ROUNDHOUSE_STEP) - hurtCapsule(foe).radius) - SHIN_CLEARANCE);
const typicalGap = (foe: Character): number => f32(f32(reach * TYPICAL_SHARE) + hurtCapsule(foe).radius);

test("Illidan's roundhouse clean hit lands at typical forward-smash range on every foe tested, and on the shin and foot of a short foe standing short of the heel, at the clean damage scaled by charge [k3 measure docs/design/illidan.md]", () => {
  for (const charge of [0, FULL_CHARGE]) {
    for (const foe of FOES) {
      const spaced = kick(typicalGap(foe), charge, controls(), 0.0, 1, foe);
      assertNear(spaced.damage, f32(CLEAN_DAMAGE * smashDamageMultiplier(charge)), f32(0.01));
    }
    for (const foe of SHORT_FOES) {
      const shin = kick(shinOnlyGap(foe), charge, controls(), 0.0, 1, foe);
      assertNear(shin.damage, f32(CLEAN_DAMAGE * smashDamageMultiplier(charge)), f32(0.01));
    }
  }
});

test("Illidan's roundhouse knee hit lands only beside his body, deals the sour damage and launches less than the clean hit, uncharged and fully charged [k3 measure docs/design/illidan.md]", () => {
  const sourReach = Math.max(...KICK.regions.filter((region) => region.hit.effect.damage === SOUR_DAMAGE).map((region) => region.hit.maxX));
  assertLessThan(sourReach, f32(farEdge * BODY_SIDE_SHARE));
  for (const charge of [0, FULL_CHARGE]) {
    const close = kick(CLOSE_GAP, charge);
    const spaced = kick(typicalGap(VICTIM_CHARACTER), charge);
    assertNear(close.damage, f32(SOUR_DAMAGE * smashDamageMultiplier(charge)), f32(0.01));
    assertGreaterThan(spaced.damage, close.damage);
    assertGreaterThan(spaced.hitstun, close.hitstun);
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
  assertTrue(ROUNDHOUSE_STEP >= 50.0 && ROUNDHOUSE_STEP <= 70.0);
  for (const charge of [0, FULL_CHARGE]) assertNear(kick(900.0, charge).moved, ROUNDHOUSE_STEP, f32(0.01));
  const shielded = kick(110.0, 0, SHIELD);
  assertLessThan(shielded.moved, ROUNDHOUSE_STEP);
  assertGreaterThan(shielded.moved, 0.0);
});

test("Illidan's roundhouse step stops at the ledge in either facing and he finishes the kick standing on the stage [k3 measure docs/design/illidan.md]", () => {
  for (const facing of [1, -1]) {
    const edge = facing > 0 ? mainDeckRight(0) : mainDeckLeft(0);
    const start = f32(edge - 10.0 * facing);
    const atLedge = kick(900.0, 0, controls(), start, facing);
    assertNear(atLedge.moved, 10.0, f32(0.01));
    assertNear(f32(f32(atLedge.end - start) * facing), 10.0, f32(0.01));
    assertTrue(atLedge.grounded);
    assertEquals(atLedge.frames, KICK.totalFrames - 1);
  }
});
