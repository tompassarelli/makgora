import { assertEquals, test } from "wisp/src/runtime/testing";
import { targetKind } from "./buttonSweep";

test("a registered button is named by its target's kind, or button when the target has none [k2 property]", () => {
  assertEquals(targetKind({ kind: "close" }), "close");
  assertEquals(targetKind({ kind: "preset", preset: 1 }), "preset");
  assertEquals(targetKind(0), "button");
  assertEquals(targetKind({ tile: 3 }), "button");
});
