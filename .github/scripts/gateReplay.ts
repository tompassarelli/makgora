import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { captureProcess, runProcess } from "wisp/scripts/wisp/hostProcess";
import { makeCi } from "wisp/scripts/wisp/commands/ci";
import { platformLayer } from "wisp/scripts/platform/layer";
import { SMASHCRAFT_DEV } from "../../ts/scripts/wisp/commands/dev";
import { SMASHCRAFT_SOAK } from "../../ts/scripts/wisp/commands/soak";

class ReplayFailure extends Schema.TaggedError<ReplayFailure>()("ReplayFailure", { problem: Schema.String }) {}
const Sha = Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/));
const Row = Schema.Struct({ lane_sha: Sha, candidate: Sha, base: Sha, run_id: Schema.Int, classification: Schema.Literals(["suite_failure", "report_generation_without_result"]), test_classes: Schema.Array(Schema.String) });
const Result = Schema.Struct({ type: Schema.String, stage: Schema.optionalKey(Schema.String), verdict: Schema.optionalKey(Schema.String), failed: Schema.optionalKey(Schema.Array(Schema.String)) });
const gateRoot = resolve(import.meta.dir, "../../ts");
const script = join(import.meta.dir, "gateReplay.ts");
const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

const check = (root: string, base: string) => makeCi({
  ...SMASHCRAFT_DEV,
  root,
  soak: { ...SMASHCRAFT_SOAK, project: join(root, "scripts/wisp/soak.ts"), reads: ["scripts/wisp/model-facts/*.json", "node_modules/wisp/src/natives/warcraft.d.ts"] },
})(["pre-merge", "--base", base, "--json"]);

const program = Effect.gen(function*() {
  if (process.argv[2] === "check") {
    const root = process.argv[3];
    const base = yield* Schema.decodeUnknownEffect(Sha)(process.argv[4]);
    if (root === undefined) return yield* new ReplayFailure({ problem: "missing replay tree" });
    return yield* check(resolve(root), base).pipe(Effect.as(0), Effect.catchTag("CiFailure", failure => Effect.succeed(failure.exitCode ?? 1)));
  }
  const rows = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Array(Row)))(process.env.REPLAY_COHORT ?? "[]");
  const shard = Number(process.env.REPLAY_SHARD);
  if (rows.length !== 20 || !Number.isInteger(shard) || shard < 0 || shard > 3) return yield* new ReplayFailure({ problem: "replay requires the approved 20 rows and shard 0..3" });
  const output = resolve(gateRoot, "build/gate-replay", String(shard));
  mkdirSync(output, { recursive: true });
  const provenance = {
    kind: "current gate runner with each historical tree's frozen dependencies; not byte-identical historical CI",
    gateSha: (yield* captureProcess("gate identity", gateRoot, ["git", "rev-parse", "HEAD"], { cwd: gateRoot })).stdout.trim(),
    runtime: process.version,
    bunVersion: Bun.version,
    runtimeSha256: digest(process.execPath),
    lockSha256: digest(join(gateRoot, "bun.lock")),
    packageSha256: digest(join(gateRoot, "package.json")),
    wispLockSha256: digest(join(gateRoot, "wisp.lock")),
  };
  writeFileSync(join(output, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
  for (const [index, row] of rows.entries()) {
    if (index % 4 !== shard) continue;
    const folder = join(output, String(index));
    mkdirSync(folder, { recursive: true });
    const measurements: Record<string, unknown> = {};
    const rowStarted = performance.now();
    const persist = () => writeFileSync(join(output, `${index}.json`), JSON.stringify({ ...row, ...provenance, measurements, rowWallSeconds: (performance.now() - rowStarted) / 1000, scoring: "pending private original-name join", missingChecks: ["actual emitted-Lua nearest/toward-zero smoke", ...(row.classification === "report_generation_without_result" ? ["report generation"] : [])], acceptance: "shared makeCi subset measurement; not complete pre-merge switch acceptance", baselineSelection: "reverse diff from historical candidate selects changed paths on exact base" }, null, 2) + "\n");
    persist();
    const fetched = yield* runProcess("fetch historical identities", gateRoot, ["git", "fetch", "origin", row.candidate, row.base], gateRoot).pipe(Effect.timeout("2 minutes"), Effect.result);
    measurements.fetch = { wallSeconds: (performance.now() - rowStarted) / 1000 };
    if (fetched._tag === "Failure") {
      measurements.fetch = { wallSeconds: (performance.now() - rowStarted) / 1000, reason: String(fetched.failure) };
      persist();
      continue;
    }
    for (const kind of ["candidate", "base"] as const) {
      yield* Effect.scoped(Effect.gen(function*() {
        const sha = row[kind];
        const reverseBase = kind === "candidate" ? row.base : row.candidate;
        const tree = join(folder, kind);
        const setupStarted = performance.now();
        const prepared = yield* runProcess("historical tree", gateRoot, ["git", "worktree", "add", "--detach", tree, sha], gateRoot).pipe(Effect.result);
        if (prepared._tag === "Failure") {
          measurements[kind] = { sha, verdict: "inconclusive", setupWallSeconds: (performance.now() - setupStarted) / 1000, reason: String(prepared.failure) };
          persist();
          return;
        }
        yield* Effect.addFinalizer(() => runProcess("retire historical tree", gateRoot, ["git", "worktree", "remove", "--force", tree], gateRoot).pipe(Effect.timeout("30 seconds"), Effect.catch(cause => Effect.sync(() => {
          measurements[`${kind}Cleanup`] = { reason: String(cause) };
          persist();
        }))));
        const root = join(tree, "ts");
        let checkStarted: number | undefined;
        let setupWallSeconds = 0;
        let installWallSeconds = 0;
        const measured = yield* Effect.gen(function*() {
          const identity = yield* captureProcess("tree identity", root, ["git", "rev-parse", "HEAD"], { cwd: root });
          if (identity.stdout.trim() !== sha) return yield* new ReplayFailure({ problem: "historical tree identity mismatch" });
          const historicalToolchain = { lockSha256: digest(join(root, "bun.lock")), packageSha256: digest(join(root, "package.json")), wispLockSha256: digest(join(root, "wisp.lock")) };
          const installStarted = performance.now();
          yield* runProcess("historical frozen dependencies", root, [process.execPath, "install", "--frozen-lockfile"], root).pipe(Effect.timeout("3 minutes"));
          installWallSeconds = (performance.now() - installStarted) / 1000;
          setupWallSeconds = (performance.now() - setupStarted) / 1000;
          checkStarted = performance.now();
          const result = yield* captureProcess("shared Wisp gate", root, [process.execPath, script, "check", root, reverseBase], { cwd: root }).pipe(Effect.timeout("8 minutes"));
          const checkWallSeconds = (performance.now() - checkStarted) / 1000;
          writeFileSync(join(folder, `${kind}.jsonl`), result.stdout);
          writeFileSync(join(folder, `${kind}.stderr`), result.stderr);
          const stages = yield* Effect.forEach(result.stdout.trim().split("\n").filter(Boolean), line => Schema.decodeEffect(Schema.fromJsonString(Result))(line));
          return { sha, diffBase: reverseBase, historicalToolchain, exitCode: result.exitCode, setupWallSeconds, installWallSeconds, checkWallSeconds, stages };
        }).pipe(Effect.result);
        measurements[kind] = measured._tag === "Success" ? measured.success : { sha, verdict: "inconclusive", setupWallSeconds: setupWallSeconds || (performance.now() - setupStarted) / 1000, installWallSeconds, ...(checkStarted === undefined ? {} : { checkWallSeconds: (performance.now() - checkStarted) / 1000 }), reason: String(measured.failure) };
        persist();
      }));
      persist();
    }

  }
  return 0;
});

BunRuntime.runMain(program.pipe(Effect.provide(Layer.merge(BunServices.layer, platformLayer()))), {
  disableErrorReporting: true,
  teardown: exit => {
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) console.error(Cause.pretty(exit.cause));
    process.exit(Exit.isSuccess(exit) ? Number(exit.value) : Cause.hasInterruptsOnly(exit.cause) ? 130 : 1);
  },
});
