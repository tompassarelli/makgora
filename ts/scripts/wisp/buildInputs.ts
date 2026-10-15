



import { chmodSync, constants, copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { Effect, Schema } from "effect";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { withLock } from "./fileLock";
import { shardFiles } from "./inputShards";
import { projectRoot } from "./project";

export const INPUTS_STORE = join(homedir(), ".local/share/smashcraft-build-inputs/store");
/** One pin file per family (build-inputs/FAMILY holds its store hash), so two lanes that store different families never edit the same file (#401); a sharded family pins each fighter's files apart (build-inputs/FAMILY/SHARD), so two lanes that repack different fighters never edit the same file either. */
export const MANIFEST = join(projectRoot, "build-inputs");

export type Pin = string | Readonly<Record<string, string>>;

const pinFiles = (directory: string): [string, string][] =>
  readdirSync(directory).filter((name) => !name.startsWith(".")).sort().map((name) => [name, join(directory, name)]);

/** The pins as one record, family to hash, or to its shards' hashes; a family with no pin is absent. */
export function readPins(directory = MANIFEST): Record<string, Pin> {
  if (!existsSync(directory)) return {};
  const read = (path: string) => readFileSync(path, "utf8").trim();
  return Object.fromEntries(pinFiles(directory).map(([name, path]) =>
    [name, statSync(path).isDirectory() ? Object.fromEntries(pinFiles(path).map(([shard, file]) => [shard, read(file)])) : read(path)]));
}

/** Pins one family to `hash`, touching only that family's file. */
export function writePin(family: Family, hash: string, directory = MANIFEST): void {
  mkdirSync(directory, { recursive: true });
  const staging = join(directory, `.${family}.${process.pid}.next`);
  writeFileSync(staging, `${hash}\n`);
  renameSync(staging, join(directory, family));
}

export function writeShardPins(family: Family, shards: Readonly<Record<string, string>>, directory = MANIFEST): void {
  const folder = join(directory, family);
  if (existsSync(folder) && !statSync(folder).isDirectory()) rmSync(folder);
  mkdirSync(folder, { recursive: true });
  for (const [shard, path] of pinFiles(folder)) if (!(shard in shards)) rmSync(path);
  for (const [shard, hash] of Object.entries(shards)) {
    const path = join(folder, shard);
    if (existsSync(path) && readFileSync(path, "utf8").trim() === hash) continue;
    const staging = join(folder, `.${shard}.${process.pid}.next`);
    writeFileSync(staging, `${hash}\n`);
    renameSync(staging, path);
  }
}






export const FAMILY_NAMES = ["base", "container", "summon", "animation-assets", "illidan-animation", "selection-assets", "fighter-renders",
  "stage-assets", "impact-assets", "imported-models", "original-clips-static-lights", "hero-models", "model-sounds"] as const;
export type Family = (typeof FAMILY_NAMES)[number];
export const FAMILIES = {
  base: { file: "base.w3m", produce: "the private base map Melee_Prototype_Base.w3m (smashcraft:docs/development-loop.md)" },
  container: { file: "container.w3x", produce: "the private asset container map (a built Smashcraft map carrying the stock imports)" },
  summon: { produce: "the private summon clip export (summon-clips-evidence.json and imports/war3mapImported/)" },
  "animation-assets": { produce: "bash tools/animations/build-assets.sh (writes build/animation-assets)" },
  "illidan-animation": { produce: "bun tools/animations/package-illidan.ts (writes build/illidan-animation)" },
  "selection-assets": { produce: "bun tools/selection/build-art.ts (writes build/selection-assets)" },
  "fighter-renders": { produce: "bun scripts/fighterPortraits.ts PRIVATE_OUTPUT (from ts/; stores PRIVATE_OUTPUT/fighter-renders)" },
  "stage-assets": { produce: "bun tools/stage/package.ts (writes build/stage-assets)" },
  "impact-assets": { produce: "bun tools/effects/package.ts, trap.ts and shield.ts (write build/impact-assets)", sharded: true },
  "imported-models": { produce: "the community models smashcraft:ts/src/game/assets/importedModelInfo.ts lists, from their authors' downloads" },
  "original-clips-static-lights": { produce: "cp -rL \"$(bun wisp inputs path assets)/original-clips-static-lights\" NEW && chmod -R u+w NEW && bun tools/animations/export-original-clips.ts --assets \"$(bun wisp inputs path assets)\" --out NEW --keep-unchanged (after adding the new fighter models' animation-assets or illidan-animation)", sharded: true },
  "hero-models": { produce: "the stock hero models extracted from the game's archives (smashcraft:ts/scripts/heroModelSource.ts)", sharded: true },
  "model-sounds": { produce: "bun tools/animations/export-model-sounds.ts --assets \"$(bun wisp inputs path assets)\" --sounds AnimSounds.slk --out NEW" },
} as const satisfies Record<Family, { readonly file?: string; readonly produce: string; readonly sharded?: true }>;

export const isSharded = (family: Family): boolean => "sharded" in FAMILIES[family];

const singleFile = (family: Family): string | undefined => {
  const input = FAMILIES[family];
  return "file" in input ? input.file : undefined;
};

export const ASSET_FAMILIES = FAMILY_NAMES.filter((family) => family !== "base" && family !== "container" && family !== "summon");

const Hash = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/));

export const Manifest = Schema.Record(Schema.Literals(FAMILY_NAMES), Schema.Union([Hash, Schema.Record(Schema.String, Hash)]));
export type Manifest = typeof Manifest.Type;


export interface BuildInputPaths { readonly base: string; readonly container: string; readonly assets: string; readonly summon: string }

const failure = (operation: string, path: string, cause: string) => new MapBuildFailure({ operation, path, cause });


function listFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) files.push(relative(root, path));
    }
  };
  walk(root);
  return files.sort();
}


export async function hashTree(root: string): Promise<string> {
  const tree = new Bun.CryptoHasher("sha256");
  for (const file of listFiles(root)) {
    const content = new Bun.CryptoHasher("sha256").update(await Bun.file(join(root, file)).bytes()).digest("hex");
    tree.update(`${file}\0${content}\n`);
  }
  return tree.digest("hex");
}


export function removeTree(root: string): void {
  if (!existsSync(root)) return;
  const unseal = (path: string) => {

    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat?.isDirectory() !== true) return;
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path)) unseal(join(path, entry));
  };
  unseal(root);
  rmSync(root, { recursive: true, force: true });
}

function seal(root: string): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) seal(path);
    else chmodSync(path, 0o444);
  }
  chmodSync(root, 0o555);
}






export function publish(staging: string, final: string): "published" | "reused" {
  try {
    renameSync(staging, final);
    return "published";
  } catch (cause) {
    const code = cause instanceof Error && "code" in cause ? cause.code : undefined;
    if ((code === "ENOTEMPTY" || code === "EEXIST") && existsSync(final)) {
      removeTree(staging);
      return "reused";
    }
    throw cause;
  }
}







export const buildOnce = <E, R>(lock: string, final: string, complete: (final: string) => boolean, waiting: string, build: (staging: string) => Effect.Effect<void, E, R>) =>
  withLock(lock, waiting, Effect.gen(function*() {
    if (existsSync(final) && complete(final)) return "reused" as const;
    const staging = yield* Effect.try({
      try: () => {
        removeTree(final);
        mkdirSync(dirname(final), { recursive: true });
        return mkdtempSync(join(dirname(final), `.${basename(final).slice(0, 12)}-`));
      },
      catch: (cause) => failure("stage build", final, String(cause)),
    });
    yield* build(staging).pipe(Effect.onError(() => Effect.sync(() => removeTree(staging))));
    return yield* Effect.try({ try: () => publish(staging, final), catch: (cause) => failure("publish build", final, String(cause)) });
  }));






export async function storeFamily(family: Family, source: string, store = INPUTS_STORE): Promise<string> {
  const file = singleFile(family);
  return storeFiles(family, file === undefined ? listFiles(source).map((path) => [join(source, path), path] as const) : [[source, file] as const], store);
}

export async function storeShards(family: Family, source: string, store = INPUTS_STORE): Promise<Record<string, string>> {
  const shards = shardFiles(family, source, listFiles(source));
  const hashes: Record<string, string> = {};
  for (const [shard, files] of [...shards].sort(([a], [b]) => a.localeCompare(b))) hashes[shard] = await storeFiles(family, files.map((path) => [join(source, path), path] as const), store);
  return hashes;
}

async function storeFiles(family: Family, files: readonly (readonly [string, string])[], store: string): Promise<string> {
  const parent = join(store, family);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".add-"));
  try {
    for (const [from, path] of files) {
      const to = join(staging, path);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to, constants.COPYFILE_FICLONE);
    }
    const hash = await hashTree(staging);
    if (existsSync(join(parent, hash))) {
      removeTree(staging);
      return hash;
    }
    seal(staging);
    publish(staging, join(parent, hash));
    return hash;
  } finally {
    removeTree(staging);
  }
}


export const stageCardPath = (sha256: string, store = INPUTS_STORE) => join(store, "stage-cards", sha256);


export async function storeStageCard(bytes: Uint8Array, store = INPUTS_STORE): Promise<string> {
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const final = stageCardPath(hash, store);
  if (existsSync(final)) return hash;
  mkdirSync(dirname(final), { recursive: true });
  const staging = join(dirname(final), `.add-${hash.slice(0, 12)}-${process.pid}`);
  await Bun.write(staging, bytes);
  chmodSync(staging, 0o444);
  renameSync(staging, final);
  return hash;
}


export const regenerate = (family: Family, pin: Pin) =>
  `produce it with ${FAMILIES[family].produce}, then run \`bun wisp inputs add ${family} DIR\` from the checkout ` +
  (typeof pin === "string" ? `(it must hash to ${pin}, or commit the hash it writes into build-inputs/${family})` : `(commit the shard hashes it writes into build-inputs/${family}/)`);


export const verifiedFamily = (family: Family, hash: string, store = INPUTS_STORE) => Effect.gen(function*() {
  const directory = join(store, family, hash);
  if (!existsSync(directory)) return yield* failure("find build input", directory, `${family} ${hash} is not in the store; ${regenerate(family, hash)}`);
  const actual = yield* Effect.tryPromise({ try: () => hashTree(directory), catch: (cause) => failure("hash build input", directory, String(cause)) });
  if (actual !== hash) {
    return yield* failure("verify build input", directory, `${family} was changed in place (it hashes to ${actual}); stored inputs are never edited: ${regenerate(family, hash)}`);
  }
  return directory;
});


export const readManifest = (path = MANIFEST) =>
  Effect.try({ try: () => readPins(path), catch: (cause) => failure("read build inputs", path, String(cause)) }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Manifest)),
    Effect.mapError((cause) => cause instanceof MapBuildFailure ? cause : failure("decode build inputs", path, String(cause))),
  );





export const pinHashes = (pin: Pin): string[] => typeof pin === "string" ? [pin] : Object.values(pin);

const pinNames = (family: Family, pin: Pin): string[] =>
  typeof pin === "string" ? [`${family} ${pin}\n`] : Object.entries(pin).sort(([a], [b]) => a.localeCompare(b)).map(([shard, hash]) => `${family}/${shard} ${hash}\n`);

function mergeShards(shards: readonly string[], target: string): void {
  for (const shard of shards) for (const path of listFiles(shard)) {
    const [from, to] = [join(shard, path), join(target, path)];
    if (existsSync(to)) {
      if (!readFileSync(to).equals(readFileSync(from))) throw new Error(`${path} differs between the shards of ${target}`);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    linkSync(from, to);
  }
  seal(target);
}

export function assetsView(manifest: Manifest, store = INPUTS_STORE): string {
  const names = ASSET_FAMILIES.flatMap((family) => pinNames(family, manifest[family])).join("");
  const final = join(store, "views", new Bun.CryptoHasher("sha256").update(names).digest("hex"));
  const unstored = (family: Family) => pinHashes(manifest[family]).find((hash) => !existsSync(join(store, family, hash)));
  const merged = (family: Family) => typeof manifest[family] === "string" || lstatSync(join(final, family)).isDirectory();
  if (existsSync(final) && ASSET_FAMILIES.every((family) => merged(family) || unstored(family) !== undefined)) return final;
  removeTree(final);
  mkdirSync(dirname(final), { recursive: true });
  const staging = mkdtempSync(join(dirname(final), ".add-"));
  for (const family of ASSET_FAMILIES) {
    const pin = manifest[family], missing = unstored(family);
    if (typeof pin === "string") symlinkSync(join("../..", family, pin), join(staging, family));
    else if (missing !== undefined) symlinkSync(join("../..", family, missing), join(staging, family));
    else mergeShards(pinHashes(pin).map((hash) => join(store, family, hash)), join(staging, family));
  }
  publish(staging, final);
  return final;
}


export const wholeFamily = (manifest: Manifest, family: Family, store = INPUTS_STORE) => {
  const pin = manifest[family];
  return typeof pin === "string" ? Effect.succeed(join(store, family, pin)) : Effect.fail(failure("resolve build input", join(MANIFEST, family), `${family} is one folder, not shards`));
};


export const resolveInputs = (manifest: Manifest, store = INPUTS_STORE) => Effect.gen(function*() {
  const pinned = FAMILY_NAMES.flatMap((family) => pinHashes(manifest[family]).map((hash) => [family, hash] as const));
  yield* Effect.forEach(pinned, ([family, hash]) => verifiedFamily(family, hash, store), { concurrency: 4, discard: true });
  const [base, container, summon] = yield* Effect.all([wholeFamily(manifest, "base", store), wholeFamily(manifest, "container", store), wholeFamily(manifest, "summon", store)]);
  const assets = yield* Effect.try({ try: () => assetsView(manifest, store), catch: (cause) => failure("link assets", store, String(cause)) });
  return { base: join(base, FAMILIES.base.file), container: join(container, FAMILIES.container.file), assets, summon } satisfies BuildInputPaths;
});


export const checkoutInputs = (manifest = MANIFEST, store = INPUTS_STORE) => readManifest(manifest).pipe(Effect.flatMap((decoded) => resolveInputs(decoded, store)));
