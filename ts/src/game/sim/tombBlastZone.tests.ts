import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { TOMB_OF_SARGERAS_STAGE } from "./stage";
import { stageBounds } from "./stageBounds";
import { melee } from "./tuning";

test("Tomb of Sargeras's side blast lines sit 20 Melee units inside Final Destination's, with the same top and bottom [k1 scenario]", () => {
  const fd = stageBounds(0).blast;
  const tomb = stageBounds(TOMB_OF_SARGERAS_STAGE).blast;
  assertNear(f32(tomb.left - fd.left), melee(20.0), f32(0.01));
  assertNear(f32(fd.right - tomb.right), melee(20.0), f32(0.01));
  assertEquals(tomb.top, fd.top);
  assertEquals(tomb.bottom, fd.bottom);
});
