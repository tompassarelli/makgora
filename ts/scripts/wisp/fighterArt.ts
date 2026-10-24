import { chmodSync, closeSync, constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { ImportGraph } from "wisp/scripts/wisp/importGraph";
import { fighterSlug } from "../../src/game/sim/heroes/registry";
import { fighters } from "../heroModelSource";
import { stopBunProcess } from "../hostProcess";
import { pruneWhiteTextures } from "../whiteImports";
import { ASSET_FAMILIES, FETCH_HINT, type Family, INPUTS_STORE, type Manifest, type Pin, assetsView, listFiles, mergeShards, publish, readManifest, removeTree, seal, storeShards, unstoredPins, writeShardPins } from "./buildInputs";
import { stockStorage } from "./renderAssetStore";
import { SHARED_SHARD, shardFiles } from "./inputShards";
import { MODEL_FACTS_DIRECTORY, modelFactsFile, writeGenerated } from "./modelFactsTable";
import { projectRoot } from "./project";

export const DERIVED_STORE = join(INPUTS_STORE, "derived");

type Output = "pool" | "impact";

interface Fighter { readonly character: number; readonly name: string; readonly slug: string; readonly source: string }

interface Work { readonly root: string; readonly checkout: string; readonly assets: string; readonly pool: string; readonly impact: string }

interface Step {
  readonly name: "clips" | "bodies" | "flashes";
  readonly tool: string;
  readonly output: Output;
  readonly args: (fighter: Fighter, work: Work) => readonly string[];
}

const STEPS: readonly Step[] = [
  { name: "clips", tool: "tools/animations/export-original-clips.ts", output: "pool", args: (fighter, work) => ["--assets", work.assets, "--out", work.pool, "--only", fighter.name] },
  { name: "bodies", tool: "tools/animations/timeline-models.ts", output: "pool", args: (fighter, work) => [work.assets, work.pool, fighter.name] },
  { name: "flashes", tool: "tools/animations/white-flash-models.ts", output: "impact", args: (fighter, work) => [work.assets, work.impact, "--character", String(fighter.character)] },
];

const FAMILY: Readonly<Record<Output, Family>> = { pool: "original-clips-static-lights", impact: "impact-assets" };

const GENERATED = [/^ts\/src\/generated\/clips\//, /^ts\/src\/generated\/assets\/white-(models|facts)\//, /^ts\/src\/generated\/assets\/white(FighterModels|ModelFacts)\.ts$/];

const LOCKS = ["ts/package.json", "ts/bun.lock", "tools/animations/package.json", "tools/animations/bun.lock"];

export const DERIVED_PATHS = ["build-inputs/original-clips-static-lights", "build-inputs/impact-assets", "ts/src/generated/clips", "ts/src/generated/assets", "ts/scripts/wisp/model-facts"];

const NODE_MODULES = ["ts/node_modules", "tools/animations/node_modules"];

const RULES = "ts/src/generated/fighter-art";

const MODEL_FACTS = relative(projectRoot, MODEL_FACTS_DIRECTORY);

const HERO_MODELS = "hero-models";

const heroShards = (pin: Pin, fighter: Fighter) => typeof pin === "string" ? [pin] : [SHARED_SHARD, fighter.slug].flatMap((shard) => pin[shard] === undefined ? [] : [pin[shard]!]);

function linkHeroModels(pin: Pin, fighter: Fighter, assets: string, target: string): void {
  if (typeof pin === "string") return symlinkSync(join(assets, HERO_MODELS), target);
  mergeShards(heroShards(pin, fighter).map((hash) => join(INPUTS_STORE, HERO_MODELS, hash)), target);
}

const sha256 = (...parts: readonly (string | Uint8Array)[]) => {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const part of parts) hasher.update(part).update("\0");
  return hasher.digest("hex");
};

const failure = (operation: string, path: string, cause: unknown) => new MapBuildFailure({ operation, path, cause: cause instanceof Error ? cause.message : String(cause) });

function stepCode(tool: string): string[] {
  const graph = new ImportGraph(projectRoot), entry = join(projectRoot, tool);
  graph.add([entry]);
  const files = [...graph.dependencies(entry)].map((path) => relative(projectRoot, path)).filter((path) => !GENERATED.some((pattern) => pattern.test(path)));
  return [...files, ...LOCKS].sort();
}

const codeDigest = (tool: string) => sha256(...stepCode(tool).flatMap((path) => [path, readFileSync(join(projectRoot, path))]));

export const derivedStepCode = (): ReadonlySet<string> => new Set(STEPS.flatMap((step) => stepCode(step.tool)));

const ownedFiles = (fighter: Fighter) => [`ts/src/generated/clips/${fighter.slug}.ts`, `ts/src/generated/assets/white-models/${fighter.slug}.ts`, `ts/src/generated/assets/white-facts/${fighter.slug}.ts`];

const ownedFacts = (fighter: Fighter) => ["OriginalClip", "TimelineBody", "White-"].map((kind) => `war3mapImported_${fighter.name}${kind}`);

function generatedFiles(fighter: Fighter, root: string): string[] {
  const directory = join(root, MODEL_FACTS);
  const facts = existsSync(directory) ? readdirSync(directory).filter((file) => ownedFacts(fighter).some((prefix) => file.startsWith(prefix))) : [];
  return [...ownedFiles(fighter).filter((path) => existsSync(join(root, path))), ...facts.map((file) => join(MODEL_FACTS, file))].sort();
}

const copyFile = (from: string, to: string) => {
  mkdirSync(dirname(to), { recursive: true });
  removeTree(to);
  copyFileSync(from, to, constants.COPYFILE_FICLONE);
  chmodSync(to, 0o644);
};

const copyTree = (from: string, to: string) => {
  for (const path of listFiles(from)) copyFile(join(from, path), join(to, path));
};

function saveStep(fighter: Fighter, step: Step, key: string, work: Work): void {
  const final = join(DERIVED_STORE, step.name, key);
  if (existsSync(final)) return;
  mkdirSync(dirname(final), { recursive: true });
  const staging = mkdtempSync(join(dirname(final), ".add-"));
  copyTree(work[step.output], join(staging, "output"));
  for (const path of generatedFiles(fighter, work.checkout)) {
    mkdirSync(dirname(join(staging, "checkout", path)), { recursive: true });
    copyFileSync(join(work.checkout, path), join(staging, "checkout", path));
  }
  seal(staging);
  publish(staging, final);
}

function restoreStep(fighter: Fighter, step: Step, key: string, work: Work): void {
  const saved = join(DERIVED_STORE, step.name, key);
  removeTree(work[step.output]);
  mkdirSync(work[step.output], { recursive: true });
  if (existsSync(join(saved, "output"))) copyTree(join(saved, "output"), work[step.output]);
  const checkout = join(saved, "checkout"), kept = new Set(existsSync(checkout) ? listFiles(checkout) : []);
  for (const path of kept) writeGenerated(join(work.checkout, path), readFileSync(join(checkout, path), "utf8"));
  for (const path of generatedFiles(fighter, work.checkout)) if (!kept.has(path)) removeTree(join(work.checkout, path));
}

const runTool = (fighter: Fighter, step: Step, work: Work) => Effect.gen(function*() {
  const log = join(work.root, `${step.name}.log`);
  const code = yield* Effect.acquireUseRelease(
    Effect.try({
      try: () => {
        const output = openSync(log, "w");
        try {
          return Bun.spawn([process.execPath, step.tool, ...step.args(fighter, work)], { cwd: work.checkout, stdio: ["ignore", output, output] });
        } finally {
          closeSync(output);
        }
      },
      catch: (cause) => failure(`run ${step.name}`, step.tool, cause),
    }),
    (child) => Effect.promise(() => child.exited),
    stopBunProcess,
  );
  if (code !== 0) return yield* failure(`run ${step.name}`, log, `${fighter.name} exited ${code}: ${readFileSync(log, "utf8").trim().split("\n").slice(-5).join("\n")}`);
});

export interface FighterPlan { readonly fighter: Fighter; readonly keys: readonly string[]; readonly cached: number; readonly sourceBytes: number }

export const planFighters = (names: readonly string[], rebuild: boolean) => Effect.gen(function*() {
  const manifest = yield* readManifest();
  const unstored = unstoredPins(manifest, ASSET_FAMILIES);
  if (unstored.length > 0) return yield* failure("find build inputs", INPUTS_STORE, `${unstored.map(({ family, hash }) => `${family} ${hash}`).join(", ")} not in the store; ${FETCH_HINT}`);
  const assets = yield* Effect.try({ try: () => assetsView(manifest), catch: (cause) => failure("link assets", INPUTS_STORE, cause) });
  const roster = [...fighters].map(([character, { name, source }]) => ({ character, name, source, slug: fighterSlug(character) }));
  const named = (fighter: Fighter, name: string) => fighter.name === name || fighter.slug === name;
  const unknown = names.filter((name) => !roster.some((fighter) => named(fighter, name)));
  if (unknown.length > 0) return yield* failure("choose fighters", names.join(","), `unknown fighters ${unknown.join(", ")}; choose from ${roster.map(({ name }) => name).join(", ")}`);
  const chosen = names.length === 0 ? roster : roster.filter((fighter) => names.some((name) => named(fighter, name)));
  const code = STEPS.map((step) => codeDigest(step.tool));
  const stock = yield* Effect.try({ try: () => readFileSync(join(stockStorage(), ".build.info")), catch: (cause) => failure("read stock build info", stockStorage(), cause) });
  const shared = sha256(stock, JSON.stringify(manifest["imported-models"]));
  const plans = yield* Effect.forEach(chosen, (fighter) => Effect.tryPromise({
    try: async () => {
      const bytes = await Bun.file(join(assets, fighter.source)).bytes(), source = sha256(bytes);
      const rules = readFileSync(join(projectRoot, RULES, `${fighter.slug}.ts`)), external = sha256(shared, ...heroShards(manifest[HERO_MODELS], fighter));
      const keys: string[] = [];
      STEPS.forEach((step, index) => keys.push(sha256(step.name, code[index]!, fighter.name, index === 0 ? source : keys[index - 1]!, index === 0 ? "" : external, rules)));
      const missing = keys.findIndex((key, index) => !existsSync(join(DERIVED_STORE, STEPS[index]!.name, key)));
      const cached = rebuild ? 0 : missing < 0 ? keys.length : missing;
      return { fighter, keys, cached, sourceBytes: bytes.byteLength } satisfies FighterPlan;
    },
    catch: (cause) => failure("hash fighter source", join(assets, fighter.source), cause),
  }), { concurrency: 8 });
  return { manifest, assets, plans };
});

const buildFighter = (plan: FighterPlan, manifest: Manifest, assets: string, root: string, checkout: string) => Effect.gen(function*() {
  const { fighter, keys, cached } = plan;
  const directory = join(root, fighter.slug);
  const work: Work = { root: directory, checkout, assets: join(directory, "assets"), pool: join(directory, "pool"), impact: join(directory, "impact") };
  yield* Effect.try({
    try: () => {
      for (const path of [work.assets, work.pool, work.impact]) mkdirSync(path, { recursive: true });
      for (const family of readdirSync(assets)) if (family !== FAMILY.pool && family !== HERO_MODELS) symlinkSync(join(assets, family), join(work.assets, family));
      linkHeroModels(manifest[HERO_MODELS], fighter, assets, join(work.assets, HERO_MODELS));
      symlinkSync(work.pool, join(work.assets, FAMILY.pool));
      const restored = (["pool", "impact"] as const).map((output) => STEPS.findLastIndex((step, index) => index < cached && step.output === output));
      for (const index of restored.filter((index) => index >= 0).sort()) restoreStep(fighter, STEPS[index]!, keys[index]!, work);
    },
    catch: (cause) => failure("restore cached steps", directory, cause),
  });
  for (const [index, step] of STEPS.entries()) {
    if (index < cached) continue;
    const started = performance.now();
    yield* runTool(fighter, step, work);
    yield* Effect.try({ try: () => saveStep(fighter, step, keys[index]!, work), catch: (cause) => failure(`store ${step.name}`, DERIVED_STORE, cause) });
    console.log(`${fighter.name} ${step.name} ${((performance.now() - started) / 1000).toFixed(1)} s`);
  }
  return work;
});

export function assembleFamily(family: Family, base: string, rebuilt: ReadonlyMap<string, string>, staging: string): void {
  const owners = new Map<string, Set<string>>();
  for (const [shard, files] of shardFiles(family, base, listFiles(base))) for (const file of files) owners.set(file, (owners.get(file) ?? new Set()).add(shard));
  for (const [file, shards] of owners) {
    if ([...shards].every((shard) => rebuilt.has(shard))) continue;
    copyFile(join(base, file), join(staging, file));
  }
  const written = new Map<string, string>();
  for (const [shard, directory] of rebuilt) for (const file of listFiles(directory)) {
    const hash = sha256(readFileSync(join(directory, file))), earlier = written.get(file);
    if (earlier !== undefined && earlier !== hash) throw new Error(`${shard} and another fighter wrote different ${file}`);
    written.set(file, hash);
    copyFile(join(directory, file), join(staging, file));
  }
  if (family === FAMILY.impact) pruneWhiteTextures(staging);
}

const shippedModels = (files: Iterable<string>) => new Set([...files].filter((file) => file.endsWith(".mdx")).map((file) => `war3mapImported\\${basename(file)}`));

export function removeDroppedModelFacts(before: Iterable<string>, after: Iterable<string>, directory = MODEL_FACTS_DIRECTORY): string[] {
  const kept = shippedModels(after), dropped = [...shippedModels(before)].filter((model) => !kept.has(model) && existsSync(join(directory, modelFactsFile(model)))).sort();
  for (const model of dropped) rmSync(join(directory, modelFactsFile(model)), { force: true });
  return dropped;
}

const checkoutFiles = Effect.try({
  try: () => {
    const listed = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
    if (listed.exitCode !== 0) throw new Error(listed.stderr.toString().trim());
    return listed.stdout.toString().split("\0").filter((path) => path !== "" && existsSync(join(projectRoot, path)));
  },
  catch: (cause) => failure("list the checkout", projectRoot, cause),
});

function scratchCheckout(directory: string, files: readonly string[]): void {
  const made = new Set<string>();
  for (const path of files) {
    const to = join(directory, path);
    if (!made.has(dirname(to))) made.add((mkdirSync(dirname(to), { recursive: true }), dirname(to)));
    copyFileSync(join(projectRoot, path), to, constants.COPYFILE_FICLONE);
  }
  for (const modules of NODE_MODULES) if (existsSync(join(projectRoot, modules))) symlinkSync(join(projectRoot, modules), join(directory, modules));
}

const derivedFiles = (root: string) => new Set(DERIVED_PATHS.flatMap((path) => existsSync(join(root, path)) ? listFiles(join(root, path)).map((file) => join(path, file)) : []));

export function derivedDifferences(checkout: string, target: string, apply: boolean): string[] {
  const derived = derivedFiles(checkout), current = derivedFiles(target);
  const same = (path: string) => derived.has(path) && current.has(path) && readFileSync(join(checkout, path)).equals(readFileSync(join(target, path)));
  const differing = [...new Set([...derived, ...current])].filter((path) => !same(path)).sort();
  if (apply) for (const path of differing) if (derived.has(path)) copyFile(join(checkout, path), join(target, path)); else rmSync(join(target, path));
  return differing;
}

// Only `apply` writes into this checkout, so a check, finished or killed, leaves tracked files as they were.
export const buildFighterArt = (plans: readonly FighterPlan[], manifest: Manifest, assets: string, jobs: number, apply: boolean) => Effect.gen(function*() {
  const root = yield* Effect.try({
    try: () => (mkdirSync(join(INPUTS_STORE, "..", "derive"), { recursive: true }), mkdtempSync(join(INPUTS_STORE, "..", "derive", "run-"))),
    catch: (cause) => failure("stage fighter art", INPUTS_STORE, cause),
  });
  const checkout = join(root, "checkout");
  const files = yield* checkoutFiles;
  yield* Effect.try({ try: () => scratchCheckout(checkout, files), catch: (cause) => failure("copy the checkout", checkout, cause) });
  const largestFirst = [...plans].sort((a, b) => b.sourceBytes - a.sourceBytes);
  const built = yield* Effect.forEach(largestFirst, (plan) => buildFighter(plan, manifest, assets, root, checkout).pipe(Effect.map((work) => ({ fighter: plan.fighter, work }))), { concurrency: jobs }).pipe(
    Effect.tapError(() => Effect.sync(() => console.error(`step logs kept in ${root}`))));
  const rebuiltFiles: string[] = [], assembledFiles: string[] = [], rebuilt = new Set(built.map(({ fighter }) => fighter.slug));
  for (const output of ["pool", "impact"] as const) {
    const family = FAMILY[output], staging = join(root, `${family}.assembled`);
    const shards = yield* Effect.tryPromise({
      try: async () => {
        for (const [shard, files] of shardFiles(family, join(assets, family), listFiles(join(assets, family)))) if (rebuilt.has(shard)) rebuiltFiles.push(...files);
        assembleFamily(family, join(assets, family), new Map(built.map(({ fighter, work }) => [fighter.slug, work[output]])), staging);
        assembledFiles.push(...listFiles(staging));
        return storeShards(family, staging);
      },
      catch: (cause) => failure(`assemble ${family}`, staging, cause),
    });
    const before = manifest[family];
    const changed = Object.keys(shards).filter((shard) => typeof before !== "object" || before[shard] !== shards[shard]);
    yield* Effect.try({ try: () => writeShardPins(family, shards, join(checkout, "build-inputs")), catch: (cause) => failure("write build inputs", family, cause) });
    console.log(`${family}: ${Object.keys(shards).length} shards, changed ${changed.length === 0 ? "none" : changed.join(" ")}`);
  }
  const dropped = yield* Effect.try({ try: () => removeDroppedModelFacts(rebuiltFiles, assembledFiles, join(checkout, MODEL_FACTS)), catch: (cause) => failure("remove dropped model facts", MODEL_FACTS_DIRECTORY, cause) });
  if (dropped.length > 0) console.log(`removed the facts of ${dropped.length} models no fighter ships: ${dropped.join(" ")}`);
  const differing = yield* Effect.try({ try: () => derivedDifferences(checkout, projectRoot, apply), catch: (cause) => failure(apply ? "write derived fighter art" : "compare derived fighter art", projectRoot, cause) });
  yield* Effect.sync(() => removeTree(root));
  return differing;
});
