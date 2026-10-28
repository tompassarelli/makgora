import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { Random } from "wisp/src/headless/random";
import { CALLBACK_MS, MEASURED_BATTLE_NET, MEASURED_TURN_BURSTS, turnBursts } from "wisp/src/headless/syncChannel";
import { ACTION_ORDER } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { MAX_INPUT_DELAY } from "../src/game/netcode/fixedSchedule";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { install, startBuild } from "../src/platform/main";
import { installSessionRates } from "../src/host/loop/sessionRates";
import { shellState } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { type Fields, parseSessionRates } from "../scripts/wisp/sessionRates";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
type Lockstep = ReturnType<typeof headless.clients>;

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-online-rollback", devConsole: true };
const DEEPEST_ROLLBACK = 8;
const HUMANS = [0, 1];
const SENDER_SPREAD_PERCENT = [85, 100, 115];
const MENU_FRAMES = 480;
const LOBBY_FRAMES = 600;
const SEED = 793;

interface Link {
  readonly rttMs: number;
  readonly spike?: { readonly atMs: number; readonly rttMs: number };
}

function turnsFor(random: Random): number {
  let rest = random.next();
  const turns = MEASURED_BATTLE_NET.extraTurns;
  for (let extra = 0; extra < turns.length - 1; extra++) {
    rest -= turns[extra] ?? 0;
    if (rest <= 0) return extra;
  }
  return turns.length - 1;
}

function battleNetDelivery(link: Link, matchStartMs: () => number | undefined): SyncDelivery {
  const senders = new Map<number, { readonly random: Random; readonly percent: number; lastMs: number }>();
  return {
    arrivalFrame: (sender, frame) => {
      let state = senders.get(sender);
      if (state === undefined) {
        state = { random: new Random(SEED * 7919 + sender * 104729 + 1), percent: SENDER_SPREAD_PERCENT[senders.size % SENDER_SPREAD_PERCENT.length] ?? 100, lastMs: 0 };
        senders.set(sender, state);
      }
      const sentMs = frame * CALLBACK_MS;
      const start = matchStartMs();
      const rttMs = link.spike !== undefined && start !== undefined && sentMs >= start + link.spike.atMs ? link.spike.rttMs : link.rttMs;
      const arrivalMs = Math.max(state.lastMs, sentMs + Math.round((rttMs * state.percent) / 200) + turnsFor(state.random) * MEASURED_BATTLE_NET.turnMs);
      state.lastMs = arrivalMs;
      return Math.max(frame + 1, Math.ceil(arrivalMs / CALLBACK_MS - 1e-9));
    },
  };
}

function recordedHeld(): number[][] {
  const lines = readFileSync(join(import.meta.dir, "fixtures/bnet-793-held.txt"), "utf8").trim().split("\n").slice(1);
  return lines.map(line => line.split(" ").slice(1).flatMap(run => {
    const [mask, count] = run.split("*").map(Number);
    return Array.from({ length: count ?? 0 }, () => mask ?? 0);
  }));
}

const KEYS = presetBindings(DEFAULT_PRESET);
const maskAt = (frames: readonly number[], frame: number): number => frame < 0 ? 0 : frames[frame % frames.length] ?? 0;

function pressRecorded(clients: Lockstep, held: readonly number[][], frame: number): void {
  held.forEach((frames, client) => {
    const before = maskAt(frames, frame - 1);
    const now = maskAt(frames, frame);
    for (const action of ACTION_ORDER) {
      const bit = 1 << action;
      if ((before & bit) === (now & bit)) continue;
      const key = keyFor(KEYS, action, 0);
      if (key !== undefined) clients.key(client, key, 0, (now & bit) !== 0);
    }
  });
}

function play(link: Link, matchFrames: number): Fields[][] {
  let matchStart: number | undefined;
  const callbacks = turnBursts(MEASURED_TURN_BURSTS, SEED);
  const clients = headless.clients({ install, start: () => { startBuild(BUILD); installSessionRates(BUILD.id); } }, HUMANS, {
    delivery: battleNetDelivery(link, () => matchStart), callbacks,
  });
  clients.start();
  clients.frames(MENU_FRAMES);
  clients.chat(0, "-dev quick cpu wren expert");
  const phase = () => {
    let shown = -1;
    clients.clients[0]?.run(() => { shown = shellState()?.game.phase ?? -1; });
    return shown;
  };
  for (let frame = 0; frame < LOBBY_FRAMES && phase() !== Phase.match; frame++) clients.frames(1);
  expect(phase()).toBe(Phase.match);
  matchStart = (clients.frame + 30) * CALLBACK_MS;
  const held = recordedHeld().slice(0, HUMANS.length);
  const base = clients.frame;
  const checksums = HUMANS.map(() => new Map<number, string>());
  let applied = 0;
  for (let frame = 0; frame < matchFrames; frame++) {
    const dueMs = callbacks.wallMs(clients.frame + 1);
    while (applied < matchFrames && (base + applied + 1) * CALLBACK_MS <= dueMs + 1e-6) pressRecorded(clients, held, applied++);
    clients.frames(1);
    if (frame % 120 === 119) HUMANS.forEach((_, index) => clients.clients[index]?.run(() => {
      const s = shellState();
      if (s !== undefined) checksums[index]?.set(s.runtime.simulationFrame, confirmedChecksum(s));
    }));
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  for (const [frame, checksum] of checksums[0] ?? []) for (const other of checksums.slice(1)) expect(other.get(frame) ?? checksum).toBe(checksum);
  return HUMANS.map((_, index) => {
    const files = clients.clients[index]?.files ?? new Map<string, string[]>();
    const lines = [...files.entries()].filter(([name]) => name.startsWith("smashcraft-rates-")).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, rows]) => rows);
    return parseSessionRates(lines).seconds.filter(second => second.ph === Phase.match).slice(1, -1);
  });
}

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const field = (seconds: readonly Fields[], name: string): number[] => seconds.map(second => second[name] ?? 0);

test("two humans and a computer on Battle.net turn jitter at a 500 ms round trip roll back at most 8 frames every second, and the agreed delay covers the rest within its ceiling with under one held callback a second [k3 measure #679]", () => {
  for (const seconds of play({ rttMs: 500 }, 1800)) {
    expect(seconds.length).toBeGreaterThan(18);
    expect(Math.max(...field(seconds, "rbd"))).toBeLessThanOrEqual(DEEPEST_ROLLBACK);
    expect(Math.max(...field(seconds, "dl"))).toBeLessThanOrEqual(MAX_INPUT_DELAY);
    expect(mean(field(seconds, "held"))).toBeLessThan(1);
    expect(mean(field(seconds, "sim"))).toBeGreaterThanOrEqual(59);
    expect(field(seconds, "sf").every(failed => failed === 0)).toBe(true);
  }
}, 120_000);

test("a round trip that jumps from 160 ms to 500 ms mid-match raises the agreed delay by the second after prediction first holds, and no rollback exceeds 8 frames [k3 measure #679]", () => {
  for (const seconds of play({ rttMs: 160, spike: { atMs: 12_000, rttMs: 500 } }, 1500)) {
    expect(Math.max(...field(seconds, "rbd"))).toBeLessThanOrEqual(DEEPEST_ROLLBACK);
    const delays = field(seconds, "dl");
    const settled = delays[9] ?? -1;
    const holding = seconds.findIndex((second, index) => index > 10 && (second.held ?? 0) > 0);
    const raised = delays.findIndex((delay, index) => index > 10 && delay > settled);
    expect(holding).toBeGreaterThan(10);
    expect(raised).toBeGreaterThan(10);
    expect(raised - holding).toBeLessThanOrEqual(1);
    expect(Math.max(...delays)).toBeGreaterThan(settled);
  }
}, 120_000);
