import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { MEASURED_BATTLE_NET } from "wisp/src/headless/syncChannel";
import { CALLBACK_MS } from "wisp/src/headless/syncChannel";
import { Random } from "wisp/src/headless/random";
import { ACTION_ORDER } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../src/game/replay/limits";
import { install, startBuild } from "../src/platform/main";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { installSessionRates } from "../src/host/loop/sessionRates";
import { shellState } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { parseSessionRates } from "../scripts/wisp/sessionRates";
import { testHeadless } from "./headless";
import { sweep } from "./sweep";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
type Lockstep = ReturnType<typeof headless.clients>;

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-online-pacing", devConsole: true };
const MENU_FRAMES = 480;
const LOBBY_FRAMES = 600;
const MATCH_FRAMES = 2400;
const SENDER_SPREAD_PERCENT = [85, 100, 115];

interface Outage {
  readonly fromMs: number;
  readonly toMs: number;
}

interface Limits {
  readonly sim: number;
  readonly held: number;
  readonly stall: number;
  readonly gmax: number;
}

interface Route {
  readonly name: string;
  readonly rttMs: number;
  readonly outages: readonly Outage[];
  readonly humans: readonly number[];
  readonly computer: boolean;
  readonly limits: Limits;
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

function relayDelivery(route: Route, seed: number, matchStartMs: () => number | undefined): SyncDelivery {
  const senders = new Map<number, { readonly random: Random; readonly baseMs: number; lastMs: number }>();
  return {
    arrivalFrame: (sender, frame) => {
      let state = senders.get(sender);
      if (state === undefined) {
        const spread = SENDER_SPREAD_PERCENT[senders.size % SENDER_SPREAD_PERCENT.length] ?? 100;
        state = { random: new Random(seed * 7919 + sender * 104729 + 1), baseMs: Math.round((route.rttMs * spread) / 200), lastMs: 0 };
        senders.set(sender, state);
      }
      const sentMs = frame * CALLBACK_MS;
      let arrivalMs = Math.max(state.lastMs, sentMs + state.baseMs + turnsFor(state.random) * MEASURED_BATTLE_NET.turnMs);
      const start = matchStartMs();
      if (start !== undefined) {
        for (const outage of route.outages) {
          if (arrivalMs >= start + outage.fromMs && arrivalMs < start + outage.toMs) arrivalMs = start + outage.toMs;
        }
      }
      state.lastMs = arrivalMs;
      return Math.max(frame + 1, Math.ceil(arrivalMs / CALLBACK_MS - 1e-9));
    },
  };
}

function recordedHeld(): number[][] {
  const lines = readFileSync(join(import.meta.dir, "fixtures/bnet-793-held.txt"), "utf8").trim().split("\n").slice(1);
  return lines.map(line => {
    const frames: number[] = [];
    for (const run of line.split(" ").slice(1)) {
      const [mask, count] = run.split("*").map(Number);
      for (let index = 0; index < (count ?? 0); index++) frames.push(mask ?? 0);
    }
    return frames;
  });
}

const KEYS = presetBindings(DEFAULT_PRESET);

function pressRecorded(clients: Lockstep, held: readonly number[][], frame: number): void {
  held.forEach((frames, client) => {
    const before = frame === 0 ? 0 : frames[(frame - 1) % frames.length] ?? 0;
    const now = frames[frame % frames.length] ?? 0;
    if (before === now) return;
    for (const action of ACTION_ORDER) {
      const bit = 1 << action;
      if ((before & bit) === (now & bit)) continue;
      const key = keyFor(KEYS, action, 0);
      if (key !== undefined) clients.key(client, key, 0, (now & bit) !== 0);
    }
  });
}

interface Pacing {
  readonly seconds: number;
  readonly delay: number;
  readonly ping: number;
  readonly sim: number;
  readonly spec: number;
  readonly held: number;
  readonly stall: number;
  readonly gap: number;
  readonly gmax: number;
  readonly worstSim: number;
  readonly late: number;
  readonly lmax: number;
}

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const tenths = (value: number): number => Math.round(value * 10) / 10;

function pacing(lines: readonly string[]): Pacing {
  const match = parseSessionRates(lines).seconds.filter(second => second.ph === Phase.match).slice(2, -1);
  const field = (name: string) => match.map(second => second[name] ?? 0);
  return {
    seconds: match.length,
    delay: Math.max(...field("dl"), -1),
    ping: tenths(mean(field("ping"))),
    sim: tenths(mean(field("sim"))),
    spec: tenths(mean(field("spec"))),
    held: tenths(mean(field("held"))),
    stall: tenths(mean(field("stall"))),
    gap: tenths(mean(field("gap"))),
    gmax: Math.max(...field("gmax")),
    worstSim: Math.min(...field("sim")),
    late: tenths(mean(field("late"))),
    lmax: Math.max(...field("lmax"), -1),
  };
}

function play(route: Route, seed: number): Pacing[] {
  const HUMANS = route.humans;
  let matchStart: number | undefined;
  let wallFrame = 0;
  const clients = headless.clients({ install, start: () => { startBuild(BUILD); installSessionRates(BUILD.id); } }, HUMANS, { delivery: relayDelivery(route, seed, () => matchStart) });
  clients.start();
  clients.frames(MENU_FRAMES);
  wallFrame += MENU_FRAMES;
  clients.chat(0, route.computer ? "-dev quick cpu wren expert" : "-dev quick");
  const phaseOf = (index: number) => {
    let phase = -1;
    clients.clients[index]?.run(() => { phase = shellState()?.game.phase ?? -1; });
    return phase;
  };
  for (let frame = 0; frame < LOBBY_FRAMES && phaseOf(0) !== Phase.match; frame++) {
    clients.frames(1);
    wallFrame++;
  }
  matchStart = (wallFrame + 30) * CALLBACK_MS;
  const held = recordedHeld().slice(0, HUMANS.length);
  const checksums = HUMANS.map(() => new Map<number, string>());
  for (let frame = 0; frame < MATCH_FRAMES; frame++) {
    pressRecorded(clients, held, frame);
    clients.frames(1);
    if (frame % 120 !== 119) continue;
    HUMANS.forEach((_, index) => clients.clients[index]?.run(() => {
      const s = shellState();
      if (s !== undefined) checksums[index]?.set(s.runtime.simulationFrame, confirmedChecksum(s));
    }));
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  for (const [frame, checksum] of checksums[0] ?? []) {
    for (const other of checksums.slice(1)) {
      const seen = other.get(frame);
      if (seen !== undefined && seen !== checksum) throw new Error(`confirmed frame ${frame} differs between clients`);
    }
  }
  return HUMANS.map((_, index) => {
    const files = clients.clients[index]?.files ?? new Map<string, string[]>();
    const lines = [...files.entries()].filter(([name]) => name.startsWith("smashcraft-rates-")).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, rows]) => rows);
    return pacing(lines);
  });
}

const THREE = [0, 2, 3];
const TWO = [0, 1];
const STEADY: Limits = { sim: 59, held: 2, stall: 2, gmax: REPLAY_MAX_CORRECTION_FRAMES - 1 };
const OUTAGE: Limits = { sim: 55, held: 7, stall: 5, gmax: REPLAY_MAX_CORRECTION_FRAMES + 12 };
const ROUTES: readonly Route[] = [
  { name: "three humans and a computer, 300 ms round trip with Battle.net turn jitter", rttMs: 300, outages: [], humans: THREE, computer: true, limits: STEADY },
  { name: "three humans and a computer, 600 ms round trip with Battle.net turn jitter", rttMs: 600, outages: [], humans: THREE, computer: true, limits: STEADY },
  { name: "three humans and a computer, match 793 profile: 920 ms round trip, turn jitter and a 1 s relay outage", rttMs: 920, outages: [{ fromMs: 21000, toMs: 22000 }], humans: THREE, computer: true, limits: OUTAGE },
  { name: "two humans and a computer, 160 ms round trip with Battle.net turn jitter", rttMs: 160, outages: [], humans: TWO, computer: true, limits: STEADY },
];

for (const route of ROUTES) {
  sweep(`${route.name}: the recorded match-793 inputs keep sim, holds, stalls and peak gap per second within the route's limits [k3 measure #14]`, () => {
    const measured = play(route, 793);
    measured.forEach((client, index) => console.log(`online pacing ${route.name}, human ${route.humans[index]}: ${JSON.stringify(client)}`));
    for (const client of measured) {
      expect(client.seconds).toBeGreaterThan(20);
      expect(client.sim).toBeGreaterThanOrEqual(route.limits.sim);
      expect(client.held).toBeLessThanOrEqual(route.limits.held);
      expect(client.stall).toBeLessThanOrEqual(route.limits.stall);
      expect(client.gmax).toBeLessThanOrEqual(route.limits.gmax);
    }
  }, 600_000);
}
