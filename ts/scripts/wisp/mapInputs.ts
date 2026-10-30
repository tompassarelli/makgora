
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect, Schema } from "effect";
import { WHITE_FIGHTER_MODELS } from "../../src/generated/assets/whiteFighterModels";
import { STAGE_SKY_MODELS } from "../../src/generated/stages/stageSkyInfo";
import { MapBuild, MapBuildFailure, type ArchiveEntry } from "wisp/scripts/wisp/mapBuild";
import { runProcess } from "wisp/scripts/wisp/hostProcess";
import { UsageFailure } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import type { FighterOriginalClip } from "../../src/generated/clips/fighterOriginalClip";
import { originalClip, originalClipCount, originalLightPath } from "../../src/generated/clips/fighterOriginalClipInfo";
import { costumeBody } from "../../src/generated/costumes/costumeBodies";
import { PARTNER_COSTUME } from "../../src/game/presentation/model/costume";
import * as frostModels from "../../src/generated/assets/frostAssetInfo";
import * as impactModels from "../../src/game/assets/impactAssetInfo";
import { IMPORTED_MUSIC } from "../../src/game/assets/importedMusicInfo";
import { IMPORTED_VOICES } from "../../src/game/assets/importedVoiceInfo";
import { IMPORTED_MODEL_FILES } from "../../src/game/assets/importedModelInfo";
import { type ModelSoundCue, fighterSoundCue, fighterSoundCueCount, modelSoundLabel } from "../../src/generated/assets/modelSoundInfo";
import * as shieldModels from "../../src/generated/assets/shieldAssetInfo";
import * as ankhModels from "../../src/generated/assets/ankhAssetInfo";
import * as felCrescentModels from "../../src/generated/assets/felCrescentAssetInfo";
import * as parasolModels from "../../src/generated/assets/parasolAssetInfo";
import { STAGE_WATER_MODEL, STAGE_LAVA_MODEL, STAGE_SEA_MODEL, STAGE_TOMB_WATER_MODEL, STAGE_TOMB_SEA_MODEL, STAGE_GROUND_MODEL, STAGE_PLAGUE_MODEL } from "../../src/generated/stages/terrainAssetInfo";
import { STAGE_CRAG_MODELS } from "../../src/generated/stages/cragAssetInfo";
import { STAGE_DECK_MODELS, STAGE_POINT_LIGHT_MODELS, STAGE_SNOW_MODEL } from "../../src/generated/stages/stageAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../../src/game/presentation/demonHunterAssetInfo";
import { SUMMON_BEAR, summonClip, summonClipCount } from "../../src/game/presentation/summonClipInfo";
import { Character } from "../../src/game/sim/codes";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { HERO_ROSTER, PORTRAIT_KINDS, RENDERED_FIGHTERS, shipsInMap } from "../../src/game/roster/kits";
import { PARTICIPANT_SLOTS } from "../../src/game/input/participants";
import { PORTRAIT_QUALITY, encodeBlp, readTga } from "../blp";
import { importedModelFile } from "../heroModelSource";
import { CLIP_RECORDS, clipPoolFiles, readClipRecords } from "../clipEvidence";
import { importList } from "./importList";
import { PREVIEW_CACHE, mapArtImports } from "./mapArtImports";
import { regenerateCommand } from "../stageThumbnailSpec";
import { stageCardPath } from "./buildInputs";
import { buildProject, projectRoot as PROJECT } from "./project";
import { UI_FRAMES } from "./uiFrames";
import { checkCueModels } from "./headlessRender";
import { mapCueModels } from "./cueModels";
import { removeGeosets, teamGlowGeosets } from "../groundPlanes";
import { generateModelMDX, parseModelMDX } from "../mdxCodec";
import { fighterPortrait, heroLook, portraitCostumes } from "../../src/game/roster/looks";
const tryMapPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) => Effect.tryPromise({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const tryMapSync = <A>(operation: string, path: string, run: () => A) => Effect.try({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const EMPTY_MODEL = "the map script names an empty model path";

const BuildOptions = Schema.Struct({
  edition: Schema.optional(Schema.Literals(["classic", "full"])),

  base: Schema.optional(Schema.NonEmptyString),
  container: Schema.optional(Schema.NonEmptyString),

  assets: Schema.optional(Schema.NonEmptyString),
  summon: Schema.optional(Schema.NonEmptyString),
  name: Schema.String.check(Schema.isPattern(/^[\x20-\x7e]{1,200}$/)),
  commit: Schema.optional(Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/))),
  out: Schema.String.check(Schema.isPattern(/\.w3x$/)),
  packager: Schema.optional(Schema.NonEmptyString),
});
type BuildOptions = typeof BuildOptions.Type;



export type MapEdition = "classic" | "full";

export const editionImports = (imports: readonly ArchiveEntry[], edition: MapEdition): readonly ArchiveEntry[] =>
  edition === "full" ? imports : imports.filter(({ entry }) => !/^_hd\.w3mod[\\/]/i.test(entry));

export const decodeBuildOptions = (args: readonly string[], defaultEdition: MapEdition = "full") => {
  const pairs = Object.fromEntries(args.flatMap((arg, index) => arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : []));
  return Schema.decodeUnknownEffect(BuildOptions)(pairs).pipe(
    Effect.mapError((cause) => new UsageFailure({ problem: cause.message })),
    Effect.map((options) => ({ ...options, edition: options.edition ?? defaultEdition })),
  );
};


const SELECTION_TEXTURES = [
  "SelectionBackdrop",
  "SelectionTileFrame", "SelectionCardRed", "SelectionCardBlue", "SelectionCardTeal", "SelectionCardPurple",
  "SelectionCardGray", "SelectionAction", "SelectionRandom", "StageBackdrop", "StageChip",
  "SelectionChipP1", "SelectionChipP2", "SelectionChipP3", "SelectionChipP4", "SelectionChipCPUP1", "SelectionChipCPUP2", "SelectionChipCPUP3", "SelectionChipCPUP4",
  "SelectionHandPoint", "SelectionHandFan", "SelectionHandPinch", "SelectionBullseye",
  "HudPlate0", "HudPlate1", "HudPlate2", "HudPlate3", "HudPlateMirror0", "HudPlateMirror1", "HudPlateMirror2", "HudPlateMirror3",
  "MarkerArrow0", "MarkerArrow1", "MarkerArrow2", "MarkerArrow3",
] as const;


const SummonEvidence = Schema.Struct({
  records: Schema.Array(Schema.Struct({ clips: Schema.Array(Schema.Struct({ filename: Schema.String })) })),
});


const importLines = (path: string) => tryMapSync("read import list", path, () => importList(path));





export const GENERATED_MODELS: readonly { readonly list: string; readonly generator: string; readonly models: readonly string[] }[] = [
  { list: "impact-assets/white-flash-imports", generator: "tools/animations/white-flash-models.ts", models: Object.entries(WHITE_FIGHTER_MODELS).filter(([character]) => shipsInMap(Number(character))).map(([, model]) => model) },
  { list: "stage-assets/imports.txt", generator: "tools/stage/package.ts", models: [...new Set([...Object.values(STAGE_DECK_MODELS).flatMap(({ main, slab, alternate }) => alternate === undefined ? [main, slab] : [main, slab, alternate]), STAGE_SNOW_MODEL, STAGE_WATER_MODEL, STAGE_LAVA_MODEL, STAGE_SEA_MODEL, STAGE_TOMB_WATER_MODEL, STAGE_TOMB_SEA_MODEL, STAGE_GROUND_MODEL, STAGE_PLAGUE_MODEL, ...STAGE_CRAG_MODELS, ...Object.values(STAGE_POINT_LIGHT_MODELS).flat(), ...Object.values(STAGE_SKY_MODELS)])] },
  { list: "impact-assets/imports.txt", generator: "tools/effects/package.ts", models: Object.values(impactModels) },
  { list: "impact-assets/frost-imports.txt", generator: "tools/effects/trap.ts", models: Object.values(frostModels) },
  { list: "impact-assets/shield-imports.txt", generator: "tools/effects/shield.ts", models: Object.values(shieldModels) },
  { list: "impact-assets/ankh-imports.txt", generator: "tools/effects/ankh.ts", models: Object.values(ankhModels) },
  { list: "impact-assets/crescent-imports.txt", generator: "tools/effects/felCrescent.ts", models: Object.values(felCrescentModels) },
  { list: "impact-assets/parasol-imports.txt", generator: "tools/effects/parasol.ts", models: Object.values(parasolModels) },
];


const SUMMON_MODELS = Array.from({ length: summonClipCount(SUMMON_BEAR) }, (_, index) => summonClip(SUMMON_BEAR, index).modelPath);





const costumePoolFiles = (pool: string): string[] =>
  readClipRecords(pool).flatMap((record: { readonly costumes?: readonly { readonly filename: string }[] }) => record.costumes?.map(({ filename }) => filename) ?? []);

export const ORIGINAL_CLIP_MODELS =[...new Set(Object.values(Character).filter(shipsInMap).flatMap((character) => {
  const light = originalLightPath(character);
  const clips = Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index)?.modelPath ?? "");
  const costumes = Array.from({ length: PARTNER_COSTUME + 1 }, (_, costume) => costumeBody(character, costume) ?? []).flat();
  return [...clips, ...costumes, ...light === undefined ? [] : [light]];
}))];

const IMPORTED_HERO_MODELS = HERO_ROSTER.map(({ character }) => heroLook(character)!.model).filter((model) => importedModelFile(model) !== undefined);


export const SCRIPT_MODELS: readonly string[] = [
  DEMON_HUNTER_MODEL_FILE, ...IMPORTED_HERO_MODELS, ...SUMMON_MODELS, ...ORIGINAL_CLIP_MODELS,
  ...GENERATED_MODELS.flatMap(({ models }) => models),
];


interface SoundTable {
  readonly cueCount: (character: number) => number;
  readonly cue: (character: number, ordinal: number) => ModelSoundCue | undefined;
  readonly label: (soundIndex: number) => string | undefined;
  readonly clip: (character: number, sequenceIndex: number) => FighterOriginalClip | undefined;
}

export const MODEL_SOUND_TABLE: SoundTable = { cueCount: fighterSoundCueCount, cue: fighterSoundCue, label: modelSoundLabel, clip: originalClip };





export function soundTableProblem(table: SoundTable): string | undefined {
  for (const character of Object.values(Character)) {
    for (let ordinal = 0; ordinal < table.cueCount(character); ordinal++) {
      const cue = table.cue(character, ordinal);
      if (cue === undefined) return `character ${character} sound cue ${ordinal} is missing`;
      const label = table.label(cue.soundIndex);
      if (label === undefined || label === "") return `character ${character} sound cue ${ordinal} names no sound label`;
      if (table.clip(character, cue.sequenceIndex) === undefined) {
        return `character ${character} sound cue ${ordinal} keys sequence ${cue.sequenceIndex}, which has no clip`;
      }
    }
  }
  return undefined;
}


export function missingModels(imports: readonly string[], models: readonly string[]): string | undefined {
  if (models.includes("")) return EMPTY_MODEL;
  const listed = new Set(imports.map((file) => `war3mapImported\\${file}`));
  const missing = models.filter((model) => !listed.has(model));
  return missing.length === 0 ? undefined : `${some(missing)} not among the imports`;
}


const some = (models: readonly string[]) => `${models.slice(0, 3).join(", ")}${models.length > 3 ? ` and ${models.length - 3} more` : ""}`;

const requireListed = (path: string, imports: readonly string[], models: readonly string[], remedy: string) => {
  const missing = missingModels(imports, models);
  return missing === undefined ? Effect.void : Effect.fail(new MapBuildFailure({ operation: "check script models", path, cause: `${missing}; ${remedy}` }));
};






const carriedModels = (map: string, packager: string, models: readonly string[] = [...SCRIPT_MODELS, ...mapCueModels().filter(model => model.toLowerCase().startsWith("war3mapimported\\"))]) => Effect.scoped(Effect.gen(function*() {
  if (models.includes("")) return yield* new MapBuildFailure({ operation: "check script models", path: map, cause: EMPTY_MODEL });
  const scratch = yield* Effect.acquireRelease(
    tryMapSync("create scratch directory", tmpdir(), () => mkdtempSync(join(tmpdir(), "smashcraft-models."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const listPath = join(scratch, "listfile");
  yield* runProcess("extract the archive's file list", map, [packager, "extract", map, listPath, "(listfile)"]);
  const text = yield* tryMapPromise("read the archive's file list", listPath, () => Bun.file(listPath).text());
  const carried = new Set(text.split(/\r?\n/).map((name) => name.toLowerCase()));
  const missing = models.filter((model) => !carried.has(model.toLowerCase()));
  if (missing.length > 0) {
    return yield* new MapBuildFailure({ operation: "check script models", path: map, cause: `the map does not carry ${some(missing)}; build it again` });
  }
  return carried;
}));


const UI_FRAME_FILES = UI_FRAMES.flatMap(({ definition }) => [`${definition.name}.fdf`, `${definition.name}.toc`]);





export const rebuildMap = (map: string) => Effect.gen(function*() {
  const packager = buildProject().packager;
  yield* carriedModels(map, packager).pipe(step("script models carried"));
  return yield* checkCueModels().pipe(
    step("cue models resolved"),
    Effect.andThen(MapBuild.use((maps) => maps.rebuild(map))),
    Effect.andThen(Effect.forEach(UI_FRAME_FILES, (file) => {
      const { entry, source } = imported(join(PROJECT, "tools/selection/art"), file);
      return runProcess(`replace ${entry}`, map, [packager, "replace", map, source, entry]);
    }, { discard: true })),
    step("menu frames replaced"),
  );
});

const imported = (directory: string, file: string): ArchiveEntry => ({ entry: `war3mapImported\\${file}`, source: join(directory, file) });


const PORTRAIT_CACHE = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "smashcraft/blp-portraits");






export const MAP_PORTRAITS: readonly string[] = RENDERED_FIGHTERS.flatMap((character) => portraitCostumes(character).flatMap((costume) => PORTRAIT_KINDS.flatMap((kind) =>
  [...(kind === "Tile" ? [undefined] : []), ...PARTICIPANT_SLOTS].map((slot) => fighterPortrait(character, kind, slot, costume)))));

const portraitImports = (assets: string) => Effect.forEach(
  MAP_PORTRAITS,
  (entry) => Effect.gen(function*() {
    const source = join(assets, "fighter-renders", entry.replace(/^.*war3mapImported\\/, "").replace(/\.blp$/, ".tga"));
    const bytes = yield* tryMapPromise("read portrait", source, () => Bun.file(source).bytes());
    const encoded = join(PORTRAIT_CACHE, `${new Bun.CryptoHasher("sha256").update(bytes).digest("hex")}-q${PORTRAIT_QUALITY}.blp`);
    if (!(yield* tryMapPromise("check portrait cache", encoded, () => Bun.file(encoded).exists()))) {
      const blp = yield* tryMapSync("encode portrait", source, () => encodeBlp(readTga(bytes), PORTRAIT_QUALITY));
      yield* tryMapPromise("write portrait", encoded, () => Bun.write(encoded, blp));
    }
    return { entry, source: encoded } satisfies ArchiveEntry;
  }),
);


export const glowFreeCaptureImports = Effect.fnUntraced(function*(imports: readonly ArchiveEntry[]) {
  const bodies = new Set(Object.values(Character).flatMap((character) =>
    Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index))
      .flatMap((clip) => clip?.timeline ? [clip.modelPath] : [])));
  return yield* Effect.forEach(imports, (imported) => Effect.gen(function*() {
    if (!bodies.has(imported.entry.replace(/^_hd\.w3mod\\/, ""))) return imported;
    const bytes = yield* tryMapPromise("read capture body", imported.source, () => Bun.file(imported.source).arrayBuffer());
    const model = yield* tryMapSync("decode capture body", imported.source, () => parseModelMDX(bytes));
    const removed = teamGlowGeosets(model);
    if (removed.size === 0) return imported;
    const stripped = yield* tryMapSync("strip capture team glow", imported.source, () => {
      removeGeosets(model, removed);
      return generateModelMDX(model);
    });
    const source = join(PREVIEW_CACHE, `team-glow-free-${new Bun.CryptoHasher("sha256").update(stripped).digest("hex")}.mdx`);
    if (!(yield* tryMapPromise("check capture body cache", source, () => Bun.file(source).exists()))) {
      yield* tryMapPromise("write capture body", source, () => Bun.write(source, stripped));
    }
    return { entry: imported.entry, source } satisfies ArchiveEntry;
  }));
});


const StageCards = Schema.Struct({ stages: Schema.Array(Schema.Struct({ stage: Schema.Finite, file: Schema.String, sha256: Schema.String })) });


const stageCardImports = Effect.gen(function*() {
  const record = yield* readJson(StageCards, join(PROJECT, "ts/stage-thumbnails.json"));
  return yield* Effect.forEach(STAGE_CATALOG.filter(({ texture }) => texture.startsWith("war3mapImported\\")), ({ id, texture }) => Effect.gen(function*() {
    const row = record.stages.find((entry) => entry.stage === id);
    const source = stageCardPath(row?.sha256 ?? "missing");
    const bytes = yield* tryMapPromise("read stage card", source, () => Bun.file(source).bytes()).pipe(Effect.orElseSucceed(() => undefined));
    if (row === undefined || bytes === undefined || new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== row.sha256) {
      return yield* new MapBuildFailure({ operation: "find stage card", path: source, cause: `stage ${id}'s card is missing or changed; from ts/: ${regenerateCommand(id)}` });
    }
    return { entry: texture, source } satisfies ArchiveEntry;
  }));
});


export const importedAssets = (assets: string, summon: string, edition: MapEdition = "full") => Effect.gen(function*() {
  const generated = yield* Effect.forEach(GENERATED_MODELS, ({ list, generator, models }) => Effect.gen(function*() {
    const path = join(assets, list);
    const files = yield* importLines(path);
    yield* requireListed(path, files, models, `package them with ${generator}`);
    return files.filter((file) => !file.toLowerCase().endsWith(".mdx") || models.includes(`war3mapImported\\${file}`)).map((file) => imported(dirname(path), file));
  }));
  const evidencePath = join(summon, "summon-clips-evidence.json");
  const evidence = yield* readJson(SummonEvidence, evidencePath);
  const summonFiles = evidence.records.flatMap((record) => record.clips).map(({ filename }) => filename);
  yield* requireListed(evidencePath, summonFiles, SUMMON_MODELS, "summonClipInfo.ts and the summon clips differ");
  const clipDirectory = join(assets, "original-clips-static-lights");
  const clipEvidencePath = join(clipDirectory, CLIP_RECORDS);
  const clipFiles = (yield* tryMapSync("read clip records", clipEvidencePath, () => [...clipPoolFiles(clipDirectory), ...costumePoolFiles(clipDirectory)])).filter((file) => ORIGINAL_CLIP_MODELS.includes(`war3mapImported\\${file}`));
  const classicBodies = clipFiles.map((filename) => imported(join(clipDirectory, "imports/war3mapImported"), filename));
  yield* requireListed(clipEvidencePath, clipFiles, ORIGINAL_CLIP_MODELS,
    `this assets folder's clip pool predates the checkout's clips. From the repository root, export a new pool from ${assets} ` +
    "with animation-assets and illidan-animation holding the packaged models fighterAssetInfo.ts and demonHunterAssetInfo.ts name: " +
    `cp -rL ${clipDirectory} NEW && chmod -R u+w NEW && bun tools/animations/export-original-clips.ts --assets ${assets} --out NEW --keep-unchanged; ` +
    "then `bun wisp inputs add original-clips-static-lights NEW` and commit build-inputs/original-clips-static-lights (smashcraft:docs/build-inputs.md)");
  const soundProblem = soundTableProblem(MODEL_SOUND_TABLE);
  if (soundProblem !== undefined) {
    return yield* new MapBuildFailure({ operation: "check model sounds", path: "ts/src/generated/assets/modelSoundInfo.ts", cause: `${soundProblem}; export them with tools/animations/export-model-sounds.ts` });
  }
  const entries: ArchiveEntry[] = [
    { entry: DEMON_HUNTER_MODEL_FILE, source: join(assets, "illidan-animation/DemonHunterFighter.mdx") },
    ...SELECTION_TEXTURES.map((texture) => imported(join(assets, "selection-assets"), `${texture}.tga`)),
    ...(yield* portraitImports(assets)),
    ...(yield* mapArtImports(assets)),

    ...(yield* stageCardImports),
    ...["SmashcraftHUD.fdf", "SmashcraftHUD.toc", ...UI_FRAME_FILES].map((file) => imported(join(PROJECT, "tools/selection/art"), file)),

    ...[...IMPORTED_MUSIC, ...IMPORTED_VOICES].map(({ path, file }) => ({ entry: path, source: join(assets, "imported-models", file) })),
    ...IMPORTED_MODEL_FILES.map(({ entry, file }) => ({ entry, source: join(assets, "imported-models", file) })),
    ...generated.flat(),
    ...summonFiles.map((filename) => imported(join(summon, "imports/war3mapImported"), filename)),
    ...classicBodies,
  ];
  const selected = editionImports(entries, edition);
  const problem = importProblem(selected);
  if (problem !== undefined) return yield* new MapBuildFailure({ operation: "check imports", path: assets, cause: problem });
  return selected;
});





function importProblem(entries: readonly ArchiveEntry[], exists: (path: string) => boolean = existsSync): string | undefined {
  const seen = new Map<string, string>();
  for (const { entry, source } of entries) {
    const key = entry.toLowerCase();
    const earlier = seen.get(key);
    if (earlier !== undefined) return `${entry} is imported twice, from ${earlier} and ${source}`;
    seen.set(key, source);
    if (!exists(source)) return `${entry}'s file ${source} is missing; a regenerated asset family must keep it (smashcraft:docs/build-inputs.md)`;
  }
  return undefined;
}


const readJson = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) =>
  tryMapPromise("read JSON", path, () => Bun.file(path).json()).pipe(Effect.flatMap((json) => decode(schema, path, json)));

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new MapBuildFailure({ operation: "decode JSON", path, cause })));
