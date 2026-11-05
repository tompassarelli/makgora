import { expect, test } from "bun:test";
import { min } from "../src/game/core/numbers";
import { DRAWN_STRIDES } from "../src/game/presentation/drawnStrideInfo";
import { groundLocomotionClip, groundLocomotionRate, groundLocomotionRateCap } from "../src/game/presentation/fighterLocomotion";
import { IllidanLocomotion } from "../src/game/presentation/illidanMotion";
import { lookCharacter } from "../src/game/roster/kits";
import { gatedFighters } from "../src/game/roster/forge";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";

const GAITS = [
  { motion: IllidanLocomotion.walk, gait: "walk", speed: (physics: { walkSpeed: number }) => physics.walkSpeed },
  { motion: IllidanLocomotion.run, gait: "run", speed: (physics: { runSpeed: number }) => physics.runSpeed },
  { motion: IllidanLocomotion.dash, gait: "run", speed: (physics: { dashSpeed: number; groundSpeedCap: number }) => min(physics.dashSpeed, physics.groundSpeedCap) },
] as const;
const FLOATERS: readonly Character[] = [Character.firelord, Character.ladyVashj];
const FOOT_SLIDE_TOLERANCE = 0.15;
const MAIEV_STOCK_WALK = 2, MAIEV_AUTHORED_RUN = 78;
const ILLIDAN_STOCK_WALK = 119, ILLIDAN_STOCK_RUN = 120;

const groundCharacters = gatedFighters().filter((candidate) => !FLOATERS.includes(candidate));

function measure(character: Character, { motion, gait, speed }: (typeof GAITS)[number]) {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.vx = speed(fighter.tuning.physics);
  const clip = groundLocomotionClip(character, motion);
  const stride = DRAWN_STRIDES[lookCharacter(character)]?.[gait];
  const rate = groundLocomotionRate(fighter, motion, clip);
  const feet = rate * (clip?.stance ?? stride?.speed ?? 0.0), body = Math.abs(fighter.motion.vx) * 60.0;
  return { clip, stride, rate, feet, body, slides: Math.abs(feet - body) > body * FOOT_SLIDE_TOLERANCE };
}

test("each grounded fighter's walk, run and dash play the clip its stride was measured on at ground speed over that stride, feet within 15% of the body, and Maiev walks on her authored run while her run and dash play the stock Walk, and Illidan runs and dashes on his stock Locomotion Run [k3 measure docs/fighter-motion.md]", () => {
  for (const character of groundCharacters) {
    for (const gait of GAITS) {
      const { clip, stride, rate, feet, body, slides } = measure(character, gait);
      expect(clip?.index, `${character} ${gait.gait}: clip against measured stride`).toBe(stride?.clip);
      expect(rate).toBeLessThanOrEqual(groundLocomotionRateCap(character));
      expect(slides, `${character} ${gait.gait} ${gait.motion}: feet ${feet.toFixed(1)} against body ${body.toFixed(1)}`).toBe(false);
    }
  }

  expect(GAITS.map(({ motion }) => groundLocomotionClip(Character.demonHunter, motion)?.index)).toEqual([ILLIDAN_STOCK_WALK, ILLIDAN_STOCK_RUN, ILLIDAN_STOCK_RUN]);
  expect(GAITS.map(({ motion }) => groundLocomotionClip(Character.warden, motion)?.index)).toEqual([MAIEV_AUTHORED_RUN, MAIEV_STOCK_WALK, MAIEV_STOCK_WALK]);
});

const PRESTOR_AUTHORED_RATE_CAP = 2.0;
const PRESTOR_AUTHORED_CLIPS: Readonly<Record<number, number>> = { [IllidanLocomotion.walk]: 8, [IllidanLocomotion.run]: 7, [IllidanLocomotion.dash]: 7 };

test("Prestor walks on her authored Movement walk and runs and dashes on her authored Movement run, each at a play rate of 2x or less with feet within 15% of the body [k3 measure #901]", () => {
  for (const gait of GAITS) {
    const { clip, rate, feet, body, slides } = measure(Character.onyxia, gait);
    expect(clip?.index, `onyxia ${gait.motion}: authored clip`).toBe(PRESTOR_AUTHORED_CLIPS[gait.motion]);
    expect(rate, `onyxia ${gait.motion} rate`).toBeLessThanOrEqual(PRESTOR_AUTHORED_RATE_CAP);
    expect(slides, `onyxia ${gait.motion}: feet ${feet.toFixed(1)} against body ${body.toFixed(1)}`).toBe(false);
  }
});
