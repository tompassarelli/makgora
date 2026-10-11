import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Cause, Effect, Exit, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { testWorkerEnvironment } from "./testWorkers";

class PremergeFailure extends Schema.TaggedError<PremergeFailure>()("PremergeFailure", { problem: Schema.String }) {}
const project = process.cwd();
const run = (name: string, command: string, args: readonly string[], env = process.env, json = false, output = "premerge-stages.jsonl") => Effect.scoped(Effect.gen(function*() {
  const started = performance.now();
  const child = yield* ChildProcess.make(command, args, { cwd: project, env, stdin: "ignore", stdout: json ? "pipe" : "inherit", stderr: "inherit" });
  const [code, raw] = yield* Effect.all([child.exitCode, json ? Stream.mkString(Stream.decodeText(child.stdout)) : Effect.succeed("")], { concurrency: "unbounded" });
  if (json) writeFileSync(join(project, "build", output), raw);
  const seconds = (performance.now() - started) / 1000;
  console.log(`${name}: exit ${code}, ${seconds.toFixed(3)} s`);
  return Number(code);
})).pipe(Effect.catchTag("PlatformError", (cause) => Effect.sync(() => {
  console.error(`${name}: ${cause.message}`);
  return 75;
})));

const program = Effect.gen(function*() {
  const base = process.argv[2];
  if (base === undefined || !/^[0-9a-f]{40}$/.test(base)) return yield* new PremergeFailure({ problem: "usage: bun scripts/premerge.ts BASE_SHA" });
  const command = process.env.WISP_CI_COMMAND;
  mkdirSync(join(project, "build"), { recursive: true });
  writeFileSync(join(project, "build/premerge-stages.jsonl"), "");
  writeFileSync(join(project, "build/premerge-plan.jsonl"), "");
  let code = 75;
  if (command !== undefined && command.trim() !== "") {
    const cli = /^bun\s+([A-Za-z0-9_./-]+)$/.exec(command.trim())?.[1];
    if (cli !== undefined && (yield* Effect.tryPromise({ try: () => Bun.file(cli).exists(), catch: cause => new PremergeFailure({ problem: String(cause) }) }))) {
      const result = yield* run("wisp-ci", process.execPath, [cli, "ci", "pre-merge", "--base", base, "--json"], process.env, true);
      code = result === 0 || result === 1 ? result : 75;
    } else console.error("Wisp CLI is unavailable; the full fallback is required.");
  } else {
    const files = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Array(Schema.String)))(process.env.PREMERGE_TEST_FILES ?? "[]");
    for (const file of files) {
      if (!/^test\/[A-Za-z0-9_./-]+\.test\.ts$/.test(file) || file.split("/").includes("..")) return yield* new PremergeFailure({ problem: `invalid existing test path: ${file}` });
    }
    const checked = yield* run("stub-typecheck", process.execPath, ["run", "check"]);
    if (checked !== 0) code = 1;
    else if (files.length > 0) {
      const tested = yield* run("stub-selected-tests", process.execPath, ["test", ...files], { ...process.env, ...testWorkerEnvironment(files) });
      if (tested !== 0) code = 1;
    }
    console.log("Wisp ci is not configured; stub evidence requires the full fallback.");
  }
  const determinism = process.env.DETERMINISM_CHECK;
  let determinismResult: { readonly verdict: "passed" | "failed" | "inconclusive" | "skipped"; readonly reason: string } | undefined;
  if (code === 0) {
    const cli = /^bun\s+([A-Za-z0-9_./-]+)$/.exec(command?.trim() ?? "")?.[1];
    const planned = cli === undefined ? 75 : yield* run("wisp-ci-plan", process.execPath, [cli, "ci", "pre-merge", "--base", base, "--plan-only", "--json"], process.env, true, "premerge-plan.jsonl");
    const scope = planned === 0 ? yield* Effect.tryPromise({
      try: () => Bun.file(join(project, "build/premerge-plan.jsonl")).text(),
      catch: cause => new PremergeFailure({ problem: String(cause) }),
    }).pipe(Effect.flatMap(raw => Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
      schema: Schema.Literal(1), command: Schema.Literal("ci"), type: Schema.Literal("plan"), base: Schema.Literal(base),
      determinism: Schema.Struct({ runs: Schema.Boolean, reason: Schema.String.check(Schema.isMinLength(1)) }),
    })))(raw.trim())), Effect.map(plan => plan.determinism), Effect.orElseSucceed(() => undefined)) : undefined;
    if (scope === undefined) {
      code = 75;
      determinismResult = { verdict: "inconclusive", reason: "the authoritative Wisp determinism plan is unavailable" };
    } else if (!scope.runs) {
      determinismResult = { verdict: "skipped", reason: scope.reason };
      console.log(`determinism: skipped (${scope.reason})`);
    } else if (determinism === undefined || determinism.trim() === "") {
      code = 75;
      determinismResult = { verdict: "inconclusive", reason: "emitted-Lua determinism check is required" };
    } else {
      const checked = yield* run("determinism", "sh", ["-c", determinism]);
      code = checked === 0 || checked === 1 ? checked : 75;
      determinismResult = { verdict: code === 0 ? "passed" : code === 1 ? "failed" : "inconclusive", reason: scope.reason };
    }
  }
  const status = code === 0 ? "pass" : code === 1 ? "fail" : "inconclusive";
  writeFileSync(join(project, "build/premerge.json"), `${JSON.stringify({ base, status, exitCode: code, stub: command === undefined || command.trim() === "", ...(determinismResult === undefined ? {} : { determinism: determinismResult }) })}\n`);
  if (process.env.GITHUB_OUTPUT !== undefined) writeFileSync(process.env.GITHUB_OUTPUT, `full=${code === 75}\nstatus=${status}\n`, { flag: "a" });
  return code;
});

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)), {
  disableErrorReporting: true,
  teardown: exit => {
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) console.error(Cause.pretty(exit.cause));
    process.exit(Exit.isSuccess(exit) ? Number(exit.value) : Cause.hasInterruptsOnly(exit.cause) ? 130 : 1);
  },
});
