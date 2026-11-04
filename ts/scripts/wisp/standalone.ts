import type { StandaloneInput, StandaloneSession } from "wisp/scripts/wisp/standalone";
import type { MapEntry } from "wisp/src/headless/client";
import { createKeyFeed } from "wisp/src/headless/keyInput";
import { createPointerFeed } from "wisp/src/headless/pointer";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { nativeDeclarations } from "./nativeDeclarations";
import { customMapData } from "wisp/scripts/wisp/headlessInput";
import { describeDigestDifference, digestDifference, frameDigest } from "../../src/game/replay/frameDigest";
import { PARTICIPANT_SLOTS } from "../../src/game/input/participants";
import { Phase, cycleSlotMode } from "../../src/game/lobby/lobbyState";
import { selectCharacter, selectCpuCharacter } from "../../src/game/lobby/characterChoice";
import { setCpuOpponent, setCpuTier, setStocks } from "../../src/game/lobby/matchRules";

import { fighterAt, isActive } from "../../src/game/sim/roster";
import { Character } from "../../src/game/sim/codes";
import { type StageTile } from "../../src/game/menu/stageCatalog";
import { NATIVE_DRIVER_BUILD, PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import type { MapBuild } from "../../src/game/session/build";
import { QUICK_TRAINING_COMMAND } from "../../src/game/session/devSettings";
import { PREDICTED_HEADLESS, MAKGORA_HEADLESS } from "./headless";
import { deliverKey } from "./deliverKey";
import { CPU_OPPONENT, SELECTION_SCRIPT, selectionPointer, selectionPresses } from "./selectionScript";
import { heldKeys, scriptedKeys } from "./standaloneKeys";
import { type StandaloneStart } from "./standaloneArguments";

export const NEUTRAL_INPUT: StandaloneInput = { buttons: [], axisX: 0, axisY: 0 };

const FOUR_FIGHTERS = ["-dev slots 1 14", "-dev fighter 2 Blademaster", "-dev fighter 3 Illidan", "-dev fighter 4 Warden", "-dev time 2"];
const FOUR_FIGHTER_STOCKS = 99;

const offersPrompt = (start: StandaloneStart, savedFiles: string | undefined, tutorialOffer: boolean): boolean => tutorialOffer && (start !== "select" || savedFiles !== undefined);

const clientOptions = (savedFiles: string | undefined) => savedFiles === undefined ? { keepCalls: 0 } : { keepCalls: 0, files: () => customMapData(savedFiles) };

const OPPONENT_SLOT = 1;

const asksForCpu = (script: string | undefined): boolean => script?.startsWith(SELECTION_SCRIPT) === true && script.split("\n", 1)[0]?.split(/\s+/).includes(CPU_OPPONENT) === true;

function addCpuOpponent(game: Parameters<typeof cycleSlotMode>[0]): void {
  cycleSlotMode(game, 0, OPPONENT_SLOT);
  cycleSlotMode(game, 0, OPPONENT_SLOT);
  setCpuOpponent(game, 0, OPPONENT_SLOT, "wren");
  setCpuTier(game, 0, OPPONENT_SLOT, "warchief");
  selectCpuCharacter(game, 0, OPPONENT_SLOT, Character.demonHunter);
  setStocks(game, 0, 1);
}

const QUICK_MATCH = "-dev quick cpu wren warchief hero illidan";
const SELECT_SETTLE_STEPS = 30;

export interface StandaloneSessionOptions {
  readonly script?: string;
  readonly presentation?: MapBuild["presentation"];
  readonly fourFighters?: boolean;
  /** The four-fighter match's stage; the first tile when absent. */
  readonly stage?: StageTile;
  /** Runs the last this many frames again after each step, as a rollback match at that many frames of delay does; the `rollback` stage times it. */
  readonly rollback?: number;
  readonly start?: StandaloneStart;
  readonly chosen?: string;
  readonly savedFiles?: string;
  /** Whether a first-time player is offered the tutorial on character select; `--no-tutorial-offer` turns it off so a live window opens on the menu with nothing in front. */
  readonly tutorialOffer?: boolean;
  readonly devCommands?: readonly string[];
}

export async function createStandaloneSession(options: StandaloneSessionOptions = {}): Promise<StandaloneSession & { frame(): number; finished(): boolean; digest(): { readonly frame: number; readonly digest: string }; difference(recorded: string): string; replayed(): number }> {
  const { script, presentation, fourFighters = false, stage = 0, rollback = 0, start = "match", chosen, savedFiles, tutorialOffer = true, devCommands = [] } = options;
  const scripted = script?.startsWith(SELECTION_SCRIPT) === true;
  const selection = scripted || start === "select";
  const driven = script !== undefined && !scripted;
  const presses = scripted ? selectionPresses(script) : [];
  const pointer = scripted ? selectionPointer(script) : undefined;
  let steps = 0;
  const runtime = installHeadless(!driven || presentation === "pool-confirmed" || presentation === "pool-predicted" ? PREDICTED_HEADLESS : MAKGORA_HEADLESS, nativeDeclarations());
  let restoreTutorialOffers = (): void => {};
  const release = (): void => { restoreTutorialOffers(); runtime.restore(); };
  try {

    interface State { controlsGreeted?: number; readonly game: { readonly phase: number; stockCount: number }; readonly runtime: { readonly simulationFrame: number }; readonly world: Parameters<typeof frameDigest>[0] & Parameters<typeof isActive>[0] }
    const { shell }: { shell(): State } = await import("../../src/host/loop/state");
    const { confirmedChecksum }: { confirmedChecksum(state: State): string } = await import("../../src/host/loop/diagnostics");
    const { applyDeveloperCommand }: { applyDeveloperCommand(state: State, slot: number, text: string): void } = await import("../../src/host/loop/developerCommands");
    const { views }: { views(state: State): { readonly settings: readonly { endPreview(): void; isOpen(): boolean; close(): void }[] } } = await import("../../src/host/loop/ui");
    const { tutorialOffers }: { tutorialOffers: { enabled: boolean } } = await import("../../src/game/ui/tutorialMenu");
    const offersBefore = tutorialOffers.enabled;
    restoreTutorialOffers = () => { tutorialOffers.enabled = offersBefore; };
    tutorialOffers.enabled = offersPrompt(start, savedFiles, tutorialOffer);
    const { drawnFrame }: { drawnFrame(state: State): { readonly frame: number } } = await import("../../src/host/loop/drawnFrame");
    const { botBeatKeys }: { botBeatKeys(frame: number): readonly [tap: number, held: number] } = await import("./botMatch");
    const { startQuickMatch }: { startQuickMatch(state: State, stage: number, scenario: undefined, character: Character | undefined, stocks: number): void } = await import("../../src/host/loop/menus");
    const { createForcedReplay, replayLatest }: { createForcedReplay(depth: number): object; replayLatest(replay: object, state: State): number } = await import("../../src/host/loop/forcedReplay");
    const build = { ...PLAYABLE_BUILD, devConsole: true, ...(presentation === undefined ? {} : { presentation }) };
    const main: { install(build: MapBuild): void; startBuild(build: MapBuild): void } = await import("../../src/platform/main");
    const driverApi: { nativeDriverCommand(text: string): void; installMakgoraNativeDriver(): void; startMakgoraNativeDriver(): void } | undefined = !driven ? undefined : await import("../../src/platform/nativeDriver");
    const driverBuild = { ...NATIVE_DRIVER_BUILD, ...(presentation === undefined ? {} : { presentation }) };
    const driver: MapEntry | undefined = !driven ? undefined : presentation === undefined ? await import("../../src/host/entries/nativeDriverMain") : {
      install() { main.install(driverBuild); driverApi?.installMakgoraNativeDriver(); },
      start() { main.startBuild(driverBuild); driverApi?.installMakgoraNativeDriver(); driverApi?.startMakgoraNativeDriver(); },
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
      startQuickMatch(state, stage, undefined, Character.demonHunter, FOUR_FIGHTER_STOCKS);
    });
    else if (selection) client.run(() => { if (asksForCpu(script)) addCpuOpponent(shell().game as unknown as Parameters<typeof cycleSlotMode>[0]); });
    else if (script === undefined) client.run(() => {
      devCommands.forEach(command => applyDeveloperCommand(shell(), 0, `-dev ${command}`));
      applyDeveloperCommand(shell(), 0, start === "training" ? QUICK_TRAINING_COMMAND : QUICK_MATCH);
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
    const replay = rollback > 0 ? createForcedReplay(rollback) : undefined;
    let simMs = 0, rollbackMs = 0, replayed = 0;
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
          const reading = pointer?.(now);
          if (reading !== undefined) feedPointer(reading);
          if (!scripted && input.pointer !== undefined) feedPointer(input.pointer);
          if (!scripted && input.keys !== undefined) feedKeys(input.keys);
          const next = scripted ? scriptedKeys(presses.filter(press => now >= press.step && now < press.step + 3).map(press => press.button)) : heldKeys(input);
          for (const key of held) if (!next.has(key)) deliverKey(client, 0, key, 0, false);
          for (const key of next) if (!held.has(key)) deliverKey(client, 0, key, 0, true);
          held = next;
        }
        const simStart = performance.now();
        clients.frames(1);
        const rollbackStart = performance.now();
        simMs = rollbackStart - simStart;
        if (replay !== undefined) {
          let ran = 0;
          client.run(() => { ran = replayLatest(replay, shell()); });
          if (ran < 0) throw new Error("forced replay could not run a kept frame again");
          replayed += ran;
        }
        rollbackMs = replay === undefined ? 0 : performance.now() - rollbackStart;
        if (start === "select" && ++settling <= SELECT_SETTLE_STEPS) client.run(() => { for (const panel of views(shell()).settings) { panel.endPreview(); if (panel.isOpen()) panel.close(); } });
        if (tap !== 0) deliverKey(client, 0, tap, 0, false);
        for (const current of clients.clients) if (current.errors.length > 0) throw new Error(current.errors.join("\n"));
      },
      checksum: () => value(() => confirmedChecksum(shell())),
      frame: () => value(() => presentation === "pool-predicted" ? drawnFrame(shell()).frame : shell().runtime.simulationFrame),
      digest: () => value(() => ({ frame: shell().runtime.simulationFrame, digest: frameDigest(shell().world, shell().runtime.simulationFrame) })),
      difference: (recorded) => value(() => describeDigestDifference(digestDifference(shell().world, shell().runtime.simulationFrame, recorded))),
      finished: () => value(() => shell().game.phase === Phase.result),
      stages: () => ({ sim: simMs, rollback: rollbackMs }),
      replayed: () => replayed,
      close() { if (!closed) { closed = true; release(); } },
    };
  } catch (error) {
    release();
    throw error;
  }
}
