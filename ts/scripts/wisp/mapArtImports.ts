import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure, type ArchiveEntry } from "wisp/scripts/wisp/mapBuild";
import { PORTRAIT_QUALITY, encodeBlp, readTga } from "../blp";
import { PREVIEW_ENTRY, PREVIEW_FILE, encodePreview } from "../mapPreview";
import { LOADING_SCREEN_MODEL, LOADING_SCREEN_PICTURE, LOADING_SCREEN_STOCK_MODEL, classicModel, loadingScreenTextures, retargetLoadingModel } from "../loadingScreen";

export const PREVIEW_CACHE = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "smashcraft/map-preview");

const tryMapPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) => Effect.tryPromise({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const tryMapSync = <A>(operation: string, path: string, run: () => A) => Effect.try({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });

const cachedImport = (entry: string, bytes: Uint8Array, extension: string) => Effect.gen(function*() {
  const source = join(PREVIEW_CACHE, `${new Bun.CryptoHasher("sha256").update(bytes).digest("hex")}.${extension}`);
  if (!(yield* tryMapPromise("check map art cache", source, () => Bun.file(source).exists()))) {
    yield* tryMapPromise("write map art", source, () => Bun.write(source, bytes));
  }
  return { entry, source } satisfies ArchiveEntry;
});

export const mapArtImports = (assets: string) => Effect.gen(function*() {
  const folder = join(assets, "imported-models");
  const preview = yield* tryMapSync("encode map preview", join(folder, PREVIEW_FILE), () => encodePreview(readTga(readFileSync(join(folder, PREVIEW_FILE)))));
  const picture = yield* tryMapSync("read loading screen picture", folder, () => readTga(readFileSync(join(folder, LOADING_SCREEN_PICTURE))));
  const model = yield* tryMapSync("retarget loading screen model", folder, () => classicModel(retargetLoadingModel(readFileSync(join(folder, LOADING_SCREEN_STOCK_MODEL)))));
  const textures = yield* Effect.forEach(loadingScreenTextures(picture), ({ entry, image }) => cachedImport(entry, encodeBlp(image, PORTRAIT_QUALITY), "blp"));
  return [yield* cachedImport(PREVIEW_ENTRY, preview, "blp"), yield* cachedImport(LOADING_SCREEN_MODEL, model, "mdx"), ...textures];
});
