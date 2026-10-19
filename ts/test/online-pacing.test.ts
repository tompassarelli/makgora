import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { MEASURED_BATTLE_NET, MEASURED_TURN_BURSTS, turnBursts } from "wisp/src/headless/syncChannel";
import { CALLBACK_MS } from "wisp/src/headless/syncChannel";
import { Random } from "wisp/src/headless/random";
import { ACTION_ORDER } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { MAX_INPUT_DELAY } from "../src/game/netcode/fixedSchedule";
import { DEFAULT_DELAY } from "../src/game/netcode/delayPolicy";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../src/game/replay/limits";
import { install, startBuild } from "../src/platform/main";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { POP_UNITS } from "../src/host/loop/netDelay";
import { RATES_RECORD_CHARS, installSessionRates } from "../src/host/loop/sessionRates";
import { activeRollback, shellState } from "../src/host/loop/state";
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
const BURSTS_PER_SECOND = { min: 36, max: 42 };

interface Outage {
  readonly fromMs: number;
  readonly toMs: number;
}

interface Limits {
  readonly sim: number;
  readonly held: number;
  readonly stall: number;
  readonly gmax: number;
  readonly delay: number;
  readonly minDelay: number;
  readonly driftEnd: number;
  readonly driftPeak: number;
  readonly popP50: number;
  readonly popP95: number;
}

interface Route {
  readonly name: string;
  readonly rttMs: number;
  readonly outages: readonly Outage[];
  readonly humans: readonly number[];
  readonly computer: boolean;
  readonly limits: Limits;
  readonly forcedDelay?: number;
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

function relayDelivery(route: Route, seed: number, matchStartMs: () => number | undefined): SyncDelivery & { readonly senders: ReadonlyMap<number, { readonly baseMs: number }> } {
  const senders = new Map<number, { readonly random: Random; readonly baseMs: number; lastMs: number }>();
  return {
    senders,
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

function maskAt(frames: readonly number[], frame: number): number {
  return frame < 0 ? 0 : frames[frame % frames.length] ?? 0;
}

function pressRecorded(clients: Lockstep, held: readonly number[][], frame: number): void {
  held.forEach((frames, client) => {
    const before = maskAt(frames, frame - 1);
    const now = maskAt(frames, frame);
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
  readonly cb: number;
  readonly delay: number;
  readonly ping: number;
  readonly sim: number;
  readonly spec: number;
  readonly held: number;
  readonly stall: number;
  readonly gap: number;
  readonly gmax: number;
  readonly worstSim: number;
  readonly late: Readonly<Record<number, number>>;
  readonly lmax: Readonly<Record<number, number>>;
  readonly echo: number;
  readonly echoMax: number;
  readonly rb: number;
  readonly rbf: number;
  readonly rbd: number;
  readonly pop: number;
  readonly popOver: number;
  readonly popP50: number;
  readonly popP95: number;
  readonly bur: number;
  readonly hrun: number;
  readonly drift: number;
  readonly driftEnd: number;
  readonly botHit: number;
  readonly botMiss: number;
  readonly alloc: number;
  readonly sf: number;
}

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const tenths = (value: number): number => Math.round(value * 10) / 10;

function quantile(counts: readonly number[], percent: number): number {
  const total = counts.reduce((sum, count) => sum + count, 0);
  let seen = 0;
  for (let pop = 0; pop < counts.length; pop++) {
    seen += counts[pop] ?? 0;
    if (seen * 100 >= total * percent) return pop;
  }
  return -1;
}

function pacing(lines: readonly string[], senders: readonly number[], pops: readonly number[]): Pacing {
  const match = parseSessionRates(lines).seconds.filter(second => second.ph === Phase.match).slice(2, -1);
  const field = (name: string) => match.map(second => second[name] ?? 0);
  const present = (name: string) => match.flatMap(second => second[name] === undefined ? [] : [second[name] ?? 0]);
  const perSender = (prefix: string, reduce: (values: readonly number[]) => number) => Object.fromEntries(senders.map(slot => [slot, reduce(present(`${prefix}P${slot + 1}`))]));
  return {
    seconds: match.length,
    cb: tenths(mean(field("cb"))),
    delay: Math.max(...field("dl"), -1),
    ping: tenths(mean(field("ping"))),
    sim: tenths(mean(field("sim"))),
    spec: tenths(mean(field("spec"))),
    held: tenths(mean(field("held"))),
    stall: tenths(mean(field("stall"))),
    gap: tenths(mean(field("gap"))),
    gmax: Math.max(...field("gmax")),
    worstSim: Math.min(...field("sim")),
    late: perSender("late", values => tenths(mean(values))),
    lmax: perSender("lmax", values => Math.max(...values, -1)),
    echo: tenths(mean(field("echo"))),
    echoMax: Math.max(...field("echoMax"), -1),
    rb: tenths(mean(field("rb"))),
    rbf: tenths(mean(field("rbf"))),
    rbd: Math.max(...field("rbd"), -1),
    pop: Math.max(...field("pop"), -1),
    popOver: tenths(mean(field("popOver"))),
    popP50: quantile(pops, 50),
    popP95: quantile(pops, 95),
    bur: tenths(mean(field("bur"))),
    hrun: Math.max(...field("hrun"), -1),
    drift: Math.max(...field("drift"), -1),
    driftEnd: match.at(-1)?.drift ?? -1,
    botHit: field("botHit").reduce((sum, value) => sum + value, 0),
    botMiss: field("botMiss").reduce((sum, value) => sum + value, 0),
    alloc: tenths(mean(field("alloc"))),
    sf: field("sf").reduce((sum, value) => sum + value, 0),
  };
}

interface Screen {
  readonly pictures: number;
  readonly steps: readonly number[];
  readonly jerk: number;
  readonly presses: number;
  readonly lostPresses: number;
  readonly sampleLagMs: number;
}

interface Sampling {
  presses: number;
  lost: number;
  lag: number[];
}

function sampleGroup(held: readonly number[][], from: number, to: number, dueMs: number, timeMs: (input: number) => number, sampling: readonly Sampling[]): void {
  held.forEach((frames, client) => {
    const seen = sampling[client];
    if (seen === undefined || to <= from) return;
    const start = maskAt(frames, from - 1);
    const end = maskAt(frames, to - 1);
    for (let input = from; input < to; input++) {
      const pressed = maskAt(frames, input) & ~maskAt(frames, input - 1);
      if (pressed === 0) continue;
      for (let bits = pressed; bits !== 0; bits &= bits - 1) seen.presses++;
      seen.lag.push(dueMs - timeMs(input));
    }
    for (let bits = end & ~start; bits !== 0; bits &= bits - 1) seen.lost--;
    for (let input = from; input < to; input++) for (let bits = maskAt(frames, input) & ~maskAt(frames, input - 1); bits !== 0; bits &= bits - 1) seen.lost++;
  });
}

interface Played {
  readonly clients: readonly Pacing[];
  readonly screens: readonly Screen[];
  readonly baseMs: ReadonlyMap<number, number>;
}

function play(route: Route, seed: number): Played {
  const HUMANS = route.humans;
  let matchStart: number | undefined;
  let wallFrame = 0;
  const delivery = relayDelivery(route, seed, () => matchStart);
  const callbacks = turnBursts(MEASURED_TURN_BURSTS, seed);
  const clients = headless.clients({ install, start: () => { startBuild(BUILD); installSessionRates(BUILD.id); } }, HUMANS, { delivery, callbacks });
  clients.start();
  clients.frames(MENU_FRAMES);
  wallFrame += MENU_FRAMES;
  if (route.forcedDelay !== undefined) clients.chat(0, `-dev delay ${route.forcedDelay}`);
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
  const base = clients.frame;
  const inputMs = (input: number) => (base + input + 1) * CALLBACK_MS;
  const sampling: Sampling[] = HUMANS.map(() => ({ presses: 0, lost: 0, lag: [] }));
  const pictures = HUMANS.map(() => ({ sim: -1, wallMs: 0, steps: [0, 0, 0, 0], errors: [] as number[] }));
  let applied = 0;
  for (let frame = 0; frame < MATCH_FRAMES; frame++) {
    const dueMs = callbacks.wallMs(clients.frame + 1);
    const from = applied;
    while (applied < MATCH_FRAMES && inputMs(applied) <= dueMs + 1e-6) pressRecorded(clients, held, applied++);
    sampleGroup(held, from, applied, dueMs, inputMs, sampling);
    clients.frames(1);
    if (callbacks.wallMs(clients.frame + 1) > dueMs) HUMANS.forEach((_, index) => clients.clients[index]?.run(() => {
      const picture = pictures[index];
      const s = shellState();
      const sim = s === undefined ? 0 : activeRollback(s)?.schedule.speculativeFrame() ?? s.runtime.simulationFrame;
      if (picture === undefined) return;
      if (picture.sim >= 0 && frame >= 120) {
        const step = sim - picture.sim;
        const bucket = Math.min(3, Math.max(0, step));
        picture.steps[bucket] = (picture.steps[bucket] ?? 0) + 1;
        picture.errors.push(step - (dueMs - picture.wallMs) / CALLBACK_MS);
      }
      picture.sim = sim;
      picture.wallMs = dueMs;
    }));
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
  const measured = HUMANS.map((slot, index) => {
    const files = clients.clients[index]?.files ?? new Map<string, string[]>();
    const lines = [...files.entries()].filter(([name]) => name.startsWith("smashcraft-rates-")).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, rows]) => rows);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(RATES_RECORD_CHARS);
    let pops: readonly number[] = [];
    clients.clients[index]?.run(() => {
      const s = shellState();
      pops = [...(s === undefined ? [] : activeRollback(s)?.net.popCounts ?? [])];
    });
    return pacing(lines, HUMANS.filter(other => other !== slot), pops);
  });
  const screens = pictures.map((picture, index): Screen => {
    const count = picture.steps.reduce((sum, value) => sum + value, 0);
    const seen = sampling[index] ?? { presses: 0, lost: 0, lag: [] };
    return {
      pictures: count,
      steps: picture.steps.map(value => Math.round((value / Math.max(1, count)) * 1000) / 1000),
      jerk: Math.round(Math.sqrt(mean(picture.errors.map(error => error * error))) * 100) / 100,
      presses: seen.presses,
      lostPresses: seen.lost,
      sampleLagMs: tenths(mean(seen.lag)),
    };
  });
  return { clients: measured, screens, baseMs: new Map([...delivery.senders].map(([sender, state]) => [sender, state.baseMs])) };
}

const POP_P50_UNITS = 2;
const POP_P95_UNITS = 250;
const OUTAGE_POP_P50_UNITS = 96;
const OUTAGE_POP_P95_UNITS = 835;
const FORCED_POP_P50_UNITS = 76;
const FORCED_POP_P95_UNITS = 680;
const THREE = [0, 2, 3];
const TWO = [0, 1];
const STEADY: Limits = { sim: 59, held: 2, stall: 2, gmax: REPLAY_MAX_CORRECTION_FRAMES - 1, delay: MAX_INPUT_DELAY, minDelay: DEFAULT_DELAY, driftEnd: 0, driftPeak: 0, popP50: POP_P50_UNITS, popP95: POP_P95_UNITS };
const LEAN: Limits = { ...STEADY, delay: 6, minDelay: 6 };
const DUEL: Limits = { ...STEADY, delay: 5, minDelay: 5 };
const OUTAGE: Limits = { sim: 59, held: 15, stall: 12, gmax: 45, delay: MAX_INPUT_DELAY, minDelay: DEFAULT_DELAY, driftEnd: 16, driftPeak: 60, popP50: OUTAGE_POP_P50_UNITS, popP95: OUTAGE_POP_P95_UNITS };
const FORCED: Limits = { sim: 59, held: 4, stall: 3, gmax: 30, delay: 8, minDelay: 8, driftEnd: 2, driftPeak: 4, popP50: FORCED_POP_P50_UNITS, popP95: FORCED_POP_P95_UNITS };
const ROUTES: readonly Route[] = [
  { name: "three humans and a computer, 300 ms round trip with Battle.net turn jitter", rttMs: 300, outages: [], humans: THREE, computer: true, limits: LEAN },
  { name: "three humans and a computer, 600 ms round trip with Battle.net turn jitter", rttMs: 600, outages: [], humans: THREE, computer: true, limits: STEADY },
  { name: "three humans and a computer, 600 ms round trip with Battle.net turn jitter at a forced 8-frame delay", rttMs: 600, outages: [], humans: THREE, computer: true, limits: FORCED, forcedDelay: 8 },
  { name: "three humans and a computer, match 793 profile: 920 ms round trip, turn jitter and a 1 s relay outage", rttMs: 920, outages: [{ fromMs: 21000, toMs: 22000 }], humans: THREE, computer: true, limits: OUTAGE },
  { name: "two humans and a computer, 160 ms round trip with Battle.net turn jitter", rttMs: 160, outages: [], humans: TWO, computer: true, limits: STEADY },
  { name: "two humans and a computer, 300 ms round trip with Battle.net turn jitter", rttMs: 300, outages: [], humans: TWO, computer: true, limits: DUEL },
];

for (const route of ROUTES) {
  sweep(`${route.name}: the recorded match-793 inputs keep Auto delay, sim, holds, stalls, peak gap and median and p95 correction pop within the route's limits, with each sender's lateness following its link and no drift without an outage [k3 measure #14]`, () => {
    const played = play(route, 793);
    const measured = played.clients;
    measured.forEach((client, index) => console.log(`online pacing ${route.name}, human ${route.humans[index]}: ${JSON.stringify({ ...client, screen: played.screens[index] })}`));
    for (const client of measured) {
      expect(client.seconds).toBeGreaterThan(20);
      expect(client.sim).toBeGreaterThanOrEqual(route.limits.sim);
      expect(client.held).toBeLessThanOrEqual(route.limits.held);
      expect(client.stall).toBeLessThanOrEqual(route.limits.stall);
      expect(client.gmax).toBeLessThanOrEqual(route.limits.gmax);
      expect(client.delay).toBeLessThanOrEqual(route.limits.delay);
      expect(client.delay).toBeGreaterThanOrEqual(route.limits.minDelay);
      expect(client.sf).toBe(0);
      expect(client.echo).toBeGreaterThan(0);
      expect(client.rb).toBeGreaterThan(0);
      expect(client.rbd).toBeLessThanOrEqual(client.gmax + 1);
      expect(client.bur).toBeGreaterThanOrEqual(BURSTS_PER_SECOND.min);
      expect(client.bur).toBeLessThanOrEqual(BURSTS_PER_SECOND.max);
      expect(client.botHit + client.botMiss).toBeGreaterThan(0);
      expect(client.driftEnd).toBeLessThanOrEqual(route.limits.driftEnd);
      expect(client.drift).toBeLessThanOrEqual(route.limits.driftPeak);
      expect(client.pop).toBeGreaterThan(POP_UNITS);
      expect(client.popP50).toBeLessThanOrEqual(route.limits.popP50);
      expect(client.popP95).toBeLessThanOrEqual(route.limits.popP95);
    }
    if (route.outages.length === 0) measured.forEach((client, index) => {
      const own = route.humans[index] ?? -1;
      const senders = route.humans.filter(slot => slot !== own);
      for (const sender of senders) expect(client.late[sender]).toBeDefined();
      for (const [a, b] of senders.flatMap(a => senders.map(b => [a, b] as const)).filter(([a, b]) => a < b)) {
        const configured = ((played.baseMs.get(a) ?? 0) - (played.baseMs.get(b) ?? 0)) / CALLBACK_MS;
        expect(Math.abs((client.late[a] ?? 0) - (client.late[b] ?? 0) - configured)).toBeLessThanOrEqual(1);
      }
    });
  }, 600_000);
}
