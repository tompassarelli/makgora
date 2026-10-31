import { assertEquals, test } from "wisp/src/runtime/testing";
import "../roster/kits";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createWhiteGlowState, whiteGlowAlpha } from "./whiteGlow";

test("White flash: a struck fighter in heavy hitlag flashes and the fighter that struck stays unflashed so the contact pose reads [k2 property]", () => {
  const victim = createFighter(Character.ladyVashj, 0.0, 1);
  victim.launch.hitlag = 12;
  victim.launch.hitstun = 20;
  const attacker = createFighter(Character.ladyVashj, 0.0, 1);
  attacker.launch.hitlag = 12;
  assertEquals(whiteGlowAlpha(createWhiteGlowState(), victim, 0) > 0, true);
  assertEquals(whiteGlowAlpha(createWhiteGlowState(), attacker, 0), 0);
});
