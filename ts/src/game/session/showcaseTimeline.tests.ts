import { floorMod } from "wisp/src/sim/intMath";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../sim/heroes/registry";
import { authoredTuning } from "../sim/tuning";
import { SHOWCASE_FIRST_FRAME, showcaseRows } from "./showcaseTimeline";

test("every selectable fighter's showcase has 2 rows per normal, special and ultimate, in strictly increasing frame order [k2 property]", () => {
  assertTrue(SELECTABLE_CHARACTERS.length > 0);
  for (const character of SELECTABLE_CHARACTERS) {
    const tuning = authoredTuning(character);
    const normals = Object.values(AttackStyle).filter(code => tuning.moves === undefined ? code !== AttackStyle.grab && code !== AttackStyle.dashAttack : tuning.moves.normals[code] !== undefined).length;
    const expected = 2 * (normals + 4 + (tuning.ultimate === undefined ? 0 : 1));
    const rows = showcaseRows(character);
    const name = fighterSlug(character);
    assertEquals(rows.length, expected, `${name} row count`);
    rows.forEach((row, index) => {
      assertEquals(row.row, `R${String(index + 1).padStart(2, "0")}`, `${name} row label`);
      assertEquals(row.facing, floorMod(index, 2) === 0 ? "right" : "left", `${name} ${row.row} facing`);
      assertTrue(row.frames[0] !== undefined && row.frames[0] > SHOWCASE_FIRST_FRAME);
      for (let at = 1; at < row.frames.length; at++) assertTrue((row.frames[at] ?? 0) > (row.frames[at - 1] ?? 0));
    });
  }
});
