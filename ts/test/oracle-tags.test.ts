// The kind-tag gate (#422) reads every registration form the suite uses and
// refuses any title that is not one of the five kinds.
import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKGROUND_SWEEPS } from "../src/runtime/backgroundSweeps";
import { backgroundSweepTitles, kindTagProblems, testTitles } from "../scripts/oracleTags";

const refusedTitles = (source: string): string[] => {
  const root = mkdtempSync(join(tmpdir(), "oracle-tags-"));
  writeFileSync(join(root, "a.test.ts"), source);
  return kindTagProblems(testTitles(root, ["a.test.ts"]), () => true).map((refused) => refused.title);
};

test("the kind-tag gate refuses a non-kind tag under test, sweep or a choice between them, and accepts each of the five kinds [k2 property]", () => {
  const forms = ["test", "sweep", "(heavy ? test : sweep)", "(heavy ? sweep : test)", "test.skip"];
  for (const form of forms) expect(refusedTitles(`${form}(\`\${name} rule [spec #98]\`, () => {});`)).toEqual(["${…} rule [spec #98]"]);
  const kinds = ["k1 scenario", "k2 property", "k3 measure #98", "k3 measure docs/README.md", "k4 reference melee", "k5 boundary map-load"];
  for (const form of forms) expect(refusedTitles(kinds.map((kind) => `${form}("${kind} [${kind}]", () => {});`).join("\n")).filter((title) => !title.includes("k5"))).toEqual([]);
  expect(refusedTitles(`test("a [k3 measure spec #98]", () => {});\ntest("b [k4 reference]", () => {});\ntest("c [k5 integration]", () => {});`)).toEqual(["a [k3 measure spec #98]", "b [k4 reference]", "c [k5 integration]"]);
});

test("every background sweep name carries a kind tag like the sweep it selects [k2 property]", () => {
  expect(kindTagProblems(backgroundSweepTitles(BACKGROUND_SWEEPS), () => true)).toEqual([]);
});
