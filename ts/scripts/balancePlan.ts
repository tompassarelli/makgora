import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { decoded, FarmFailure, run } from "wisp/scripts/wisp/farm";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";
import { runnerAdmission } from "./farmAdmission";
import { JOB_SECONDS, measuredSeconds, ofKind, shardWork, type Work } from "./balanceShards";

const Timings = Schema.Record(Schema.String, Schema.Finite);
const Runs = Schema.Struct({ workflow_runs: Schema.Array(Schema.Struct({ id: Schema.Finite })) });
const Artifacts = Schema.Struct({ artifacts: Schema.Array(Schema.Struct({ id: Schema.Finite, name: Schema.String, expired: Schema.Boolean, workflow_run: Schema.Struct({ id: Schema.Finite }) })) });

const timingSamples = (repo: string, keys: readonly string[]) => Effect.acquireUseRelease(
  Effect.sync(() => mkdtempSync(join(tmpdir(), "balance-timings-"))),
  (folder) => Effect.gen(function*() {
    const balanceRuns = yield* decoded(Runs, yield* run(["gh", "api", `repos/${repo}/actions/workflows/balance.yml/runs?status=completed&per_page=30`]));
    const named = yield* decoded(Artifacts, yield* run(["gh", "api", `repos/${repo}/actions/artifacts?name=balance-timings&per_page=30`]));
    const runs = [...new Set([...balanceRuns.workflow_runs.map((prior) => prior.id), ...named.artifacts.filter((artifact) => !artifact.expired).map((artifact) => artifact.workflow_run.id)])].toSorted((a, b) => b - a);
    const samples: Record<string, number>[] = [];
    const covered = new Set<string>();
    for (const id of runs) {
      if (keys.every((key) => covered.has(key))) break;
      const target = join(folder, String(id));
      if (!(yield* run(["gh", "run", "download", String(id), "-R", repo, "-p", "balance-timings*", "-D", target]).pipe(Effect.as(true), Effect.orElseSucceed(() => false)))) continue;
      const sample: Record<string, number> = {};
      const files = readdirSync(target, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".json"));
      for (const file of files) Object.assign(sample, yield* decoded(Timings, readFileSync(join(target, file), "utf8")));
      for (const key of Object.keys(sample)) covered.add(key);
      if (Object.keys(sample).length > 0) samples.push(sample);
    }
    return samples;
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
  const samples = yield* timingSamples(repo, [...pairs.map((pair) => `shard/${pair}`), ...pairs.map((pair) => `ceiling/${pair}`), ...slugs.map((slug) => `probe/${slug}`)]);
  const measured = measuredSeconds(pairs, ofKind(samples, "shard"));
  const measuredCeiling = measuredSeconds(pairs, ofKind(samples, "ceiling"));
  const measuredProbe = measuredSeconds(slugs, ofKind(samples, "probe"));
  const field: Work[] = pairs.map((pair) => ({ name: pair, seconds: (measured?.[pair] ?? JOB_SECONDS) * Number(process.env.PER_PAIR ?? 400) / 400 }));
  const partitioned = (name: string, duration: number): Work[] => {
    const count = Math.max(1, Math.ceil(duration / (JOB_SECONDS * 0.75)));
    return Array.from({ length: count }, (_, part) => ({ name: `${name}@${part}/${count}`, seconds: duration / count }));
  };
  const ceiling = pairs.flatMap((pair) => partitioned(pair, measuredCeiling?.[pair] ?? JOB_SECONDS));
  const probe = slugs.flatMap((slug) => partitioned(slug, (measuredProbe?.[slug] ?? JOB_SECONDS) * Number(process.env.PROBE ?? 40) / 40));
  const fields = shardWork(field).map((group) => group.join(","));
  const ceilings = shardWork(ceiling).map((group) => group.join(","));
  const probes = Number(process.env.PROBE ?? 40) === 0 ? [] : shardWork(probe).map((group) => group.join(","));
  const admission = yield* runnerAdmission(repo, Number(process.env.GITHUB_RUN_ID));
  console.error(`Timings from ${samples.length} measured artifacts: ${pairs.length} pairs in ${fields.length} field jobs, ${ceilings.length} ceiling jobs and ${probes.length} probe jobs, predicted longest <= ${JOB_SECONDS}s`);
  console.log(`parallel=${admission.parallel}\nadmission=${admission.measurement}; timings from ${samples.length} measured artifacts\nshards=${JSON.stringify(fields)}\nceilings=${JSON.stringify(ceilings)}\nprobes=${JSON.stringify(probes)}\njobs=${fields.length}`);
});

if (import.meta.main) BunRuntime.runMain(main);
