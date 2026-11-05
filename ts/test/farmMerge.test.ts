import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { type CheckArtifacts, expectedGroups, mergeChecks, readArtifacts } from "../scripts/farmMerge";
import { GROUPS, type Group } from "../scripts/landingChecks";

const PLAN = { bun: [], lua: 1, luaTests: {} };
const NO_TIMINGS = { bun: {}, lua: {} };

const artifactFolder = (reused: readonly Group[], ran: readonly Group[] = []) => {
  const folder = mkdtempSync(join(tmpdir(), "farm-merge-"));
  for (const group of reused) {
    mkdirSync(join(folder, `farm-test-skipped-check-${group}`));
    writeFileSync(join(folder, `farm-test-skipped-check-${group}`, `skipped-check-${group}.txt`), `${group} reused: it passed before on inputs ${"a".repeat(64)}\n`);
  }
  for (const group of ran) {
    mkdirSync(join(folder, `farm-test-result-check-${group}`));
    writeFileSync(join(folder, `farm-test-result-check-${group}`, `result-check-${group}.json`),
      JSON.stringify({ suite: "lua", shard: 0, exitCode: 0, tests: [{ name: `check: ${group}`, unit: `check: ${group}`, seconds: 4, status: "pass" }] }));
  }
  return folder;
};

const mergedProblems = (artifacts: CheckArtifacts, checks: string) =>
  mergeChecks({ plan: PLAN, artifacts, expected: expectedGroups(checks), planResult: "success", timings: NO_TIMINGS }).summary.problems;

test("every check group the plan's lua shard serves can be reused alone or with all the others and the summary stays clean [k2 property]", () => {
  for (const group of GROUPS) expect({ group, problems: mergedProblems(readArtifacts(artifactFolder([group])), JSON.stringify([group])) }).toEqual({ group, problems: [] });
  expect(mergedProblems(readArtifacts(artifactFolder([...GROUPS])), "")).toEqual([]);
  expect(mergedProblems(readArtifacts(artifactFolder(GROUPS.slice(0, 5), GROUPS.slice(5))), "")).toEqual([]);
});
