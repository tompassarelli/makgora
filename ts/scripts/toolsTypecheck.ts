import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { resolve } from "node:path";
import { ProcessFailure } from "./hostProcess";

const root = resolve(import.meta.dir, "..");
const diagnostic = /^\S.*error TS\d+/;

const main = Effect.scoped(Effect.gen(function*() {
  const handle = yield* ChildProcess.make(process.execPath, [resolve(root, "node_modules/typescript-native/bin/tsc"), "-p", "tsconfig.tools.json", "--pretty", "false"], { cwd: root });
  const [stdout, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(handle.stdout)), handle.exitCode], { concurrency: "unbounded" });
  const reported: string[] = [];
  let vendored = false;
  for (const line of stdout.split("\n")) {
    if (diagnostic.test(line)) vendored = line.includes("node_modules/");
    if (line !== "" && !vendored) reported.push(line);
  }
  if (reported.length > 0) return yield* new ProcessFailure({ command: "tools typecheck", problem: `\n${reported.join("\n")}` });
  if (code !== 0 && !stdout.includes("error TS")) return yield* new ProcessFailure({ command: "tools typecheck", problem: `exited ${code} without a diagnostic` });
})).pipe(Effect.catchTag("PlatformError", (cause) => Effect.fail(new ProcessFailure({ command: "tools typecheck", problem: cause.message }))));

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
