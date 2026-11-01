import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { min } from "../core/numbers";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { groundLocomotionClip, groundLocomotionRate, GROUND_LOCOMOTION_RATE_CAP, uncappedGroundLocomotionRate } from "./fighterLocomotion";
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
      assertTrue(rate <= GROUND_LOCOMOTION_RATE_CAP);
      assertEquals(rate, raw <= GROUND_LOCOMOTION_RATE_CAP ? raw : GROUND_LOCOMOTION_RATE_CAP);
    }
  }
});

test("the short-stride fighters are the ones the cap holds back [k3 measure docs/fighter-motion.md]", () => {
  const capped = (character: Character, motion: IllidanLocomotion, speed: number) => {
    const fighter = createFighter(character, 0.0, 1);
    fighter.motion.vx = speed;
    return uncappedGroundLocomotionRate(fighter, motion, groundLocomotionClip(character, motion)) > GROUND_LOCOMOTION_RATE_CAP;
  };
  for (const character of [Character.firelord, Character.onyxia]) {
    assertTrue(capped(character, IllidanLocomotion.run, createFighter(character, 0.0, 1).tuning.physics.runSpeed));
  }
  for (const character of [Character.lich, Character.jaina, Character.tyrande, Character.warden]) {
    assertTrue(!capped(character, IllidanLocomotion.run, createFighter(character, 0.0, 1).tuning.physics.runSpeed));
  }
});
