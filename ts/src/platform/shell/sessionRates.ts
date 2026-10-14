import { writeLines } from "wisp/src/platform/fileio";
import { floorMod, idiv } from "wisp/src/sim/intMath";
import { Phase } from "../../game/match/rules";
import { sourceVersion } from "../../game/shell/sourceVersion";
import { sessionRatesFile, sessionRatesHeader } from "../../runtime/gameFiles";
import { activeRollback, shellState } from "./state";

declare const os: { readonly clock?: (this: void) => number } | undefined;

type Kind = "trg" | "tmr" | "eff" | "snd" | "frm" | "unit";

const KINDS: readonly Kind[] = ["trg", "tmr", "eff", "snd", "frm", "unit"];

const TICK = "shell.tick";
const DRAW = "shell.draw";
const FALLBACK_TICKS = 60;
const FLUSH_SECONDS = 10;
const SECONDS_PER_FILE = 60;
const TOP_EVENTS = 6;

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
}

declare global {
  var __smashcraftSessionRates: SessionRates | undefined;
  var __smashcraftDispatch: { run: (this: void, name: string) => void } | undefined;
}

const emptySecond = (): Second => ({
  ticks: 0, draws: 0, events: 0, lua: 0, tick: 0, tickMax: 0, sim: 0, spec: 0, conf: 0,
  held: 0, stalled: 0, gap: 0, gapMax: 0, gapSamples: 0, sends: 0, paused: 0, pauses: 0, menus: 0, tickGap: 0,
});

const zeroKinds = (): Record<Kind, number> => ({ trg: 0, tmr: 0, eff: 0, snd: 0, frm: 0, unit: 0 });

const microseconds = (seconds: number): number => Math.floor(seconds * 1000000);

function created<T extends handle>(rates: SessionRates, kind: Kind, value: T): T {
  rates.created[kind]++;
  const id = GetHandleId(value);
  if (id > rates.handleMax) rates.handleMax = id;
  return value;
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
    if (make !== undefined) globals[name] = (...args: unknown[]) => created(rates, make, native(...args) as handle);
    else if (end !== undefined) globals[name] = (...args: unknown[]) => { rates.destroyed[end]++; return native(...args); };
    else if (name === "BlzTriggerRegisterPlayerKeyEvent") globals[name] = (...args: unknown[]) => { rates.keyRegistrations++; rates.registrations++; return native(...args); };
    else if (name.startsWith("TriggerRegister") || name.startsWith("BlzTriggerRegister")) globals[name] = (...args: unknown[]) => { rates.registrations++; return native(...args); };
    else if (name === "TriggerAddAction" || name === "TriggerAddCondition") globals[name] = (...args: unknown[]) => { rates.actions++; return native(...args); };
    else if (name === "BlzSendSyncData") globals[name] = (...args: unknown[]) => { rates.sends++; rates.second.sends++; return native(...args); };
    else if (name === "StopSound") globals[name] = (value: unknown, kill: unknown, fade: unknown) => { if (kill === true) rates.destroyed.snd++; return native(value, kill, fade); };
  }
}

function findClock(): ((this: void) => number) | undefined {
  if (typeof os !== "object" || os === null || typeof os.clock !== "function") return undefined;
  return os.clock;
}

function sampleTick(rates: SessionRates, now: number): void {
  const second = rates.second;
  second.ticks++;
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
  if (rollback === undefined || s.game.phase !== Phase.match) return;
  const { schedule } = rollback;
  const spec = schedule.speculativeFrame();
  const conf = schedule.nextConfirmedFrame();
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
  if (rollback.predictionHeld) second.held++;
  if (rollback.stalled > 0) second.stalled++;
}

function elapsedMs(rates: SessionRates, now: number): number {
  return rates.clock === undefined ? Math.floor(rates.seconds * 1000) : Math.floor((now - rates.started) * 1000);
}

function rateLine(rates: SessionRates, now: number): string {
  const s = shellState();
  const second = rates.second;
  const gap = second.gapSamples === 0 ? 0 : idiv(second.gap, second.gapSamples);
  const tick = second.ticks === 0 ? 0 : idiv(microseconds(second.tick), second.ticks);
  const phase = s === undefined ? -1 : s.game.phase;
  const match = s === undefined ? -1 : s.replay.serial;
  const frame = s === undefined ? -1 : activeRollback(s)?.schedule.speculativeFrame() ?? s.runtime.simulationFrame;
  return `r t=${elapsedMs(rates, now)} cb=${second.ticks} dr=${second.draws} ev=${second.events} sim=${second.sim} spec=${second.spec} conf=${second.conf} held=${second.held} stall=${second.stalled} gap=${gap} gmax=${second.gapMax} lua=${microseconds(second.lua)} tk=${tick} tkmax=${microseconds(second.tickMax)} send=${second.sends} pz=${second.paused} pt=${second.pauses} pm=${second.menus} cbgap=${microseconds(second.tickGap)} ph=${phase} m=${match} f=${frame}`;
}

function countLine(rates: SessionRates, now: number): string {
  const live = KINDS.map(kind => `${kind}=${rates.created[kind] - rates.destroyed[kind]}/${rates.created[kind]}`).join(" ");
  const heap = typeof collectgarbage === "function" ? Math.floor(collectgarbage("count")) : -1;
  return `c t=${elapsedMs(rates, now)} ${live} kreg=${rates.keyRegistrations} reg=${rates.registrations} act=${rates.actions} send=${rates.sends} hid=${rates.handleMax} heap=${heap}`;
}

function eventLine(rates: SessionRates, now: number): string {
  const counts: [string, number][] = [];
  for (const name in rates.named) counts.push([name, rates.named[name] ?? 0]);
  counts.sort((left, right) => right[1] !== left[1] ? right[1] - left[1] : left[0] < right[0] ? -1 : 1);
  rates.named = {};
  return `e t=${elapsedMs(rates, now)} ${counts.slice(0, TOP_EVENTS).map(([name, count]) => `${name}:${count}`).join(" ")} names=${counts.length}`;
}

function flush(rates: SessionRates, now: number): void {
  rates.lines.push(countLine(rates, now), eventLine(rates, now));
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
    sampleTick(rates, now);
  } else if (name === DRAW) second.draws++;
  if (rates.clock === undefined ? second.ticks >= FALLBACK_TICKS : now - rates.secondStarted >= 1) closeSecond(rates, now);
}

export function installSessionRates(build: string): void {
  const clock = findClock();
  const started = clock === undefined ? 0 : clock();
  const rates = globalThis.__smashcraftSessionRates ??= {
    clock, started, secondStarted: started, seconds: 0, load: undefined, build, second: emptySecond(), lines: [], file: 0, named: {},
    epoch: -1, lastSpec: 0, lastConf: 0, lastSim: 0, created: zeroKinds(), destroyed: zeroKinds(),
    keyRegistrations: 0, registrations: 0, actions: 0, sends: 0, handleMax: 0, wrapped: false, wasPaused: false, wasMenu: false, lastTick: started,
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
