import { floorMod } from "wisp/src/sim/intMath";
import { callbackClockFile } from "../../game/core/gameFiles";
import { osKeyDown } from "../../platform/osKeys";
import { RATES_RECORD_CHARS } from "./sessionRates";
import { KEY_DOWN, KEY_UP } from "./keyEvents";
import { DRAW_EVENT, burstAlpha, drawnAlpha } from "./betweenFrames";
import { activeRollback, shellState } from "./state";
import { createTimer, destroyTimer, localElapsed, startTimer, Timer } from "wisp/game/clock";
import { displayText } from "wisp/game/frames";
import { eventKey } from "wisp/game/input";
import { eventPlayer, localPlayer, playerSlot } from "wisp/game/players";
import { addFileLine, clearFileLines, endFile, startFile } from "wisp/game/files";
declare const os: { readonly clock?: (this: void) => number } | undefined;

const TICK = "shell.tick";
const MAX_CALLBACKS = 36000;
const ROLLBACK_EVERY = 600;
const MAX_EVENTS = 6000;
const BURST_GAP = 0.001953125;

interface Burst {
  last: number;
  game: number;
  alpha: number;
  drawn: number;
  draws: number;
  ticks: number;
}

interface CallbackClock {
  readonly run: number;
  readonly key: number;
  readonly limit: number;
  readonly gameClock: Timer;
  readonly records: string[];
  readonly rollbacks: string[];
  readonly events: string[];
  readonly bursts: string[];
  readonly burst: Burst;
  record: string;
  burstRecord: string;
  callbacks: number;
  last: number;
  down: boolean;
}

let runs = 0;
let active: CallbackClock | undefined;

const microseconds = (seconds: number): number => Math.floor(seconds * 1000000);
const permille = (fraction: number): number => Math.floor(fraction * 1000);

function sample(probe: CallbackClock, now: number): void {
  const down = osKeyDown(probe.key);
  const delta = microseconds(now - probe.last);
  const token = probe.callbacks === 0 ? `${microseconds(now)}` : `${delta}${down !== probe.down ? "*" : ""}`;
  if (probe.record.length + 1 + token.length > RATES_RECORD_CHARS) {
    probe.records.push(probe.record);
    probe.record = `k ${probe.callbacks}`;
  }
  probe.record += ` ${token}`;
  probe.last = now;
  probe.down = down;
  probe.callbacks++;
  if (floorMod(probe.callbacks, ROLLBACK_EVERY) === 0) noteRollbacks(probe, now);
  if (probe.callbacks >= probe.limit) finish(probe);
}

function closeBurst(probe: CallbackClock): void {
  const { burst } = probe;
  const token = `${microseconds(burst.last)},${microseconds(burst.game)},${permille(burst.alpha)},${permille(burst.drawn)},${burst.draws},${burst.ticks}`;
  if (probe.burstRecord.length + 1 + token.length > RATES_RECORD_CHARS) {
    probe.bursts.push(probe.burstRecord);
    probe.burstRecord = "b";
  }
  probe.burstRecord += ` ${token}`;
  burst.draws = 0;
  burst.ticks = 0;
}

function noteBurst(probe: CallbackClock, now: number, draw: boolean): void {
  const { burst } = probe;
  if (burst.last > 0 && now - burst.last > BURST_GAP) closeBurst(probe);
  burst.last = now;
  burst.game = localElapsed(probe.gameClock);
  burst.alpha = burstAlpha();
  burst.drawn = drawnAlpha();
  if (draw) burst.draws++;
  else burst.ticks++;
}

function noteRollbacks(probe: CallbackClock, now: number): void {
  const s = shellState();
  const rollback = s === undefined ? undefined : activeRollback(s);
  if (rollback === undefined) return;
  const { net, schedule } = rollback;
  probe.rollbacks.push(`r ${probe.callbacks} t=${microseconds(now)} f=${schedule.nextSpeculative} cf=${schedule.nextConfirmed} dl=${rollback.delay} rb=${net.corrections} rbf=${net.replayed} rbd=${net.deepest}`);
}

function noteKeyEvent(probe: CallbackClock, down: boolean, now: number): void {
  if (eventKey() !== probe.key || probe.events.length >= MAX_EVENTS) return;
  const player = eventPlayer();
  if (player === localPlayer()) probe.events.push(`${down ? "d" : "u"} ${microseconds(now)} ${osKeyDown(probe.key) ? 1 : 0} ${probe.callbacks}`);
  else probe.events.push(`${down ? "D" : "U"} ${microseconds(now)} ${playerSlot(player)} ${probe.callbacks}`);
}

function clockNow(): number | undefined {
  return typeof os === "object" && os !== null && typeof os.clock === "function" ? os.clock() : undefined;
}

export function noteCallbackClockRow(frame: number, pressed: number): void {
  const probe = active;
  const now = clockNow();
  if (probe === undefined || now === undefined || pressed === 0 || probe.events.length >= MAX_EVENTS) return;
  probe.events.push(`j ${microseconds(now)} ${frame} ${pressed} ${probe.callbacks}`);
}

export function noteCallbackClockRemoteRow(sender: number, frame: number, pressed: number): void {
  const probe = active;
  const now = clockNow();
  if (probe === undefined || now === undefined || pressed === 0 || probe.events.length >= MAX_EVENTS) return;
  probe.events.push(`s ${microseconds(now)} ${sender} ${frame} ${pressed} ${probe.callbacks}`);
}

function finish(probe: CallbackClock): void {
  active = undefined;
  closeBurst(probe);
  probe.records.push(probe.record);
  probe.bursts.push(probe.burstRecord);
  destroyTimer(probe.gameClock);
  const slot = playerSlot(localPlayer());
  clearFileLines();
  startFile();
  addFileLine(`callback-clock v=3 run=${probe.run} slot=${slot} key=${probe.key} callbacks=${probe.callbacks}`);
  for (const record of probe.records) addFileLine(record);
  for (const record of probe.rollbacks) addFileLine(record);
  for (const record of probe.events) addFileLine(record);
  for (const record of probe.bursts) addFileLine(record);
  endFile(callbackClockFile(slot, probe.run));
  displayText(localPlayer(), 0.0, 0.0, `callback-clock run=${probe.run} callbacks=${probe.callbacks} written`);
}

export function probeCallbackClock(key: number, callbacks: number): boolean {
  const clock = typeof os === "object" && os !== null && typeof os.clock === "function" ? os.clock : undefined;
  const table = globalThis.__smashcraftDispatch;
  if (clock === undefined || table === undefined || active !== undefined) return false;
  runs++;
  const gameClock = createTimer();
  startTimer(gameClock, 3600.0, false, () => {});
  const probe: CallbackClock = {
    run: runs, key, limit: callbacks < MAX_CALLBACKS ? callbacks : MAX_CALLBACKS, gameClock, records: [], rollbacks: [], events: [], bursts: [],
    burst: { last: 0, game: 0, alpha: 0, drawn: 0, draws: 0, ticks: 0 }, record: "k 0", burstRecord: "b", callbacks: 0, last: 0, down: false,
  };
  active = probe;
  const plain = table.run;
  table.run = (name: string) => {
    if (active === probe) beforeCallback(probe, name, clock());
    plain(name);
    if (active === probe) afterCallback(probe, name, clock());
    else if (table.run !== plain) table.run = plain;
  };
  return true;
}

function beforeCallback(probe: CallbackClock, name: string, now: number): void {
  if (name === TICK) sample(probe, now);
  else if (name === KEY_DOWN || name === KEY_UP) noteKeyEvent(probe, name === KEY_DOWN, now);
}

function afterCallback(probe: CallbackClock, name: string, now: number): void {
  if (name === TICK || name === DRAW_EVENT) noteBurst(probe, now, name === DRAW_EVENT);
}
