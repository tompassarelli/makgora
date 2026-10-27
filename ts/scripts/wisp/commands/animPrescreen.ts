import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Console, Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { JUDGE_LINES } from "../animJudgeIdentity";
import type { Character } from "../../../src/game/sim/codes";
import { fighterSlug } from "../../../src/game/roster/kits";
import { projectRoot } from "../project";
import { judgeRun } from "./animJudgeRun";

export const PRESCREEN_FILE = join(projectRoot, "build/anim-prescreen/prescreen.jsonl");
export const PRESCREEN_STOP_BELOW = 3;

export interface PrescreenVerdict { readonly verdict: "go" | "stop"; readonly mean: number; readonly lowest: number }

export function prescreenVerdict(scores: Readonly<Record<(typeof JUDGE_LINES)[number], number>>, stopBelow: number): PrescreenVerdict {
  const lines = JUDGE_LINES.map((line) => scores[line]);
  const mean = lines.reduce((sum, value) => sum + value, 0) / lines.length;
  return { verdict: mean < stopBelow ? "stop" : "go", mean, lowest: Math.min(...lines) };
}

export interface PrescreenOptions { readonly fighter: string; readonly move: string; readonly stopBelow: number; readonly claude: string | undefined; readonly resultFile: string; readonly renderSeconds: number }

export const prescreenJudge = (directory: string, options: PrescreenOptions) => Effect.gen(function*() {
  const judge = `prescreen-${Date.now().toString(36)}`;
  const started = performance.now();
  yield* judgeRun([directory, "--judge", judge, ...(options.claude === undefined ? [] : ["--claude", options.claude])]);
  const scoresFile = readdirSync(directory).find((name) => name === `scores-${judge}.jsonl`);
  const line = scoresFile === undefined ? undefined : readFileSync(join(directory, scoresFile), "utf8").split("\n").find((text) => text.trim() !== "");
  if (line === undefined) return yield* new UsageFailure({ problem: `the viewer returned no scores for ${options.fighter}/${options.move}` });
  const scores = JSON.parse(line) as Record<(typeof JUDGE_LINES)[number], number> & { readonly note: string };
  const result = prescreenVerdict(scores, options.stopBelow);
  const viewerSeconds = (performance.now() - started) / 1000;
  mkdirSync(dirname(options.resultFile), { recursive: true });
  appendFileSync(options.resultFile, `${JSON.stringify({ fighter: options.fighter, move: options.move, judge, ...result, stopBelow: options.stopBelow, scores: JUDGE_LINES.map((name) => scores[name]), note: scores.note, renderSeconds: Math.round(options.renderSeconds * 10) / 10, viewerSeconds: Math.round(viewerSeconds * 10) / 10 })}\n`);
  const wall = options.renderSeconds + viewerSeconds;
  yield* Console.log(`${result.verdict}: ${options.fighter} ${options.move} prescreen mean ${result.mean.toFixed(1)}, lowest ${result.lowest} (stops below ${options.stopBelow}); lines ${JUDGE_LINES.map((name) => `${name} ${scores[name]}`).join(", ")}; render ${options.renderSeconds.toFixed(1)} s + one cold viewer ${viewerSeconds.toFixed(1)} s = wall ${wall.toFixed(1)} s; native capture and three viewers still decide the box`);
  return result;
});

const FLAGS = ["--fighter", "--move", "--threshold", "--assets", "--claude"];

export const prescreenCommand = (prepare: Command, selectFighters: (names: readonly string[]) => Effect.Effect<readonly Character[], UsageFailure>): Command => (args) => Effect.gen(function*() {
  const flags = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if (flag === undefined || value === undefined || !FLAGS.includes(flag)) { flags.clear(); break; }
    flags.set(flag, value);
  }
  const move = flags.get("--move"), name = flags.get("--fighter"), stopBelow = Number(flags.get("--threshold") ?? PRESCREEN_STOP_BELOW), assets = flags.get("--assets");
  if (move === undefined || name === undefined || !Number.isFinite(stopBelow)) return yield* new UsageFailure({ problem: "anim prescreen --fighter SLUG --move MOVE [--threshold N] [--assets DIR] [--claude BIN]" });
  const [character] = yield* selectFighters([name]);
  const slug = fighterSlug(character ?? 0);
  const directory = mkdtempSync(join(tmpdir(), "anim-prescreen-"));
  const started = performance.now();
  yield* Effect.gen(function*() {
    yield* prepare(["--out", directory, "--move", `${slug}:${move}`, ...(assets === undefined ? [] : ["--assets", assets])]);
    const renderSeconds = (performance.now() - started) / 1000;
    yield* prescreenJudge(directory, { fighter: slug, move, stopBelow, claude: flags.get("--claude"), resultFile: PRESCREEN_FILE, renderSeconds });
  }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
});
