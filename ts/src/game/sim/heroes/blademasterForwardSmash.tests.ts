import { assertGreaterThan, test } from "wisp/src/runtime/testing";
import { AttackStyle } from "../codes";
import { ordinaryHitKnockback } from "../knockback";
import { BLADEMASTER_MOVES } from "./blademasterMoves";

test("Blademaster's forward smash tip launches at least 235 and its sour hit at least 190 on a weight-100 foe at 100% [k3 measure docs/design/roster.md]", () => {
  const regions = BLADEMASTER_MOVES.normals[AttackStyle.forwardSmash]?.regions ?? [];
  const knockbacks = regions.map(({ hit: { effect } }) => ordinaryHitKnockback(100.0, effect.damage, 100.0, effect.growth, effect.base, 1.0)).sort((a, b) => a - b);
  assertGreaterThan(knockbacks.length, 1);
  assertGreaterThan(knockbacks[knockbacks.length - 1]!, 235.0);
  assertGreaterThan(knockbacks[0]!, 190.0);
});
