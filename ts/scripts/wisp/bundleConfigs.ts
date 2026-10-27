import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Lua bundles built from tsconfig.map.json with their own entry: each map
 * profile but main, and the host tools' Lua programs. bundleConfig writes the
 * TypeScriptToLua config as ts/.tsconfig.NAME.json, beside tsconfig.map.json
 * rather than in build/, because Wisp's number plugin names throw sites
 * relative to the config's folder.
 */
interface BundleConfig {
  readonly entry: string;
  readonly bundle: string;
  /** Files the bundle compiles besides the entry. */
  readonly sources?: readonly string[];
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
  readonly tstl?: Readonly<Record<string, unknown>>;
}

const tsDirectory = join(import.meta.dir, "../..");
const natives = "node_modules/wisp/src/natives/warcraft.d.ts";
const stackTraces = {
  luaPlugins: [
    { name: "./node_modules/wisp/plugins/warcraft-numbers.ts" },
    { name: "./node_modules/wisp/plugins/stack-traces.ts" },
    { name: "./plugins/source-version.ts" },
  ],
};
const scriptProgram = (entry: string, bundle: string, sources: readonly string[]): BundleConfig =>
  ({ entry, bundle, sources, compilerOptions: { rootDir: ".", sourceMap: false } });

export const bundleConfigs = {
  integrity: { entry: "src/host/entries/integrityMain.ts", bundle: "integrity.lua" },
  "pause-probe": { entry: "src/host/entries/pauseProbeMain.ts", bundle: "pause-probe.lua" },
  playable: { entry: "src/host/entries/playableMain.ts", bundle: "playable.lua" },
  "playable-single-sends": { entry: "src/host/entries/playableSingleSendsMain.ts", bundle: "playable-single-sends.lua" },
  "soak-playable": { entry: "src/host/entries/soakPlayableMain.ts", bundle: "soak-playable.lua" },
  "soak-integrity": { entry: "src/host/entries/soakIntegrityMain.ts", bundle: "soak-integrity.lua" },
  "native-input": { entry: "src/host/entries/nativeInputMain.ts", bundle: "native-input.lua" },
  "native-driver": { entry: "src/host/entries/nativeDriverMain.ts", bundle: "native-driver.lua" },
  "native-capture": { entry: "src/host/entries/nativeCaptureMain.ts", bundle: "native-capture.lua" },
  "voice-check": { entry: "src/host/entries/voiceCheckMain.ts", bundle: "voice-check.lua" },
  trailer: { entry: "src/host/entries/trailerMain.ts", bundle: "trailer.lua" },
  showcase: { entry: "src/host/entries/showcaseMain.ts", bundle: "showcase.lua" },
  "analog-keys": { entry: "src/host/entries/analogKeysMain.ts", bundle: "analog-keys.lua" },
  "analog-cursor": { entry: "src/host/entries/analogCursorMain.ts", bundle: "analog-cursor.lua" },
  "native-perf": { entry: "src/host/entries/nativePerfMain.ts", bundle: "native-perf.lua" },
  census: { entry: "src/host/entries/censusMain.ts", bundle: "census.lua" },
  "frame-cost": { entry: "src/host/entries/frameCostMain.ts", bundle: "frame-cost.lua" },
  "damage-blend-probe": { entry: "src/host/entries/damageBlendProbeMain.ts", bundle: "damage-blend-probe.lua" },
  "stack-trace": { entry: "src/host/entries/stackTraceMain.ts", bundle: "stack-trace.lua", compilerOptions: { rootDir: "." }, tstl: stackTraces },
  "lua-stack": { entry: "test/stack/entry.ts", bundle: "stack.lua", compilerOptions: { rootDir: ".", outDir: "build/lua-stack" }, tstl: stackTraces },
  "viewer-lua": { entry: "src/game/replay/viewerDriver.ts", bundle: "viewer.lua", compilerOptions: { outDir: "build/viewer-lua", sourceMap: false } },
  handles: scriptProgram("scripts/wisp/handleBaselineLua.ts", "handles.lua", ["scripts/wisp/handleBaseline.ts", "scripts/wisp/handleCensus.ts", "scripts/wisp/memoryCensus.ts", "scripts/wisp/botMatch.ts"]),
  memory: scriptProgram("scripts/wisp/memoryLua.ts", "memory.lua", ["scripts/wisp/memoryCensus.ts", "scripts/wisp/handleCensus.ts", "scripts/wisp/botMatch.ts"]),
  perf: scriptProgram("scripts/wisp/perfLua.ts", "perf.lua", ["scripts/wisp/botMatch.ts", "scripts/wisp/census.ts", "scripts/wisp/censusProfile.ts"]),
} satisfies Record<string, BundleConfig>;
type BundleName = keyof typeof bundleConfigs;

/** Writes NAME's config when it changed, keeping its age for the map build's staleness check, and returns its path. */
export function bundleConfig(name: BundleName): string {
  const { entry, bundle, sources = [], compilerOptions, tstl }: BundleConfig = bundleConfigs[name];
  const config = {
    extends: "./tsconfig.map.json",
    ...(compilerOptions === undefined ? {} : { compilerOptions }),
    include: [natives, entry, ...sources],
    exclude: [],
    tstl: { ...tstl, luaBundle: bundle, luaBundleEntry: entry },
  };
  const path = join(tsDirectory, `.tsconfig.${name}.json`);
  const text = `${JSON.stringify(config, null, 2)}\n`;
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) writeFileSync(path, text);
  return path;
}
