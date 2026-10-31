import type { StandaloneGame, StandaloneInput, StandaloneSession } from "wisp/scripts/wisp/standalone";
import { join } from "node:path";
import type { MapEntry } from "wisp/src/headless/client";
import { createKeyFeed } from "wisp/src/headless/keyInput";
import { createPointerFeed } from "wisp/src/headless/pointer";
import { Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { RenderFailure } from "wisp/scripts/wisp/headlessRender";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { customMapData } from "wisp/scripts/wisp/headlessInput";
import { describeDigestDifference, digestDifference, frameDigest } from "../../src/game/replay/frameDigest";
import { Action } from "../../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../../src/game/input/keyBindings";
import { PARTICIPANT_SLOTS } from "../../src/game/input/participants";
import { Phase, cycleSlotMode, selectCharacter, selectCpuCharacter, setCpuOpponent, setCpuTier, setStocks } from "../../src/game/lobby/lobbyState";
import { fighterAt, isActive } from "../../src/game/sim/roster";
import { Character } from "../../src/game/sim/codes";
import { NATIVE_DRIVER_BUILD, PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import type { MapBuild } from "../../src/game/session/build";
import { DIZZY_MODEL } from "../../src/host/loop/fighterBody";
import { preloadFighterModels, preloadFighterTextures } from "../../src/game/render/fighterPreload";
import { preloadMatchModels } from "../../src/game/render/matchPreload";
import { preloadHudTextures } from "../../src/game/ui/hudPreload";
import { preloadMenuTextures } from "../../src/game/ui/menuPreload";
import { SELECTABLE_CHARACTERS } from "../../src/game/roster/kits";
import { cueModels } from "./cueModels";
import { preloadModels, preloadSkies } from "../../src/game/presentation/stagePreload";
import { PREDICTED_HEADLESS, SMASHCRAFT_HEADLESS } from "./headless";
import { deliverKey } from "./deliverKey";
import { headlessRender, playerRender } from "./headlessRender";
import { createNetStandalone, smashcraftMapHash } from "./net";
import { ACTIONS, CPU_OPPONENT, SELECTION_SCRIPT, selectionClicks, selectionPresses } from "./selectionScript";

const BINDINGS = presetBindings(DEFAULT_PRESET);
const ESCAPE_KEY = 0x1b;
export const NEUTRAL_INPUT: StandaloneInput = { buttons: [], axisX: 0, axisY: 0 };

export function heldKeys(input: StandaloneInput): Set<number> {
  const buttons = new Set(input.buttons);
  if (input.axisX < -0.28) buttons.add("left");
  if (input.axisX > 0.28) buttons.add("right");
  if (input.axisY < -0.28) buttons.add("down");
  if (input.axisY > 0.28) buttons.add("up");
  const held = new Set<number>();
  for (const button of buttons) {
    const action = ACTIONS[button];
    const key = button === "start" ? 89 : button === "view" ? 75 : button === "back" ? ESCAPE_KEY : action === undefined ? undefined : keyFor(BINDINGS, action, 0);
    if (key !== undefined) held.add(key);
  }
  return held;
}






const FOUR_FIGHTERS = ["-dev slots 1 14", "-dev fighter 2 Blademaster", "-dev fighter 3 Illidan", "-dev fighter 4 Warden", "-dev time 2"];
const FOUR_FIGHTER_STOCKS = 99;


export type StandaloneStart = "match" | "select" | "results";

const offersPrompt = (start: StandaloneStart, savedFiles: string | undefined): boolean => start !== "select" || savedFiles !== undefined;

const clientOptions = (savedFiles: string | undefined) => savedFiles === undefined ? { keepCalls: 0 } : { keepCalls: 0, files: () => customMapData(savedFiles) };

const OPPONENT_SLOT = 1;

const asksForCpu = (script: string | undefined): boolean => script?.startsWith(SELECTION_SCRIPT) === true && script.split("\n", 1)[0]?.split(/\s+/).includes(CPU_OPPONENT) === true;

function addCpuOpponent(game: Parameters<typeof cycleSlotMode>[0]): void {
  cycleSlotMode(game, 0, OPPONENT_SLOT);
  cycleSlotMode(game, 0, OPPONENT_SLOT);
  setCpuOpponent(game, 0, OPPONENT_SLOT, "wren");
  setCpuTier(game, 0, OPPONENT_SLOT, "expert");
  selectCpuCharacter(game, 0, OPPONENT_SLOT, Character.demonHunter);
  setStocks(game, 0, 1);
}

const QUICK_MATCH = "-dev quick cpu wren expert hero illidan";
const SELECT_SETTLE_STEPS = 30;

export async function createStandaloneSession(options: { readonly script?: string; readonly presentation?: MapBuild["presentation"]; readonly fourFighters?: boolean; readonly start?: StandaloneStart; readonly chosen?: string; readonly savedFiles?: string } = {}): Promise<StandaloneSession & { frame(): number; finished(): boolean; digest(): { readonly frame: number; readonly digest: string }; difference(recorded: string): string }> {
  const { script, presentation, fourFighters = false, start = "match", chosen, savedFiles } = options;
  const scripted = script?.startsWith(SELECTION_SCRIPT) === true;
  const selection = scripted || start === "select";
  const driven = script !== undefined && !scripted;
  const presses = scripted ? selectionPresses(script) : [], clicks = scripted ? selectionClicks(script) : [];
  let steps = 0;
  const runtime = installHeadless(!driven || presentation === "pool-confirmed" || presentation === "pool-predicted" ? PREDICTED_HEADLESS : SMASHCRAFT_HEADLESS);
  let restoreTutorialOffers = (): void => {};
  const release = (): void => { restoreTutorialOffers(); runtime.restore(); };
  try {

    const platform = join(import.meta.dir, "../../src/platform");
    interface State { controlsGreeted?: number; readonly game: { readonly phase: number; stockCount: number }; readonly runtime: { readonly simulationFrame: number }; readonly world: Parameters<typeof frameDigest>[0] & Parameters<typeof isActive>[0] }
    const { shell }: { shell(): State } = await import(join(platform, "../host/loop/state.ts"));
    const { confirmedChecksum }: { confirmedChecksum(state: State): string } = await import(join(platform, "../host/loop/diagnostics.ts"));
    const { applyDeveloperCommand }: { applyDeveloperCommand(state: State, slot: number, text: string): void } = await import(join(platform, "../host/loop/developerCommands.ts"));
    const { views }: { views(state: State): { readonly settings: readonly { endPreview(): void; isOpen(): boolean; close(): void }[] } } = await import(join(platform, "../host/loop/ui.ts"));
    const { tutorialOffers }: { tutorialOffers: { enabled: boolean } } = await import(join(platform, "../game/ui/tutorialMenu.ts"));
    const offersBefore = tutorialOffers.enabled;
    restoreTutorialOffers = () => { tutorialOffers.enabled = offersBefore; };
    tutorialOffers.enabled = offersPrompt(start, savedFiles);
    const { drawnFrame }: { drawnFrame(state: State): { readonly frame: number } } = await import(join(platform, "../host/loop/drawnFrame.ts"));
    const { botBeatKeys }: { botBeatKeys(frame: number): readonly [tap: number, held: number] } = await import(join(import.meta.dir, "botMatch.ts"));
    const { startQuickMatch }: { startQuickMatch(state: State, stage: number, scenario: undefined, character: Character | undefined, stocks: number): void } = await import(join(platform, "../host/loop/menus.ts"));
    const build = { ...PLAYABLE_BUILD, devConsole: true, ...(presentation === undefined ? {} : { presentation }) };
    const main: { install(build: MapBuild): void; startBuild(build: MapBuild): void } = await import(join(platform, "main.ts"));
    const driverApi: { nativeDriverCommand(text: string): void; installSmashcraftNativeDriver(): void; startSmashcraftNativeDriver(): void } | undefined = !driven ? undefined : await import(join(platform, "nativeDriver.ts"));
    const driverBuild = { ...NATIVE_DRIVER_BUILD, ...(presentation === undefined ? {} : { presentation }) };
    const driver: MapEntry | undefined = !driven ? undefined : presentation === undefined ? await import(join(platform, "../host/entries/nativeDriverMain.ts")) : {
      install() { main.install(driverBuild); driverApi?.installSmashcraftNativeDriver(); },
      start() { main.startBuild(driverBuild); driverApi?.installSmashcraftNativeDriver(); driverApi?.startSmashcraftNativeDriver(); },
    };
    const driverCommand = driverApi?.nativeDriverCommand;
    const clients = runtime.clients(driver ?? { install: () => main.install(build), start: () => main.startBuild(build) }, !driven ? [0] : [0, 1], clientOptions(savedFiles));
    clients.start();
    clients.frames(30);
    const client = clients.client(0);
    const value = <T>(read: () => T): T => {
      let result: T | undefined;
      client.run(() => { result = read(); });
      if (result === undefined) throw new Error("standalone state missing");
      return result;
    };
    if (fourFighters) client.run(() => {
      const state = shell();
      for (const command of FOUR_FIGHTERS) applyDeveloperCommand(state, 0, command);

      state.game.stockCount = FOUR_FIGHTER_STOCKS;
      startQuickMatch(state, 0, undefined, Character.demonHunter, FOUR_FIGHTER_STOCKS);
    });
    else if (selection) client.run(() => { if (asksForCpu(script)) addCpuOpponent(shell().game as unknown as Parameters<typeof cycleSlotMode>[0]); });
    else if (script === undefined) client.run(() => {
      applyDeveloperCommand(shell(), 0, QUICK_MATCH);
      if (start === "results") for (const slot of PARTICIPANT_SLOTS) if (isActive(shell().world, slot)) fighterAt(shell().world, slot).status.stocks = 1;
    });
    else clients.everywhere(() => driverCommand?.(script));
    if (start === "select") client.run(() => { shell().controlsGreeted = PARTICIPANT_SLOTS.reduce<number>((greeted, slot) => greeted | 1 << slot, 0); });
    if (start === "select" && chosen !== undefined) {
      const character = Character[chosen as keyof typeof Character];
      if (typeof character !== "number") throw new Error(`--chosen names no fighter: ${chosen}`);
      client.run(() => selectCharacter(shell().game as unknown as Parameters<typeof selectCharacter>[0], 0, character));
    }
    if (!selection && value(() => shell().game.phase) !== Phase.match) throw new Error("standalone match did not start");
    if (driven) clients.everywhere(() => driverCommand?.("resume"));
    const feedPointer = createPointerFeed(clients, 0);
    const feedKeys = createKeyFeed(clients, 0);
    let held = new Set<number>();
    let beat = 0, beatHeld = 0;
    let closed = false;
    let settling = 0;
    return {
      client,
      step(input) {
        if (closed) throw new Error("standalone session is closed");
        let tap = 0;
        if (fourFighters) {
          const [beatTap, hold] = botBeatKeys(++beat);
          if (beatHeld !== hold && beatHeld !== 0) deliverKey(client, 0, beatHeld, 0, false);
          if (beatHeld !== hold && hold !== 0) deliverKey(client, 0, hold, 0, true);
          if (beatTap !== 0) deliverKey(client, 0, beatTap, 0, true);
          beatHeld = hold;
          tap = beatTap;
        } else if (!driven) {
          const now = steps++;
          for (const click of clicks) if (click.step === now) clients.click(0, click.x, click.y);
          if (!scripted && input.pointer !== undefined) feedPointer(input.pointer);
          if (!scripted && input.keys !== undefined) feedKeys(input.keys);
          const next = heldKeys(scripted ? { buttons: presses.filter(press => now >= press.step && now < press.step + 3).map(press => press.button), axisX: 0, axisY: 0 } : input);
          for (const key of held) if (!next.has(key)) deliverKey(client, 0, key, 0, false);
          for (const key of next) if (!held.has(key)) deliverKey(client, 0, key, 0, true);
          held = next;
        }
        clients.frames(1);
        if (start === "select" && ++settling <= SELECT_SETTLE_STEPS) client.run(() => { for (const panel of views(shell()).settings) { panel.endPreview(); if (panel.isOpen()) panel.close(); } });
        if (tap !== 0) deliverKey(client, 0, tap, 0, false);
        for (const current of clients.clients) if (current.errors.length > 0) throw new Error(current.errors.join("\n"));
      },
      checksum: () => value(() => confirmedChecksum(shell())),
      frame: () => value(() => presentation === "pool-predicted" ? drawnFrame(shell()).frame : shell().runtime.simulationFrame),
      digest: () => value(() => ({ frame: shell().runtime.simulationFrame, digest: frameDigest(shell().world, shell().runtime.simulationFrame) })),
      difference: (recorded) => value(() => describeDigestDifference(digestDifference(shell().world, shell().runtime.simulationFrame, recorded))),
      finished: () => value(() => shell().game.phase === Phase.result),
      close() { if (!closed) { closed = true; release(); } },
    };
  } catch (error) {
    release();
    throw error;
  }
}

/** Every model and interface image a match can show on any selectable stage with any selectable fighter, so the native window reads them in, and remasters them, while the player is in the menus. */
export const standalonePreload = () => ({
  preloadModels: [...new Set([DIZZY_MODEL, ...preloadFighterModels(), ...preloadModels(), ...preloadSkies(), ...preloadMatchModels(), ...cueModels(SELECTABLE_CHARACTERS)])],
  preloadTextures: [...new Set([...preloadHudTextures(), ...preloadMenuTextures(), ...preloadFighterTextures()])],
});

export const smashcraftStandalone = (render: StandaloneGame["render"]): StandaloneGame => ({
  title: "Smashcraft",
  render: { ...render, ...standalonePreload() },
  create: createStandaloneSession,
  net: { mapHash: smashcraftMapHash, create: createNetStandalone },
});

const FLAGS = new Set(["--headless", "--four-fighters", "--player-assets-only"]);
const TEXT_OPTIONS = new Set(["--script", "--map", "--out", "--start", "--chosen", "--digests", "--storage"]);

export function standaloneArguments(args: readonly string[], window: "chrome" | "native" = "chrome") {
  let frames: number | undefined;
  let presentation: MapBuild["presentation"] | undefined;
  const flags = new Set<string>(), texts = new Map<string, string>();
  const captureFrames: number[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = String(args[index]);
    if (arg === "--standalone") continue;
    if (FLAGS.has(arg)) { flags.add(arg); continue; }
    if (!TEXT_OPTIONS.has(arg) && arg !== "--frames" && arg !== "--capture-frames" && arg !== "--presentation") throw new Error(`unknown standalone option: ${arg}`);
    const value = args[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
    if (TEXT_OPTIONS.has(arg)) texts.set(arg, value);
    else if (arg === "--presentation") {
      if (value !== "native" && value !== "pool-confirmed" && value !== "pool-predicted") throw new Error("--presentation needs native, pool-confirmed or pool-predicted");
      presentation = value;
    } else if (arg === "--frames") {
      if (!/^\d+$/.test(value) || Number(value) < 1) throw new Error("--frames needs a positive frame count");
      frames = Number(value);
    } else {
      if (!/^\d+(,\d+)*$/.test(value)) throw new Error("--capture-frames needs comma-separated frame numbers");
      captureFrames.push(...value.split(",").map(Number));
    }
  }
  const startOptions = startArguments(texts);
  const script = texts.get("--script"), digests = digestsOf(texts, window), out = texts.get("--out"), map = texts.get("--map"), storage = texts.get("--storage"), headless = flags.has("--headless"), fourFighters = flags.has("--four-fighters");
  if (headless && (frames === undefined || (out === undefined && window === "chrome"))) throw new Error(window === "native" ? "--headless needs --frames N" : "--headless needs --frames N and --out DIR");
  const playerAssets = playerAssetsOf(flags.has("--player-assets-only"), map);
  if (fourFighters && script !== undefined) throw new Error("--four-fighters plays its own inputs; drop --script");
  return { ...(fourFighters ? { fourFighters } : {}), ...(storage === undefined ? {} : { storage }), ...startOptions, ...playerAssets, ...(script === undefined ? {} : { script }), ...digests, ...(presentation === undefined ? {} : { presentation }), ...(out === undefined ? {} : { out }), ...(frames === undefined ? {} : { frames }), headless, ...(captureFrames.length === 0 ? {} : { captureFrames }) };
}

function digestsOf(texts: ReadonlyMap<string, string>, window: "chrome" | "native"): { readonly digests?: string } {
  const digests = texts.get("--digests");
  if (digests !== undefined && window !== "native") throw new Error("--digests is written by the native window; add --window native");
  return digests === undefined ? {} : { digests };
}

function startArguments(texts: ReadonlyMap<string, string>): { readonly start?: StandaloneStart; readonly chosen?: string } {
  const start = texts.get("--start"), chosen = texts.get("--chosen");
  if (start !== undefined && start !== "match" && start !== "select" && start !== "results") throw new Error("--start needs match, select or results");
  if (chosen !== undefined && start !== "select") throw new Error("--chosen needs --start select");
  return { ...(start === undefined ? {} : { start }), ...(chosen === undefined ? {} : { chosen }) };
}

function playerAssetsOf(playerAssetsOnly: boolean, map: string | undefined): { readonly playerAssets?: { readonly map: string } } {
  if (map === undefined) {
    if (playerAssetsOnly) throw new Error("--player-assets-only reads the map's files; add --map MAP.w3x");
    return {};
  }
  if (!playerAssetsOnly) throw new Error("--map is read only with --player-assets-only");
  return { playerAssets: { map } };
}

const NATIVE_GAME_MODULE = join(import.meta.dir, "nativeGame.ts");

export const standalonePlay: Command = (args) => Effect.gen(function*() {
  const { runStandalone, standaloneEmulatedCallsArgument, standaloneNetArguments, standaloneWindowArgument } = yield* Effect.tryPromise({ try: () => import("wisp/scripts/wisp/standalone"), catch: (cause) => new RenderFailure({ cause }) });
  const net = standaloneNetArguments(args);
  if (typeof net === "string") return yield* new UsageFailure({ problem: net });
  const windowed = standaloneWindowArgument(net.rest);
  if (typeof windowed === "string") return yield* new UsageFailure({ problem: windowed });
  const counted = standaloneEmulatedCallsArgument(windowed.rest);
  if (typeof counted === "string") return yield* new UsageFailure({ problem: counted });
  const options = yield* Effect.try({ try: () => standaloneArguments(counted.rest, windowed.window), catch: (cause) => new UsageFailure({ problem: String(cause) }) });
  const { playerAssets, start, chosen, digests, storage, ...run } = options;
  if (windowed.window === "native" && options.fourFighters === true) {
    return yield* new UsageFailure({ problem: "--window native steps Smashcraft's default session; drop --four-fighters or use --window chrome" });
  }
  const game = smashcraftStandalone(playerAssets === undefined ? headlessRender() : yield* playerRender(playerAssets.map).pipe(Effect.mapError((cause) => new RenderFailure({ cause }))));
  const query = new URLSearchParams();
  if (playerAssets !== undefined) query.set("map", playerAssets.map);
  if (options.start !== undefined) query.set("start", options.start);
  if (!options.headless) query.set("save", "1");
  if (chosen !== undefined) query.set("chosen", chosen);
  if (options.presentation !== undefined) query.set("presentation", options.presentation);
  if (digests !== undefined) query.set("digests", digests);
  const nativeModule = query.size === 0 ? NATIVE_GAME_MODULE : `${NATIVE_GAME_MODULE}?${query}`;
  return yield* runStandalone({ ...game, create: (session) => createStandaloneSession({ ...session, ...(options.presentation === undefined ? {} : { presentation: options.presentation }), ...(options.fourFighters === true ? { fourFighters: true } : {}), ...(start === undefined ? {} : { start }), ...(chosen === undefined ? {} : { chosen }) }) }, {
    ...run,
    reforged: storage === undefined ? {} : { storage },
    ...(playerAssets === undefined ? {} : { gpuLease: false }),
    ...(counted.emulatedCalls === undefined ? {} : { emulatedCalls: counted.emulatedCalls }),
    ...(net.net === undefined ? {} : { net: net.net }),
    ...(windowed.window === undefined ? {} : { window: windowed.window }),
    ...(windowed.window === "native" ? { nativeGame: { module: nativeModule, export: "SMASHCRAFT_NATIVE_GAME" } } : {}),
  });
});
