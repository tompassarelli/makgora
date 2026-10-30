import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { CaptureQueueFailure, queueDirectory, writeAtomic } from "./captureQueue";
import { pairDefaults } from "./captureQueuePair";
import { manifestAt, originOf, planAt, pullFile, pullStoredMap, pushFolder } from "./captureQueueRemote";

const fail = (problem: string) => new CaptureQueueFailure({ problem });
const attempt = <A>(problem: string, run: () => A) => Effect.try({ try: run, catch: cause => fail(`${problem}: ${cause instanceof Error ? cause.message : String(cause)}`) });

export interface Pull {
  readonly origin: string;
  readonly originStore: string;
  readonly key: string;
  readonly plan: string;
  readonly manifest: string;
  readonly out: string;
  readonly work: string;
  readonly pair: number;
  readonly client: string;
  readonly minutes: number;
}

export const pullOf = (args: readonly string[]): Pull | undefined => {
  const option = (name: string) => args[args.indexOf(name) + 1];
  const [origin, originStore, key, plan, manifest, out, work, pair, minutes] = ["--origin", "--origin-store", "--key", "--plan", "--manifest", "--out", "--work", "--pair", "--minutes"].map(option);
  const number = Number(pair);
  if (origin === undefined || originStore === undefined || key === undefined || plan === undefined || manifest === undefined || out === undefined || work === undefined || !Number.isInteger(number) || number < 0) return undefined;
  return { origin, originStore, key, plan, manifest, out, work, pair: number, client: option("--client") ?? `lan${number}a`, minutes: Number(minutes ?? "1") };
};

/** Runs a capture batch queued by another host on this host's pair: the stored map, plan and manifest come from that host over ssh and the frames, whole or partial, go back to its `out` before the batch's result is returned. */
export const pull = (job: Pull, ts: string) => Effect.gen(function*() {
  const origin = originOf(job.origin), there = join(queueDirectory("batches"), "remote", job.work), logFile = join(there, "run.log");
  yield* attempt("create the work folder", () => mkdirSync(there, { recursive: true }));
  const map = yield* pullStoredMap(origin, job.originStore, job.key, logFile);
  yield* pullFile(origin, job.manifest, join(there, "origin-manifest.json"), logFile);
  yield* pullFile(origin, job.plan, join(there, "origin-plan.json"), logFile);
  const manifest = join(there, "manifest.json"), plan = join(there, "plan.json");
  yield* attempt("write the manifest", () => writeAtomic(manifest, manifestAt(readFileSync(join(there, "origin-manifest.json"), "utf8"), map)));
  yield* attempt("write the plan", () => writeAtomic(plan, planAt(readFileSync(join(there, "origin-plan.json"), "utf8"), map, manifest)));
  const own = pairDefaults(job.pair, job.client), frames = join(there, "native");
  const ran = yield* Effect.tryPromise({
    try: async () => {
      const fd = openSync(logFile, "a");
      const child = Bun.spawn([process.execPath, "scripts/nativeCapture.ts", "batch", "--plan", plan, "--out", frames, "--pair", String(job.pair), "--desktop", own.desktop, "--capacity", own.capacity, "--clients-file", own.clientsFile, "--client", own.client, "--install", own.install, "--minutes", String(job.minutes)], { cwd: ts, stdin: "ignore", stdout: fd, stderr: fd });
      closeSync(fd);
      const code = await child.exited;
      if (code !== 0) throw new Error(`batch exited ${code}`);
    },
    catch: cause => fail(`${cause instanceof Error ? cause.message : String(cause)}; see ${logFile}`),
  }).pipe(Effect.result);
  const pushed = yield* pushFolder(origin, frames, job.out, logFile).pipe(Effect.result);
  if (ran._tag === "Failure") return yield* ran.failure;
  if (pushed._tag === "Failure") return yield* pushed.failure;
});

if (import.meta.main) {
  const job = pullOf(process.argv.slice(2));
  if (job === undefined) {
    console.error("usage: captureQueuePull.ts --origin HOST --origin-store DIR --key KEY --plan FILE --manifest FILE --out DIR --work NAME --pair K [--client NAME] [--minutes N]");
    process.exit(2);
  }
  BunRuntime.runMain(pull(job, join(import.meta.dir, "..")).pipe(Effect.tapError(error => Effect.sync(() => console.error(error.message)))));
}
