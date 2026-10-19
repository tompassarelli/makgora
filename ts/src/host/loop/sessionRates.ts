import { writeLines } from "wisp/src/platform/fileio";
import { floorMod, idiv } from "wisp/src/sim/intMath";
import { Phase } from "../../game/lobby/lobbyState";
import { sourceVersion } from "../../game/shell/sourceVersion";
import { sessionRatesFile, sessionRatesHeader } from "../../game/core/gameFiles";
import { smoothedRttMs } from "../../game/netcode/delayPolicy";
import { takeNetRates } from "./netDelay";
import { type Rollback, activeRollback, shellState } from "./state";

declare const os: { readonly clock?: (this: void) => number } | undefined;

type Kind = "trg" | "tmr" | "eff" | "snd" | "frm" | "unit";

const KINDS: readonly Kind[] = ["trg", "tmr", "eff", "snd", "frm", "unit"];

const TICK = "shell.tick";
const DRAW = "shell.draw";
const INPUT = "shell.input";
const FALLBACK_TICKS = 60;
const FLUSH_SECONDS = 10;
const SECONDS_PER_FILE = 60;
const TOP_EVENTS = 6;
const TOP_EFFECTS = 6;
const TOP_SOUNDS = 3;
const MAX_NAME = 20;
const BURST_IDLE_US = 2000;

interface Second {
  ticks: number;
  draws: number;
  events: number;
  lua: number;
  tick: number;
  tickMax: number;
  sim: number;
  spec: number;
  conf: number;
  held: number;
  stalled: number;
  gap: number;
  gapMax: number;
  gapSamples: number;
  sends: number;
  paused: number;
  pauses: number;
  menus: number;
  tickGap: number;
  received: number;
  receivedOwn: number;
  bursts: number;
  heldRun: number;
  sendFailed: number;
}

interface SessionRates {
  clock: ((this: void) => number) | undefined;
  started: number;
  secondStarted: number;
  seconds: number;
  load: string | undefined;
  build: string;
  second: Second;
  lines: string[];
  file: number;
  named: Record<string, number>;
  epoch: number;
  lastSpec: number;
  lastConf: number;
  lastSim: number;
  created: Record<Kind, number>;
  destroyed: Record<Kind, number>;
  keyRegistrations: number;
  registrations: number;
  actions: number;
  sends: number;
  handleMax: number;
  wrapped: boolean;
  wasPaused: boolean;
  wasMenu: boolean;
  lastTick: number;
  heldRun: number;
  driftEpoch: number;
  driftCallbacks: number;
  driftBase: number;
  drift: number;
  botRepeated: number;
  botRerun: number;
  heap: number;
  tags: Record<number, string | undefined>;
  live: Record<string, number>;
  shortNames: Record<string, string>;
}

declare global {
  var __smashcraftSessionRates: SessionRates | undefined;
  var __smashcraftDispatch: { run: (this: void, name: string) => void } | undefined;
}

const emptySecond = (): Second => ({
  ticks: 0, draws: 0, events: 0, lua: 0, tick: 0, tickMax: 0, sim: 0, spec: 0, conf: 0,
  held: 0, stalled: 0, gap: 0, gapMax: 0, gapSamples: 0, sends: 0, paused: 0, pauses: 0, menus: 0, tickGap: 0, received: 0, receivedOwn: 0,
  bursts: 0, heldRun: 0, sendFailed: 0,
});

const zeroKinds = (): Record<Kind, number> => ({ trg: 0, tmr: 0, eff: 0, snd: 0, frm: 0, unit: 0 });

const microseconds = (seconds: number): number => Math.floor(seconds * 1000000);

function shortName(rates: SessionRates, path: unknown): string {
  if (typeof path !== "string") return "?";
  const known = rates.shortNames[path];
  if (known !== undefined) return known;
  const file = path.split("\\").join("/").split("/").at(-1) ?? path;
  const dot = file.indexOf(".");
  const name = (dot > 0 ? file.slice(0, dot) : file).split(" ").join("_").slice(0, MAX_NAME);
  rates.shortNames[path] = name;
  return name;
}

function tagFor(rates: SessionRates, kind: Kind, source: unknown): string | undefined {
  if (kind === "eff" || kind === "snd") return `${kind === "eff" ? "e" : "s"}:${shortName(rates, source)}`;
  if (kind === "unit") return `u:p${source === undefined ? "?" : GetPlayerId(source as player)}`;
  return undefined;
}

function created<T extends handle>(rates: SessionRates, kind: Kind, value: T, source: unknown): T {
  rates.created[kind]++;
  const id = GetHandleId(value);
  if (id > rates.handleMax) rates.handleMax = id;
  const tag = tagFor(rates, kind, source);
  if (tag !== undefined && id !== 0) {
    const previous = rates.tags[id];
    if (previous !== undefined) rates.live[previous] = (rates.live[previous] ?? 1) - 1;
    rates.tags[id] = tag;
    rates.live[tag] = (rates.live[tag] ?? 0) + 1;
  }
  return value;
}

function released(rates: SessionRates, kind: Kind, value: unknown): void {
  rates.destroyed[kind]++;
  if (kind !== "eff" && kind !== "snd" && kind !== "unit") return;
  const id = GetHandleId(value as handle);
  const tag = rates.tags[id];
  if (tag === undefined) return;
  rates.tags[id] = undefined;
  rates.live[tag] = (rates.live[tag] ?? 1) - 1;
}

const gameSpeeds = (): readonly gamespeed[] => [MAP_SPEED_SLOWEST, MAP_SPEED_SLOW, MAP_SPEED_NORMAL, MAP_SPEED_FAST, MAP_SPEED_FASTEST];

function gameSpeed(): string {
  const speed = GetGameSpeed();
  return `gs=${gameSpeeds().indexOf(speed)}`;
}

function wrapNatives(rates: SessionRates): void {
  const globals = globalThis as Record<string, unknown>;
  // Only in Lua: a JavaScript host swaps one client's natives in and out of the shared global object.
  if (rates.wrapped || typeof globals._VERSION !== "string") return;
  rates.wrapped = true;
  const kinds: Record<string, Kind> = {
    CreateTrigger: "trg", CreateTimer: "tmr", AddSpecialEffect: "eff", AddSpecialEffectLoc: "eff", AddSpecialEffectTarget: "eff",
    CreateSound: "snd", CreateSoundFromLabel: "snd", BlzCreateFrame: "frm", BlzCreateSimpleFrame: "frm", BlzCreateFrameByType: "frm", CreateUnit: "unit",
  };
  const ends: Record<string, Kind> = { DestroyTrigger: "trg", DestroyTimer: "tmr", DestroyEffect: "eff", KillSoundWhenDone: "snd", BlzDestroyFrame: "frm", RemoveUnit: "unit" };
  const names: string[] = [];
  for (const name in globals) if (typeof globals[name] === "function") names.push(name);
  for (const name of names) {
    const native = globals[name] as (this: void, ...args: unknown[]) => unknown;
    const make = kinds[name];
    const end = ends[name];
    if (make === "unit") globals[name] = (...args: unknown[]) => created(rates, make, native(...args) as handle, args[0]);
    else if (make !== undefined) globals[name] = (...args: unknown[]) => created(rates, make, native(...args) as handle, make === "eff" || make === "snd" ? args[0] : undefined);
    else if (end !== undefined) globals[name] = (value: unknown) => { released(rates, end, value); return native(value); };
    else if (name === "BlzTriggerRegisterPlayerKeyEvent") globals[name] = (...args: unknown[]) => { rates.keyRegistrations++; rates.registrations++; return native(...args); };
    else if (name.startsWith("TriggerRegister") || name.startsWith("BlzTriggerRegister")) globals[name] = (...args: unknown[]) => { rates.registrations++; return native(...args); };
    else if (name === "TriggerAddAction" || name === "TriggerAddCondition") globals[name] = (...args: unknown[]) => { rates.actions++; return native(...args); };
    else if (name === "BlzSendSyncData") globals[name] = (...args: unknown[]) => {
      rates.sends++;
      rates.second.sends++;
      const sent = native(...args);
      if (sent === false) rates.second.sendFailed++;
      return sent;
    };
    else if (name === "StopSound") globals[name] = (value: unknown, kill: unknown, fade: unknown) => { if (kill === true) released(rates, "snd", value); return native(value, kill, fade); };
  }
}

function findClock(): ((this: void) => number) | undefined {
  if (typeof os !== "object" || os === null || typeof os.clock !== "function") return undefined;
  return os.clock;
}

function sampleTick(rates: SessionRates, now: number, start: number): void {
  const second = rates.second;
  second.ticks++;
  if (rates.clock !== undefined && microseconds(start - rates.lastTick) >= BURST_IDLE_US) second.bursts++;
  if (now - rates.lastTick > second.tickGap) second.tickGap = now - rates.lastTick;
  rates.lastTick = now;
  const s = shellState();
  if (s === undefined) return;
  const paused = s.session.paused;
  const menu = s.pauseMenu?.shown === true;
  if (paused) second.paused++;
  if (paused !== rates.wasPaused) second.pauses++;
  if (menu !== rates.wasMenu) second.menus++;
  rates.wasPaused = paused;
  rates.wasMenu = menu;
  const sim = s.runtime.simulationFrame;
  if (sim > rates.lastSim) second.sim += sim - rates.lastSim;
  rates.lastSim = sim;
  const rollback = activeRollback(s);
  if (rollback === undefined || s.game.phase !== Phase.match) rates.heldRun = 0;
  else sampleMatch(rates, rollback, paused);
}

function sampleDrift(rates: SessionRates, epoch: number, spec: number, paused: boolean): void {
  if (epoch !== rates.driftEpoch) {
    rates.driftEpoch = epoch;
    rates.driftCallbacks = 0;
    rates.driftBase = spec;
  } else if (!paused) rates.driftCallbacks++;
  rates.drift = rates.driftCallbacks - (spec - rates.driftBase);
}

function sampleHeld(rates: SessionRates, held: boolean): void {
  if (!held) {
    rates.heldRun = 0;
    return;
  }
  rates.second.held++;
  rates.heldRun++;
  if (rates.heldRun > rates.second.heldRun) rates.second.heldRun = rates.heldRun;
}

function sampleMatch(rates: SessionRates, rollback: Rollback, paused: boolean): void {
  const second = rates.second;
  const { schedule } = rollback;
  const spec = schedule.speculativeFrame();
  const conf = schedule.nextConfirmedFrame();
  sampleDrift(rates, rollback.epoch, spec, paused);
  if (rollback.epoch === rates.epoch) {
    if (spec > rates.lastSpec) second.spec += spec - rates.lastSpec;
    if (conf > rates.lastConf) second.conf += conf - rates.lastConf;
  }
  rates.epoch = rollback.epoch;
  rates.lastSpec = spec;
  rates.lastConf = conf;
  const gap = spec - conf;
  second.gap += gap;
  second.gapSamples++;
  if (gap > second.gapMax) second.gapMax = gap;
  sampleHeld(rates, rollback.predictionHeld);
  if (rollback.stalled > 0) second.stalled++;
}

function elapsedMs(rates: SessionRates, now: number): number {
  return rates.clock === undefined ? Math.floor(rates.seconds * 1000) : Math.floor((now - rates.started) * 1000);
}

function botLine(rates: SessionRates, rollback: Rollback): string {
  const repeated = rollback.playback.repeatedComputerDecisions();
  const rerun = rollback.playback.rerunComputerDecisions();
  const text = `bot=${repeated - rates.botRepeated}/${rerun - rates.botRerun}`;
  rates.botRepeated = repeated;
  rates.botRerun = rerun;
  return text;
}

function heapGrowth(rates: SessionRates): number {
  if (typeof collectgarbage !== "function") return 0;
  const heap = Math.floor(collectgarbage("count"));
  const grown = rates.heap < 0 ? 0 : heap - rates.heap;
  rates.heap = heap;
  return grown;
}

function rateLine(rates: SessionRates, now: number): string {
  const s = shellState();
  const second = rates.second;
  const gap = second.gapSamples === 0 ? 0 : idiv(second.gap, second.gapSamples);
  const tick = second.ticks === 0 ? 0 : idiv(microseconds(second.tick), second.ticks);
  const phase = s === undefined ? -1 : s.game.phase;
  const match = s === undefined ? -1 : s.replay.serial;
  const rollback = s === undefined ? undefined : activeRollback(s);
  const frame = s === undefined ? -1 : rollback?.schedule.speculativeFrame() ?? s.runtime.simulationFrame;
  const window = rollback === undefined ? "" : ` cf=${rollback.schedule.nextConfirmedFrame()} kn=${rollback.schedule.knownThrough()} win=${rollback.window} dl=${rollback.delay} ping=${smoothedRttMs(rollback.net.estimate)} drift=${rates.drift} ${botLine(rates, rollback)} ${takeNetRates(rollback.net)}`;
  return `r t=${elapsedMs(rates, now)} cb=${second.ticks} dr=${second.draws} ev=${second.events} sim=${second.sim} spec=${second.spec} conf=${second.conf} held=${second.held} stall=${second.stalled} gap=${gap} gmax=${second.gapMax} lua=${microseconds(second.lua)} tk=${tick} tkmax=${microseconds(second.tickMax)} send=${second.sends} recv=${second.received} rown=${second.receivedOwn} pz=${second.paused} pt=${second.pauses} pm=${second.menus} cbgap=${microseconds(second.tickGap)} bur=${second.bursts} hrun=${second.heldRun} sf=${second.sendFailed} alloc=${heapGrowth(rates)} ${gameSpeed()} ph=${phase} m=${match} f=${frame}${window}`;
}

function countLine(rates: SessionRates, now: number): string {
  const live = KINDS.map(kind => `${kind}=${rates.created[kind] - rates.destroyed[kind]}/${rates.created[kind]}`).join(" ");
  const heap = typeof collectgarbage === "function" ? Math.floor(collectgarbage("count")) : -1;
  return `c t=${elapsedMs(rates, now)} ${live} kreg=${rates.keyRegistrations} reg=${rates.registrations} act=${rates.actions} send=${rates.sends} hid=${rates.handleMax} heap=${heap}`;
}

interface Row {
  name: string;
  count: number;
}

interface Top {
  kept: Row[];
  rows: number;
}

const ranksBefore = (count: number, name: string, other: Row): boolean =>
  count !== other.count ? count > other.count : name < other.name;

function offer(top: Top, limit: number, name: string, count: number): void {
  top.rows++;
  let at = top.kept.length;
  while (at > 0) {
    const other = top.kept[at - 1];
    if (other === undefined || !ranksBefore(count, name, other)) break;
    at--;
  }
  if (at >= limit) return;
  top.kept.splice(at, 0, { name, count });
  if (top.kept.length > limit) top.kept.pop();
}

const emptyTop = (): Top => ({ kept: [], rows: 0 });

const topText = (top: Top, from: number, separator: string): string =>
  top.kept.map((row) => `${row.name.slice(from)}:${row.count}`).join(separator);

function eventLine(rates: SessionRates, now: number): string {
  const top = emptyTop();
  for (const name in rates.named) offer(top, TOP_EVENTS, name, rates.named[name] ?? 0);
  rates.named = {};
  return `e t=${elapsedMs(rates, now)} ${topText(top, 0, " ")} names=${top.rows}`;
}

function liveLines(rates: SessionRates, now: number): readonly string[] {
  const effects = emptyTop();
  const sounds = emptyTop();
  const units: string[] = [];
  for (const tag in rates.live) {
    const count = rates.live[tag] ?? 0;
    if (count === 0) continue;
    if (tag.startsWith("e:")) offer(effects, TOP_EFFECTS, tag, count);
    else if (tag.startsWith("s:")) offer(sounds, TOP_SOUNDS, tag, count);
    else units.push(`${tag.slice(2)}:${count}`);
  }
  units.sort();
  const t = elapsedMs(rates, now);
  return [`l t=${t} models=${effects.rows} eff=${topText(effects, 2, ",")}`, `s t=${t} files=${sounds.rows} snd=${topText(sounds, 2, ",")} unit=${units.join(",")}`];
}

function flush(rates: SessionRates, now: number): void {
  rates.lines.push(countLine(rates, now), eventLine(rates, now), ...liveLines(rates, now));
  const load = rates.load ??= `${globalThis.__smashcraftMatchSerial ?? 0}-${microseconds(rates.started)}`;
  writeLines(sessionRatesFile(load, rates.file), [sessionRatesHeader(load, rates.file, rates.build, sourceVersion(), rates.clock !== undefined), ...rates.lines]);
  if (rates.seconds - rates.file * SECONDS_PER_FILE < SECONDS_PER_FILE) return;
  rates.file++;
  rates.lines = [];
}

function closeSecond(rates: SessionRates, now: number): void {
  rates.seconds++;
  rates.lines.push(rateLine(rates, now));
  rates.second = emptySecond();
  rates.secondStarted = now;
  if (floorMod(rates.seconds, FLUSH_SECONDS) === 0) flush(rates, now);
}

function account(rates: SessionRates, name: string, spent: number, now: number): void {
  const second = rates.second;
  second.events++;
  second.lua += spent;
  rates.named[name] = (rates.named[name] ?? 0) + 1;
  if (name === TICK) {
    second.tick += spent;
    if (spent > second.tickMax) second.tickMax = spent;
    sampleTick(rates, now, now - spent);
  } else if (name === DRAW) second.draws++;
  else if (name === INPUT) {
    second.received++;
    if (GetTriggerPlayer() === GetLocalPlayer()) second.receivedOwn++;
  }
  if (rates.clock === undefined ? second.ticks >= FALLBACK_TICKS : now - rates.secondStarted >= 1) closeSecond(rates, now);
}

export function installSessionRates(build: string): void {
  const clock = findClock();
  const started = clock === undefined ? 0 : clock();
  const rates = globalThis.__smashcraftSessionRates ??= {
    clock, started, secondStarted: started, seconds: 0, load: undefined, build, second: emptySecond(), lines: [], file: 0, named: {},
    epoch: -1, lastSpec: 0, lastConf: 0, lastSim: 0, created: zeroKinds(), destroyed: zeroKinds(),
    keyRegistrations: 0, registrations: 0, actions: 0, sends: 0, handleMax: 0, wrapped: false, wasPaused: false, wasMenu: false, lastTick: started,
    heldRun: 0, driftEpoch: -1, driftCallbacks: 0, driftBase: 0, drift: 0, botRepeated: 0, botRerun: 0, heap: -1,
    tags: {}, live: {}, shortNames: {},
  };
  wrapNatives(rates);
  const table = globalThis.__smashcraftDispatch;
  if (table === undefined) return;
  const plain = table.run;
  const read = rates.clock;
  table.run = read === undefined
    ? (name: string) => {
      plain(name);
      account(rates, name, 0, 0);
    }
    : (name: string) => {
      const before = read();
      plain(name);
      const after = read();
      account(rates, name, after - before, after);
    };
}
