import { floorMod } from "wisp/src/sim/intMath";
import { callbackClockFile } from "../../game/core/gameFiles";
import { osKeyDown } from "../../platform/osKeys";
import { RATES_RECORD_CHARS } from "./sessionRates";
import { activeRollback, shellState } from "./state";
declare const os: { readonly clock?: (this: void) => number } | undefined;

const TICK = "shell.tick";
const MAX_CALLBACKS = 36000;
const ROLLBACK_EVERY = 600;

interface CallbackClock {
  readonly run: number;
  readonly key: number;
  readonly limit: number;
  readonly records: string[];
  readonly rollbacks: string[];
  record: string;
  callbacks: number;
  last: number;
  down: boolean;
}

let runs = 0;
let active: CallbackClock | undefined;

const microseconds = (seconds: number): number => Math.floor(seconds * 1000000);

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

function noteRollbacks(probe: CallbackClock, now: number): void {
  const s = shellState();
  const rollback = s === undefined ? undefined : activeRollback(s);
  if (rollback === undefined) return;
  const { net, schedule } = rollback;
  probe.rollbacks.push(`r ${probe.callbacks} t=${microseconds(now)} f=${schedule.speculativeFrame()} cf=${schedule.nextConfirmedFrame()} dl=${rollback.delay} rb=${net.corrections} rbf=${net.replayed} rbd=${net.deepest}`);
}

function finish(probe: CallbackClock): void {
  active = undefined;
  probe.records.push(probe.record);
  const slot = GetPlayerId(GetLocalPlayer());
  PreloadGenClear();
  PreloadGenStart();
  Preload(`callback-clock v=1 run=${probe.run} slot=${slot} key=${probe.key} callbacks=${probe.callbacks}`);
  for (const record of probe.records) Preload(record);
  for (const record of probe.rollbacks) Preload(record);
  PreloadGenEnd(callbackClockFile(slot, probe.run));
  DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, `callback-clock run=${probe.run} callbacks=${probe.callbacks} written`);
}

export function probeCallbackClock(key: number, callbacks: number): boolean {
  const clock = typeof os === "object" && os !== null && typeof os.clock === "function" ? os.clock : undefined;
  const table = globalThis.__smashcraftDispatch;
  if (clock === undefined || table === undefined || active !== undefined) return false;
  runs++;
  const probe: CallbackClock = { run: runs, key, limit: callbacks < MAX_CALLBACKS ? callbacks : MAX_CALLBACKS, records: [], rollbacks: [], record: "k 0", callbacks: 0, last: 0, down: false };
  active = probe;
  const plain = table.run;
  table.run = (name: string) => {
    if (name === TICK && active === probe) sample(probe, clock());
    plain(name);
    if (active !== probe && table.run !== plain) table.run = plain;
  };
  return true;
}
