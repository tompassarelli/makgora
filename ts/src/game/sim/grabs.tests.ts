import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { HERO_ROSTER } from "./heroes/registry";
import { AttackStyle, Character, GrabAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { resolveGrabs } from "./grabs";
import { GRAB_HOLD_MINIMUM_FRAMES, grabHoldFrames, attackStartupFrames } from "./moves";
import type { Controls, Roster } from "./roster";
import { controls, testBeginAttacks, testGrabFrame, testWorld } from "./testWorld";

test("simultaneous grabs give neither slot ownership [k3 measure docs/physics.md]", () => {
  const first = createFighter(Character.rifleman, 0.0, 1);
  const second = createFighter(Character.rifleman, 90.0, -1);
  const world = testWorld(first, second);
  testBeginAttacks(world, AttackStyle.grab, AttackStyle.grab);
  first.attack.frame = attackStartupFrames(AttackStyle.grab);
  second.attack.frame = attackStartupFrames(AttackStyle.grab);
  resolveAttacks(world);
  assertEquals(first.grab.target, undefined);
  assertEquals(second.grab.target, undefined);
  assertEquals(first.grab.grabbedFrames, 0);
  assertEquals(second.grab.grabbedFrames, 0);
  first.launch.hitlag = 1;
  second.attack.frame++;
  resolveAttacks(world);
  assertEquals(second.grab.target, undefined);
  assertEquals(first.grab.grabbedFrames, 0);
});

const GRABBERS = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];

type Mash = "none" | "slow" | "human" | "quick" | "fastest";

function mashInput(mash: Mash, frame: number): Controls {
  if (mash === "none") return controls();
  if (mash === "human" || mash === "quick" || mash === "slow") {
    const rate = mash === "human" ? 8 : mash === "quick" ? 10 : 6;
    return controls({ grabMashPressed: floorDiv(frame * rate, 60) !== floorDiv((frame - 1) * rate, 60) || frame === 1 });
  }
  return controls({ grabMashPressed: floorMod(frame, 2) === 1, direction: floorMod(frame, 2) === 1 ? 1 : -1 });
}

function heldBy(character: Character, percent: number): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 50.0, -1);
  target.status.damage = percent;
  const world = testWorld(owner, target);
  owner.motion.surface = 0;
  target.motion.surface = 0;
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab, owner.tuning.moves);
  resolveAttacks(world);
  resolveGrabs(world);
  assertEquals(owner.grab.target, 1, `${character} catches`);
  assertEquals(target.grab.grabbedFrames, grabHoldFrames(percent));
  return { world, owner, target };
}

/** The held frame each mash frees the victim on, by percent: the hold is floor(90 + 1.75 x percent), never cut below 60. */
const MASH_ESCAPE = {
  0: { none: 90, slow: 60, human: 60, quick: 60, fastest: GRAB_HOLD_MINIMUM_FRAMES },
  50: { none: 177, slow: 97, human: 83, quick: 73, fastest: GRAB_HOLD_MINIMUM_FRAMES },
  100: { none: 265, slow: 145, human: 128, quick: 113, fastest: GRAB_HOLD_MINIMUM_FRAMES },
} as const;
const PERCENTS = [0, 50, 100] as const;
const MASHES = ["none", "slow", "human", "quick", "fastest"] as const;

/** Runs held frames until the victim is free; the frame it went free on, or undefined. */
function holdUntilFree(world: Roster, target: Fighter, mash: Mash, owner: (frame: number) => Controls, frames = 300): number | undefined {
  for (let frame = 1; frame <= frames; frame++) {
    testGrabFrame(world, [owner(frame), mashInput(mash, frame)], false);
    if (target.grab.owner === undefined) return frame;
  }
  return undefined;
}

test("a grab holds floor(90 + 1.75 x percent) frames: 90 at 0%, 177 at 50%, 265 at 100% [k4 reference docs/gameplay-design.md#grab-holds-and-pummels]", () => {
  assertEquals(grabHoldFrames(0.0), 90);
  assertEquals(grabHoldFrames(50.0), 177);
  assertEquals(grabHoldFrames(100.0), 265);
  assertEquals(grabHoldFrames(f32(33.3)), 148);
  assertEquals(GRAB_HOLD_MINIMUM_FRAMES, 60);
});

test("every grab holds its percent's time, and mashing shortens it but never below 60 frames [k3 measure #550]", () => {
  for (const character of GRABBERS) {
    for (const percent of PERCENTS) {
      for (const mash of MASHES) {
        const { world, owner, target } = heldBy(character, percent);
        const frame = holdUntilFree(world, target, mash, () => controls());
        const label = `${character} at ${percent}% with ${mash} mashing`;
        assertEquals(frame, MASH_ESCAPE[percent][mash], label);
        assertEquals(owner.grab.action, GrabAction.escape, label);
        assertEquals(target.status.damage, percent, label);
      }
    }
  }
});

test("pummeling every chance never extends the hold: the same mashing frees the victim no later, and sooner when unmashed [k3 measure #550]", () => {
  for (const character of GRABBERS) {
    for (const percent of PERCENTS) {
      for (const mash of MASHES) {
        const { world, owner, target } = heldBy(character, percent);
        const frame = holdUntilFree(world, target, mash, () => controls({ attackPressed: true }));
        const label = `${character} at ${percent}% with ${mash} mashing`;
        assertTrue(owner.grab.pummels >= 1);
        assertTrue(frame !== undefined && frame <= MASH_ESCAPE[percent][mash]);
        if (mash === "none") assertTrue(frame !== undefined && frame < MASH_ESCAPE[percent][mash]);
        if (mash !== "fastest" && !(percent === 0 && mash !== "none")) assertTrue(target.status.damage > percent);
        assertEquals(owner.grab.action, GrabAction.escape, label);
        assertEquals(target.launch.throwHitstun, false, label);
      }
    }
  }
});
