




import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Console, Effect } from "effect";
import { sceneFile } from "wisp/src/runtime/scene";
import { FILE_SLOT_NUMBERS } from "wisp/scripts/wisp/preloadRecord";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { frameProblems, measureFrame } from "wisp/scripts/wisp/frameProbe";
import { readGameFile } from "wisp/scripts/wisp/gameFiles";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { runProcess } from "wisp/scripts/wisp/hostProcess";
import { type ModelFacts, modelFacts } from "wisp/scripts/wisp/models";
import { PlayerViewFailure, SceneReportFile, readFrame } from "wisp/scripts/wisp/playerView";
import { describeScene, sceneProblems } from "wisp/scripts/wisp/scene";
import { importedAssets } from "../mapInputs";
import { heroModelSource, importedModelFile, stockModelPath } from "../../heroModelSource";
import { gameFilesLayer, tsDirectory } from "../project";
import { SMASHCRAFT_FRAME, SMASHCRAFT_SCENE } from "../playerView";
import { DrawnModel } from "../drawnModel";
import { CHARACTER_NAMES, FIGHTER_MODELS, STYLE_NAMES, loadDrawnModel, sampleAttack, sampleState, sheet } from "../hurtboxView";
import { characterModelScale } from "../../../src/game/presentation/modelScale";
import { type DrawnReachRow, REACH_CHECKED, drawnReachSource, measureDrawnReach } from "../drawnReach";
import { DRAWN_REACH } from "../drawnReachInfo";
import { STRIKE_FILE_GLOB, measureStrikeMoments, staleStrikeFighters, strikeMomentSources } from "../strikeMoments";
import { HERO_STRIKE_MOMENTS } from "../../../src/game/presentation/heroStrikeMomentInfo";
import { checkoutInputs } from "../buildInputs";
import { BODY_HEIGHT, type ReachCueRow, measureReachCue, measuredStyles, reachCueSource, showsReachCue } from "../reachCues";
import { ALL_HEROES, SELECTABLE_CHARACTERS, isSelectableCharacter, fighterName, fighterSlug, shipsInMap } from "../../../src/game/roster/kits";
import { DRAWN_STRIDES } from "../../../src/game/presentation/drawnStrideInfo";
import { DRAWN_MOTION } from "../drawnMotionInfo";
import { MOTION_STATES, drawnStrideSource, measureDrawnMotion, measureDrawnStride, type DrawnStride, type DrawnMotionRow } from "../drawnMotion";
import { AttackPhase, AttackStyle, Character } from "../../../src/game/sim/codes";
import { AUTHORED_SAMPLE_STYLES } from "../../../src/game/sim/hurtboxes";
import { CUE_FRAMES, type CueMeasurement, cueMoves, measureCueMoves } from "../cueBudget";

const scenes = (directories: readonly string[]) => Effect.forEach(directories, (directory) => Effect.gen(function*() {
  const reports = yield* Effect.forEach(FILE_SLOT_NUMBERS, (slot) => {
    const path = join(directory, sceneFile(slot, "smashcraft"));
    return readGameFile(path, SceneReportFile).pipe(Effect.map((file) => (file === undefined ? [] : [{ path, ...file }])));
  });
  const newest = reports.flat().sort((a, b) => b.modified - a.modified)[0];
  if (newest === undefined) return yield* new UsageFailure({ problem: `${directory} holds no scene report` });
  yield* Console.log(`${newest.path}: ${describeScene(newest.value, SMASHCRAFT_SCENE)}`);
  const problems = sceneProblems(newest.value, SMASHCRAFT_SCENE);
  if (problems.length > 0) return yield* new PlayerViewFailure({ client: directory, source: newest.path, problems });
}), { discard: true }).pipe(Effect.provide(gameFilesLayer));


const frames = (paths: readonly string[]) => Effect.gen(function*() {
  const absent = new Map<string, string[]>();
  for (const path of paths) {
    const results = measureFrame(yield* readFrame(path), SMASHCRAFT_FRAME);
    yield* Console.log(`${path}: ${results.map(({ feature, present, measured }) => `${feature.name} ${present ? "present" : "absent"} (${measured})`).join("; ")}`);
    for (const { seen } of frameProblems(results)) absent.set(seen, [...(absent.get(seen) ?? []), path]);
  }
  if (absent.size === 0) return;
  return yield* new PlayerViewFailure({
    client: `${new Set([...absent.values()].flat()).size} of ${paths.length} frames`,
    source: paths.length === 1 ? paths[0] ?? "" : `${paths.length} frames`,
    problems: [...absent].map(([seen, failed]) => ({ seen, evidence: `${failed.length} of ${paths.length} frames` })),
  });
});

import { MODEL_FACTS } from "../modelFacts";
import { MODEL_FACTS_DIRECTORY, roundedFacts, writeModelFacts } from "../modelFactsTable";
import { heroLook } from "../../../src/game/roster/looks";

const MODEL_TABLE = MODEL_FACTS_DIRECTORY;






const models = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  if (args.length === 1 && (args[0] === "--prune" || args[0] === "--check")) {
    const named = new Set(SMASHCRAFT_SCENE.kinds.flatMap(kind => kind.models).filter(model => model !== ""));
    const missing = [...named].filter(model => MODEL_FACTS[model] === undefined).sort();
    if (missing.length > 0) return yield* new UsageFailure({ problem: `${missing.length} scene models have no facts; measure them with bun wisp view models --assets "$(bun wisp inputs path assets)" --summon "$(bun wisp inputs path summon)" --extractor CASC_EXTRACT --storage WARCRAFT_DIR --only "${missing.join(",")}"` });
    if (args[0] === "--check") {
      yield* Console.log(`${named.size} scene models measured`);
      return;
    }
    const kept = Object.fromEntries(Object.entries(MODEL_FACTS).filter(([model]) => named.has(model)));
    yield* Effect.try({ try: () => writeModelFacts(kept), catch: cause => new MapBuildFailure({ operation: "write model facts", path: MODEL_TABLE, cause }) });
    yield* Console.log(`Kept ${named.size} measured models: ${MODEL_TABLE}`);
    return;
  }
  const options = Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { assets, summon, extractor, storage, only } = options;
  if (assets === undefined || summon === undefined || extractor === undefined || storage === undefined || !(args.length === 8 || args.length === 10 && only !== undefined)) {
    return yield* new UsageFailure({ problem: "view models takes --assets DIR --summon DIR --extractor CASC_EXTRACT --storage WARCRAFT_DIR [--only MODEL,...]" });
  }
  const imports = new Map((yield* importedAssets(assets, summon)).map(({ entry, source }) => [entry.toLowerCase(), source]));
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-stock-models."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const selected = only?.split(",");
  const named = [...new Set(SMASHCRAFT_SCENE.kinds.flatMap((kind) => kind.models))].filter((model) => model !== "" && (selected === undefined || selected.includes(model))).sort();
  const lines = yield* Effect.forEach(named, (model, index) => Effect.gen(function*() {
    let file = imports.get(model.toLowerCase());
    if (file === undefined) {
      const stockFile = join(scratch, `stock-${index}.mdx`);
      file = stockFile;
      yield* runProcess("extract stock model", model, [extractor, storage, stockModelPath(model), stockFile]).pipe(
        Effect.catch(() => runProcess("extract HD-only stock model", model, [extractor, storage, stockModelPath(model).replace("war3.w3mod:", "war3.w3mod:_hd.w3mod:"), stockFile])),
      );
    }
    const path = file;
    const facts = yield* Effect.tryPromise({
      try: async () => modelFacts(await Bun.file(path).bytes()),
      catch: (cause) => new MapBuildFailure({ operation: "read model facts", path: model, cause }),
    });
    return [model, roundedFacts(facts)] as const;
  }), { concurrency: 4 });
  const table = { ...(selected === undefined ? {} : Object.fromEntries(Object.entries(MODEL_FACTS).filter(([model]) => !named.includes(model)))), ...Object.fromEntries(lines) };
  yield* Effect.try({ try: () => writeModelFacts(table), catch: (cause) => new MapBuildFailure({ operation: "write model facts", path: MODEL_TABLE, cause }) });
  yield* Console.log(`${named.length} models, ${named.filter((model) => !imports.has(model.toLowerCase())).length} from the game's archives: ${MODEL_TABLE}`);
}));

const AERIALS: readonly AttackStyle[] = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];






const hurtboxes = (args: readonly string[]) => Effect.gen(function*() {
  const options = Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { assets, out } = options;
  if (assets === undefined || out === undefined || args.length !== 4) return yield* new UsageFailure({ problem: "view hurtboxes takes --assets DIR --out DIR" });
  yield* Effect.tryPromise({
    try: async () => {
      mkdirSync(out, { recursive: true });
      for (const character of [ Character.rifleman, Character.demonHunter]) {
        const model = await loadDrawnModel(assets, character);
        const name = CHARACTER_NAMES[character] ?? `${character}`;
        const sheets = [sheet(`${name} stand-crouch`, model, [sampleState(character, false), sampleState(character, true), sampleState(character, false, -1), sampleState(character, true, -1)], 4)];
        const mirrored = [];
        for (const style of AUTHORED_SAMPLE_STYLES) {
          const aerial = AERIALS.includes(style);
          sheets.push(sheet(`${name} ${STYLE_NAMES[style] ?? style}`, model, sampleAttack(character, style, 1, aerial)));
          mirrored.push(...sampleAttack(character, style, -1, aerial).filter((frame) => frame.phase === AttackPhase.active).slice(0, 1));
        }
        sheets.push(sheet(`${name} first-active-left`, model, mirrored, mirrored.length));
        for (const result of sheets) {
          await Bun.write(join(out, `${result.name.replaceAll(" ", "-")}.png`), result.png);
          for (const line of result.lines) console.log(line);
        }
      }
    },
    catch: (cause) => new MapBuildFailure({ operation: "draw hurt volumes", path: out, cause }),
  });
});

const STRIKE_GAME = join(import.meta.dir, "../../../src/game");

const differingStrikeFiles = (sources: ReadonlyMap<string, string>) => Effect.tryPromise({
  try: async () => {
    const differing = [...new Bun.Glob(STRIKE_FILE_GLOB).scanSync(STRIKE_GAME)].filter((path) => !sources.has(path));
    for (const [path, source] of sources) {
      const file = Bun.file(join(STRIKE_GAME, path));
      if (!(await file.exists()) || await file.text() !== source) differing.push(path);
    }
    return differing.sort();
  },
  catch: (cause) => new MapBuildFailure({ operation: "read strike moments", path: STRIKE_GAME, cause }),
});





const strikes = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const check = args.length === 1 && args[0] === "--check";
  const options: Record<string, string | undefined> = check ? { assets: (yield* checkoutInputs()).assets } : Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { extractor, storage, assets } = options;
  const extractStock = extractor !== undefined && storage !== undefined;
  if (!(check || assets !== undefined && args.length === 2 || extractStock && args.length === (assets === undefined ? 4 : 6))) {
    return yield* new UsageFailure({ problem: "view strikes takes --check, --assets DIR or --extractor CASC_EXTRACT --storage WARCRAFT_DIR [--assets DIR]" });
  }
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-strikes."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const files = new Map<string, string>();
  for (const [index, model] of [...new Set(ALL_HEROES.map(({ character }) => heroLook(character)!.model))].entries()) {
    if (assets !== undefined) {
      files.set(model, join(assets, heroModelSource(model)));
      continue;
    }
    if (importedModelFile(model) !== undefined) return yield* new UsageFailure({ problem: `${model} is imported: pass --assets DIR` });
    if (extractor === undefined || storage === undefined) return yield* new UsageFailure({ problem: "stock models need --extractor CASC_EXTRACT --storage WARCRAFT_DIR" });
    const file = join(scratch, `hero-${index}.mdx`);
    yield* runProcess("extract stock model", model, [extractor, storage, stockModelPath(model), file]);
    files.set(model, file);
  }
  const moments = yield* Effect.tryPromise({
    try: () => measureStrikeMoments((model) => Bun.file(files.get(model) ?? "").arrayBuffer()),
    catch: (cause) => new MapBuildFailure({ operation: "measure strike moments", path: STRIKE_GAME, cause }),
  });
  const sources = strikeMomentSources(moments);
  const differing = yield* differingStrikeFiles(sources);
  if (check) {
    if (differing.length === 0) return yield* Console.log(`${moments.length} strike moments in ${sources.size} files match the committed models: ${STRIKE_GAME}`);
    const stale = staleStrikeFighters(moments, HERO_STRIKE_MOMENTS, ALL_HEROES.map(({ character }) => character)).map(fighterSlug);
    return yield* new MapBuildFailure({ operation: "check strike moments", path: STRIKE_GAME, cause: `the committed strike tables ${differing.join(", ")} differ from what ${stale.length > 0 ? stale.join(", ") : "the roster"} measure from their committed models; run bun wisp view strikes --assets "$(bun wisp inputs path assets)" and commit the tables` });
  }
  yield* Effect.tryPromise({
    try: async () => {
      for (const path of differing) {
        const source = sources.get(path);
        if (source === undefined) rmSync(join(STRIKE_GAME, path));
        else await Bun.write(join(STRIKE_GAME, path), source);
      }
    },
    catch: (cause) => new MapBuildFailure({ operation: "write strike moments", path: STRIKE_GAME, cause }),
  });
  yield* Console.log(`${moments.length} strike moments in ${sources.size} files, ${differing.length} rewritten: ${STRIKE_GAME}`);
}));

const REACH_TABLE = join(import.meta.dir, "../drawnReachInfo.ts");






const reach = (args: readonly string[]) => Effect.gen(function*() {
  const assets = args[0] === "--assets" ? args[1] : undefined;
  const character = args[2] === "--character" ? Number(args[3]) : undefined;
  if (assets === undefined || !(args.length === 2 || args.length === 4 && character !== undefined && REACH_CHECKED.some((row) => row.character === character))) {
    return yield* new UsageFailure({ problem: "view reach takes --assets DIR [--character ID]" });
  }
  const rows = yield* Effect.tryPromise({
    try: async () => {
      const measured: DrawnReachRow[] = [];
      for (const { character: fighter, styles } of REACH_CHECKED) {
        if (character !== undefined && character !== fighter) {
          for (const style of styles) {
            const retained = DRAWN_REACH.find((row) => row.character === fighter && row.style === style);
            if (retained === undefined) throw new Error(`${fighter}/${style}: no retained reach; measure every fighter`);
            measured.push({ ...retained, character: fighter, style });
          }
          continue;
        }
        const hero = ALL_HEROES.find((candidate) => candidate.character === fighter);
        let model: DrawnModel;
        let id: string;
        if (hero === undefined) {
          const bytes = await Bun.file(join(assets, FIGHTER_MODELS[fighter] ?? "")).arrayBuffer();
          const name = (FIGHTER_MODELS[fighter] ?? "").split("/").at(-1)?.replace(/\.mdx$/, "");
          id = `war3mapImported\\${name}-${new Bun.CryptoHasher("sha256").update(new Uint8Array(bytes)).digest("hex")}.mdx`;
          model = await loadDrawnModel(assets, fighter);
        } else {
          const file = join(assets, heroModelSource(heroLook(hero.character)!.model));
          model = new DrawnModel(await Bun.file(file).arrayBuffer(), characterModelScale(fighter));
          id = heroLook(hero.character)!.model;
        }
        for (const style of styles) measured.push({ character: fighter, style, model: id, ...measureDrawnReach(model, fighter, style) });
      }
      return measured;
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure drawn reach", path: assets, cause }),
  });
  for (const row of rows.filter((row) => character === undefined || row.character === character)) yield* Console.log(`${CHARACTER_NAMES[row.character] ?? row.character} ${row.style}: swing ${row.swing.toFixed(1)}, peak frame ${row.peakFrame}, active ${row.firstActive}-${row.lastActive}`);
  yield* Effect.tryPromise({ try: () => Bun.write(REACH_TABLE, drawnReachSource(rows)), catch: (cause) => new MapBuildFailure({ operation: "write drawn reach", path: REACH_TABLE, cause }) });
});


const REACH_CUE_TABLE = join(import.meta.dir, "../../../src/game/presentation/reachCueInfo.ts");

const reachCues = (args: readonly string[]) => Effect.gen(function*() {
  const assets = args[0] === "--assets" && args.length === 2 ? args[1] : undefined;
  if (assets === undefined) return yield* new UsageFailure({ problem: "view reachcues takes --assets DIR" });
  const rows = yield* Effect.tryPromise({
    try: async () => {
      const measured: ReachCueRow[] = [];
      for (const character of SELECTABLE_CHARACTERS) {
        const hero = ALL_HEROES.find((candidate) => candidate.character === character);
        const model = hero === undefined ? await loadDrawnModel(assets, character)
          : new DrawnModel(await Bun.file(join(assets, heroModelSource(heroLook(hero.character)!.model))).arrayBuffer(), characterModelScale(character));
        for (const style of measuredStyles(character)) measured.push(measureReachCue(model, character, style));
      }
      return measured;
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure reach cues", path: assets, cause }),
  });
  for (const character of SELECTABLE_CHARACTERS) {
    const own = rows.filter((row) => row.character === character);
    yield* Console.log(`${fighterSlug(character)}: ${own.filter(showsReachCue).length} of ${own.length} cued; ${own.map((row) => `${STYLE_NAMES[row.style] ?? row.style} ${(row.beyond / BODY_HEIGHT).toFixed(2)}`).join(", ")}`);
  }
  yield* Effect.tryPromise({ try: () => Bun.write(REACH_CUE_TABLE, reachCueSource(rows)), catch: (cause) => new MapBuildFailure({ operation: "write reach cues", path: REACH_CUE_TABLE, cause }) });
});


const motion = (args: readonly string[]) => Effect.gen(function*() {
  const assets = args[0] === "--assets" ? args[1] : undefined;
  const selected = args[2] === "--character" ? Number(args[3]) : undefined;
  if (assets === undefined || !(args.length === 2 || args.length === 4 && selected !== undefined && isSelectableCharacter(selected))) return yield* new UsageFailure({ problem: "view motion takes --assets DIR [--character ID]" });
  const result = yield* Effect.tryPromise({
    try: async () => {
      const strides: DrawnStride[] = selected === undefined ? [] : SELECTABLE_CHARACTERS.flatMap(character => {
        const row = DRAWN_STRIDES[character];
        return row === undefined || character === selected ? [] : (["walk", "run"] as const).map(motion => ({ character, motion, ...row[motion] }));
      });
      const rows: DrawnMotionRow[] = selected === undefined ? [] : DRAWN_MOTION.filter(row => row.character !== selected);
      const models: { character: Character; drawn: DrawnModel; model: string }[] = [];
      const characters = [ Character.rifleman, Character.demonHunter, ...ALL_HEROES.map((hero) => hero.character)];
      for (const character of characters) {
        if (selected !== undefined && character !== selected) continue;
        const hero = ALL_HEROES.find((candidate) => candidate.character === character);
        const relative = hero === undefined ? FIGHTER_MODELS[character] ?? "" : heroModelSource(heroLook(hero.character)!.model);
        const bytes = await Bun.file(join(assets, relative)).arrayBuffer();
        const hash = new Bun.CryptoHasher("sha256").update(new Uint8Array(bytes)).digest("hex");
        const model = heroLook(character)?.model ?? `war3mapImported\\${relative.split("/").at(-1)?.replace(/\.mdx$/, "")}-${hash}.mdx`;
        const drawn = new DrawnModel(bytes, characterModelScale(character));
        for (const state of ["walk", "run"] as const) strides.push(measureDrawnStride(bytes, drawn, character, state, model));
        models.push({ character, drawn, model });
      }
      const stridePath = join(import.meta.dir, "../../../src/game/presentation/drawnStrideInfo.ts");
      const strideSource = drawnStrideSource(strides.sort((a, b) => a.character - b.character));
      if (!await Bun.file(stridePath).exists() || await Bun.file(stridePath).text() !== strideSource) {
        await Bun.write(stridePath, strideSource);

        return { changed: true, rows };
      }
      for (const { character, drawn, model } of models) for (const state of MOTION_STATES) rows.push(measureDrawnMotion(drawn, character, state, model));
      rows.sort((a, b) => characters.indexOf(a.character) - characters.indexOf(b.character) || MOTION_STATES.indexOf(a.state) - MOTION_STATES.indexOf(b.state));
      const rowSource = rows.map((row) => `  ${JSON.stringify({ ...row, motion: Number(row.motion.toFixed(1)), body: Number(row.body.toFixed(1)), toward: Number(row.toward.toFixed(1)), against: Number(row.against.toFixed(1)) })},`).join("\n");
      await Bun.write(join(import.meta.dir, "../drawnMotionInfo.ts"), `// Generated by \`bun wisp view motion --assets DIR\`; regenerate instead of editing.\nimport type { DrawnMotionRow } from "./drawnMotion";\nexport const DRAWN_MOTION: readonly DrawnMotionRow[] = [\n${rowSource}\n];\n`);
      const lines = ["# Fighter movement and recovery clips", "", "Generated from the packaged models by `bun wisp view motion --assets DIR` (#171). Each row follows production pose selection over the state's completed frames. Motion is the greatest local vertex travel; body is the mean of each vertex's greatest travel, in world units. The direction column measures vertex travel toward/against the action's direction (vertical for standing up or crouching, horizontal otherwise). Local measurements exclude the simulation's movement across the stage. Clip numbers and names identify sequences of the fighter's model. A zero reveals a held pose. These measurements expose gaps; a stock Walk in a roll row still needs a roll clip.", "", "| Fighter | State | Clip | Motion | Body | Direction; toward/against |", "| --- | --- | --- | ---: | ---: | --- |", ...rows.filter((row) => shipsInMap(row.character)).map((row) => `| ${fighterName(row.character)} | ${row.state} | ${row.clips.map((clip, index) => `${clip}: ${row.names[index]}`).join(", ")} | ${row.motion.toFixed(1)} | ${row.body.toFixed(1)} | ${row.direction}; ${row.toward.toFixed(1)}/${row.against.toFixed(1)} |`), "", "Walking/running cadence uses grounded vertices' horizontal excursion twice per cycle. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale. Ground clips play at body speed over drawn stride, capped at 5x (GROUND_LOCOMOTION_RATE_CAP in fighterLocomotion.ts), so past it the body outruns the feet. That reads well on the floaters Firelord and Lady Vashj. Warden, Tyrande and Jaina are grounded and their models carry a single stock Walk, so Tyrande runs on an authored `Movement run` (tools/animations/run-clips.ts, #834) whose stride is measured over the grounded vertices that move, leaving the hem and pelvis out. Warden walks on that clip (`--walk`), which her stride lock holds at 3.38x with no slide, and runs and dashes on her stock Walk, which needs 6.17x at run speed and 5.36x at dash speed, so her cap is 6.25x (groundLocomotionRateCap) instead of 5x and her feet stay on the ground at both (Tom asked for this split on 2026-10-31). Jaina (about 1.15x) is marginal and stays on her walk.", ""];
      await Bun.write(join(import.meta.dir, "../../../../docs/fighter-motion.md"), lines.join("\n"));
      return { changed: false, rows };
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure drawn motion", path: assets, cause }),
  });
  if (result.changed) return yield* runProcess("measure updated movement cadence", tsDirectory, [process.execPath, "scripts/wisp.ts", "view", "motion", ...args]);
  for (const row of result.rows.filter(row => selected === undefined || row.character === selected)) yield* Console.log(`${fighterSlug(row.character)} ${row.state}: clips ${row.clips.join(",")}, motion ${row.motion.toFixed(1)}, body ${row.body.toFixed(1)}`);
});

const cues = (args: readonly string[]) => Effect.gen(function*() {
  const only = args.flatMap((arg, index) => args[index - 1] === "--move" ? [arg] : []);
  if (args.length !== only.length * 2) {
    return yield* new UsageFailure({ problem: "view cues takes [--move FIGHTER:MOVE]..." });
  }
  const known = cueMoves();
  const unknown = only.filter((name) => !known.some((move) => move.name === name));
  if (unknown.length > 0) return yield* new UsageFailure({ problem: `view cues knows no move ${unknown.join(", ")}; names look like blademaster:down-special-air-ex` });
  const moves = known.filter(({ name }) => only.length === 0 || only.includes(name));
  const rows: CueMeasurement[] = [...yield* measureCueMoves(moves, CUE_FRAMES)];
  const frames = (value: number) => Number.isFinite(value) ? String(value) : "never";
  for (const row of [...rows].sort((a, b) => b.linger - a.linger || b.coverage - a.coverage)) {
    yield* Console.log(`${row.over.length > 0 ? "OVER" : "ok  "} ${row.move}: danger to ${row.lastDanger}, shown ${row.firstShown}-${frames(row.lastShown)}, linger ${frames(row.linger)}, covers ${(row.coverage * 100).toFixed(1)}% (${row.widest.join(", ")})${row.colour === undefined ? "" : `, colour rgb(${row.colour.join(",")}), ${row.feedback}`}${row.popcorn ? " (Popcorn undrawn)" : ""}${row.over.length > 0 ? `; ${row.over.join("; ")}` : ""}`);
  }
  const models = rows.flatMap((row) => (row.models ?? []).map((model) => ({ row, model })));
  for (const { row, model } of models) {
    yield* Console.log(`${model.present ? model.pixels > 0 ? "px  " : "emit" : "ZERO"} ${row.move} ${model.model}: ${model.pixels} px at most, shown on ${model.frames} frames${model.present && model.pixels === 0 ? " (present by emitter; appearance needs native)" : model.popcorn ? " (Popcorn undrawn)" : ""}`);
  }
  const zero = models.filter(({ model }) => !model.present);
  const over = rows.filter((row) => row.over.length > 0);
  yield* Console.log(`${rows.length} cue measurements, ${over.length} over budget; ${models.length} special form cue models, ${zero.length} absent; frames in ${CUE_FRAMES}`);
  if (zero.length > 0) return yield* new MapBuildFailure({ operation: "find every special form's cue models", path: "ts/scripts/wisp/cueBudget.ts", cause: zero.map(({ row, model }) => `${row.move} ${model.model}`).join(", ") });
  if (over.length > 0) return yield* new MapBuildFailure({ operation: "check the effect budget", path: "docs/design/visual-quality.md", cause: over.map((row) => row.move).join(", ") });
});

export const view: Command = ([mode, ...paths]) => {
  if (mode === "cues") return cues(paths);
  if (mode === "models") return models(paths);
  if (mode === "motion") return motion(paths);
  if (mode === "reach") return reach(paths);
  if (mode === "reachcues") return reachCues(paths);
  if (mode === "strikes") return strikes(paths);
  if (mode === "hurtboxes") return hurtboxes(paths);
  if (paths.length === 0) return Effect.fail(new UsageFailure({ problem: "view takes scene DATA_DIR..., frame FRAME.ppm..., models --assets DIR ..., hurtboxes, strikes or reach --assets DIR" }));
  if (mode === "scene") return scenes(paths);
  if (mode === "frame") return frames(paths);
  return Effect.fail(new UsageFailure({ problem: `unknown view check ${mode}` }));
};
