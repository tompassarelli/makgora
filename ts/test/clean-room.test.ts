import { expect, test } from "bun:test";
import { reachProblems } from "../scripts/cleanRoom";

const refused = (text: string, path = "ts/src/game/sim/example.ts") => reachProblems([{ path, line: 1, text }]).length > 0;

test("refuses offset-named Melee fields as identifiers or strings [k2 property]", () => {
  for (const text of [
    'set("shield.max", commonValue("x260_startShieldHealth"));',
    'set("shield.drain", f2(commonValue("x278") * 2));',
    'set("di.degrees", commonValue("x1A8"));',
    "// Common-data value x3E8 sets the decay.",
    "the hit's damage (`dmg.x1924`)",
    "`x1960_vibrateMult`, 1.0 by default",
    "the highest ECB bone its fighter data lists (ftData x44)",
  ]) expect(refused(text)).toBe(true);
});

test("refuses retail-file provenance [k2 property]", () => {
  for (const text of [
    "const STAGE = \"Final Destination's coll_data: rightWall lines 9, 10\";",
    "/** air speed 3.0 for every fighter but Falco (retail-roster.json). */",
    'const DODGE_DATA = "Fox/Falco animation frames (retail-action-lengths.json)";',
    "// Value from the cited NTSC 1.02 extraction.",
    "Each rule comes from the decompilation.",
    "/** GrOp.dat yakumono_param: the shortest wait between gusts. */",
    "/** GrOk.dat rframe_barrel_in: the catch radius. */",
    "the shot leaves after groldkongo.c stageGObj1_GObjProc's timer",
    "Melee's per-state interrupt lists (`ftCo_*_IASA`)",
    "`Fighter_procUpdate` adds it to the position",
  ]) expect(refused(text)).toBe(true);
});

test("allows a listed file only for its listed rule [k2 property]", () => {
  expect(refused("read from the decompilation", "docs/delivery-goal.md")).toBe(false);
  expect(refused("main.dol", "docs/delivery-goal.md")).toBe(true);
  expect(refused("`coll_data` (Melee `MapCollData`)", "docs/physics.md")).toBe(true);
});

