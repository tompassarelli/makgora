import type { StandaloneGame, StandaloneInput, StandaloneSession } from "wisp/scripts/wisp/standalone";
import { join } from "node:path";
import type { MapEntry } from "wisp/src/headless/client";
import { Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { RenderFailure } from "wisp/scripts/wisp/headlessRender";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { describeDigestDifference, digestDifference, frameDigest } from "../../src/game/replay/frameDigest";
import { Action } from "../../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../../src/game/input/keyBindings";
import { Phase } from "../../src/game/lobby/lobbyState";
import { Character } from "../../src/game/sim/codes";
import { NATIVE_DRIVER_BUILD, PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import type { MapBuild } from "../../src/game/session/build";
import { PREDICTED_HEADLESS, SMASHCRAFT_HEADLESS } from "./headless";
import { deliverKey } from "./deliverKey";
import { headlessRender, playerRender } from "./headlessRender";
import { createNetStandalone, smashcraftMapHash } from "./net";

const ACTIONS: Readonly<Record<string, Action>> = {
  attack: Action.attack, special: Action.special, jump: Action.jump,
  grab: Action.grab, shield: Action.leftTrigger, walk: Action.modX,
  left: Action.moveLeft, right: Action.moveRight, up: Action.moveUp, down: Action.moveDown,
  cLeft: Action.cLeft, cRight: Action.cRight,
  cUp: Action.cUp, cDown: Action.cDown,
};
const BINDINGS = presetBindings(DEFAULT_PRESET);
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
    const key = button === "start" ? 89 : button === "view" ? 75 : action === undefined ? undefined : keyFor(BINDINGS, action, 0);
    if (key !== undefined) held.add(key);
  }
  return held;
}






const FOUR_FIGHTERS = ["-dev slots 1 14", "-dev fighter 2 Blademaster", "-dev fighter 3 Illidan", "-dev fighter 4 Warden", "-dev time 2"];
const FOUR_FIGHTER_STOCKS = 99;


/** A script whose first line is this stays on character select instead of starting a match, so a scene check can draw the selection screen. Its other lines are `STEP BUTTON`, which holds that button (attack, special, jump, left and so on) for 3 steps from STEP, and `STEP click X Y`, which clicks at X, Y of Warcraft's 0.8 by 0.6 screen once at STEP; a click on Done closes the controls panel that opens first. */
const SELECTION_SCRIPT = "#! select";

const selectionLines = (script: string) => script.split("\n").map(line => line.trim().split(/\s+/)).filter(([step]) => /^\d+$/.test(step ?? ""));

const selectionPresses = (script: string): readonly { readonly step: number; readonly button: string }[] =>
  selectionLines(script).flatMap(([step, button]) => button !== undefined && ACTIONS[button] !== undefined ? [{ step: Number(step), button }] : []);

const selectionClicks = (script: string): readonly { readonly step: number; readonly x: number; readonly y: number }[] =>
  selectionLines(script).flatMap(([step, verb, x, y]) => verb === "click" ? [{ step: Number(step), x: Number(x), y: Number(y) }] : []);

export async function createStandaloneSession(options: { readonly script?: string; readonly presentation?: MapBuild["presentation"]; readonly fourFighters?: boolean } = {}): Promise<StandaloneSession & { frame(): number; finished(): boolean; digest(): { readonly frame: number; readonly digest: string }; difference(recorded: string): string }> {
  const { script, presentation, fourFighters = false } = options;
  const selection = script?.startsWith(SELECTION_SCRIPT) === true;
  const driven = script !== undefined && !selection;
  const presses = selection ? selectionPresses(script) : [], clicks = selection ? selectionClicks(script) : [];
  let steps = 0;
  const runtime = installHeadless(!driven || presentation === "pool-confirmed" || presentation === "pool-predicted" ? PREDICTED_HEADLESS : SMASHCRAFT_HEADLESS);
  try {

    const platform = join(import.meta.dir, "../../src/platform");
    interface State { readonly game: { readonly phase: number; stockCount: number }; readonly runtime: { readonly simulationFrame: number }; readonly world: Parameters<typeof frameDigest>[0] }
    const { shell }: { shell(): State } = await import(join(platform, "../host/loop/state.ts"));
    const { confirmedChecksum }: { confirmedChecksum(state: State): string } = await import(join(platform, "../host/loop/diagnostics.ts"));
    const { applyDeveloperCommand }: { applyDeveloperCommand(state: State, slot: number, text: string): void } = await import(join(platform, "../host/loop/developerCommands.ts"));
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
    const clients = runtime.clients(driver ?? { install: () => main.install(build), start: () => main.startBuild(build) }, !driven ? [0] : [0, 1], { keepCalls: 0 });
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
    else if (selection) client.run(() => undefined);
    else if (script === undefined) client.run(() => applyDeveloperCommand(shell(), 0, "-dev quick cpu wren expert hero illidan"));
    else clients.everywhere(() => driverCommand?.(script));
    if (!selection && value(() => shell().game.phase) !== Phase.match) throw new Error("standalone match did not start");
    if (driven) clients.everywhere(() => driverCommand?.("resume"));
    let held = new Set<number>();
    let beat = 0, beatHeld = 0;
    let closed = false;
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
          const next = heldKeys(selection ? { buttons: presses.filter(press => now >= press.step && now < press.step + 3).map(press => press.button), axisX: 0, axisY: 0 } : input);
          for (const key of held) if (!next.has(key)) deliverKey(client, 0, key, 0, false);
          for (const key of next) if (!held.has(key)) deliverKey(client, 0, key, 0, true);
          held = next;
        }
        clients.frames(1);
        if (tap !== 0) deliverKey(client, 0, tap, 0, false);
        for (const current of clients.clients) if (current.errors.length > 0) throw new Error(current.errors.join("\n"));
      },
      checksum: () => value(() => confirmedChecksum(shell())),
      frame: () => value(() => presentation === "pool-predicted" ? drawnFrame(shell()).frame : shell().runtime.simulationFrame),
      digest: () => value(() => ({ frame: shell().runtime.simulationFrame, digest: frameDigest(shell().world, shell().runtime.simulationFrame) })),
      difference: (recorded) => value(() => describeDigestDifference(digestDifference(shell().world, shell().runtime.simulationFrame, recorded))),
      finished: () => value(() => shell().game.phase === Phase.result),
      close() { if (!closed) { closed = true; runtime.restore(); } },
    };
  } catch (error) {
    runtime.restore();
    throw error;
  }
}

export const smashcraftStandalone = (render: StandaloneGame["render"]): StandaloneGame => ({
  title: "Smashcraft",
  render: { ...render, preloadModels: ["Abilities\\Spells\\Human\\Thunderclap\\ThunderclapTarget.mdx"] },
  create: createStandaloneSession,
  net: { mapHash: smashcraftMapHash, create: createNetStandalone },
});

const FLAGS = new Set(["--headless", "--four-fighters", "--player-assets-only"]);
const TEXT_OPTIONS = new Set(["--script", "--map", "--out"]);

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
  const script = texts.get("--script"), out = texts.get("--out"), map = texts.get("--map"), headless = flags.has("--headless"), fourFighters = flags.has("--four-fighters");
  if (headless && (frames === undefined || (out === undefined && window === "chrome"))) throw new Error(window === "native" ? "--headless needs --frames N" : "--headless needs --frames N and --out DIR");
  const playerAssets = playerAssetsOf(flags.has("--player-assets-only"), map);
  if (fourFighters && script !== undefined) throw new Error("--four-fighters plays its own inputs; drop --script");
  return { ...(fourFighters ? { fourFighters } : {}), ...playerAssets, ...(script === undefined ? {} : { script }), ...(presentation === undefined ? {} : { presentation }), ...(out === undefined ? {} : { out }), ...(frames === undefined ? {} : { frames }), headless, ...(captureFrames.length === 0 ? {} : { captureFrames }) };
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
  const { runStandalone, standaloneNetArguments, standaloneWindowArgument } = yield* Effect.tryPromise({ try: () => import("wisp/scripts/wisp/standalone"), catch: (cause) => new RenderFailure({ cause }) });
  const net = standaloneNetArguments(args);
  if (typeof net === "string") return yield* new UsageFailure({ problem: net });
  const windowed = standaloneWindowArgument(net.rest);
  if (typeof windowed === "string") return yield* new UsageFailure({ problem: windowed });
  const options = yield* Effect.try({ try: () => standaloneArguments(windowed.rest, windowed.window), catch: (cause) => new UsageFailure({ problem: String(cause) }) });
  const { playerAssets, ...run } = options;
  if (windowed.window === "native" && (options.presentation !== undefined || options.fourFighters === true)) {
    return yield* new UsageFailure({ problem: "--window native steps Smashcraft's default session; drop --presentation and --four-fighters or use --window chrome" });
  }
  const game = smashcraftStandalone(playerAssets === undefined ? headlessRender() : yield* playerRender(playerAssets.map).pipe(Effect.mapError((cause) => new RenderFailure({ cause }))));
  const nativeModule = playerAssets === undefined ? NATIVE_GAME_MODULE : `${NATIVE_GAME_MODULE}?map=${encodeURIComponent(playerAssets.map)}`;
  return yield* runStandalone({ ...game, create: (session) => createStandaloneSession({ ...session, ...(options.presentation === undefined ? {} : { presentation: options.presentation }), ...(options.fourFighters === true ? { fourFighters: true } : {}) }) }, {
    ...run,
    ...(playerAssets === undefined ? {} : { gpuLease: false }),
    ...(net.net === undefined ? {} : { net: net.net }),
    ...(windowed.window === undefined ? {} : { window: windowed.window }),
    ...(windowed.window === "native" ? { nativeGame: { module: nativeModule, export: "SMASHCRAFT_NATIVE_GAME" } } : {}),
  });
});
