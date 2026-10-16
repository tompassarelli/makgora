import { expect, test } from "bun:test";
import { artifactMatches } from "../scripts/workflowArtifacts";

const INTENDED = [
  "balance.yml: shard balance-shard-${{ strategy.job-index }} -> merge balance-shard-*",
  "balance.yml: merge balance-merged -> probe balance-merged",
  "balance.yml: shard balance-shard-${{ strategy.job-index }} -> verdict balance-shard-*",
  "balance.yml: probe balance-probe-${{ strategy.job-index }} -> verdict balance-probe-*",
  "balance.yml: ceiling balance-ceiling-${{ strategy.job-index }} -> verdict balance-ceiling-*",
  "farm-test.yml: plan farm-test-plan -> bun farm-test-plan",
  "farm-test.yml: plan farm-test-plan -> lua farm-test-plan",
  "farm-test.yml: plan farm-test-plan -> merge farm-test-*",
  "farm-test.yml: bun farm-test-result-bun-${{ matrix.shard }} -> merge farm-test-*",
  "farm-test.yml: lua farm-test-result-lua-${{ matrix.job }} -> merge farm-test-*",
  "farm-test.yml: checks farm-test-skipped-check-${{ matrix.group }} -> merge farm-test-*",
  "farm-test.yml: checks farm-test-result-check-${{ matrix.group }} -> merge farm-test-*",
  "headless-pads.yml: helper wc3-journal -> pad wc3-journal",
  "playtest.yml: shard playtest-shard-${{ strategy.job-index }} -> report playtest-shard-*",
];

test("every workflow artifact a job's download name or pattern picks up from another job is a listed, intended producer and consumer pair [k1 scenario]", () => {
  expect(artifactMatches().filter((match) => !INTENDED.includes(match))).toEqual([]);
});
