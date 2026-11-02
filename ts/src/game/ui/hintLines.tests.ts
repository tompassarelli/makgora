import { assertEquals, test } from "wisp/src/runtime/testing";
import { padHintRows } from "./hintLines";

test("a pad player's preview shows pad buttons with Start to pause and F2 to hide [k2 property]", () => {
  assertEquals(padHintRows().map(row => `${row.keys} ${row.label}`).join("|"), "Left stick move|X/Y jump|A attack|B special|LT shield|RB grab|LB Strong|R stick tilt Mod X + Y|Start pause|F2 hide");
});
