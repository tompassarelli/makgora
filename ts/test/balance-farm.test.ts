import { expect, test } from "bun:test";
import { JOB_SECONDS, RUNNER_CORES, partitionWork, shardWork } from "../scripts/balanceShards";
import { reserveP90, type Job } from "../scripts/farmAdmission";
import { mergeProbeCounts } from "../scripts/cpuField";

test("time-based shards and partitions run every work unit exactly once within the job budget [k2 property]", () => {
  let seed = 12345;
  for (let trial = 0; trial < 100; trial++) {
    const units = Array.from({ length: trial + 1 }, (_, index) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return { name: String(index), seconds: 1 + ((seed >>> 0) % JOB_SECONDS) };
    });
    const groups = shardWork(units);
    expect(groups.flat().sort()).toEqual(units.map((unit) => unit.name).sort());
    const times = new Map(units.map((unit) => [unit.name, unit.seconds]));
    for (const group of groups) {
      const cores = Array.from({ length: RUNNER_CORES }, () => 0);
      for (const name of group) { const core = cores.indexOf(Math.min(...cores)); cores[core] = (cores[core] ?? 0) + (times.get(name) ?? 0); }
      expect(Math.max(...cores)).toBeLessThanOrEqual(JOB_SECONDS);
    }
    for (const count of [1, 2, 3, 7, 13]) {
      const owners = Array.from({ length: count }, (_, part) => partitionWork(`${part}/${count}`));
      for (const unit of units) expect(owners.filter((owns) => owns()).length).toBe(1);
    }
  }
});

test("Autoland reserve weights running time and excludes self-hosted work and runner waits [k2 property]", () => {
  const job = (start: number, end: number, labels = ["ubuntu-latest"], runner_name = "GitHub Actions 1"): Job => ({ name: "job", status: "completed", conclusion: "success", started_at: new Date(start * 1000).toISOString(), completed_at: new Date(end * 1000).toISOString(), labels, runner_name });
  const jobs = [job(0, 100), job(0, 90), job(0, 1), job(0, 100, ["self-hosted"]), job(0, 100, ["ubuntu-latest"], "")];
  expect(reserveP90(jobs)).toBe(2);
  expect(reserveP90([])).toBe(0);
});

test("split spam probes combine decisive wins and all matches before calculating the verdict [k2 property]", () => {
  const rows = [{ fighter: "test", move: "special", wins: 1, losses: 9, matches: 12 }, { fighter: "test", move: "special", wins: 8, losses: 2, matches: 10 }];
  expect(mergeProbeCounts(rows).get("test")).toEqual({ move: "special", winRate: 9 / 20, matches: 22 });
  expect(mergeProbeCounts([...rows].reverse())).toEqual(mergeProbeCounts(rows));
  expect(() => mergeProbeCounts([...rows, { fighter: "test", move: "other", wins: 1, losses: 0, matches: 1 }])).toThrow("different moves");
});
