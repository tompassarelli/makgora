import { assertEquals, test } from "wisp/src/runtime/testing";
import { padHintRows } from "./hintLines";

test("a pad player's preview shows pad buttons with Start to pause, and drops the hide line when H is bound to an action [k2 property]", () => {
  const lines = (hideKeyFree: boolean) => padHintRows(hideKeyFree).map(row => `${row.keys} ${row.label}`);
  assertEquals(lines(true).join("|"), "Left stick move|X/Y jump|A attack|B special|LT shield|RB grab|LB Strong|R stick tilt Mod X + Y|Start pause|H hide");
  assertEquals(lines(false).includes("H hide"), false);
});
