import { assertEquals, test } from "wisp/src/runtime/testing";
import { padHintRows } from "./hintLines";

test("a pad player's preview shows pad buttons with Start to pause, names the Toggle controls key on the hide line, and drops the line when that action is unbound [k2 property]", () => {
  const lines = (toggleKey: string | undefined) => padHintRows(toggleKey).map(row => `${row.keys} ${row.label}`);
  assertEquals(lines("F2").join("|"), "Left stick move|X/Y jump|A attack|B special|LT shield|RB grab|LB Strong|R stick tilt Mod X + Y|Start pause|F2 hide");
  assertEquals(lines("V").includes("V hide"), true);
  assertEquals(lines(undefined).some(line => line.endsWith(" hide")), false);
});
