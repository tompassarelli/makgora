import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { mapCompiler, report } from "wisp/scripts/compiler";
import { describeCause } from "wisp/scripts/wisp/command";
import { ensurePackager } from "wisp/scripts/wisp/mapBuild";
import { runProcess } from "wisp/scripts/wisp/hostProcess";
import { step } from "wisp/scripts/wisp/timings";
import { bundleConfig } from "./bundleConfigs";
import { stockLua } from "./luaRuntimes";
import { mapBuildKey } from "./mapBuildKey";
import { buildProject, projectRoot, tsDirectory } from "./project";

export class MapBootFailure extends Schema.TaggedError<MapBootFailure, { readonly brand: unique symbol }>()("MapBootFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

// wisp:host/toolchain/mapScript.ts composeScript wraps the bundle as `load([==[\n BUNDLE ]==], "=map-KEY")`; Lua drops the newline after the bracket.
export function mapBundle(script: string): string | undefined {
  const open = /= assert\(load\(\[(=*)\[\n/.exec(script);
  if (open === null) return undefined;
  const start = open.index + open[0].length;
  const end = script.indexOf(`]${open[1]}], "=map-`, start);
  return end < 0 ? undefined : script.slice(start, end);
}

// wisp:host/compile/mapBuild.ts compileCacheDirectory is not exported; the boot driver shares the map build's compile cache so an unchanged source tree is not compiled again.
const compileCacheDirectory = () => process.env.WISP_COMPILE_CACHE || join(homedir(), ".cache/wisp/compile");

const compile = (config: string) => Effect.try({
  try: () => report(mapCompiler(config, undefined, compileCacheDirectory())()),
  catch: (cause) => new MapBootFailure({ problem: `compiling ${config}: ${describeCause(cause)}` }),
}).pipe(Effect.flatMap((problems) => (problems === "" ? Effect.void : Effect.fail(new MapBootFailure({ problem: problems })))));

const DRIVER = join(tsDirectory, "build/boot.lua");
const DRIVER_KEY = `${DRIVER}.key`;

export const compileBootDriver = Effect.gen(function*() {
  const key = yield* mapBuildKey(projectRoot, ["boot-driver"]).pipe(Effect.mapError((cause) => new MapBootFailure({ problem: `keying the boot check: ${describeCause(cause)}` })));
  const current = existsSync(DRIVER) && existsSync(DRIVER_KEY) && readFileSync(DRIVER_KEY, "utf8") === key;
  if (current) return;
  yield* compile(bundleConfig("boot")).pipe(step("compile the boot check"));
  writeFileSync(DRIVER_KEY, key);
});

const shippedBundle = (map: string, scratch: string) => Effect.gen(function*() {
  const packager = buildProject().packager;
  const script = join(scratch, "war3map.lua");
  yield* ensurePackager(packager).pipe(
    Effect.andThen(runProcess("extract war3map.lua", map, [packager, "extract", map, script, "war3map.lua"])),
    Effect.mapError((cause) => new MapBootFailure({ problem: `can't read war3map.lua from ${map}: ${describeCause(cause)}` })),
  );
  const bundle = mapBundle(readFileSync(script, "utf8"));
  if (bundle === undefined) return yield* new MapBootFailure({ problem: `${map}'s war3map.lua carries no TypeScript bundle` });
  const path = join(scratch, "bundle.lua");
  writeFileSync(path, bundle);
  return path;
});

const runBoot = (bundle: string) => Effect.scoped(Effect.gen(function*() {
  const lua = yield* stockLua.pipe(Effect.mapError((problem) => new MapBootFailure({ problem })));
  const declarations = join(tsDirectory, "node_modules/wisp/src/natives/warcraft.d.ts");
  const child = yield* ChildProcess.make(lua, [DRIVER, bundle, declarations], { cwd: tsDirectory, stdin: "ignore" });
  const [output, errors, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode], { concurrency: "unbounded" });
  return { output: `${output}${errors}`.trimEnd(), passed: code === 0 && output.includes("done problems=0") };
})).pipe(
  Effect.provide(BunServices.layer),
  Effect.mapError((cause) => new MapBootFailure({ problem: `running the boot check: ${describeCause(cause)}` })),
);

export const bootCheck = (map: string | undefined) => Effect.scoped(Effect.gen(function*() {
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-boot."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const bundle = map === undefined
    ? yield* compile(buildProject("playable").configPath).pipe(step("compile the playable build"), Effect.as(buildProject("playable").bundlePath))
    : yield* shippedBundle(map, scratch);
  yield* compileBootDriver;
  const { output, passed } = yield* runBoot(bundle).pipe(step("boot to character select in 32-bit Lua"));
  yield* Console.log(output);
  if (!passed) {
    const problems = output.split("\n").filter((line) => line.startsWith("problem ") || line.includes("error")).slice(0, 5).join("; ");
    return yield* new MapBootFailure({ problem: `${map ?? "the playable build"} does not reach character select: ${problems === "" ? output.split("\n").slice(-3).join("; ") : problems}` });
  }
}));
