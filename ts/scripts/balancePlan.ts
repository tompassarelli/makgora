import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { decoded, FarmFailure, run } from "wisp/scripts/wisp/farm";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { readJobs, runnerAdmission, type Job } from "./farmAdmission";
import { JOB_SECONDS, shardWork, type Work } from "./balanceShards";

const Timings = Schema.Record(Schema.String, Schema.Finite);
const Runs = Schema.Struct({ workflow_runs: Schema.Array(Schema.Struct({ id: Schema.Finite })) });
const Cpu = Schema.Struct({ cpuSeconds: Schema.Finite, pairs: Schema.Record(Schema.String, Schema.Finite) });

function legacyTimings(pairs: readonly string[], slugs: readonly string[], jobs: readonly Job[]): Record<string, number> {
  const seconds: Record<string, number> = {};
  const groups = Math.ceil(pairs.length / 8);
  for (const job of jobs) {
    if (job.started_at === null || job.completed_at === null || (job.runner_name ?? "") === "" || job.conclusion !== "success") continue;
    const elapsed = (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000;
    for (const kind of ["shard", "ceiling"]) {
      if (!job.name.startsWith(`${kind} (`)) continue;
      const first = pairs.findIndex((pair) => job.name.startsWith(`${kind} (${pair},`) || job.name === `${kind} (${pair})`);
      if (first < 0) continue;
      const group = pairs.filter((_, index) => index % groups === first);
      for (const pair of group) seconds[`${kind}/${pair}`] = elapsed / Math.ceil(group.length / 4);
    }
    if (job.name.startsWith("probe (")) for (const fighter of job.name.slice(7, -1).split(",").filter((fighter) => slugs.includes(fighter))) seconds[`probe/${fighter}`] = elapsed;
  }
  return seconds;
}

const historicalTimings = (repo: string, pairs: readonly string[], slugs: readonly string[]) => Effect.acquireUseRelease(
  Effect.sync(() => mkdtempSync(join(tmpdir(), "balance-timings-"))),
  (folder) => Effect.gen(function*() {
    const history = yield* decoded(Runs, yield* run(["gh", "api", `repos/${repo}/actions/workflows/balance.yml/runs?status=completed&per_page=20`]));
    for (const prior of history.workflow_runs) {
      const target = join(folder, String(prior.id));
      const cached = yield* run(["gh", "run", "download", String(prior.id), "-R", repo, "-n", "balance-timings", "-D", target]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
      if (cached) {
        const seconds = yield* decoded(Timings, readFileSync(join(target, "timings.json"), "utf8"));
        if (pairs.every((pair) => seconds[`shard/${pair}`] !== undefined && seconds[`ceiling/${pair}`] !== undefined) && slugs.every((slug) => seconds[`probe/${slug}`] !== undefined)) return { source: prior.id, seconds };
      }
      const seconds = legacyTimings(pairs, slugs, yield* readJobs(repo, prior.id));
      if (!pairs.every((pair) => seconds[`shard/${pair}`] !== undefined && seconds[`ceiling/${pair}`] !== undefined) || !slugs.every((slug) => seconds[`probe/${slug}`] !== undefined)) continue;
      yield* run(["gh", "run", "download", String(prior.id), "-R", repo, "-p", "balance-ceiling-*", "-D", target]);
      for (const directory of readdirSync(target)) for (const name of readdirSync(join(target, directory))) {
        if (!name.endsWith(".json")) continue;
        const data = yield* decoded(Cpu, readFileSync(join(target, directory, name), "utf8"));
        const pair = (Object.keys(data.pairs)[0] ?? "").split("/").slice(1, 3).join(":");
        if (pairs.includes(pair)) seconds[`ceiling/${pair}`] = data.cpuSeconds;
      }
      return { source: prior.id, seconds };
    }
    return yield* new FarmFailure({ problem: "No complete balance timing sample in the last twenty runs" });
  }),
  (folder) => Effect.sync(() => rmSync(folder, { recursive: true, force: true })),
);

const main = Effect.gen(function*() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo === undefined) return yield* new FarmFailure({ problem: "balancePlan needs GITHUB_REPOSITORY" });
  const slugs = SELECTABLE_CHARACTERS.map(fighterSlug);
  const allPairs = slugs.flatMap((a, index) => slugs.slice(index + 1).map((b) => `${a}:${b}`));
  const requested = (process.env.MATCHUPS ?? "").split(",").filter(Boolean);
  if (requested.some((pair) => !allPairs.includes(pair))) return yield* new FarmFailure({ problem: "Unknown or reversed fighter matchup" });
  const pairs = requested.length === 0 ? allPairs : allPairs.filter((pair) => requested.includes(pair));
  const { source, seconds } = yield* historicalTimings(repo, allPairs, slugs);
  const field: Work[] = pairs.map((pair) => ({ name: pair, seconds: (seconds[`shard/${pair}`] ?? JOB_SECONDS) * Number(process.env.PER_PAIR ?? 400) / 400 }));
  const partitioned = (name: string, duration: number): Work[] => {
    const count = Math.max(1, Math.ceil(duration / (JOB_SECONDS * 0.75)));
    return Array.from({ length: count }, (_, part) => ({ name: `${name}@${part}/${count}`, seconds: duration / count }));
  };
  const ceiling = pairs.flatMap((pair) => partitioned(pair, seconds[`ceiling/${pair}`] ?? JOB_SECONDS));
  const probe = slugs.flatMap((slug) => partitioned(slug, (seconds[`probe/${slug}`] ?? JOB_SECONDS) * Number(process.env.PROBE ?? 40) / 40));
  const fields = shardWork(field).map((group) => group.join(","));
  const ceilings = shardWork(ceiling).map((group) => group.join(","));
  const probes = Number(process.env.PROBE ?? 40) === 0 ? [] : shardWork(probe).map((group) => group.join(","));
  const admission = yield* runnerAdmission(repo, Number(process.env.GITHUB_RUN_ID));
  console.error(`Timing source ${source}: ${pairs.length} pairs in ${fields.length} field jobs, ${ceilings.length} ceiling jobs and ${probes.length} probe jobs, predicted longest <= ${JOB_SECONDS}s`);
  console.log(`parallel=${admission.parallel}\nadmission=${admission.measurement}; timings from ${source}\nshards=${JSON.stringify(fields)}\nceilings=${JSON.stringify(ceilings)}\nprobes=${JSON.stringify(probes)}\njobs=${fields.length}`);
});

if (import.meta.main) BunRuntime.runMain(main);
