import { assertDefined, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { type Pad, type PadMatch, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

function seededPads(seed: number, frames: number): Pad[] {
  const pads: Pad[] = [];
  let state = seed;
  const next = (range: number): number => {
    state = imod(state * 75 + 74, 65537);
    return imod(state, range);
  };
  for (let frame = 0; frame < frames; frame++) {
    const axis = [-1.0, -0.5, 0.0, 0.5, 1.0];
    pads.push({
      x: axis[next(5)] ?? 0.0, y: axis[next(5)] ?? 0.0, cx: next(6) === 0 ? axis[next(5)] ?? 0.0 : 0.0,
      attack: next(4) === 0, special: next(8) === 0, jump: next(8) === 0, trigger: next(10) === 0,
    });
  }
  return pads;
}

function slotPadMatch(firstCharacter: Character, secondCharacter: Character, swapped: boolean): PadMatch {
  const match = testMatch(3, Character.rifleman);
  const left = createFighter(firstCharacter, -120.0, 1);
  const right = createFighter(secondCharacter, 120.0, -1);
  match.world.fighters[0] = swapped ? right : left;
  match.world.fighters[1] = swapped ? left : right;
  return padMatch(match, swapped ? "slot-swap-b" : "slot-swap-a");
}

function sameFighter(actual: Fighter | undefined, expected: Fighter | undefined): boolean {
  if (actual === undefined || expected === undefined) return actual === expected;
  return actual.motion.x === expected.motion.x && actual.motion.z === expected.motion.z && actual.facing === expected.facing
    && actual.status.damage === expected.status.damage && actual.status.stocks === expected.status.stocks
    && actual.attack.serial === expected.attack.serial && actual.attack.style === expected.attack.style && actual.attack.frame === expected.attack.frame
    && actual.launch.hitstun === expected.launch.hitstun && actual.shield.energy === expected.shield.energy;
}

test("swapping two humans' slots, with their characters, places and seeded pad tapes, swaps their every frame: 4 tapes of 160 frames [k2 property]", () => {
  for (let seed = 1; seed <= 4; seed++) {
    const firstCharacter = assertDefined(SELECTABLE_CHARACTERS[imod(seed * 7, SELECTABLE_CHARACTERS.length)], "first");
    const secondCharacter = assertDefined(SELECTABLE_CHARACTERS[imod(seed * 11 + 3, SELECTABLE_CHARACTERS.length)], "second");
    const leftPads = seededPads(seed, 160);
    const rightPads = seededPads(seed + 1000, 160);
    const straight = slotPadMatch(firstCharacter, secondCharacter, false);
    const swapped = slotPadMatch(firstCharacter, secondCharacter, true);
    for (let frame = 0; frame < 160; frame++) {
      const left = assertDefined(leftPads[frame], "left pad");
      const right = assertDefined(rightPads[frame], "right pad");
      playPads(straight, left, right);
      playPads(swapped, right, left);
      if (!sameFighter(swapped.match.world.fighters[1], straight.match.world.fighters[0]) || !sameFighter(swapped.match.world.fighters[0], straight.match.world.fighters[1])) {
        throw new Error(`seed ${seed} frame ${frame}: the swapped slots diverge`);
      }
    }
  }
});
