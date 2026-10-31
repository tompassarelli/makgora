import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Clock, Effect } from "effect";
import { TOM_BUILD_LOG } from "./tomBuildWatch";
import { loadResolver, packageWindow, prepareWindowLibrary, windowLine } from "./wisp/windowLibrary";

const shaIndex = process.argv.indexOf("--sha");
const sha = process.argv[shaIndex + 1];
const logIndex = process.argv.indexOf("--log");
const log = logIndex < 0 ? TOM_BUILD_LOG : process.argv[logIndex + 1] ?? TOM_BUILD_LOG;
if (shaIndex < 0 || sha === undefined || !/^[0-9a-f]{40}$/.test(sha)) throw new Error("prepareWindowLibrary takes --sha <40-hex commit>");

BunRuntime.runMain(Effect.gen(function*() {
  const resolver = yield* Effect.promise(() => loadResolver());
  const build = yield* prepareWindowLibrary(resolver, packageWindow());
  if (!build.built) return;
  const line = windowLine(yield* Clock.currentTimeMillis, sha, build);
  mkdirSync(dirname(log), { recursive: true });
  appendFileSync(log, `${line}\n`);
  console.log(line);
}));
