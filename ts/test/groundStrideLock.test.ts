import { expect, test } from "bun:test";
import { min } from "../src/game/core/numbers";
import { DRAWN_STRIDES } from "../src/game/presentation/drawnStrideInfo";
import { groundLocomotionClip, groundLocomotionRate, groundLocomotionRateCap } from "../src/game/presentation/fighterLocomotion";
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
const FOOT_SLIDE_TOLERANCE = 0.15;
const MAIEV_STOCK_WALK = 2, MAIEV_AUTHORED_RUN = 78;
const ILLIDAN_STOCK_WALK = 119, ILLIDAN_STOCK_RUN = 120;

type Gait = (typeof GAITS)[number]["gait"];

const STRIDE_DEBT: Readonly<Partial<Record<Character, Readonly<Partial<Record<Gait, string>>>>>> = {
  [Character.onyxia]: {
    walk: "Prestor's stock Walk draws 51 units a second against a 576 unit body, past the 5x rate cap (#901)",
    run: "Prestor's stock Walk draws 51 units a second against an 828 unit body, past the 5x rate cap (#901)",
  },
};

const groundCharacters = SELECTABLE_CHARACTERS.filter((candidate) => !FLOATERS.includes(candidate));

function measure(character: Character, { motion, gait, speed }: (typeof GAITS)[number]) {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.vx = speed(fighter.tuning.physics);
  const clip = groundLocomotionClip(character, motion);
  const stride = DRAWN_STRIDES[lookCharacter(character)]?.[gait];
  const rate = groundLocomotionRate(fighter, motion, clip);
  const feet = rate * (clip?.stance ?? stride?.speed ?? 0.0), body = Math.abs(fighter.motion.vx) * 60.0;
  return { clip, stride, rate, feet, body, slides: Math.abs(feet - body) > body * FOOT_SLIDE_TOLERANCE };
}

test("each grounded fighter's walk, run and dash play the clip its stride was measured on at ground speed over that stride, feet within 15% of the body unless the gait is listed as owing a stride, and Maiev walks on her authored run while her run and dash play the stock Walk, and Illidan runs and dashes on his stock Locomotion Run [k3 measure docs/fighter-motion.md]", () => {
  for (const character of groundCharacters) {
    for (const gait of GAITS) {
      const { clip, stride, rate, feet, body, slides } = measure(character, gait);
      expect(clip?.index, `${character} ${gait.gait}: clip against measured stride`).toBe(stride?.clip);
      expect(rate).toBeLessThanOrEqual(groundLocomotionRateCap(character));
      if (STRIDE_DEBT[character]?.[gait.gait] !== undefined) continue;
      expect(slides, `${character} ${gait.gait} ${gait.motion}: feet ${feet.toFixed(1)} against body ${body.toFixed(1)}`).toBe(false);
    }
  }

  expect(GAITS.map(({ motion }) => groundLocomotionClip(Character.demonHunter, motion)?.index)).toEqual([ILLIDAN_STOCK_WALK, ILLIDAN_STOCK_RUN, ILLIDAN_STOCK_RUN]);
  expect(GAITS.map(({ motion }) => groundLocomotionClip(Character.warden, motion)?.index)).toEqual([MAIEV_AUTHORED_RUN, MAIEV_STOCK_WALK, MAIEV_STOCK_WALK]);
});

test("each gait listed as owing a stride still slides its feet past 15% of the body, so the list shrinks when its clip is fixed [k3 measure #901]", () => {
  for (const [key, gaits] of Object.entries(STRIDE_DEBT)) {
    const character = Number(key) as Character;
    expect(groundCharacters).toContain(character);
    for (const gait of Object.keys(gaits) as Gait[]) {
      expect(GAITS.filter((candidate) => candidate.gait === gait).some((candidate) => measure(character, candidate).slides), `${character} ${gait}`).toBe(true);
    }
  }
});
