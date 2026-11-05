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

test("a lua group reused from a cached pass hands the plan's lua shard 0 its pass, so the summary names no missing shard (makgora#1125) [k1 scenario]", () => {
  const artifacts = readArtifacts(artifactFolder(["lua"]));
  expect(artifacts.results.has("result-check-lua.json")).toBe(false);
  expect(mergedProblems(artifacts, '["lua"]')).toEqual([]);
});

test("every check group the plan's lua shard serves can be reused alone or with all the others and the summary stays clean [k2 property]", () => {
  for (const group of GROUPS) expect({ group, problems: mergedProblems(readArtifacts(artifactFolder([group])), JSON.stringify([group])) }).toEqual({ group, problems: [] });
  expect(mergedProblems(readArtifacts(artifactFolder([...GROUPS])), "")).toEqual([]);
  expect(mergedProblems(readArtifacts(artifactFolder(GROUPS.slice(0, 5), GROUPS.slice(5))), "")).toEqual([]);
});

test("a group that neither ran nor left a skip marker, and a run with no result at all, are still reported [k1 scenario]", () => {
  expect(mergedProblems(readArtifacts(artifactFolder(["lua"])), '["lua","boot"]')).toEqual(["check group boot neither ran nor was filtered out: it left no result"]);
  expect(mergedProblems(readArtifacts(artifactFolder([])), '["lua"]')).toEqual([
    "check group lua neither ran nor was filtered out: it left no result",
    "lua shard 0 sent no result",
  ]);
});

test("a ran group's failing test and its problem notes reach the summary beside a reused group [k1 scenario]", () => {
  const folder = artifactFolder(["lua"]);
  mkdirSync(join(folder, "farm-test-result-check-boot"));
  writeFileSync(join(folder, "farm-test-result-check-boot", "result-check-boot.json"),
    JSON.stringify({ suite: "lua", shard: 0, exitCode: 1, tests: [{ name: "check: boot", unit: "check: boot", seconds: 2, status: "fail" }] }));
  writeFileSync(join(folder, "farm-test-result-check-boot", "problems-boot.txt"), "boot: the map failed to load\n\n");
  const { summary } = mergeChecks({ plan: PLAN, artifacts: readArtifacts(folder), expected: expectedGroups('["lua","boot"]'), planResult: "success", timings: NO_TIMINGS });
  expect(summary.failures).toEqual(["lua: check: boot"]);
  expect(summary.problems).toEqual(["boot: the map failed to load"]);
});
