import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { min } from "../core/numbers";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { groundLocomotionClip, FIRELORD_BOB_RATE_CAP, groundLocomotionRate, groundLocomotionRateCap, GROUND_LOCOMOTION_RATE_CAP, uncappedGroundLocomotionRate } from "./fighterLocomotion";
import { IllidanLocomotion } from "./illidanMotion";

const SPEEDS = [
  { motion: IllidanLocomotion.walk, speed: (physics: { walkSpeed: number }) => physics.walkSpeed },
  { motion: IllidanLocomotion.run, speed: (physics: { runSpeed: number }) => physics.runSpeed },
  { motion: IllidanLocomotion.dash, speed: (physics: { dashSpeed: number; groundSpeedCap: number }) => min(physics.dashSpeed, physics.groundSpeedCap) },
] as const;

test("no fighter's walk, run or dash clip plays faster than the ground rate cap, and a rate under it is untouched [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    for (const { motion, speed } of SPEEDS) {
      fighter.motion.vx = speed(fighter.tuning.physics);
      const clip = groundLocomotionClip(character, motion);
      const raw = uncappedGroundLocomotionRate(fighter, motion, clip);
      const rate = groundLocomotionRate(fighter, motion, clip);
      assertTrue(rate <= groundLocomotionRateCap(character));
      assertEquals(rate, raw <= groundLocomotionRateCap(character) ? raw : groundLocomotionRateCap(character));
    }
  }
});

test("the short-stride fighters are the ones the cap holds back [k3 measure docs/fighter-motion.md]", () => {
  const capped = (character: Character, motion: IllidanLocomotion, speed: number) => {
    const fighter = createFighter(character, 0.0, 1);
    fighter.motion.vx = speed;
    return uncappedGroundLocomotionRate(fighter, motion, groundLocomotionClip(character, motion)) > groundLocomotionRateCap(character);
  };
  for (const character of [Character.firelord, Character.onyxia]) {
    assertTrue(capped(character, IllidanLocomotion.run, createFighter(character, 0.0, 1).tuning.physics.runSpeed));
  }
  for (const character of [Character.lich, Character.jaina, Character.tyrande, Character.warden]) {
    assertTrue(!capped(character, IllidanLocomotion.run, createFighter(character, 0.0, 1).tuning.physics.runSpeed));
  }
});

test("Firelord's walk, run and dash play his stock Walk at his 2.5x bob cap, half the shared cap, so his 22.6 unit body bob repeats 5 times a second instead of 10 [k3 measure docs/fighter-motion.md]", () => {
  const fighter = createFighter(Character.firelord, 0.0, 1);
  assertTrue(FIRELORD_BOB_RATE_CAP < GROUND_LOCOMOTION_RATE_CAP);
  for (const { motion, speed } of SPEEDS) {
    fighter.motion.vx = speed(fighter.tuning.physics);
    assertEquals(groundLocomotionRate(fighter, motion, groundLocomotionClip(Character.firelord, motion)), FIRELORD_BOB_RATE_CAP);
  }
});
