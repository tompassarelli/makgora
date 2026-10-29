import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { moveWeight } from "../../match/botGameplan";
import { HeroSpecialUse, heroSpecialUse, pressHeroFollowUp } from "../../match/botHeroKit";
import { fighter, frame, scene } from "../../match/padScene";
import { Character, SpecialAction } from "../../sim/codes";
import { GameplanSpecial } from "../../sim/gameplan";
import { neutralControls } from "../../sim/roster";
import { SpecialSlot } from "../../sim/specials/schema";
import { PEON_GAMEPLAN } from "./gameplan";

const IN_REACH = 90.0;
const OUT_OF_REACH = 500.0;

function duel(foeX: number) {
  const s = scene(0, [{ character: Character.peon, x: 0.0, facing: 1 }, { character: Character.peon, x: foeX, facing: -1 }]);
  return { s, peon: fighter(s, 0), foe: fighter(s, 1) };
}

test("Peon's gameplan weighs Gold Sack above a plain option at bonk range, and higher again for a foe past 80% [k1 scenario]", () => {
  const d = duel(IN_REACH);
  const weigh = (): number => moveWeight(PEON_GAMEPLAN, 0, d.peon, 1, d.foe, GameplanSpecial.neutral);
  const spaced = weigh();
  assertGreaterThan(spaced, 1);
  d.foe.status.damage = 90.0;
  assertGreaterThan(weigh(), spaced);
});

test("The computer offers Gold Sack for a foe in reach and not for one far away [k1 scenario]", () => {
  const near = duel(IN_REACH);
  assertEquals(heroSpecialUse(near.peon, near.foe, 0, SpecialSlot.neutral), HeroSpecialUse.close);
  const far = duel(OUT_OF_REACH);
  assertEquals(heroSpecialUse(far.peon, far.foe, 0, SpecialSlot.neutral), HeroSpecialUse.none);
});

test("The computer holds the sack while its foe is out of reach and lets go once the foe is in reach [k1 scenario]", () => {
  const d = duel(OUT_OF_REACH);
  frame(d.s, [Action.special]);
  assertEquals(d.peon.special.action, SpecialAction.heroNeutral, "the charge starts");
  const far = neutralControls();
  assertTrue(pressHeroFollowUp(d.peon, d.foe, 0, 0, far));
  assertTrue(far.specialHeld);
  d.foe.motion.x = IN_REACH;
  const near = neutralControls();
  assertTrue(pressHeroFollowUp(d.peon, d.foe, 0, 0, near));
  assertFalse(near.specialHeld);
});
