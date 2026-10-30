import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { BUTCHER_MOVES } from "./moves";

test("His forward smash carves 20% with the cleaver's edge and 13% with the haft, his authored values at the 2026-10-30 field retune [k3 measure docs/design/butcher.md]", () => {
  const regions = BUTCHER_MOVES.normals[AttackStyle.forwardSmash]?.regions ?? [];
  assertEquals(regions.length, 2);
  assertEquals(regions[0]?.hit.effect.damage, f32(20.0 * f32(1.0)));
  assertEquals(regions[1]?.hit.effect.damage, f32(13.0 * f32(1.0)));
  assertEquals(regions[1]?.hit.effect.growth, f32(86.0 * f32(1.04)));
});
