

import { closeSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Console, Effect, Layer } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { type ArchiveEntry, type GeneratedFile, MapBuild, MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { runProcess } from "wisp/scripts/wisp/hostProcess";
import { checkoutInputs } from "../buildInputs";
import { repairPackager } from "../nativeTools";
import { step } from "wisp/scripts/wisp/timings";
import { glowFreeCaptureImports, decodeBuildOptions, editionImports, importedAssets, rebuildMap, type MapEdition } from "../mapInputs";
import { buildProject, gameFilesLayer, profileOption, projectRoot, sourceErrorsLayer } from "../project";
import { describeMapSize, mapBudgetProblem, mapGrowthProblem, type MapSize, readMapBaseline, readTables, storedBytes, writeMapBaseline } from "../../mapSize";
import { ensureGenerated } from "../../generated";
import { SMASHCRAFT_MAP } from "../../mapInfo";
import { fighterUnits, fileIoAbility } from "../../objectData";
import { POST_PROCESSING_FILE } from "../../postProcessing";
import { checkCueModels, headlessRender } from "../headlessRender";
import { writePlaytestCost } from "../playtestCost";
import { PREDICT_COST, TOM_EDITION, costPrediction, playableBuildArgs } from "../greenBuilds";
import { insideTomsLibrary } from "../mapLibrary";


export const profileOptions = (args: readonly string[]) => Effect.gen(function*() {
  const { profile, args: remaining } = yield* profileOption(args);
  const services = MapBuild.layer(buildProject(profile)).pipe(Layer.provideMerge(sourceErrorsLayer), Layer.provideMerge(gameFilesLayer));
  return { profile, args: remaining, services };
});


export const generatedFiles = (): readonly GeneratedFile[] => [
  { entry: "war3map.w3u", contents: fighterUnits() },
  { entry: "war3map.w3a", contents: fileIoAbility() },
  POST_PROCESSING_FILE,
];

const MAP_SIZE_BASELINE = join(projectRoot, "ts/map-size-baseline.tsv");






const measureMap = (out: string, declared: readonly ArchiveEntry[]) => Effect.scoped(Effect.gen(function*() {
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-size."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const listPath = join(scratch, "listfile");
  yield* runProcess("extract the archive's file list", out, [buildProject().packager, "extract", out, listPath, "(listfile)"]);
  const declaredEntries = new Set(declared.map(({ entry }) => entry.toLowerCase()));
  const listed = readFileSync(listPath, "utf8").split(/\r?\n/).filter((name) => name !== "" && (name.includes("\\") || declaredEntries.has(name.toLowerCase())));
  return yield* Effect.try({
    try: (): MapSize => {
      const fd = openSync(out, "r");
      try {
        const read = (start: number, length: number) => {
          const bytes = new Uint8Array(length);
          readSync(fd, bytes, 0, length, start);
          return bytes;
        };
        const total = statSync(out).size;
        const tables = readTables(read, total);
        return { total, imports: new Map(listed.map((entry) => [entry, storedBytes(tables, entry) ?? 0])) };
      } finally {
        closeSync(fd);
      }
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure map size", path: out, cause }),
  });
}));


const checkMapSize = (out: string, imports: readonly ArchiveEntry[], bounded: boolean, edition: MapEdition) => Effect.gen(function*() {
  const size = yield* measureMap(out, imports);
  const entries = [...size.imports.keys()].map((entry) => ({ entry, source: out }));
  const overrides = entries.length - editionImports(entries, "classic").length;
  yield* Console.log(`${edition} package: ${imports.length} declared imports, ${overrides} HD archive entries`);
  if (edition === "classic" && overrides > 0) return yield* new MapBuildFailure({ operation: "check Classic package", path: out, cause: "the base or container carries HD entries; use the sealed build inputs" });
  yield* Console.log(describeMapSize(size));
  const budgetProblem = mapBudgetProblem(size);
  if (budgetProblem !== undefined) return yield* new MapBuildFailure({ operation: "check map size", path: out, cause: budgetProblem });
  if (!bounded) return;
  const baseline = readMapBaseline(MAP_SIZE_BASELINE);
  if (baseline === undefined || process.env.MAP_SIZE_UPDATE === "1") {
    writeMapBaseline(MAP_SIZE_BASELINE, size);
    return yield* Console.log("wrote ts/map-size-baseline.tsv; commit it");
  }
  const problem = mapGrowthProblem(size, baseline);
  if (problem !== undefined) return yield* new MapBuildFailure({ operation: "check map size", path: out, cause: problem });
});

const tomsLibraryOut = (path: string) => new UsageFailure({ problem: `${path} is in Tom's Maps/00-Smashcraft, which holds only installed builds; build to a private folder` });

const RELEASE_OPTIONS: readonly string[] = ["--name", "--out", "--commit"];

export const releaseBuildArgs = (args: readonly string[]) => {
  const { predict, args: rest } = costPrediction(args);
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const option = rest[index];
    const value = rest[index + 1];
    if (option === undefined || value === undefined || !RELEASE_OPTIONS.includes(option) || values.has(option)) return undefined;
    values.set(option, value);
  }
  const name = values.get("--name");
  const out = values.get("--out");
  return name === undefined || out === undefined ? undefined : playableBuildArgs(name, out, predict, TOM_EDITION, values.get("--commit")).slice(2);
};

const BARE_BUILD = "map build needs --profile; a map for players or Tom is `map release --name NAME --out OUT.w3x` (the playable profile and Classic edition Tom's dev builds use), and a debug build says `--profile main`";

export const build: Command = (args) => Effect.gen(function*() {
  if (!args.includes("--profile")) return yield* new UsageFailure({ problem: BARE_BUILD });
  const { predict, args: buildArgs } = costPrediction(args);
  const inputsOnly = buildArgs.includes("--inputs-only");
  const options = yield* profileOptions(buildArgs.filter((arg) => arg !== "--inputs-only"));
  const bounded = options.profile === "main";
  const playable = options.profile === "playable";
  const capture = options.profile === "native-capture";
  if (predict && !playable) return yield* new UsageFailure({ problem: `${PREDICT_COST} needs --profile playable` });
  return yield* decodeBuildOptions(inputsOnly ? ["--name", "Input check", "--out", "build/input-check.w3x", ...options.args] : options.args, playable ? "classic" : "full").pipe(
    Effect.flatMap((options) => Effect.gen(function*() {
      yield* Effect.sync(ensureGenerated);
      const { base, container, assets, summon, packager, edition, commit, ...map } = options;
      if (insideTomsLibrary(map.out)) return yield* tomsLibraryOut(map.out);
      const declared = base !== undefined && container !== undefined && assets !== undefined && summon !== undefined
        ? { base, container, assets, summon }
        : yield* checkoutInputs().pipe(step("verify build inputs"));
      const imported = yield* importedAssets(assets ?? declared.assets, summon ?? declared.summon, edition);
      const imports = capture ? yield* glowFreeCaptureImports(imported) : imported;
      const checked = yield* checkCueModels(headlessRender({ assets: assets ?? declared.assets, imports })).pipe(step("cue models resolved"));
      yield* Console.log(`${checked} cue model resolutions passed`);
      if (inputsOnly) return yield* Console.log("map-build inputs passed; compilation and packaging skipped");
      yield* MapBuild.use((maps) => maps.build({ ...map, base: base ?? declared.base, container: container ?? declared.container, ...(packager === undefined ? {} : { packager }), declaration: commit === undefined ? SMASHCRAFT_MAP : { ...SMASHCRAFT_MAP, description: `${SMASHCRAFT_MAP.description} Build ${commit}.` }, imports, objectData: generatedFiles() })).pipe(Effect.andThen(checkMapSize(map.out, imports, bounded, edition)));
      if (predict) yield* writePlaytestCost(map.out).pipe(step("predict playtest Lua cost"));
    })),
    Effect.provide(options.services),
  );
});

export const rebuild: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  const [map, ...rest] = options.args;
  if (map === undefined || rest.length > 0) return yield* new UsageFailure({ problem: "rebuild takes one map" });
  if (insideTomsLibrary(map)) return yield* tomsLibraryOut(map);
  return yield* rebuildMap(map).pipe(Effect.provide(options.services));
});


const release = (args: readonly string[]) => {
  const buildArgs = releaseBuildArgs(args);
  return buildArgs === undefined ? Effect.fail(new UsageFailure({ problem: "map release --name NAME --out OUT.w3x [--commit SHA] [--predict-cost]" })) : repairPackager().pipe(Effect.andThen(build(buildArgs)));
};

export const map: Command = ([verb, ...args]) => verb === "release" ? release(args) : verb === "build" ? (args.includes("--inputs-only") ? build(args) : repairPackager().pipe(Effect.andThen(build(args)))) : verb === "rebuild" ? repairPackager().pipe(Effect.andThen(rebuild(args))) : Effect.fail(new UsageFailure({ problem: "map takes release, build or rebuild" }));
