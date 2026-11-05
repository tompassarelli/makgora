import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recordedFacts } from "../scripts/wisp/cueModels";
import { CUE_MODEL_RECORD } from "../scripts/wisp/cueInputs";
import { effectUses, judgeUse, modelFactsKey } from "../scripts/wisp/effectVisibility";



test("every parked ribbon projectile is shown again in a sequence its Classic model holds, because Warcraft leaves an effect asked for a missing sequence in the one it was parked in [k2 property]", () => {
  const recorded = recordedFacts(readFileSync(join(import.meta.dir, "../..", CUE_MODEL_RECORD), "utf8"));
  if ("problem" in recorded) throw new Error(recorded.problem);
  const parked = effectUses().filter((use) => use.kind === "projectile" && use.parked !== undefined);
  expect(parked.length).toBeGreaterThan(0);
  const stuck = parked.map((use) => judgeUse(use, recorded.facts.get(modelFactsKey(use.model)) ?? null)).filter((finding) => finding.status === "invisible").map((finding) => `${finding.fighter} ${finding.move}`);
  expect(stuck).toEqual([]);
});

