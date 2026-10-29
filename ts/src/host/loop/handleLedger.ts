import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { writeLine } from "wisp/src/platform/fileio";
import { handleLedgerFile } from "../../game/core/gameFiles";

export const LEDGER_MARK = "l";
export const LEDGER_TICKS = 60;
const KEPT_WINDOWS = 16;
const NAMES_PER_TICK = 4;
const SENT_TICKS = 12;
const OVERFLOW = "+";

export const LEDGER_NATIVES = [
  "AddLightningEx", "AddSpecialEffect", "AddSpecialEffectTarget", "BlzCreateFrame", "BlzCreateFrameByType", "BlzCreateSimpleFrame", "BlzDestroyFrame",
  "BlzTriggerRegisterFrameEvent", "BlzTriggerRegisterPlayerKeyEvent", "BlzTriggerRegisterPlayerSyncEvent", "CreateQuest", "CreateSound", "CreateSoundFromLabel",
  "CreateTextTag", "CreateTimer", "CreateTrigger", "CreateUnit", "DestroyEffect", "DestroyLightning", "DestroyTextTag", "DestroyTimer", "DestroyTrigger",
  "GetRectCenter", "KillSoundWhenDone", "PauseTimer", "RemoveLocation", "RemoveUnit", "ResumeTimer", "TimerStart", "TriggerAddAction", "TriggerRegisterPlayerChatEvent",
  "TriggerRegisterPlayerEvent",
] as const;

interface LedgerTick {
  readonly offset: number;
  count: number;
  readonly natives: number[];
}

interface LedgerWindow {
  window: number;
  total: number;
  readonly ticks: LedgerTick[];
}

export interface HandleLedger {
  tick: number;
  wrapped: boolean;
  sentWindow: number;
  readonly windows: LedgerWindow[];
  readonly reported: boolean[];
  readonly lines: string[];
}

export interface LedgerReport {
  readonly window: number;
  readonly total: number;
  readonly ticks: readonly { readonly offset: number; readonly count: number; readonly native: number }[];
}

declare global {
  var __smashcraftHandleLedger: HandleLedger | undefined;
}

export function handleLedger(): HandleLedger {
  return globalThis.__smashcraftHandleLedger ??= { tick: 0, wrapped: false, sentWindow: -1, windows: [], reported: [false, false, false, false], lines: [] };
}

function windowAt(ledger: HandleLedger, window: number): LedgerWindow {
  const index = floorMod(window, KEPT_WINDOWS);
  const kept = ledger.windows[index];
  if (kept !== undefined && kept.window === window) return kept;
  const fresh: LedgerWindow = { window, total: 0, ticks: [] };
  ledger.windows[index] = fresh;
  return fresh;
}

function keptWindow(ledger: Readonly<HandleLedger>, window: number): LedgerWindow | undefined {
  const kept = ledger.windows[floorMod(window, KEPT_WINDOWS)];
  return kept !== undefined && kept.window === window ? kept : undefined;
}

export function noteHandleCall(ledger: HandleLedger, native: number): void {
  const record = windowAt(ledger, floorDiv(ledger.tick, LEDGER_TICKS));
  record.total++;
  const offset = ledger.tick - record.window * LEDGER_TICKS;
  const last = record.ticks[record.ticks.length - 1];
  const tick = last !== undefined && last.offset === offset ? last : { offset, count: 0, natives: [] };
  if (tick !== last) record.ticks.push(tick);
  tick.count++;
  if (tick.natives.length < NAMES_PER_TICK) tick.natives.push(native);
}

export function advanceHandleLedger(ledger: HandleLedger): void {
  ledger.tick++;
  windowAt(ledger, floorDiv(ledger.tick, LEDGER_TICKS));
}

export function installHandleLedger(ledger: HandleLedger): void {
  if (ledger.wrapped) return;
  ledger.wrapped = true;
  const globals = globalThis as Record<string, unknown>;
  LEDGER_NATIVES.forEach((name, code) => {
    const native = globals[name];
    if (typeof native !== "function") return;
    const call = native as (this: void, ...args: unknown[]) => unknown;
    globals[name] = (...args: unknown[]) => {
      noteHandleCall(ledger, code);
      return call(...args);
    };
  });
}

export function encodeLedgerReport(record: Readonly<LedgerWindow>): string {
  const parts = [`${LEDGER_MARK}${I2S(record.window)}:${I2S(record.total)}`];
  for (const tick of record.ticks.slice(0, SENT_TICKS)) parts.push(`${I2S(tick.offset)}.${I2S(tick.count)}.${I2S(tick.natives[0] ?? -1)}`);
  if (record.ticks.length > SENT_TICKS) parts.push(OVERFLOW);
  return parts.join(",");
}

export function decodeLedgerReport(data: string): LedgerReport | undefined {
  if (data.substring(0, 1) !== LEDGER_MARK) return undefined;
  const parts = data.substring(1).split(",");
  const head = (parts[0] ?? "").split(":");
  if (head.length !== 2) return undefined;
  const ticks: { offset: number; count: number; native: number }[] = [];
  for (const part of parts.slice(1)) {
    if (part === OVERFLOW) continue;
    const [offset, count, native] = part.split(".").map(value => S2I(value));
    if (offset === undefined || count === undefined || native === undefined) return undefined;
    ticks.push({ offset, count, native });
  }
  return { window: S2I(head[0] ?? ""), total: S2I(head[1] ?? ""), ticks };
}

export function takeLedgerReport(ledger: HandleLedger): string | undefined {
  const finished = floorDiv(ledger.tick, LEDGER_TICKS) - 1;
  if (finished <= ledger.sentWindow) return undefined;
  ledger.sentWindow = finished;
  return encodeLedgerReport(keptWindow(ledger, finished) ?? { window: finished, total: 0, ticks: [] });
}

const nativeName = (code: number): string => LEDGER_NATIVES[code] ?? "?";

function firstDifference(own: Readonly<LedgerWindow>, other: LedgerReport): number | undefined {
  const sent = own.ticks.slice(0, SENT_TICKS);
  const offsets = [...sent.map(tick => tick.offset), ...other.ticks.map(tick => tick.offset)].sort((a, b) => a - b);
  for (const offset of offsets) {
    const mine = sent.find(tick => tick.offset === offset)?.count ?? 0;
    const theirs = other.ticks.find(tick => tick.offset === offset)?.count ?? 0;
    if (mine !== theirs) return offset;
  }
  return own.total === other.total ? undefined : -1;
}

export function receiveLedgerReport(ledger: HandleLedger, local: number, sender: number, data: string): string | undefined {
  if (sender === local || sender < 0 || sender >= ledger.reported.length || ledger.reported[sender] === true) return undefined;
  const other = decodeLedgerReport(data);
  if (other === undefined) return undefined;
  const own = keptWindow(ledger, other.window);
  if (own === undefined) return undefined;
  const offset = firstDifference(own, other);
  if (offset === undefined) return undefined;
  ledger.reported[sender] = true;
  const window = other.window * LEDGER_TICKS;
  const tick = offset < 0 ? window : window + offset;
  const mine = own.ticks.find(entry => entry.offset === offset);
  const theirs = other.ticks.find(entry => entry.offset === offset);
  const where = offset < 0 ? `in ticks ${I2S(window)}-${I2S(window + LEDGER_TICKS - 1)}` : `at tick ${I2S(tick)}`;
  const line = `handle ledger: p${I2S(local)} and p${I2S(sender)} differ ${where}:`
    + ` p${I2S(local)} made or freed ${I2S(offset < 0 ? own.total : mine?.count ?? 0)} (${(mine?.natives ?? []).map(code => nativeName(code)).join(" ")})`
    + ` and p${I2S(sender)} ${I2S(offset < 0 ? other.total : theirs?.count ?? 0)} (${theirs === undefined ? "" : nativeName(theirs.native)})`;
  ledger.lines.push(line);
  writeLine(handleLedgerFile(local, tick), line);
  return line;
}
