import { expect } from "bun:test";
import { readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { testHeadless } from "./headless";
import { type SyncLatency, syncDelivery } from "wisp/src/headless/syncChannel";
import type { HeadlessClient, SyncMessage } from "wisp/src/headless/client";
import { Phase } from "../src/game/lobby/lobbyState";
import { Character } from "../src/game/sim/codes";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { Key } from "../src/host/loop/keyEvents";
import { panelActions } from "../src/host/loop/menus";
import { shell } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { sweep } from "./sweep";
import { passStartControls } from "../scripts/wisp/startControls";

const extraTurns = Array.from({ length: 24 }, (_, turns) => 0.75 ** turns);
const BOT_SESSION_LATENCY: SyncLatency = { latencyMs: 80, turnMs: 25, extraTurns: extraTurns.map((weight) => weight / extraTurns.reduce((sum, each) => sum + each, 0)) };
const CATCH_UP_CALLBACKS = 10;
const B_SLOWER = 6;
const STALL_FRAMES = 120;
const STALLS = [360, 840, 1320];
const AFTER_STALLS = 600;
const SEEDS = [11, 12, 13, 14];

const declarations = readNativeDeclarations();
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this test compares confirmed state"]));
const headless = testHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged }, declarations);

interface LockstepFrames {
  frame: number;
  readonly inFlight: { readonly arrival: number; readonly message: SyncMessage }[];
  flush(): void;
}

function playSeed(seed: number): void {
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  let now = 0;
  helpers.clock = () => now;
  const network = syncDelivery(BOT_SESSION_LATENCY, seed);
  let slower = 0;
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: { arrivalFrame: (sender, frame, message) => network.arrivalFrame(sender, frame, message) + (sender === 1 ? slower : 0) } });
  const lockstep = clients as unknown as LockstepFrames;
  const host = clients.clients[0] as HeadlessClient;
  const read = <T>(client: HeadlessClient, body: () => T): T => {
    let value: T | undefined;
    client.run(() => {
      value = body();
    });
    return value as T;
  };
  const phase = () => read(host, () => shell().game.phase);
  const confirmed = () => clients.clients.map((client) => read(client, () => shell().runtime.simulationFrame));

  const stopped = new Set<number>();
  const owed = [0, 0];
  const tick = () => {
    now++;
    lockstep.frame++;
    if (stopped.size === 0) {
      while ((lockstep.inFlight[0]?.arrival ?? Infinity) <= lockstep.frame) {
        const due = lockstep.inFlight.shift();
        if (due !== undefined) for (const client of clients.clients) client.deliverSync(due.message);
      }
    }
    const runs = clients.clients.map((_, index) => {
      if (stopped.has(index)) {
        owed[index] = (owed[index] ?? 0) + 1;
        return 0;
      }
      const run = 1 + Math.min(owed[index] ?? 0, CATCH_UP_CALLBACKS);
      owed[index] = (owed[index] ?? 0) - (run - 1);
      return run;
    });
    for (let round = 0; round < Math.max(...runs); round++) {
      clients.clients.forEach((client, index) => {
        if (round < (runs[index] ?? 0)) client.step();
      });
    }
    lockstep.flush();
    helpers.service(clients);
  };
  const until = (what: string, done: () => boolean, limit: number) => {
    for (let frame = 0; frame < limit && !done(); frame++) tick();
    if (!done()) throw new Error(`seed ${seed}: ${what} not reached; phase ${phase()}, confirmed ${confirmed().join(" ")}`);
  };

  clients.start();
  for (let frame = 0; frame < 30; frame++) tick();
  passStartControls(clients, (count) => {
    for (let frame = 0; frame < count; frame++) tick();
  });
  for (let click = 0; click < 2; click++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  clients.everywhere(() => panelActions().selection.selectCpuChoice(0, 2, Character.rifleman));
  clients.everywhere(() => {
    while (shell().game.stockCount < 9) panelActions().selection.changeStocks(0, 1);
  });
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  for (let frame = 0; frame < 60; frame++) tick();
  clients.press(0, Key.y);
  until("stage menu", () => phase() === Phase.stageMenu, 120);
  clients.press(0, Key.y);
  until("match", () => phase() === Phase.match, 120);
  until("journaling", () => (helpers.journaled(0) ?? 0) > 0 && (helpers.journaled(1) ?? 0) > 0, 60);
  slower = B_SLOWER;

  for (const stall of STALLS) {
    until("stall", () => (helpers.journaled(1) ?? 0) >= stall, 2 * STALL_FRAMES * STALLS.length + stall);
    stopped.add(1);
    helpers.silent.add(1);
    for (let frame = 0; frame < STALL_FRAMES; frame++) tick();
    stopped.clear();
    helpers.silent.clear();
  }
  const resumed = helpers.journaled(1) ?? 0;
  until(`both clients confirming ${AFTER_STALLS} frames past the last stall`, () => confirmed().every((frame) => frame >= resumed + AFTER_STALLS), 2 * AFTER_STALLS);
  until("one confirmed frame on both clients", () => new Set(confirmed()).size === 1, 60);
  const checksums = clients.clients.map((client) => read(client, () => confirmedChecksum(shell())));
  expect(checksums[0]).toBe(checksums[1] as string);
  expect(phase()).toBe(Phase.match);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}

sweep("after three 2 s stalls of the slower client, both clients keep confirming the same frames on every network seed [k1 scenario]", () => {
  for (const seed of SEEDS) playSeed(seed);
}, 120_000);
