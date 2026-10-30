import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure, type ArchiveEntry } from "wisp/scripts/wisp/mapBuild";
import { encodeBlp, readTga } from "../blp";
import { MINIMAP_MARKERS_ENTRY, NO_MINIMAP_MARKERS, PREVIEW_ENTRY, composePreview, encodePreview } from "../mapPreview";

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

const CURSOR_RACE_TEXTURES = ["HumanCursor", "OrcCursor", "NightElfCursor", "UndeadCursor", "ForsakenCursor"] as const;

const CURSOR_QUALITY = 100;

const gameCursorImports = (assets: string) => Effect.gen(function*() {
  const sheet = join(assets, "selection-assets", "GameCursor.tga");
  const blp = yield* tryMapSync("encode the game cursor", sheet, () => encodeBlp(readTga(readFileSync(sheet)), CURSOR_QUALITY));
  return yield* Effect.forEach(CURSOR_RACE_TEXTURES, (texture) => cachedImport(`UI\\Cursor\\${texture}.blp`, blp, "blp"));
});

export const mapArtImports = (assets: string) => Effect.gen(function*() {
  const renders = join(assets, "fighter-renders");
  const preview = yield* tryMapSync("compose map preview", renders, () => encodePreview(composePreview((file) => readTga(readFileSync(join(renders, file))))));
  return [yield* cachedImport(PREVIEW_ENTRY, preview, "blp"), yield* cachedImport(MINIMAP_MARKERS_ENTRY, NO_MINIMAP_MARKERS, "mmp"), ...(yield* gameCursorImports(assets))];
});
