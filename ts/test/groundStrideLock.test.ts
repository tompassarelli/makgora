import { expect, test } from "bun:test";
import { min } from "../src/game/core/numbers";
import { DRAWN_STRIDES } from "../src/game/presentation/drawnStrideInfo";
import { GROUND_LOCOMOTION_RATE_CAP, groundLocomotionClip, groundLocomotionRate } from "../src/game/presentation/fighterLocomotion";
import { IllidanLocomotion } from "../src/game/presentation/illidanMotion";
import { lookCharacter, SELECTABLE_CHARACTERS } from "../src/game/roster/kits";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";

const GAITS = [
  { motion: IllidanLocomotion.walk, gait: "walk", speed: (physics: { walkSpeed: number }) => physics.walkSpeed },
  { motion: IllidanLocomotion.run, gait: "run", speed: (physics: { runSpeed: number }) => physics.runSpeed },
  { motion: IllidanLocomotion.dash, gait: "run", speed: (physics: { dashSpeed: number; groundSpeedCap: number }) => min(physics.dashSpeed, physics.groundSpeedCap) },
] as const;
const FLOATERS: readonly Character[] = [Character.firelord, Character.ladyVashj];
const OWN_GAIT: readonly Character[] = [Character.demonHunter];
const FOOT_SLIDE_TOLERANCE = 0.15;

test("each grounded fighter's walk, run and dash play the clip its stride was measured on at ground speed over that stride, feet within 15% of the body, and Maiev's run cycles faster than her walk [k3 measure docs/fighter-motion.md]", () => {
  for (const character of SELECTABLE_CHARACTERS.filter((candidate) => !FLOATERS.includes(candidate) && !OWN_GAIT.includes(candidate))) {
    const fighter = createFighter(character, 0.0, 1);
    for (const { motion, gait, speed } of GAITS) {
      fighter.motion.vx = speed(fighter.tuning.physics);
      const clip = groundLocomotionClip(character, motion);
      const stride = DRAWN_STRIDES[lookCharacter(character)]?.[gait];
      expect(clip?.index, `${character} ${gait}: clip against measured stride`).toBe(stride?.clip);
      const rate = groundLocomotionRate(fighter, motion, clip);
      const feet = rate * (clip?.stance ?? stride?.speed ?? 0.0), body = Math.abs(fighter.motion.vx) * 60.0;
      expect(rate).toBeLessThanOrEqual(GROUND_LOCOMOTION_RATE_CAP);
      expect(Math.abs(feet - body), `${character} ${gait} ${motion}: feet ${feet.toFixed(1)} against body ${body.toFixed(1)}`).toBeLessThanOrEqual(body * FOOT_SLIDE_TOLERANCE);
    }
  }

  const maiev = createFighter(Character.warden, 0.0, 1);
  const cycles = GAITS.map(({ motion, speed }) => {
    maiev.motion.vx = speed(maiev.tuning.physics);
    const clip = groundLocomotionClip(Character.warden, motion);
    return groundLocomotionRate(maiev, motion, clip) / (clip?.seconds ?? Infinity);
  });
  expect(cycles[1]).toBeGreaterThan(cycles[0] ?? Infinity);
});
