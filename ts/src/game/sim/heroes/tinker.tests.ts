import { assertDefined, assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { rollTravel } from "../geometry/rollTravel";
import { Character, SpecialAction } from "../codes";
import { TECH_ROLL_FRAMES } from "../down";
import { type Fighter, createFighter } from "../fighter";
import { setWorldMotionValue } from "../motion";
import { SHIELD_RELEASE_LAG_FRAMES } from "../shield";
import { SELECTABLE_CHARACTERS } from "./registry";
import { TINKER_SPECIALS } from "./tinkerSpecials";
import { createReferenceContactFighter } from "../referenceRig";
import { controls } from "../testWorld";
import { AUTHORED_PHYSICS, melee } from "../tuning";
import { duelPair, stepDuel } from "../testDuel";
import { BEAM_MIN_AHEAD, advanceHeroSpecial, beamSegment } from "../specials/engine";
import { fightersApart } from "../../replay/scopedRepair";
import { createRoster } from "../roster";
import { shieldCenterX, shieldCenterZ } from "../shieldTilt";
import { shieldSizeMultiplier } from "../shield";
import { emptyCapsule } from "../geometry/contactGeometry";

test("Tinker body keeps ROB run and air speed with weight 92 for about 9% earlier standard-smash KOs [k4 reference ssbu]", () => {
  const f = createFighter(Character.tinker, 0.0, 1);
  const reference = AUTHORED_PHYSICS.reference;
  assertNear(f.tuning.physics.weight, 92.0, f32(0.001));
  assertNear(f.tuning.physics.runSpeed / reference.runSpeed, f32(f32(1.725) / f32(2.2)), f32(0.00001));
  assertNear(f.tuning.physics.airSpeed / reference.airSpeed, f32(f32(1.134) / f32(0.83)), f32(0.00001));
});


const LASER = TINKER_SPECIALS.side.ground;
const BEAM = assertDefined(LASER.beam, "Laser beam");
const PRESS = controls({ specialPressed: true, specialX: 1 });

function place(fighter: Fighter, x: number, z: number): void {
  fighter.motion.x = x;
  fighter.motion.z = z;
  fighter.motion.vx = 0.0;
  fighter.motion.vz = 0.0;
  setWorldMotionValue(fighter.motion.meleeX, x);
  setWorldMotionValue(fighter.motion.meleeZ, z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, 0.0);
}

/** The frame (1 = the press) the Laser first damages a target `ahead` units in front and `up` units above the Tinker, moving by (`vx`, `vz`) away from him each frame, or 0. */
function laserContact(ahead: number, up: number, facing: number, vx = 0.0, vz = 0.0): number {
  const owner = createFighter(Character.tinker, 0.0, facing);
  const victim = createReferenceContactFighter(f32(facing * ahead), -facing);
  const { world } = duelPair(owner, victim);
  const press = controls({ specialPressed: true, specialX: facing });
  for (let f = 1; f <= LASER.endFrame; f++) {
    if (up !== 0.0 || vx !== 0.0 || vz !== 0.0) {
      victim.motion.grounded = up <= 0.0 && vz === 0.0;
      place(victim, f32(facing * f32(ahead + f32(vx * (f - 1)))), f32(up + f32(vz * (f - 1))));
    }
    stepDuel(world, f === 1 ? press : controls());
    if (victim.status.damage > 0) return f;
  }
  return 0;
}

test("Laser first connects on frame 20 anywhere in front within its range, mirrored, and never beyond it or behind him [k2 property]", () => {
  for (let ahead = 40; ahead <= 500; ahead += 20) {
    const right = laserContact(ahead, 0.0, 1);
    assertEquals(laserContact(ahead, 0.0, -1), right, `facing mirrors at ${ahead}`);
    if (ahead <= 360) assertEquals(right, 20, `contact at ${ahead}`);
    if (ahead >= 460) assertEquals(right, 0, `no contact at ${ahead}`);
  }
  assertEquals(laserContact(-120, 0.0, 1), 0, "a foe behind him is not tracked or hit");
});

test("Laser tracks a foe faster than any tech roll but an air dodge outruns it [k2 property]", () => {
  let fastestRoll = 0.0;
  for (const character of SELECTABLE_CHARACTERS) {
    for (const direction of ["forward", "back"] as const) {
      let travel = 0.0;
      let moving = 0;
      for (let frame = 1; frame <= TECH_ROLL_FRAMES; frame++) {
        const step = rollTravel(character, "tech", direction, frame);
        travel = f32(travel + step);
        if (step > 0.0) moving++;
      }
      if (moving > 0) fastestRoll = Math.max(fastestRoll, f32(travel / moving));
    }
  }
  assertEquals(BEAM.track >= f32(fastestRoll * f32(1.2)), true, `track ${BEAM.track} vs fastest tech roll ${fastestRoll}`);
  assertEquals(BEAM.track < melee(f32(3.4)), true, "an air dodge opens faster than the aim turns");
  for (const facing of [1, -1]) {
    const rising = laserContact(160, 0.0, facing, 0.0, 9.0);
    assertEquals(rising >= 20 && rising <= 27, true, `a foe rising 9 units a frame is hit, on ${rising}`);
    const sliding = laserContact(100, 0.0, facing, 9.0, 0.0);
    assertEquals(sliding >= 20 && sliding <= 27, true, `a foe sliding away 9 units a frame is hit, on ${sliding}`);
    assertEquals(laserContact(120, 60.0, facing, 0.0, 22.0), 0, "a foe leaving at air dodge speed escapes the aim");
  }
});

test("A Laser shielded on its last active frame leaves the Tinker punishable by a median jab or grab out of shield [k2 property]", () => {
  const owner = createFighter(Character.tinker, 0.0, 1);
  const victim = createFighter(Character.jaina, 80.0, -1);
  const { world } = duelPair(owner, victim);
  const shield = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 0.0 });
  let contact = 0;
  let stunEnds = 0;
  let tinkerActs = 0;
  for (let f = 1; f <= 120 && tinkerActs === 0; f++) {
    stepDuel(world, f === 1 ? PRESS : controls(), shield);
    if (contact === 0 && victim.shield.stun > 0) contact = f;
    if (contact > 0 && stunEnds === 0 && victim.shield.stun === 0) stunEnds = f;
    if (f > 1 && owner.special.action === SpecialAction.none) tinkerActs = f;
  }
  assertEquals(contact, 20, "the shield takes the beam on its first active frame");
  assertEquals(victim.status.damage, 0.0, "the shield holds");
  const lateContactLag = tinkerActs - stunEnds - (27 - 20);
  assertEquals(lateContactLag >= SHIELD_RELEASE_LAG_FRAMES + 4 + 2, true, `jab out of shield: ${lateContactLag} frames of lag after shieldstun`);
  assertEquals(lateContactLag >= 8 + 2, true, `grab out of shield: ${lateContactLag} frames of lag after shieldstun`);
});

test("EX Laser reaches a quarter farther and hits a quarter harder [k2 property]", () => {
  const ex = assertDefined(LASER.ex, "EX Laser");
  assertNear(assertDefined(ex.beam, "EX beam").range, f32(BEAM.range * 1.25), f32(0.001));
  assertNear(assertDefined(ex.regions?.[0], "EX region").hit.effect.damage, f32(assertDefined(LASER.regions?.[0], "region").hit.effect.damage * 1.25), f32(0.001));
});

test("A shielded Laser ends at the shield and spares a foe standing behind the shielding foe [k2 property]", () => {
  const shield = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 0.0 });
  for (const facing of [1, -1]) {
    for (const gap of [150.0, 220.0, 290.0]) {
      const owner = createFighter(Character.tinker, 0.0, facing);
      const shielder = createFighter(Character.jaina, f32(facing * gap), -facing);
      const behind = createReferenceContactFighter(f32(facing * f32(gap + 70.0)), -facing);
      const world = createRoster(7, [owner, shielder, behind]);
      const line = emptyCapsule();
      for (let i = 0; i < 3; i++) stepDuel(world, controls(), shield);
      for (let f = 1; f <= LASER.endFrame; f++) {
        stepDuel(world, f === 1 ? controls({ specialPressed: true, specialX: facing }) : controls(), shield);
        if (f < 20 || f > 27 || !shielder.shield.raised) continue;
        beamSegment(line, owner, BEAM, 14.0);
        const radius = f32(shielder.tuning.shield.radius * shieldSizeMultiplier(shielder.shield.energy, shielder.shield.strength));
        const ex = f32(line.x2 - shieldCenterX(shielder));
        const ez = f32(line.z2 - shieldCenterZ(shielder));
        const end = Math.sqrt(ex * ex + ez * ez);
        assertEquals(end >= radius - 0.5 && end <= radius + 14.0, true, `gap ${gap} facing ${facing} frame ${f}: the beam ends ${end} from a shield of ${radius}`);
      }
      assertEquals(shielder.status.damage, 0.0, `gap ${gap} facing ${facing}: the shield holds`);
      assertEquals(behind.status.damage, 0.0, `gap ${gap} facing ${facing}: the foe behind the shield is not hit`);
    }
  }
});

test("Laser aim stays at least BEAM_MIN_AHEAD in front of his arm, so a foe crossing under him never pulls the beam into the floor and escapes once behind [k2 property]", () => {
  const line = emptyCapsule();
  for (const facing of [1, -1]) {
    for (const speed of [4.0, 9.0, 16.0]) {
      const owner = createFighter(Character.tinker, 0.0, facing);
      const victim = createReferenceContactFighter(f32(facing * 90.0), -facing);
      const { world } = duelPair(owner, victim);
      for (let f = 1; f <= 27; f++) {
        victim.motion.grounded = true;
        place(victim, f32(facing * f32(90.0 - f32(speed * (f - 1)))), 0.0);
        stepDuel(world, f === 1 ? controls({ specialPressed: true, specialX: facing }) : controls());
        beamSegment(line, owner, BEAM, 14.0);
        const ahead = f32(f32(line.x2 - line.x1) * facing);
        const drop = f32(line.z1 - line.z2);
        assertEquals(f32(f32(owner.special.beamX - line.x1) * facing) >= f32(BEAM_MIN_AHEAD - f32(0.001)), true, `speed ${speed} frame ${f}: aim ${owner.special.beamX} too close to the arm`);
        assertEquals(drop <= f32(ahead * f32(5.0 / 60.0)) + f32(0.01), true, `speed ${speed} frame ${f}: beam drops ${drop} over ${ahead}`);
        assertEquals(line.z2 > 0.0, true, `speed ${speed} frame ${f}: beam end ${line.z2} stays above the floor`);
      }
      if (speed >= 9.0) assertEquals(victim.status.damage, 0.0, `speed ${speed}: a foe behind him by frame 20 escapes`);
    }
  }
});

test("Fighter-scoped rollback repair never treats a shield that shortens the EX Laser as apart [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (let gap = 400; gap <= 900; gap += 10) {
      const lengths: number[] = [];
      let apart = true;
      for (const raised of [false, true]) {
        const owner = createFighter(Character.tinker, 0.0, 1);
        const shielder = createFighter(character, gap, -1);
        const world = createRoster(3, [owner, shielder]);
        owner.special.action = SpecialAction.heroSide;
        owner.special.ex = true;
        owner.special.frame = 5;
        owner.special.beamX = f32(gap - 240);
        owner.special.beamZ = 50.0;
        shielder.shield.raised = raised;
        shielder.shield.tiltX = -1;
        shielder.shield.strength = 0.0;
        advanceHeroSpecial(owner, 0, undefined, world);
        lengths.push(owner.special.beamLength);
        if (raised) apart = fightersApart(owner, shielder);
      }
      if (lengths[0] !== lengths[1]) assertEquals(apart, false, `character ${character} at ${gap}: its shield shortens the beam`);
    }
  }
});
