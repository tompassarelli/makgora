import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { copyFighterState, sameFighterState } from "../../generated/state/fighterState";
import { sweep } from "../core/sweep";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { EX_WAVEDASH_SPEED } from "./exWavedash";
import { METER } from "./meter";
import type { Roster } from "./roster";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

interface Run { readonly world: Roster; readonly f: Fighter }

interface Slide {
  readonly distance: number;
  readonly landingVx: number;
  readonly lagFrames: number;
  readonly charge: number;
  readonly ex: boolean;
}

const enum Angle { shallow, diagonal, lateDiagonal, down }

function start(character: Character, charge: number): Run {
  const { world, owner } = duelPair(createFighter(character, -300.0, 1), createFighter(Character.rifleman, 700.0, -1));
  owner.meter.ex = charge;
  return { world, f: owner };
}

function dodgeInput(angle: Angle, ex: boolean) {
  const dodgeX = angle === Angle.down ? 0 : 1;
  const dodgeZ = angle === Angle.shallow ? 0 : -1;
  return controls({ airDodgePressed: true, shield: true, shieldPressed: true, exDodgePressed: ex, dodgeX, dodgeZ, direction: dodgeX, verticalDirection: dodgeZ });
}

function wavedash(run: Run, angle: Angle, ex: boolean): Slide {
  const { world, f } = run;
  const startX = f.motion.x;
  if (angle === Angle.lateDiagonal || angle === Angle.down) {
    lift(f, f32(f.motion.z + 12.0));
    stepDuel(world, dodgeInput(angle, ex));
  } else {
    stepDuel(world, controls({ jumpPressed: true, shortHopPressed: true }));
    stepDuel(world, dodgeInput(angle, ex));
  }
  return finish(run, startX);
}

function finish(run: Run, startX: number): Slide {
  const { world, f } = run;
  let landingVx = 0.0;
  let lagFrames = 0;
  for (let frame = 0; frame < 240; frame++) {
    const lagBefore = f.landing.lag;
    stepDuel(world);
    if (lagBefore === 0 && f.landing.lag > 0) landingVx = f.motion.vx;
    if (f.landing.lag > 0) lagFrames++;
    if (f.motion.grounded && f.motion.vx === 0 && f.landing.lag === 0 && !f.dodge.airDodging && f.jump.squat === 0) break;
  }
  return { distance: f32(f.motion.x - startX), landingVx, lagFrames, charge: f.meter.ex, ex: f.dodge.ex };
}

const slide = (character: Character, angle: Angle, ex: boolean, charge: number = METER.exFrames): Slide => wavedash(start(character, charge), angle, ex);

test("A wavedash without Strong or without an EX charge is the plain wavedash and spends nothing [k1 scenario]", () => {
  for (const angle of [Angle.shallow, Angle.diagonal, Angle.lateDiagonal]) {
    const plain = slide(Character.blademaster, angle, false);
    const broke = slide(Character.blademaster, angle, true, 0);
    assertEquals(plain.charge, METER.exFrames);
    assertTrue(broke.charge < METER.exFrames);
    assertEquals(broke.distance, plain.distance);
    assertEquals(broke.landingVx, plain.landingVx);
    assertFalse(broke.ex);
  }
});

test("An EX wavedash spends exactly one EX charge [k3 measure docs/design/mana.md]", () => {
  for (const angle of [Angle.shallow, Angle.diagonal]) {
    const spent = slide(Character.blademaster, angle, true);
    assertTrue(spent.charge < METER.exFrames);
  }
});

test("An EX wavedash adds the same slide speed at every angle and keeps the landing lag [k3 measure docs/design/mana.md]", () => {
  for (const character of [Character.jaina, Character.blademaster, Character.cairne]) {
    for (const angle of [Angle.shallow, Angle.diagonal, Angle.lateDiagonal]) {
      const plain = slide(character, angle, false);
      const ex = slide(character, angle, true);
      assertTrue(plain.landingVx > 0);
      assertEquals(ex.landingVx, f32(plain.landingVx + EX_WAVEDASH_SPEED));
      assertEquals(ex.lagFrames, plain.lagFrames);
      assertTrue(ex.distance > plain.distance);
    }
  }
});

test("A straight-down air dodge into the ground is never EX [k1 scenario]", () => {
  const plain = slide(Character.blademaster, Angle.down, false);
  const ex = slide(Character.blademaster, Angle.down, true);
  assertEquals(ex.charge, METER.exFrames);
  assertEquals(ex.distance, plain.distance);
  assertEquals(ex.lagFrames, plain.lagFrames);
  assertFalse(ex.ex);
});

sweep("A max-length EX wavedash slides about 40% further for the median fighter [k3 measure docs/design/mana.md]", () => {
  const gains: number[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const plain = slide(character, Angle.shallow, false);
    gains.push(f32(slide(character, Angle.shallow, true).distance / plain.distance));
  }
  gains.sort((a, b) => a - b);
  const median = gains[idiv(gains.length, 2)] ?? 0.0;
  assertTrue(median > f32(1.35) && median < f32(1.45));
});

test("The EX request survives a rollback restore and replays the same slide [k1 scenario]", () => {
  const run = start(Character.blademaster, METER.exFrames);
  stepDuel(run.world, controls({ jumpPressed: true, shortHopPressed: true }));
  stepDuel(run.world, dodgeInput(Angle.diagonal, true));
  const startX = -300.0;
  const saved = createFighter(Character.blademaster, 0.0, 1);
  copyFighterState(saved, run.f, 3);
  assertTrue(saved.dodge.ex);
  const first = finish(run, startX);
  copyFighterState(run.f, saved, 3);
  const second = finish(run, startX);
  assertEquals(second.distance, first.distance);
  assertEquals(second.landingVx, first.landingVx);
  const flipped = createFighter(Character.blademaster, 0.0, 1);
  copyFighterState(flipped, saved, 3);
  flipped.dodge.ex = false;
  assertFalse(sameFighterState(flipped, saved));
});
