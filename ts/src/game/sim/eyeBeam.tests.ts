import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { fighter, frame, scene } from "../match/padScene";
import { Character, ContactKind, ProjectileKind, SpecialAction } from "./codes";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "./contacts";
import { EYE_BEAM_AIR_FRAMES, EYE_BEAM_AIR_SHOT, EYE_BEAM_DAMAGE, EYE_BEAM_GROUND_FRAMES, EYE_BEAM_GROUND_SHOT, EYE_BEAM_LANDING_LAG } from "./eyeBeam";
import { type Fighter, createFighter } from "./fighter";
import { KNOCKBACK_LAUNCH_SPEED, TUMBLE_KNOCKBACK } from "./knockback";
import { fillMeter } from "./meter";
import { originalProjectileEffect } from "./projectiles";
import { fighterAt } from "./roster";
import { testWorld } from "./testWorld";
import { melee } from "./tuning";

const FRAME_LIMIT = 120;
const GAP = 400.0;

interface Shot {
  readonly shotFrame: number;
  readonly duration: number;
  readonly damage: number;
}

/** Presses neutral special on frame 1 (in the air from a full jump's apex when `air`) and records the special frame the beam appears on. */
function fireEyeBeam(air: boolean, ex = false): Shot {
  const s = scene(0, [{ character: Character.demonHunter, x: 0.0, facing: 1 }, { character: Character.blademaster, x: 1800.0, facing: -1 }]);
  const user = fighter(s);
  fillMeter(user);
  if (air) {
    frame(s, [Action.jump]);
    for (let tick = 0; tick < FRAME_LIMIT && (user.motion.grounded || user.motion.vz > 0.0); tick++) frame(s, [Action.jump]);
  }
  frame(s, ex ? [Action.special, Action.strong] : [Action.special]);
  const duration = user.special.duration;
  for (let tick = 0; tick < FRAME_LIMIT && user.special.action === SpecialAction.demonHunterEyeBeam; tick++) {
    const beam = user.projectiles.find((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.eyeBeam);
    if (beam !== undefined) return { shotFrame: user.special.frame, duration, damage: f32(EYE_BEAM_DAMAGE * beam.damageMultiplier) };
    frame(s, []);
  }
  return { shotFrame: 0, duration, damage: 0.0 };
}

test("Eye Beam fires on frame 23 and lasts 57 frames standing, fires on frame 13 and lasts 42 frames in the air, as Falco's Blaster does [k4 reference melee]", () => {
  const ground = fireEyeBeam(false);
  assertEquals(ground.shotFrame, EYE_BEAM_GROUND_SHOT);
  assertEquals(ground.duration, EYE_BEAM_GROUND_FRAMES);
  assertEquals([EYE_BEAM_GROUND_SHOT, EYE_BEAM_GROUND_FRAMES].join(" "), "23 57");
  const air = fireEyeBeam(true);
  assertEquals(air.shotFrame, EYE_BEAM_AIR_SHOT);
  assertEquals(air.duration, EYE_BEAM_AIR_FRAMES);
  assertEquals([EYE_BEAM_AIR_SHOT, EYE_BEAM_AIR_FRAMES].join(" "), "13 42");
});

test("EX Eye Beam in the air fires on the same frame and deals 25% more damage, 3.75% [k3 measure docs/design/mana.md]", () => {
  const ex = fireEyeBeam(true, true);
  assertEquals(ex.shotFrame, EYE_BEAM_AIR_SHOT);
  assertNear(ex.damage, 3.75, f32(0.001));
  assertNear(fireEyeBeam(true).damage, 3.0, f32(0.001));
});

interface ShortHopBeam {
  readonly hit: boolean;
  readonly landingLag: number;
  readonly specialOnLanding: SpecialAction;
}

/** Short hops, presses neutral special on the takeoff frame, fast-falls at the apex when `fastFall`, and steps until the beam is spent. */
function shortHopEyeBeam(target: Character, facing: number, fastFall: boolean): ShortHopBeam {
  const s = scene(0, [{ character: Character.demonHunter, x: 0.0, facing }, { character: target, x: facing * GAP, facing: -facing }]);
  const user = fighter(s);
  const foe = fighter(s, 1);
  frame(s, [Action.shortHop]);
  let pressed = false;
  let falling = false;
  let landing: ShortHopBeam | undefined;
  for (let tick = 0; tick < FRAME_LIMIT; tick++) {
    const takeoff: boolean = !pressed && !user.motion.grounded;
    pressed ||= takeoff;
    const apex: boolean = pressed && !takeoff && !falling && user.motion.vz <= 0.0;
    falling ||= apex;
    frame(s, takeoff ? [Action.special] : apex && fastFall ? [Action.moveDown] : []);
    if (pressed && landing === undefined && user.motion.grounded) landing = { hit: false, landingLag: user.landing.lag, specialOnLanding: user.special.action };
    if (landing !== undefined && !user.projectiles.some((projectile) => projectile.life > 0)) break;
  }
  return { hit: foe.status.damage > 0.0, landingLag: landing?.landingLag ?? -1, specialOnLanding: landing?.specialOnLanding ?? user.special.action };
}

test("A short-hop Eye Beam pressed on the takeoff frame hits a standing Shadow Hunter, average height, with or without a fast fall, either facing, and lands with no lag [k1 scenario]", () => {
  for (const [facing, fastFall] of [[1, true], [-1, true], [1, false], [-1, false]] as const) {
    const hop = shortHopEyeBeam(Character.shadowHunter, facing, fastFall);
    assertTrue(hop.hit);
    assertEquals(hop.specialOnLanding, SpecialAction.none);
    assertEquals(hop.landingLag, EYE_BEAM_LANDING_LAG);
  }
});

function beamKnockback(percent: number): { knockback: number; hitstun: number } {
  const world = testWorld(createFighter(Character.demonHunter, 0.0, 1), createFighter(Character.shadowHunter, 100.0, -1));
  const victim: Fighter = fighterAt(world, 1);
  victim.status.damage = percent;
  const beam = { ...createFighter(Character.demonHunter, 0.0, 1).projectiles[0]!, kind: ProjectileKind.eyeBeam, damageMultiplier: 1.0 };
  beginDamageContacts();
  collectDamageContact(world, 0, 1, originalProjectileEffect(beam), 1, ContactKind.launch, true, undefined, false);
  finishDamageContacts(world);
  const { knockbackX, knockbackZ } = victim.launch;
  return { knockback: Math.sqrt(knockbackX * knockbackX + knockbackZ * knockbackZ) / melee(KNOCKBACK_LAUNCH_SPEED), hitstun: victim.launch.hitstun };
}

test("Eye Beam's set knockback 5 interrupts a standing foe with the same small launch at 0% and 150%, below tumble [k4 reference melee]", () => {
  const fresh = beamKnockback(0.0);
  const worn = beamKnockback(150.0);
  assertGreaterThan(fresh.hitstun, 0);
  assertGreaterThan(fresh.knockback, 0.0);
  assertLessThan(worn.knockback, TUMBLE_KNOCKBACK);
  assertNear(worn.knockback, fresh.knockback, f32(0.01));
  assertEquals(worn.hitstun, fresh.hitstun);
});
