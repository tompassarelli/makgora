import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { MATCH_TICKS_PER_SECOND, type MatchState, Phase } from "../src/game/lobby/lobbyState";
import { produceComputerInput } from "../src/game/match/botPlay";
import { isCpuTier, type CpuTier } from "../src/game/match/cpuProfiles";
import { captureFrame, executeMatchFrame } from "../src/game/match/frameInput";
import { type Character, SpecialAction } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { ROSTER_MANA, trickleDue } from "../src/game/sim/mana";
import { copyControls, fighterAt, neutralControls } from "../src/game/sim/roster";
import { type FieldOptions, openFieldMatch } from "./cpuField";
import { fieldPairs } from "./meterDropField";

export interface MeterRate {
  readonly trickleFrames: number;
  readonly dropGain: number;
}

export const rateName = (rate: MeterRate): string => `${rate.trickleFrames}:${rate.dropGain}`;

export const SHIPPED_RATE: MeterRate = { trickleFrames: ROSTER_MANA.trickleFrames, dropGain: ROSTER_MANA.dropGain };

export const TARGET_BARS_PER_STOCK_LOST = 0.5;

export interface MeterSide {
  readonly fighter: string;
  minutes: number;
  stocksLost: number;
  firstBarSeconds: number | null;
  trickle: number;
  drops: number;
  other: number;
  exSpent: number;
  ultimatesSpent: number;
  dropsAhead: number;
  dropsEven: number;
  dropsBehind: number;
}

export interface MeterMatch {
  readonly rate: string;
  readonly seed: number;
  readonly spawned: number;
  readonly sides: readonly [MeterSide, MeterSide];
}

const NEUTRAL = neutralControls();

const played = (match: Readonly<MatchState>): number => Math.max(0, match.matchFrame - match.startHold);

function withMeterRate<T>(rate: MeterRate, run: () => T): T {
  const shipped = { ...ROSTER_MANA };
  Object.assign(ROSTER_MANA, rate);
  try {
    return run();
  } finally {
    Object.assign(ROSTER_MANA, shipped);
  }
}

interface MeterWatch {
  mana: number;
  out: boolean;
  special: number;
  specialFrame: number;
}

function accountFrame(own: MeterSide, was: MeterWatch, f: Readonly<Fighter>, trickle: number, drop: number, seconds: number): void {
  own.trickle += trickle;
  own.drops += drop;
  const started = f.special.action !== was.special || f.special.frame < was.specialFrame;
  if (started && f.special.action === SpecialAction.heroUltimate) own.ultimatesSpent++;
  else if (started && f.special.ex && was.mana - f.mana.points >= ROSTER_MANA.exCost) own.exSpent++;
  const rise = f.mana.points - was.mana;
  if (rise > trickle + drop) own.other += rise - trickle - drop;
  if (f.status.out && !was.out) own.stocksLost++;
  if (own.firstBarSeconds === null && f.mana.points >= ROSTER_MANA.max) own.firstBarSeconds = seconds;
  was.mana = f.mana.points;
  was.out = f.status.out;
  was.special = f.special.action;
  was.specialFrame = f.special.frame;
}

function tallyPickup(sides: readonly [MeterSide, MeterSide], taker: 0 | 1, lead: number): void {
  const own = sides[taker];
  if (lead > 0) own.dropsAhead++;
  else if (lead < 0) own.dropsBehind++;
  else own.dropsEven++;
}

export function playMeterMatch(a: Character, b: Character, rate: MeterRate, options: FieldOptions, seed: number): MeterMatch | undefined {
  return withMeterRate(rate, () => {
    const opened = openFieldMatch(a, b, "frozen-throne", 0, options, seed);
    if (opened === undefined) return undefined;
    const { match, world, controls, produced, runtime, row } = opened;
    const side = (character: Character): MeterSide => ({ fighter: fighterSlug(character), minutes: 0, stocksLost: 0, firstBarSeconds: null, trickle: 0, drops: 0, other: 0, exSpent: 0, ultimatesSpent: 0, dropsAhead: 0, dropsEven: 0, dropsBehind: 0 });
    const sides: [MeterSide, MeterSide] = [side(a), side(b)];
    const seen = [0, 1].map((slot): MeterWatch => {
      const f = fighterAt(world, slot);
      return { mana: f.mana.points, out: f.status.out, special: f.special.action, specialFrame: f.special.frame };
    });
    let pickups = match.drops.pickupSerial;
    const limit = (match.timeLimitMinutes * 60 + 5) * MATCH_TICKS_PER_SECOND;
    let frame = 0;
    while (match.phase === Phase.match && frame < limit) {
      frame = runtime.simulationFrame + 1;
      for (const slot of PARTICIPANT_SLOTS) {
        copyControls(produced.inputs[slot], NEUTRAL);
        clearAttackBuffer(produced.commands[slot]);
        if (slot === 0 || slot === 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot], undefined);
      }
      if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
      if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
      const dropped = [0, 0];
      if (match.drops.pickupSerial !== pickups) {
        pickups = match.drops.pickupSerial;
        const taker = match.drops.lastTaker;
        if (taker === 0 || taker === 1) {
          dropped[taker] = ROSTER_MANA.dropGain;
          tallyPickup(sides, taker, fighterAt(world, taker).status.stocks - fighterAt(world, 1 - taker).status.stocks);
        }
      }
      const trickle = trickleDue(played(match)) ? 1 : 0;
      for (const slot of [0, 1] as const) {
        const was = seen[slot];
        const f = fighterAt(world, slot);
        if (was !== undefined) accountFrame(sides[slot], was, f, f.status.out ? 0 : trickle, dropped[slot] ?? 0, played(match) / MATCH_TICKS_PER_SECOND);
      }
    }
    for (const own of sides) own.minutes = played(match) / MATCH_TICKS_PER_SECOND / 60;
    return { rate: rateName(rate), seed, spawned: match.drops.spawnSerial, sides };
  });
}

const earned = (side: MeterSide): number => side.trickle + side.drops + side.other;
const earnedBars = (side: MeterSide): number => earned(side) / ROSTER_MANA.max;

export interface Spread {
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly mean: number;
}

export function spread(values: readonly number[]): Spread {
  const sorted = [...values].sort((x, y) => x - y);
  const at = (q: number): number => {
    if (sorted.length === 0) return Number.NaN;
    const position = q * (sorted.length - 1);
    const low = Math.floor(position);
    const high = Math.ceil(position);
    return (sorted[low] ?? 0) + ((sorted[high] ?? 0) - (sorted[low] ?? 0)) * (position - low);
  };
  const mean = sorted.length === 0 ? Number.NaN : sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { q1: at(0.25), median: at(0.5), q3: at(0.75), mean };
}

export interface RateReport {
  readonly rate: string;
  readonly matches: number;
  readonly rows: readonly (readonly [string, Spread])[];
  readonly barsPerStockLost: Spread;
  readonly dropShare: number;
  readonly barsPerStockLostOfMeans: number;
  readonly takes: { readonly ahead: number; readonly even: number; readonly behind: number; readonly spawned: number };
}

export function reportRate(rate: string, matches: readonly MeterMatch[]): RateReport {
  const sides = matches.flatMap((match) => match.sides);
  const losing = sides.filter((side) => side.stocksLost > 0);
  const barsPerStockLost = spread(losing.map((side) => earnedBars(side) / side.stocksLost));
  const takes = { ahead: 0, even: 0, behind: 0, spawned: matches.reduce((sum, match) => sum + match.spawned, 0) };
  let dropPoints = 0, allPoints = 0, stocksLost = 0;
  for (const side of sides) {
    takes.ahead += side.dropsAhead;
    takes.even += side.dropsEven;
    takes.behind += side.dropsBehind;
    dropPoints += side.drops;
    allPoints += earned(side);
    stocksLost += side.stocksLost;
  }
  return {
    rate, matches: matches.length, barsPerStockLost, takes, barsPerStockLostOfMeans: stocksLost === 0 ? Number.NaN : allPoints / ROSTER_MANA.max / stocksLost, dropShare: allPoints === 0 ? Number.NaN : dropPoints / allPoints,
    rows: [
      ["Match minutes", spread(matches.map((match) => match.sides[0].minutes))],
      ["Stocks lost per player", spread(sides.map((side) => side.stocksLost))],
      ["Seconds to first full bar", spread(sides.filter((side) => side.firstBarSeconds !== null).map((side) => side.firstBarSeconds ?? 0))],
      ["Trickle points per player", spread(sides.map((side) => side.trickle))],
      ["Drop points per player", spread(sides.map((side) => side.drops))],
      ["Share of a player's meter from drops", spread(sides.filter((side) => earned(side) > 0).map((side) => side.drops / earned(side)))],
      ["Full bars earned per player", spread(sides.map(earnedBars))],
      ["Full bars earned per stock lost", barsPerStockLost],
      ["EX specials spent per player", spread(sides.map((side) => side.exSpent))],
      ["Ultimates spent per player", spread(sides.map((side) => side.ultimatesSpent))],
    ],
  };
}

const fixed = (value: number): string => Number.isNaN(value) ? "-" : value.toFixed(2);
const cell = (s: Spread): string => `${fixed(s.median)} (${fixed(s.q1)}–${fixed(s.q3)}; mean ${fixed(s.mean)})`;
const percent = (part: number, whole: number): string => whole === 0 ? "-" : `${Math.round(100 * part / whole)}%`;

export function renderReports(reports: readonly RateReport[]): string {
  const lines = [
    `| Trickle frames per point : points per drop | ${reports.map((report) => report.rate).join(" | ")} |`,
    `|---|${reports.map(() => "---").join("|")}|`,
  ];
  const labels = reports[0]?.rows.map(([label]) => label) ?? [];
  for (const [index, label] of labels.entries()) lines.push(`| ${label} | ${reports.map((report) => cell(report.rows[index]?.[1] ?? spread([]))).join(" | ")} |`);
  lines.push(`| Share of all meter from drops | ${reports.map((report) => percent(report.dropShare, 1)).join(" | ")} |`);
  lines.push(`| Drops taken by the fighter ahead on stocks / level / behind, of drops spawned | ${reports.map(({ takes }) => {
    const taken = takes.ahead + takes.even + takes.behind;
    return `${percent(takes.ahead, taken)} / ${percent(takes.even, taken)} / ${percent(takes.behind, taken)}; ${taken} of ${takes.spawned}`;
  }).join(" | ")} |`);
  lines.push(`| All bars earned over all stocks lost against the target of ${TARGET_BARS_PER_STOCK_LOST} | ${reports.map((report) => `${fixed(report.barsPerStockLostOfMeans)}: ${(report.barsPerStockLostOfMeans / TARGET_BARS_PER_STOCK_LOST).toFixed(2)}×`).join(" | ")} |`);
  lines.push(`| Mean bars per stock lost against the target of ${TARGET_BARS_PER_STOCK_LOST} | ${reports.map((report) => `${fixed(report.barsPerStockLost.mean)}: ${(report.barsPerStockLost.mean / TARGET_BARS_PER_STOCK_LOST).toFixed(2)}×`).join(" | ")} |`);
  return lines.join("\n");
}

const isMeterMatches = (value: unknown): value is MeterMatch[] => Array.isArray(value) && value.every((entry) => typeof entry === "object" && entry !== null && "rate" in entry && "sides" in entry);

function parseRate(text: string): MeterRate {
  const [trickleFrames, dropGain] = text.split(":").map(Number);
  if (trickleFrames === undefined || dropGain === undefined || !(trickleFrames > 0) || !(dropGain >= 0)) throw new Error(`--rates takes FRAMES:POINTS pairs, not ${text}`);
  return { trickleFrames, dropGain };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { fighters: { type: "string" }, rates: { type: "string" }, tier: { type: "string" }, seed: { type: "string" }, shard: { type: "string" }, json: { type: "string" }, merge: { type: "string" } } });
  const rates = values.rates === undefined ? [SHIPPED_RATE] : values.rates.split(",").map(parseRate);
  let matches: MeterMatch[];
  if (values.merge !== undefined) {
    matches = values.merge.split(",").flatMap((file) => {
      const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (!isMeterMatches(parsed)) throw new Error(`${file} is not a meterRate shard`);
      return parsed;
    });
  } else {
    const fighters = values.fighters === undefined ? SELECTABLE_CHARACTERS : values.fighters.split(",").map((slug) => {
      const character = selectableCharacterBySlug(slug);
      if (character === undefined) throw new Error(`no fighter ${slug}`);
      return character;
    });
    const tier: CpuTier = values.tier !== undefined && isCpuTier(values.tier) ? values.tier : "expert";
    const [shardIndex, shardCount] = (values.shard ?? "0/1").split("/").map(Number);
    if (shardIndex === undefined || shardCount === undefined || !(shardCount >= 1) || !(shardIndex >= 0 && shardIndex < shardCount)) throw new Error("--shard takes K/N with 0 <= K < N");
    const options: FieldOptions = { tiers: [tier, tier], stocks: 3, minutes: 7, drops: true };
    const base = Number(values.seed ?? 484);
    const pairs = fieldPairs(fighters).map((pair, index) => ({ pair, seed: base + index })).filter((_, index) => index % shardCount === shardIndex);
    const started = performance.now();
    matches = rates.flatMap((rate) => pairs.map(({ pair: [a, b], seed }) => playMeterMatch(a, b, rate, options, seed)).filter((match): match is MeterMatch => match !== undefined));
    console.error(`shard ${shardIndex}/${shardCount}: ${pairs.length} pairs × ${rates.length} rates, ${matches.length} matches, ${((performance.now() - started) / 1000).toFixed(0)} s`);
    if (values.json !== undefined) writeFileSync(values.json, `${JSON.stringify(matches)}\n`);
  }
  const names = [...new Set(matches.map((match) => match.rate))];
  const reports = names.map((name) => reportRate(name, matches.filter((match) => match.rate === name)));
  console.log(`Expert CPU field, 3 stocks, 7-minute clock, meter drops every 20 s, Frozen Throne; ${reports[0]?.matches ?? 0} matches per rate.`);
  console.log(renderReports(reports));
}
