import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, DuoRole } from "../sim/codes";
import { createFighter, mutableDuo } from "../sim/fighter";
import { bodyModelScale, fighterModelScale } from "./fighterScale";
import { characterModelScale } from "./modelScale";

test("a Murloc partner body draws at the partner look's 0.9 of the leader's scale, and other roles and fighters are unscaled [k2 property]", () => {
  const full = characterModelScale(Character.murloc);
  assertEquals(bodyModelScale(Character.murloc, DuoRole.solo), full);
  assertEquals(bodyModelScale(Character.murloc, DuoRole.leader), full);
  assertEquals(bodyModelScale(Character.murloc, DuoRole.partner), f32(full * f32(0.9)));
  assertEquals(bodyModelScale(Character.grom, DuoRole.partner), characterModelScale(Character.grom));
});

test("a fighter's effect scale follows its duo role [k2 property]", () => {
  const fighter = createFighter(Character.murloc, 0.0, 1);
  assertEquals(fighterModelScale(fighter), characterModelScale(Character.murloc));
  mutableDuo(fighter).role = DuoRole.partner;
  assertEquals(fighterModelScale(fighter), f32(characterModelScale(Character.murloc) * f32(0.9)));
});
