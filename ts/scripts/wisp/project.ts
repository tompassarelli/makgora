import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { Effect, Layer } from "effect";
import { UsageFailure } from "wisp/scripts/wisp/command";
import type { BuildProject } from "wisp/scripts/wisp/mapBuild";
import { GameFileFailure, GameFiles } from "wisp/scripts/wisp/gameFiles";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { SourceErrors } from "wisp/scripts/wisp/sourceErrors";
import { bundleConfig } from "./bundleConfigs";
import { type Profile, profiles } from "./profiles";

import { projectRoot, tsDirectory } from "./projectRoot";

export { projectRoot, tsDirectory };
export const clientState = join(homedir(), ".local/state/smashcraft/clients.json");
export const PLAYTEST_PREFIX = join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx");
export const sourceMapDirectory = join(tsDirectory, "build/source-maps");


export const sceneProfiles: ReadonlySet<Profile> = new Set<Profile>(["main", "integrity", "pause-probe"]);
const profileConfig = (profile: Profile) => profile === "main" ? join(tsDirectory, "tsconfig.map.json") : bundleConfig(profile);

export const buildProject = (profile: Profile = "main"): BuildProject => ({
  projectRoot,
  configPath: profileConfig(profile),
  bundlePath: join(tsDirectory, profile === "main" ? "build/map.lua" : `build/${profile}.lua`),
  compileInputs: [join(tsDirectory, "src"), join(tsDirectory, "node_modules/wisp/src"), join(tsDirectory, "node_modules/wisp/plugins"), join(tsDirectory, "plugins"), join(tsDirectory, "wisp.lock"),
    join(tsDirectory, "tsconfig.map.json"), join(tsDirectory, "tsconfig.lua.json"), join(import.meta.dir, "bundleConfigs.ts"), join(tsDirectory, "tsconfig.json")],
  packager: join(projectRoot, "build/tools/map-pack"),
  toolchainLockPath: join(projectRoot, "typescript-toolchain.lock"),
  packageDirectory: tsDirectory,
  entryGlobal: "smashcraftTs",
});


export const profileOption = (args: readonly string[]) => Effect.gen(function*() {
  const index = args.indexOf("--profile");
  const name = index < 0 ? "main" : args[index + 1];
  const profile = profiles.find((candidate) => candidate === name);
  if (profile === undefined) return yield* new UsageFailure({ problem: `--profile takes ${profiles.join(", ")}` });
  return { profile, args: index < 0 ? [...args] : [...args.slice(0, index), ...args.slice(index + 2)] };
});

export const gameFilesLayer = Layer.effect(GameFiles, Effect.gen(function*() {
  const files = yield* GameFiles;
  const tom = resolve(documentsFolder(PLAYTEST_PREFIX));
  return GameFiles.of({
    ...files,
    installMap: (documents, map) => resolve(documents) === tom
      ? Effect.fail(new GameFileFailure({ operation: "install map", path: documents, cause: "Tom's Maps/00-Smashcraft takes only main builds and one lane build to try; run tests on a pool client" }))
      : files.installMap(documents, map),
  });
})).pipe(Layer.provide(GameFiles.layer({ mapFolder: "Maps/00-Smashcraft/tests", replacedMaps: "Maps/00-Smashcraft/tests", preserveMaps: true })));
export const sourceErrorsLayer = SourceErrors.layer({ sourceMapDirectory, filePrefix: "smashcraft" });
