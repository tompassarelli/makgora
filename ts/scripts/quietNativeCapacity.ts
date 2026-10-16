import { join } from "node:path";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Schedule, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { capacityHelper } from "./heavyCapacity";
import { spawnLogged } from "wisp/scripts/wisp/hostProcess";

class QuietLeaseFailure extends Schema.TaggedError<QuietLeaseFailure>()("QuietLeaseFailure", {
  problem: Schema.String,
}) {
  override get message(): string { return this.problem; }
}

export const withQuietNativeCapacity = <A, E, R>(owner: string, run: Effect.Effect<A, E, R>, helper = capacityHelper) => Effect.scoped(Effect.gen(function*() {
  if (process.env.WISP_QUIET_NATIVE_LEASE === "1") return yield* run;
  const folder = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "smashcraft-native-quiet-" }).pipe(
    Effect.mapError((cause) => new QuietLeaseFailure({ problem: String(cause) })),
  );
  const stdout = join(folder, "stdout");
  const stderr = join(folder, "stderr");
  const child = yield* spawnLogged(ChildProcess.make(process.execPath, [helper, "session", "--class", "native", "--quiet", "--memory-gib", "1", "--owner", owner,
    "--", process.execPath, "-e", "setInterval(() => {}, 60_000)"], { stdin: "ignore", forceKillAfter: "5 seconds" }), { stdout, stderr }).pipe(
    Effect.mapError((cause) => new QuietLeaseFailure({ problem: `starting native quiet lease: ${String(cause)}` })),
  );
  yield* Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* Effect.all([
      fs.readFileString(stdout).pipe(Effect.orElseSucceed(() => "")),
      fs.readFileString(stderr).pipe(Effect.orElseSucceed(() => "")),
    ]).pipe(Effect.map((lines) => lines.join("\n")));
    if (text.split("\n").some((line) => {
      try { return JSON.parse(line).decision === "RESERVED"; } catch { return false; }
    })) return true;
    const exit = yield* child.handle.exitCode.pipe(Effect.timeoutOption("1 millis"));
    if (exit._tag === "Some") return yield* new QuietLeaseFailure({ problem: `native quiet lease exited ${Number(exit.value)} before RESERVED: ${(yield* fs.readFileString(stderr).pipe(Effect.orElseSucceed(() => ""))).trim()}` });
    return false;
  }).pipe(Effect.repeat({ schedule: Schedule.spaced("50 millis"), until: Boolean }));
  return yield* run;
})).pipe(Effect.provide(BunServices.layer));
