import { createFighter } from "./fighter";
import { stageBounds } from "./stageBounds";

import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { Character } from "./codes";
import { canAttack } from "./conditions";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { type Fighter,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { AIR_DODGE_ANIMATION_FRAMES, beginAirDodge } from "./jumpsAndDodges";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "./knockback";
import { advanceSolo, controls } from "./testWorld";

const ALL_FIGHTERS = Object.values(Character);

function airDodgedFighter(character: Character): Fighter {
  const fighter = createReferenceFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 3000.0;
  fighter.jump.remaining = 1;
  advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: 1, dodgeZ: -1 }), -240.0);
  assertTrue(fighter.dodge.airDodging);
  assertTrue(fighter.dodge.airUsed);
  return fighter;
}

test("every fighter's air dodge ends actionable, spends no jump and allows one per airtime [k3 measure docs/gameplay-design.md]", () => {
  for (const character of ALL_FIGHTERS) {
    const fighter = airDodgedFighter(character);
    assertEquals(fighter.jump.remaining, 1);
    const idle = controls();
    for (let frame = 2; frame < AIR_DODGE_ANIMATION_FRAMES; frame++) {
      advanceSolo(fighter, 0, idle, -240.0);
      assertTrue(fighter.dodge.airDodging);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, idle, -240.0);
    assertFalse(fighter.motion.grounded);
    assertFalse(fighter.dodge.airDodging);
    assertTrue(canAttack(fighter));

    advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: -1 }), -240.0);
    assertFalse(fighter.dodge.airDodging);
    advanceSolo(fighter, 0, controls({ jumpPressed: true }), -240.0);
    assertEquals(fighter.jump.remaining, 0);
    assertTrue(fighter.dodge.airUsed);
  }
});

test("a diagonal air dodge displaces both axes with the same decayed vector [k3 measure docs/physics.md]", () => {
  for (const direction of [-1, 1]) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 300.0;
    beginAirDodge(fighter, 1, direction);
    const input = controls();
    let displacement = 11.836965560913086;
    let distance = 0.0;
    for (let frame = 1; frame <= 29; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      distance = f32(distance + displacement);
      assertNear(fighter.motion.x, distance, 0.0010000000474974513);
      assertNear(fighter.motion.z, 300 + direction * distance, 0.0010000000474974513);
      assertNear(fighter.motion.vx, displacement, 0.0010000000474974513);
      assertNear(fighter.motion.vz, direction * displacement, 0.0010000000474974513);
      displacement = f32(displacement * 0.8999999761581421);
    }
  }
});

test("an air dodge landing slides and restores actions after ten ticks [k3 measure docs/physics.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const fighter = createReferenceFighter(character, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    beginAirDodge(fighter, 1, -1);
    const input = controls();
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
    assertFalse(canAttack(fighter));
    const { traction, walkSpeed } = fighter.tuning.physics;
    let expected = fighter.motion.vx;
    input.direction = -1;
    for (let tick = 1; tick <= 9; tick++) {
      const previousX = fighter.motion.x;
      advanceSolo(fighter, 0, input, 0.0);
      assertGreaterThan(fighter.motion.x, previousX);
      expected = f32(expected - (expected > walkSpeed ? f32(traction * 2.0) : traction));
      assertEquals(fighter.motion.vx, expected);
      assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG - tick);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.landing.lag, 0);
    assertTrue(canAttack(fighter));
    assertNear(fighter.motion.vx, -11.399999618530273, 0.0010000000474974513);
    assertEquals(fighter.ground.dashFrame, 1);
  }
});

const BLAST_EXITS = ["left", "right", "bottom"] as const;

test("each crossing of a side or bottom blast zone removes exactly one stock until none is left: every exit of both blast-zone shapes [k2 property]", () => {
  let index = 0;
  for (const stage of [0, 2]) {
    const { blast } = stageBounds(stage);
    for (const exit of BLAST_EXITS) {
      const character = ALL_FIGHTERS[imod(index * 7 + 3, ALL_FIGHTERS.length)]!;
      index++;
      const fighter = createReferenceFighter(character, 0.0, 1);
      const step = () => advanceSolo(fighter, stage, controls(), -240.0);
      assertTrue(fighter.status.stocks > 1);
      const label = `stage ${stage} ${exit} ${character}`;
      for (let stocks = fighter.status.stocks - 1; stocks >= 0; stocks--) {
        while (fighter.status.respawn > 0) step();
        assertEquals(fighter.status.out, false, label);
        fighter.motion.grounded = false;
        fighter.motion.x = exit === "left" ? f32(blast.left - 0.0009765625) : exit === "right" ? f32(blast.right + 0.0009765625) : 0.0;
        if (exit === "bottom") fighter.motion.z = f32(blast.bottom - 0.0009765625);
        step();
        assertEquals(fighter.status.stocks, stocks, label);
        assertEquals(fighter.status.out, true, label);
      }
      const finalX = fighter.motion.x;
      step();
      assertEquals(fighter.motion.x, finalX, label);
      assertEquals(fighter.status.stocks, 0, label);
    }
  }
});

test("the top blast zone requires launch knockback rather than jump speed [k3 measure docs/physics.md]", () => {
  for (const mode of [0, 1, 2]) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = (stageBounds(0).blast.top + 1.0);
    fighter.motion.vz = 30.0;
    fighter.launch.knockbackZ = mode === 0 ? 0.0 : mode === 1 ? TOP_KO_MINIMUM_UPWARD_KNOCKBACK : f32(TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 0.0010000000474974513);
    advanceSolo(fighter, 0, controls(), 0.0);
    assertEquals(fighter.status.out, mode === 2);
    assertEquals(fighter.status.stocks, mode === 2 ? 2 : 3);
  }
});

