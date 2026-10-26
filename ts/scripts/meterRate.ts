import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { MATCH_TICKS_PER_SECOND, type MatchState, Phase } from "../src/game/lobby/lobbyState";
import { produceComputerInput } from "../src/game/match/botPlay";
import { isCpuTier, type CpuTier } from "../src/game/match/cpuProfiles";
import { captureFrame, executeMatchFrame } from "../src/game/match/frameInput";
import { DROP_METER } from "../src/game/match/meterDrops";
import { type Character, SpecialAction } from "../src/game/sim/codes";
import { observeDamageContacts } from "../src/game/sim/contacts";
import type { Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { ROSTER_MANA, dealtManaGain, takenManaGain } from "../src/game/sim/mana";
import { copyControls, fighterAt, neutralControls } from "../src/game/sim/roster";
import { type FieldOptions, openFieldMatch } from "./cpuField";
import { type DropVariant, advanceDropVariant, endDropVariant, startDropVariant } from "./dropVariants";
import { fieldPairs } from "./meterDropField";

export interface MeterRate {
  readonly name: string;
  readonly dealtPoints: number;
  readonly dealtPercent: number;
  readonly dealtCap: number;
  readonly takenPoints: number;
  readonly takenPercent: number;
  readonly takenCap: number;
  readonly drops: DropVariant;
}

const NO_DAMAGE_GAIN = { dealtPoints: 0, dealtPercent: 1, dealtCap: 0, takenPoints: 0, takenPercent: 1, takenCap: 0 } as const;

export const METER_RATES: readonly MeterRate[] = [
  { name: "today", dealtPoints: ROSTER_MANA.dealtPoints, dealtPercent: ROSTER_MANA.dealtPercent, dealtCap: ROSTER_MANA.dealtCap, takenPoints: ROSTER_MANA.takenPoints, takenPercent: ROSTER_MANA.takenPercent, takenCap: ROSTER_MANA.takenCap, drops: "shipped" },
  { name: "drops-only", ...NO_DAMAGE_GAIN, drops: "shipped" },
  { name: "drops-only-slow", ...NO_DAMAGE_GAIN, drops: "slow" },
  { name: "drops-only-sparse", ...NO_DAMAGE_GAIN, drops: "sparse" },
  { name: "dealt-only-1", dealtPoints: 1, dealtPercent: 1, dealtCap: 12, takenPoints: 0, takenPercent: 1, takenCap: 0, drops: "shipped" },
  { name: "dealt-only-2", dealtPoints: 1, dealtPercent: 2, dealtCap: 6, takenPoints: 0, takenPercent: 1, takenCap: 0, drops: "shipped" },
];

export const TARGET_BARS_PER_STOCK_LOST = 0.5;

export interface MeterSide {
  readonly fighter: string;
  minutes: number;
  stocksLost: number;
  firstBarSeconds: number | null;
  firstBarStocksLost: number | null;
  dealt: number;
  taken: number;
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
  readonly sides: readonly [MeterSide, MeterSide];
}

const NEUTRAL = neutralControls();

const played = (match: Readonly<MatchState>): number => Math.max(0, match.matchFrame - match.startHold) / MATCH_TICKS_PER_SECOND;

function withMeterRate<T>({ name: _name, drops: _drops, ...rate }: MeterRate, run: () => T): T {
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

function accountFrame(own: MeterSide, was: MeterWatch, f: Readonly<Fighter>, gains: { readonly dealt: number; readonly taken: number }, drop: number, seconds: number): void {
  own.dealt += gains.dealt;
  own.taken += gains.taken;
  own.drops += drop;
  const started = f.special.action !== was.special || f.special.frame < was.specialFrame;
  if (started && f.special.action === SpecialAction.heroUltimate) own.ultimatesSpent++;
  else if (started && f.special.ex && was.mana - f.mana.points >= ROSTER_MANA.exCost) own.exSpent++;
  const rise = f.mana.points - was.mana;
  if (rise > gains.dealt + gains.taken + drop) own.other += rise - gains.dealt - gains.taken - drop;
  if (f.status.out && !was.out) own.stocksLost++;
  if (own.firstBarSeconds === null && f.mana.points >= ROSTER_MANA.max) {
    own.firstBarSeconds = seconds;
    own.firstBarStocksLost = own.stocksLost;
  }
  was.mana = f.mana.points;
  was.out = f.status.out;
  was.special = f.special.action;
  was.specialFrame = f.special.frame;
}

export function playMeterMatch(a: Character, b: Character, rate: MeterRate, options: FieldOptions, seed: number): MeterMatch | undefined {
  return withMeterRate(rate, () => {
    const opened = openFieldMatch(a, b, "frozen-throne", 0, options, seed);
    if (opened === undefined) return undefined;
    const { match, world, controls, produced, runtime, row } = opened;
    const dropRule = rate.drops === "shipped" ? undefined : startDropVariant(rate.drops, match);
    const side = (character: Character): MeterSide => ({ fighter: fighterSlug(character), minutes: 0, stocksLost: 0, firstBarSeconds: null, firstBarStocksLost: null, dealt: 0, taken: 0, drops: 0, other: 0, exSpent: 0, ultimatesSpent: 0, dropsAhead: 0, dropsEven: 0, dropsBehind: 0 });
    const sides: [MeterSide, MeterSide] = [side(a), side(b)];
    const owed = [{ dealt: 0, taken: 0 }, { dealt: 0, taken: 0 }];
    const seen = [0, 1].map((slot): MeterWatch => {
      const f = fighterAt(world, slot);
      return { mana: f.mana.points, out: f.status.out, special: f.special.action, specialFrame: f.special.frame };
    });
    let pickups = match.drops.pickupSerial;
    const limit = (match.timeLimitMinutes * 60 + 5) * MATCH_TICKS_PER_SECOND;
    let frame = 0;
    observeDamageContacts((source, target, damage) => {
      const victim = owed[target];
      if (victim !== undefined) victim.taken += takenManaGain(damage);
      const attacker = owed[source];
      if (attacker !== undefined && source !== target) attacker.dealt += dealtManaGain(damage);
    });
    try {
      while (match.phase === Phase.match && frame < limit) {
        frame = runtime.simulationFrame + 1;
        for (const gains of owed) {
          gains.dealt = 0;
          gains.taken = 0;
        }
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
            dropped[taker] = DROP_METER;
            const lead = fighterAt(world, taker).status.stocks - fighterAt(world, 1 - taker).status.stocks;
            const own = sides[taker];
            if (lead > 0) own.dropsAhead++;
            else if (lead < 0) own.dropsBehind++;
            else own.dropsEven++;
          }
        }
        if (dropRule !== undefined) advanceDropVariant(dropRule, match, world);
        for (const slot of [0, 1] as const) {
          const was = seen[slot];
          const gains = owed[slot];
          if (was !== undefined && gains !== undefined) accountFrame(sides[slot], was, fighterAt(world, slot), gains, dropped[slot] ?? 0, played(match));
        }
      }
    } finally {
      observeDamageContacts(undefined);
      if (dropRule !== undefined) endDropVariant(dropRule, match);
    }
    for (const own of sides) own.minutes = played(match) / 60;
    return { rate: rate.name, seed, sides };
  });
}

const earnedBars = (side: MeterSide): number => (side.dealt + side.taken + side.drops + side.other) / ROSTER_MANA.max;

export interface Spread {
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly mean: number;
  readonly count: number;
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
  return { q1: at(0.25), median: at(0.5), q3: at(0.75), mean, count: sorted.length };
}

export interface RateReport {
  readonly rate: string;
  readonly matches: number;
  readonly neverFull: number;
  readonly rows: readonly (readonly [string, Spread])[];
  readonly barsPerStockLost: Spread;
  readonly barsPerMatch: Spread;
  readonly drops: { readonly ahead: number; readonly even: number; readonly behind: number };
}

export function reportRate(rate: string, matches: readonly MeterMatch[]): RateReport {
  const sides = matches.flatMap((match) => match.sides);
  const full = sides.filter((side) => side.firstBarSeconds !== null);
  const losing = sides.filter((side) => side.stocksLost > 0);
  const share = (pick: (side: MeterSide) => number) => sides.filter((side) => earnedBars(side) > 0).map((side) => pick(side) / (earnedBars(side) * ROSTER_MANA.max));
  const barsPerStockLost = spread(losing.map((side) => earnedBars(side) / side.stocksLost));
  const barsPerMatch = spread(sides.map(earnedBars));
  const drops = { ahead: 0, even: 0, behind: 0 };
  for (const side of sides) {
    drops.ahead += side.dropsAhead;
    drops.even += side.dropsEven;
    drops.behind += side.dropsBehind;
  }
  return {
    rate, matches: matches.length, drops, neverFull: sides.length - full.length, barsPerStockLost, barsPerMatch,
    rows: [
      ["Seconds to first full bar (players who filled one)", spread(full.map((side) => side.firstBarSeconds ?? 0))],
      ["Stocks lost before first full bar", spread(full.map((side) => side.firstBarStocksLost ?? 0))],
      ["Full bars earned per stock lost", barsPerStockLost],
      ["Full bars earned per minute", spread(sides.map((side) => earnedBars(side) / side.minutes))],
      ["Full bars earned per match", barsPerMatch],
      ["EX specials spent per match", spread(sides.map((side) => side.exSpent))],
      ["Ultimates spent per match", spread(sides.map((side) => side.ultimatesSpent))],
      ["Share of meter from dealing damage", spread(share((side) => side.dealt))],
      ["Share of meter from taking damage", spread(share((side) => side.taken))],
      ["Drops taken per match", spread(sides.map((side) => side.dropsAhead + side.dropsEven + side.dropsBehind))],
      ["Share of meter from meter drops", spread(share((side) => side.drops))],
      ["Share of meter from steals and rituals", spread(share((side) => side.other))],
      ["Stocks lost per match", spread(sides.map((side) => side.stocksLost))],
      ["Match minutes", spread(sides.map((side) => side.minutes))],
    ],
  };
}

const fixed = (value: number): string => Number.isNaN(value) ? "-" : value.toFixed(2);
const cell = (s: Spread): string => `${fixed(s.median)} (${fixed(s.q1)}–${fixed(s.q3)}; mean ${fixed(s.mean)})`;

export function renderReports(reports: readonly RateReport[]): string {
  const lines = [
    `| Per player per match: median (quartiles; mean) | ${reports.map((report) => report.rate).join(" | ")} |`,
    `|---|${reports.map(() => "---").join("|")}|`,
  ];
  const labels = reports[0]?.rows.map(([label]) => label) ?? [];
  for (const [index, label] of labels.entries()) lines.push(`| ${label} | ${reports.map((report) => cell(report.rows[index]?.[1] ?? spread([]))).join(" | ")} |`);
  lines.push(`| Players who never filled a bar | ${reports.map((report) => `${report.neverFull} of ${2 * report.matches}`).join(" | ")} |`);
  lines.push(`| Drops taken by the fighter ahead on stocks / level / behind | ${reports.map(({ drops }) => {
    const total = drops.ahead + drops.even + drops.behind;
    const pct = (n: number) => total === 0 ? "-" : `${Math.round(100 * n / total)}%`;
    return `${pct(drops.ahead)} / ${pct(drops.even)} / ${pct(drops.behind)} of ${total}`;
  }).join(" | ")} |`);
  lines.push(`| Predicted ultimates per player per match if EX is unspent (mean bars earned) | ${reports.map((report) => fixed(report.barsPerMatch.mean)).join(" | ")} |`);
  lines.push(`| Against the target of ${TARGET_BARS_PER_STOCK_LOST} bar per stock lost (mean bars per stock lost) | ${reports.map((report) => {
    const ratio = report.barsPerStockLost.mean / TARGET_BARS_PER_STOCK_LOST;
    return `${fixed(report.barsPerStockLost.mean)}: ${ratio.toFixed(1)}× target`;
  }).join(" | ")} |`);
  return lines.join("\n");
}

const isMeterMatches = (value: unknown): value is MeterMatch[] => Array.isArray(value) && value.every((entry) => typeof entry === "object" && entry !== null && "rate" in entry && "sides" in entry);

if (import.meta.main) {
  const { values } = parseArgs({ options: { fighters: { type: "string" }, rates: { type: "string" }, tier: { type: "string" }, seed: { type: "string" }, shard: { type: "string" }, json: { type: "string" }, merge: { type: "string" } } });
  const rates = values.rates === undefined ? METER_RATES : values.rates.split(",").map((name) => {
    const rate = METER_RATES.find((known) => known.name === name);
    if (rate === undefined) throw new Error(`no meter rate ${name}; known: ${METER_RATES.map((known) => known.name).join(", ")}`);
    return rate;
  });
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
  const reports = rates.map((rate) => reportRate(rate.name, matches.filter((match) => match.rate === rate.name))).filter((report) => report.matches > 0);
  console.log(`Expert CPU field, 3 stocks, 7-minute clock, meter drops on, Frozen Throne; ${reports[0]?.matches ?? 0} matches per rate.`);
  console.log(renderReports(reports));
}
