import { assertEquals, test } from "wisp/src/runtime/testing";
import { GOLD_SACK_CHARGE } from "../fighters/peon/specials";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { goldSackStage, goldSackStored } from "./peonCues";
import { specialCueState } from "./specialCues";

const CHARGES = [1, 20, 39, 40, 59, 60, 79, 80, 120];

function peonWith(action: SpecialAction, charge: number) {
  const peon = createFighter(Character.peon, 0.0, 1);
  peon.special.action = action;
  peon.special.form = 0;
  peon.special.frame = GOLD_SACK_CHARGE.hold + 10;
  peon.special.charge = charge;
  return peon;
}

test("Peon's gold icon, the glint while charging and the sack on his back while stored, shows only from a full charge and not at stages 0 to 3 [k1 scenario]", () => {
  for (const charge of CHARGES) {
    const full = goldSackStage(charge) === GOLD_SACK_CHARGE.stages;
    const charging = specialCueState(peonWith(SpecialAction.heroNeutral, charge));
    assertEquals(charging.cues !== undefined && charging.phase === "startup", full, `charging icon at charge ${charge}`);
    assertEquals(goldSackStored(peonWith(SpecialAction.none, charge)), full, `stored icon at charge ${charge}`);
    assertEquals(goldSackStored(peonWith(SpecialAction.heroNeutral, charge)), false, `no back sack while charging at ${charge}`);
  }
  assertEquals(specialCueState(peonWith(SpecialAction.heroNeutral, 0)).cues, undefined, "no icon at an empty sack");
  assertEquals(goldSackStored(peonWith(SpecialAction.none, 0)), false, "no icon once the charge is spent");
});
