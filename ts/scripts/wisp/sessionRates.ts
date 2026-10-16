import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";

const DEFAULT_FOLDER = join(process.env.HOME ?? "", ".local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData");
export const RATES_FILE = /^smashcraft-rates-(.+)-(\d+)\.txt$/;
const GAP_FLAG_US = 250000;
const SLOW_SIM = 55;
const SLOW_CB = 55;
const SLOW_DRAW = 57;
const MIN_MATCH_SECONDS = 20;

export type Fields = Record<string, number>;

export interface SessionRateLines {
  readonly header: string | undefined;
  readonly seconds: Fields[];
  readonly counts: Fields[];
  readonly events: string[];
  readonly live: string[];
}

function fields(words: readonly string[]): Fields {
  const parsed: Fields = {};
  for (const word of words) {
    const at = word.indexOf("=");
    if (at < 0) continue;
    const [live, created] = word.slice(at + 1).split("/");
    parsed[word.slice(0, at)] = Number(live);
    if (created !== undefined) parsed[`${word.slice(0, at)}Made`] = Number(created);
  }
  return parsed;
}

export function parseSessionRates(lines: readonly string[]): SessionRateLines {
  const seconds: Fields[] = [];
  const counts: Fields[] = [];
  const events: string[] = [];
  const live: string[] = [];
  let header: string | undefined;
  for (const line of lines) {
    const words = line.split(" ");
    if (words[0] === "smashcraft-rates") header = line;
    else if (words[0] === "r") seconds.push(fields(words.slice(1)));
    else if (words[0] === "c") counts.push(fields(words.slice(1)));
    else if (words[0] === "e") events.push(line.slice(2));
    else if (words[0] === "l" || words[0] === "s") live.push(words.slice(2).join(" "));
  }
  return { header, seconds, counts, events, live };
}

interface Minute {
  readonly minute: number;
  readonly mtime: number;
  readonly lines: SessionRateLines;
}

const FAST = 2;
const SPEEDS = ["Slow", "Normal", "Fast"];

function speedFlag(seconds: readonly Fields[]): string {
  const seen = new Set(seconds.map(row => row.gs ?? -1).filter(speed => speed >= 0));
  const other = [...seen].filter(speed => speed !== FAST);
  return other.length === 0 ? "" : `SPEED(${[...seen].map(speed => SPEEDS[speed] ?? speed).join("/")})`;
}

const sum = (rows: readonly Fields[], key: string) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
const most = (rows: readonly Fields[], key: string) => rows.reduce((top, row) => Math.max(top, row[key] ?? 0), 0);
const fixed = (value: number, digits = 1) => value.toFixed(digits);

function minuteRow(minute: Minute, previousEnd: number): string {
  const { seconds, counts, events, live: liveTags } = minute.lines;
  const end = seconds.at(-1)?.t ?? previousEnd;
  const span = Math.max(1, (end - previousEnd) / 1000);
  const matchTicks = sum(seconds.filter(row => row.ph === 2), "cb");
  const flags = [
    sum(seconds, "pt") > 0 || sum(seconds, "pz") > 0 ? `PAUSE(${sum(seconds, "pt")} toggles, ${sum(seconds, "pz")} paused cb)` : "",
    sum(seconds, "pm") > 0 ? `MENU(${sum(seconds, "pm")})` : "",
    most(seconds, "cbgap") > GAP_FLAG_US ? `GAP(${fixed(most(seconds, "cbgap") / 1000, 0)} ms, focus?)` : "",
    speedFlag(seconds),
    span > seconds.length + 5 ? `MISSING(${fixed(span - seconds.length, 0)} s without lines)` : "",
  ].filter(flag => flag !== "").join(" ");
  const last = counts.at(-1) ?? {};
  const live = ["trg", "tmr", "eff", "snd", "frm", "unit"].map(kind => `${kind} ${last[kind] ?? "?"}`).join(" ");
  const topEvents = events.at(-1) ?? "";
  const tagged = liveTags.slice(-2).join(" ");
  return [
    `  min ${String(minute.minute).padStart(3)} t ${fixed(end / 1000, 0).padStart(5)}s`,
    `cb/s ${fixed(sum(seconds, "cb") / span)} game/real ${fixed(sum(seconds, "cb") / span / 60, 2)} (min ${seconds.length === 0 ? "-" : Math.min(...seconds.map(row => row.cb ?? 0))})`,
    `sim/s ${fixed(sum(seconds, "sim") / span)} spec/s ${fixed(sum(seconds, "spec") / span)} conf/s ${fixed(sum(seconds, "conf") / span)} spec/cb ${fixed(sum(seconds, "spec") / Math.max(1, sum(seconds, "cb")), 2)}`,
    `held ${fixed(100 * sum(seconds, "held") / Math.max(1, matchTicks), 0)}% stall ${fixed(100 * sum(seconds, "stall") / Math.max(1, matchTicks), 0)}% gap ${fixed(sum(seconds, "gap") / Math.max(1, seconds.length))}/${most(seconds, "gmax")}`,
    `lua ms/s ${fixed(sum(seconds, "lua") / 1000 / span)} tick us ${fixed(sum(seconds, "tk") / Math.max(1, seconds.length), 0)}/${most(seconds, "tkmax")}`,
    `draw/s ${fixed(sum(seconds, "dr") / span)} ev/s ${fixed(sum(seconds, "ev") / span)} send/s ${fixed(sum(seconds, "send") / span)} recv/s ${fixed(sum(seconds, "recv") / span)} own echo/s ${fixed(sum(seconds, "rown") / span)} window ${seconds.at(-1)?.win ?? "-"} f ${seconds.at(-1)?.f ?? "-"} cf ${seconds.at(-1)?.cf ?? "-"} kn ${seconds.at(-1)?.kn ?? "-"}`,
    `live ${live} kreg ${last.kreg ?? "?"} reg ${last.reg ?? "?"} act ${last.act ?? "?"} hid ${last.hid ?? "?"} heapKb ${last.heap ?? "?"}`,
    flags,
    topEvents === "" ? "" : `events[${topEvents}]`,
    tagged === "" ? "" : `by model/owner[${tagged}]`,
  ].filter(part => part !== "").join(" | ");
}

const mean = (rows: readonly Fields[], key: string) => sum(rows, key) / Math.max(1, rows.length);

export function forkVerdict(minutes: readonly { readonly minute: number; readonly lines: SessionRateLines }[]): string {
  const match = (seconds: readonly Fields[]) => seconds.filter(row => row.ph === 2);
  const onset = minutes.find(minute => {
    const seconds = match(minute.lines.seconds);
    return seconds.length >= MIN_MATCH_SECONDS && mean(seconds, "sim") < SLOW_SIM;
  });
  if (onset === undefined) return `  fork: none (sim held ≥${SLOW_SIM}/s every minute)`;
  const slow = minutes.flatMap(minute => match(minute.lines.seconds)).filter(row => (row.sim ?? 0) < SLOW_SIM);
  const at = `onset min ${onset.minute} t ${fixed((match(onset.lines.seconds).at(-1)?.t ?? 0) / 1000, 0)}s`;
  const speeds = [...new Set(slow.map(row => row.gs ?? -1))].filter(speed => speed !== FAST);
  if (speeds.length > 0) return `  fork: game-speed (${speeds.map(speed => `gs=${speed} ${SPEEDS[speed] ?? "unknown"}`).join("/")}), ${at}`;
  const cb = mean(slow, "cb");
  const draw = mean(slow, "dr");
  const sim = mean(slow, "sim");
  if (cb < SLOW_CB) return `  fork: callbacks (Warcraft delivered cb ${fixed(cb)}/s, draw ${fixed(draw)}/s, sim ${fixed(sim)}/s; render-bound when draw falls with cb) ${draw < SLOW_DRAW ? "render-bound" : "timer-bound"}, ${at}`;
  return `  fork: echo-wait (cb ${fixed(cb)}/s, sim ${fixed(sim)}/s, held ${fixed(100 * sum(slow, "held") / Math.max(1, sum(slow, "cb")), 0)}%, gap ${fixed(mean(slow, "gap"))}, own echo ${fixed(mean(slow, "rown"))}/s), ${at}`;
}

export function sessionRateReport(folder: string): string[] {
  const loads = new Map<string, Minute[]>();
  for (const name of readdirSync(folder)) {
    const match = RATES_FILE.exec(name);
    if (match === null) continue;
    const path = join(folder, name);
    const text = readFileSync(path, "utf8");
    const lines = preloadLines(text) ?? text.split(/\r?\n/);
    const minutes = loads.get(match[1] ?? "") ?? [];
    minutes.push({ minute: Number(match[2]), mtime: statSync(path).mtimeMs, lines: parseSessionRates(lines) });
    loads.set(match[1] ?? "", minutes);
  }
  if (loads.size === 0) return [`no smashcraft-rates files in ${folder}`];
  const report: string[] = [];
  const ordered = [...loads.entries()].sort((left, right) => Math.min(...left[1].map(m => m.mtime)) - Math.min(...right[1].map(m => m.mtime)));
  for (const [load, minutes] of ordered) {
    minutes.sort((left, right) => left.minute - right.minute);
    const first = minutes[0];
    const lastMinute = minutes.at(-1);
    if (first === undefined || lastMinute === undefined) continue;
    const clockSpan = ((lastMinute.lines.seconds.at(-1)?.t ?? 0) - (first.lines.seconds.at(-1)?.t ?? 0)) / 1000;
    const wallSpan = (lastMinute.mtime - first.mtime) / 1000;
    report.push(`load ${load} started ~${new Date(first.mtime - (first.lines.seconds.at(-1)?.t ?? 0)).toISOString()} ${first.lines.header ?? ""}`);
    report.push(`  clock check: map clock ${fixed(clockSpan)} s vs file mtimes ${fixed(wallSpan)} s between first and last file (equal when the map clock is real time)`);
    let previousEnd = 0;
    for (const minute of minutes) {
      report.push(minuteRow(minute, previousEnd));
      previousEnd = minute.lines.seconds.at(-1)?.t ?? previousEnd;
    }
    report.push(forkVerdict(minutes));
  }
  return report;
}

if (import.meta.main) console.log(sessionRateReport(process.argv[2] ?? DEFAULT_FOLDER).join("\n"));
