import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { FIGHTER_ART } from "../../src/generated/fighterArtData";
import { INPUTS_STORE, type Manifest, assetsView, readManifest } from "./buildInputs";
import { ProcessFailure, runProcess } from "../hostProcess";
import { POST_PROCESSING_FILE } from "../postProcessing";
import { resolveRenderAsset, type AssetLocation, type AssetLayer, type Graphics, type ResolvedRenderAsset } from "wisp/scripts/wisp/renderAssets";

export const key = (path: string) => path.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx");
const PRIVATE = join(homedir(), ".local/share/smashcraft-render-assets");
const NOT_IN_STORAGE = "open asset failed: 2";
const ABSENT_SUFFIX = ".absent";
const EXTRACT_TIMEOUT = "60 seconds";


class RenderAssetFailure extends Schema.TaggedError<RenderAssetFailure>()("RenderAssetFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

export interface RenderAssetOptions {
  readonly assets?: string;
  readonly imports?: readonly { readonly entry: string; readonly source: string }[];
  readonly extractor?: string;
  readonly storage?: string;
  readonly textures?: string;
  readonly cache?: string;
  readonly manifest?: string;
  readonly strict?: boolean;
}

export interface StockBuild {
  readonly storage: string;
  readonly buildInfoSha256: string;
  readonly fields: Readonly<Record<string, string>>;
}

export type MapImports = readonly { readonly entry: string; readonly source: string }[];

export const stockStorage = () => process.env.WC3_STORAGE ?? join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III");

const attempt = <A>(operation: string, run: () => A | Promise<A>) =>
  Effect.tryPromise({ try: async () => run(), catch: (cause) => new RenderAssetFailure({ problem: `${operation}: ${cause instanceof Error ? cause.message : String(cause)}` }) });

const read = (path: string) => attempt(`read ${path}`, async () => {
  const file = Bun.file(path);
  if (!await file.exists()) return undefined;
  const bytes = await file.bytes();
  return bytes.length > 0 ? bytes : undefined;
});

export const readStockBuild = (storage: string) => attempt("read the stock build info", async (): Promise<StockBuild> => {
  const info = await Bun.file(join(storage, ".build.info")).text();
  const lines = info.trim().split(/\r?\n/), headers = (lines[0] ?? "").split("|").map((name) => name.split("!")[0] ?? name);
  const rows = lines.slice(1).map((line) => Object.fromEntries(line.split("|").map((value, index) => [headers[index] ?? String(index), value])));
  return { storage, buildInfoSha256: createHash("sha256").update(info).digest("hex"), fields: rows.find((row) => row.Active === "1") ?? rows[0] ?? {} };
});

const findExtractor = (options: RenderAssetOptions) => options.extractor ?? process.env.CASC_EXTRACTOR ?? Bun.which("casc-extract")
      ?? Array.from(new Bun.Glob("*/build/animation-assets/casc-extract").scanSync({ cwd: dirname(INPUTS_STORE), absolute: true }))[0];

const mapSources = (options: RenderAssetOptions, mapImports: ((assets: string, manifest: Manifest) => Effect.Effect<MapImports, { readonly message: string }>) | undefined, stockFallback: Set<string>) => Effect.gen(function*() {
  const manifest = yield* readManifest();
  const assets = options.assets ?? assetsView(manifest);
  const imports = options.imports ?? (mapImports === undefined ? yield* new RenderAssetFailure({ problem: "no map imports given" }) : yield* mapImports(assets, manifest));
  const paths = new Map(imports.map(({ entry, source }) => [key(entry), source]));
  for (const { model, source, stock } of FIGHTER_ART.values()) {
    if (model === undefined || paths.has(key(model))) continue;
    paths.set(key(model), join(assets, source));
    if (stock !== undefined) stockFallback.add(key(model));
  }
  return paths;
}).pipe(Effect.mapError((cause) => cause instanceof RenderAssetFailure ? cause : new RenderAssetFailure({ problem: `read the map's imports: ${cause.message}` })));

export function renderAssetStore(options: RenderAssetOptions = {}, mapImports?: (assets: string, manifest: Manifest) => Effect.Effect<MapImports, { readonly message: string }>) {
  const storage = options.storage ?? stockStorage();
  const manifestPath = options.manifest ?? process.env.WC3_ASSET_MANIFEST;
  const used = new Map<string, { readonly sha256: string; readonly bytes: number }>();
  let stockInfo: StockBuild | undefined;
  let temporaries = 0;
  const temporary = (target: string) => `${target}.${process.pid}.${++temporaries}.tmp`;

  const stockCache = Effect.runSync(Effect.cached(readStockBuild(storage).pipe(Effect.flatMap((build) => attempt("open the stock cache", () => {
    stockInfo = build;
    const directory = join(options.cache ?? PRIVATE, "stock", stockInfo.buildInfoSha256);
    mkdirSync(directory, { recursive: true });
    const buildInfo = join(directory, "build-info.json"), temp = temporary(buildInfo);
    try {
      writeFileSync(temp, JSON.stringify(stockInfo, null, 2) + "\n");
      renameSync(temp, buildInfo);
    } finally {
      rmSync(temp, { force: true });
    }
    return directory;
  })))));
  const stockFallback = new Set<string>();
  const sources = Effect.runSync(Effect.cached(mapSources(options, mapImports, stockFallback)));
  let extractedTextures: Map<string, string> | undefined;
  const pending = new Map<string, Promise<ResolvedRenderAsset>>();
  const convertTexture = (source: string, target: string) => Effect.gen(function*() {
    const converter = Bun.which("magick") ?? Bun.which("convert");
    if (converter === null) return yield* new RenderAssetFailure({ problem: "textures need ImageMagick installed (magick or convert)" });
    const temp = temporary(target);
    yield* runProcess(ChildProcess.make(converter, [`${source}[0]`, `png:${temp}`], { stdin: "ignore" })).pipe(
      Effect.flatMap(() => attempt(`move ${temp}`, () => renameSync(temp, target))),
      Effect.ensuring(Effect.sync(() => rmSync(temp, { force: true }))),
      Effect.catch((failure) => read(target).pipe(Effect.flatMap((bytes) => bytes !== undefined ? Effect.void
        : Effect.fail(new RenderAssetFailure({ problem: `cannot convert texture ${source}: ${failure.problem}` }))))));
  });

  const succeeds = (program: string, args: readonly string[]) => {
    const output = args.at(-1);
    if (output === undefined) return Effect.succeed(false);
    const temp = temporary(output), absent = `${output}${ABSENT_SUFFIX}`;
    const extract = runProcess(ChildProcess.make(program, [...args.slice(0, -1), temp], { stdin: "ignore" })).pipe(
      Effect.timeoutOrElse({ duration: EXTRACT_TIMEOUT, orElse: () => Effect.fail(new ProcessFailure({ command: program, problem: `no result within ${EXTRACT_TIMEOUT}` })) }),
      Effect.flatMap(() => read(temp)),
      Effect.flatMap((bytes) => bytes === undefined ? Effect.succeed(false) : attempt(`move ${temp}`, () => (renameSync(temp, output), true))),
      Effect.catchTag("ProcessFailure", (failure) => failure.problem.endsWith(NOT_IN_STORAGE) ? attempt(`mark ${absent}`, () => (writeFileSync(absent, ""), false))
        : options.strict === true ? Effect.fail(new RenderAssetFailure({ problem: `extract ${args.at(-2) ?? output}: ${failure.problem}` })) : Effect.succeed(false)),
      Effect.ensuring(Effect.sync(() => rmSync(temp, { force: true }))),
      Effect.flatMap((moved) => moved ? Effect.succeed(true) : read(output).pipe(Effect.map((bytes) => bytes !== undefined))));
    return attempt(`read ${absent}`, () => Bun.file(absent).exists()).pipe(Effect.flatMap((known) => known ? Effect.succeed(false) : extract));
  };

  const stockLayer = (normalized: string, layer: AssetLayer) => Effect.gen(function*() {
    const directory = join(yield* stockCache, layer);
    const texture = /\.(blp|tga|png|dds|tif)$/.test(normalized);
    const target = texture ? normalized.replace(/\.[^.]+$/, ".png") : normalized;
    const cached = yield* read(join(directory, target));
    if (cached !== undefined) return cached;
    const extractor = findExtractor(options);
    if (extractor === null || extractor === undefined) return yield* new RenderAssetFailure({ problem: `stock asset ${normalized} needs CASC_EXTRACTOR (smashcraft-tools extract-animation-assets builds it)` });
    mkdirSync(dirname(join(directory, target)), { recursive: true });
    if (!texture) return (yield* succeeds(extractor, [storage, `war3.w3mod:${layer}:${normalized}`, join(directory, target)])) ? yield* read(join(directory, target)) : undefined;
    const dds = join(directory, normalized.replace(/\.[^.]+$/, ".dds"));
    if (!(yield* succeeds(extractor, [storage, `war3.w3mod:${layer}:${normalized.replace(/\.[^.]+$/, ".dds")}`, dds]))) {
      const blp = join(directory, normalized.replace(/\.[^.]+$/, ".blp"));
      return (yield* succeeds(extractor, [storage, `war3.w3mod:${layer}:${normalized.replace(/\.[^.]+$/, ".blp")}`, blp])) ? yield* read(blp) : undefined;
    }
    yield* convertTexture(dds, join(directory, target));
    return yield* read(join(directory, target));
  });
  const stockClassic = (path: string) => Effect.gen(function*() {
    const normalized = key(path);
    if (normalized.split("/").some((part) => part === "..") || normalized.startsWith("/")) return yield* new RenderAssetFailure({ problem: `invalid map asset path: ${path}` });
    const imported = yield* sources;
    const source = imported.get(normalized);
    if (source !== undefined) return yield* read(source);
    if (normalized.startsWith("war3mapimported/")) return undefined;
    const texture = /\.(blp|tga|png|dds|tif)$/.test(normalized);
    const pngName = normalized.replace(/\.[^.]+$/, ".png");
    const textures = options.textures ?? process.env.WC3_TEXTURES;
    if (texture && textures !== undefined) {
      extractedTextures ??= new Map(Array.from(new Bun.Glob("**/*.{png,blp,tga}").scanSync({ cwd: textures })).map((name) => [key(name), join(textures, name)]));
      const existingPath = extractedTextures.get(pngName) ?? extractedTextures.get(normalized);
      const existing = existingPath === undefined ? undefined : yield* read(existingPath);
      if (existing !== undefined) return existing;
    }
    const directory = yield* stockCache;
    const cache = join(directory, normalized);
    const cached = yield* read(cache);
    if (cached !== undefined) return cached;
    const extractor = findExtractor(options);
    if (extractor === null || extractor === undefined) return yield* new RenderAssetFailure({ problem: `stock asset ${path} needs CASC_EXTRACTOR (smashcraft-tools extract-animation-assets builds it)` });
    mkdirSync(dirname(cache), { recursive: true });
    if (yield* succeeds(extractor, [storage, `war3.w3mod:${normalized}`, cache])) return yield* read(cache);
    if (/\.(flac|wav|ogg|mp3)$/.test(normalized)) {
      return (yield* succeeds(extractor, [storage, `war3.w3mod:_locales/enus.w3mod:${normalized}`, cache])) ? yield* read(cache) : undefined;
    }
    if (!texture) return undefined;
    const png = join(directory, pngName);
    const oldPng = yield* read(png);
    if (oldPng !== undefined) return oldPng;
    const dds = cache.replace(/\.[^.]+$/, ".dds");
    if (!(yield* succeeds(extractor, [storage, `war3.w3mod:${normalized.replace(/\.[^.]+$/, ".dds")}`, dds]))) {
      const blp = cache.replace(/\.[^.]+$/, ".blp");
      return (yield* succeeds(extractor, [storage, `war3.w3mod:${normalized.replace(/\.[^.]+$/, ".blp")}`, blp])) ? yield* read(blp) : undefined;
    }
    yield* convertTexture(dds, png);
    return yield* read(png);
  });
  const resolveAsset = (path: string, graphics: Graphics = "classic", body?: AssetLocation): Promise<ResolvedRenderAsset> => {
    const normalized = `${graphics}:${body?.source ?? ""}:${body?.layer ?? ""}:${key(path)}`;
    let promise = pending.get(normalized);
    const resolveMap = (entry: string) => Effect.gen(function*() {
      const imported = yield* sources;
      const name = key(entry);

      if (name === key(POST_PROCESSING_FILE.entry)) return POST_PROCESSING_FILE.contents;
      if (graphics !== "classic" && stockFallback.has(name)) return undefined;
      const source = imported.get(name);
      if (source === undefined) return undefined;
      const bytes = yield* read(source);
      if (bytes === undefined || !name.endsWith(".dds")) return bytes;
      const directory = join(options.cache ?? PRIVATE, "map-textures");
      const decoded = join(directory, `${createHash("sha256").update(bytes).digest("hex")}.png`);
      const cached = yield* read(decoded);
      if (cached !== undefined) return cached;
      mkdirSync(directory, { recursive: true });
      yield* convertTexture(source, decoded);
      return yield* read(decoded);
    });
    const readers = {
      map: (entry: string) => Effect.runPromise(resolveMap(entry).pipe(Effect.provide(BunServices.layer))),
      stock: (entry: string, layer: AssetLayer) => Effect.runPromise((layer === "base" ? stockClassic(entry) : stockLayer(key(entry), layer)).pipe(Effect.provide(BunServices.layer))),
    };
    if (promise === undefined) pending.set(normalized, promise = Effect.runPromise(resolveRenderAsset(readers, path, graphics, body)).then((result) => {
      const { bytes } = result;
      if (bytes !== undefined && manifestPath !== undefined) {
        used.set(normalized, { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
        mkdirSync(dirname(manifestPath), { recursive: true });
        writeFileSync(manifestPath, JSON.stringify({ stock: stockInfo, assets: Object.fromEntries(used) }, null, 2) + "\n");
      }
      return result;
    }));
    return promise;
  };
  return {
    resolveAsset,
    readAsset: (path: string, graphics: Graphics = "classic") => resolveAsset(path, graphics).then(({ bytes }) => bytes),
  };
}
