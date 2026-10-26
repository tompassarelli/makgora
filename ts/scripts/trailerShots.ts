import { parseArgs } from "node:util";
import { selectableCharacterBySlug } from "../src/game/roster/kits";
import { MATCH_TICKS_PER_SECOND } from "../src/game/lobby/lobbyState";
import { type ComboRecord, type MatchRecord, moveName, playCpuMatch, reportedMove } from "./cpuField";
import { type MatchSpec, DEFAULT_CONFIG, planMatches } from "./playtestCore";
import { ROSTER } from "./playtest";

const LEAD_FRAMES = 45;
const TAIL_FRAMES = 45;
const LONGEST_FRAMES = 8 * MATCH_TICKS_PER_SECOND;
const SHORTEST_FRAMES = 4 * MATCH_TICKS_PER_SECOND;
const TARGET_FRAMES = 75 * MATCH_TICKS_PER_SECOND;
const MOST_FRAMES = 90 * MATCH_TICKS_PER_SECOND;
const MOST_SHOTS = 15;

export interface Shot {
  readonly spec: MatchSpec;
  readonly start: number;
  readonly end: number;
  readonly fighters: readonly string[];
  readonly why: string;
  readonly score: number;
}

interface Beat {
  readonly start: number;
  readonly moves: readonly string[];
  readonly damage: number;
}

function beat(combo: ComboRecord | undefined, from: number, to: number): Beat {
  const end = to + TAIL_FRAMES;
  if (combo === undefined) return { start: Math.max(0, Math.min(from - LEAD_FRAMES, end - SHORTEST_FRAMES)), moves: [], damage: 0 };
  const floor = end - LONGEST_FRAMES + LEAD_FRAMES;
  const hits = combo.hitFrames.flatMap((frame, hit) => (frame >= floor ? [hit] : []));
  const first = combo.hitFrames[hits[0] ?? 0] ?? from;
  const moves = hits.filter((hit, index) => index === 0 || combo.instances[hit] !== combo.instances[hit - 1]).map((hit) => {
    const move = combo.moves[hit] ?? -1;
    return move < 0 ? "?" : moveName(reportedMove(move));
  });
  return { start: Math.max(0, Math.min(first - LEAD_FRAMES, end - SHORTEST_FRAMES)), moves, damage: hits.reduce((sum, hit) => sum + (combo.damages[hit] ?? 0), 0) };
}

const strung = (moves: readonly string[]): string => (moves.length === 1 ? `a ${moves[0]}` : `${moves.slice(0, -1).join(", ")} and ${moves.at(-1)}`);
const flair = (moves: readonly string[]): number => moves.length + (moves.includes("ultimate") ? 3 : 0);
const lengthCost = (start: number, end: number): number => (0.4 * (end - start)) / MATCH_TICKS_PER_SECOND;

export function shotsOf(spec: MatchSpec, record: MatchRecord): Shot[] {
  const shots: Shot[] = [];
  const combos = record.combos ?? [];
  for (const victim of [0, 1] as const) {
    const attacker = record.sides[victim === 0 ? 1 : 0].fighter;
    const target = record.sides[victim].fighter;
    const fighters = [attacker, target];
    const kills = new Set<number>();
    for (const loss of record.sides[victim].stockLosses) {
      if (loss.selfDestruct || loss.sinceHit === undefined) continue;
      kills.add(loss.frame);
      const combo = combos.find((candidate) => candidate.victim === victim && candidate.frame === loss.frame);
      const { start, moves, damage } = beat(combo, loss.frame - loss.sinceHit, loss.frame);
      const end = loss.frame + TAIL_FRAMES;
      const edgeguard = loss.recovering === true;
      const percent = loss.percent ?? 0;
      const opening = moves.length === 0 ? `${attacker} KOs ${target}` : `${attacker} lands ${strung(moves)} (${Math.round(damage)}%) and KOs ${target}`;
      const why = `${opening} off the ${loss.blast ?? "side"} at ${percent}%${edgeguard ? ", edgeguarded while recovering" : ""}`;
      shots.push({ spec, start, end, fighters, why, score: 6 + flair(moves) + damage / 15 + (percent < 90 ? 2 : 0) + (edgeguard ? 2 : 0) - lengthCost(start, end) });
    }
    for (const combo of combos) {
      if (combo.victim !== victim || kills.has(combo.frame)) continue;
      const last = combo.hitFrames.at(-1) ?? combo.frame;
      const { start, moves, damage } = beat(combo, combo.hitFrames[0] ?? last, last);
      if (moves.length < 4 || damage < 30) continue;
      const end = last + TAIL_FRAMES;
      shots.push({ spec, start, end, fighters, why: `${attacker} strings ${target} with ${strung(moves)} for ${Math.round(damage)}%`, score: flair(moves) + damage / 15 - lengthCost(start, end) });
    }
  }
  return shots;
}

export function pickShots(candidates: readonly Shot[]): Shot[] {
  const picked: Shot[] = [];
  const fighters = new Set<string>();
  const stages = new Set<string>();
  let frames = 0;
  while (picked.length < MOST_SHOTS && frames < TARGET_FRAMES) {
    const seeds = new Set(picked.map((shot) => shot.spec.seed));
    let best: Shot | undefined;
    let bestValue = -Infinity;
    for (const shot of candidates) {
      if (seeds.has(shot.spec.seed) || frames + shot.end - shot.start > MOST_FRAMES) continue;
      const value = shot.score + 4 * shot.fighters.filter((fighter) => !fighters.has(fighter)).length + (stages.has(shot.spec.stage) ? 0 : 3);
      if (value > bestValue) [best, bestValue] = [shot, value];
    }
    if (best === undefined) break;
    picked.push(best);
    frames += best.end - best.start;
    for (const fighter of best.fighters) fighters.add(fighter);
    stages.add(best.spec.stage);
  }
  return picked.toSorted((left, right) => left.spec.seed - right.spec.seed);
}

export function playExpert(spec: MatchSpec): MatchRecord {
  const a = selectableCharacterBySlug(spec.a);
  const b = selectableCharacterBySlug(spec.b);
  if (a === undefined || b === undefined || spec.tier !== "expert") throw new Error(`seed ${spec.seed} is not an Expert computer match`);
  const record = playCpuMatch(a, b, spec.stage, 0, { tiers: ["expert", "expert"], frameCap: DEFAULT_CONFIG.frameCap, playtest: true, bufferedAttacks: true }, spec.seed);
  if (record === undefined) throw new Error(`no spawn for ${spec.stage}`);
  return record;
}

const seconds = (frames: number): string => (frames / MATCH_TICKS_PER_SECOND).toFixed(1);

export function renderShots(shots: readonly Shot[]): string {
  const frames = shots.reduce((sum, shot) => sum + shot.end - shot.start, 0);
  const lines = [
    `${shots.length} shots, ${seconds(frames)} s, ${new Set(shots.flatMap((shot) => shot.fighters)).size} fighters, ${new Set(shots.map((shot) => shot.spec.stage)).size} stages`,
    "",
    "| Seed | Fighters | Stage | Frames | Seconds | Why it reads |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const shot of shots) {
    lines.push(`| ${shot.spec.seed} | ${shot.spec.a} vs ${shot.spec.b} | ${shot.spec.stage} | ${shot.start}–${shot.end} | ${seconds(shot.end - shot.start)} | ${shot.why} |`);
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { first: { type: "string" }, count: { type: "string" }, seeds: { type: "string" } }, strict: true });
  const specs = values.seeds === undefined
    ? planMatches(ROSTER, Number(values.first ?? 0), Number(values.count ?? 400)).filter((spec) => spec.tier === "expert")
    : values.seeds.split(",").map((seed) => planMatches(ROSTER, Number(seed), 1)[0]).filter((spec) => spec !== undefined);
  const candidates = specs.flatMap((spec) => shotsOf(spec, playExpert(spec)));
  console.log(renderShots(values.seeds === undefined ? pickShots(candidates) : candidates.toSorted((left, right) => right.score - left.score)));
}
