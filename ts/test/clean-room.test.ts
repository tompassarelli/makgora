import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creditsSection } from "../src/game/ui/credits";
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
  ]) expect(refused(text)).toBe(true);
});

test("passes ordinary hex, coordinates and policy text [k2 property]", () => {
  for (const text of [
    "x11_display: Some(display.to_owned()),",
    '"@effect/tsgo-linux-x64": ["x64"],',
    "spawns f12 at x32/z40, 8/frame",
    "the drawn shoulder spans x24–31/z51–86",
    "const reset = \"\\x1b[0m\";",
    "* qdtext = HTAB / SP / %x21 / %x23-5B / %x5D-7E",
    '"application/xcap-diff+xml": ["xdf"],',
    "Installed fighter extraction",
    "Never from disassembly, decompilation or Melee's own files.",
  ]) expect(refused(text)).toBe(false);
});

test("allows a listed file only for its listed rule [k2 property]", () => {
  expect(refused("read from the decompilation", "docs/delivery-goal.md")).toBe(false);
  expect(refused("main.dol", "docs/delivery-goal.md")).toBe(true);
  expect(refused("`coll_data` (Melee `MapCollData`)", "docs/physics.md")).toBe(true);
});

test("the Hive post's Credits section is the in-game credits list, so the two cannot drift [k2 property]", () => {
  const post = readFileSync(join(import.meta.dir, "../../docs/hive-post.md"), "utf8");
  const start = post.indexOf("## Credits\n");
  const end = post.indexOf("\n## ", start + 1);
  expect(post.slice(start, end).trimEnd()).toBe(creditsSection());
});
