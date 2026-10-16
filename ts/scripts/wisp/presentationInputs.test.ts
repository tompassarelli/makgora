import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRESENTATION_MAP, newestPresentation } from "./presentationInputs";

test("acceptance selects the newest complete presentation input set, skipping partial and undated ones [k5 boundary presentation-inputs]", () => {
  const root = mkdtempSync(join(tmpdir(), "presentation-inputs-"));
  try {
    const set = (name: string, files: readonly string[]) => {
      mkdirSync(join(root, name));
      for (const file of files) writeFileSync(join(root, name, file), "");
    };
    const full = [PRESENTATION_MAP, `${PRESENTATION_MAP}.base.lua`];
    set("native-acceptance-20261006", full);
    set("native-acceptance-20261016", full);
    set("native-acceptance-20261020", [PRESENTATION_MAP]);
    set("native-acceptance-20261030-scratch", full);
    expect(newestPresentation(root)).toBe(join(root, "native-acceptance-20261016", PRESENTATION_MAP));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
