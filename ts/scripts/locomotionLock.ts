import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect } from "effect";
import { ChildProcess } from "effect/process";
import type { model as mdx } from "war3-model";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { advanceFighter } from "../src/game/sim/step";
import { advanceFighterPose, createFighterPose } from "../src/game/presentation/fighterPose";
import { FRAME_SECONDS } from "../src/game/presentation/frameClock";
import { IllidanLocomotion } from "../src/game/presentation/illidanMotion";
import { INPUTS_STORE, MANIFEST, readManifest, wholeFamily } from "./wisp/buildInputs";
import { projectRoot } from "./wisp/project";
import { parseModelMDX } from "./mdxCodec";
import { runProcess } from "./hostProcess";
import { transforms } from "./modelTracks";
import { LOCOMOTION_RECORD, LOCOMOTION_TRAILER } from "./locomotionRecord";

const FIGHTER = "illidan";
const SAMPLE_FRAMES = 40;
const STEADY_FRAMES = 15;

type Gait = "walk" | "run";
export interface GaitPrint { readonly sequence: string; readonly clip: number; readonly frames: number; readonly looping: boolean; readonly keys: number; readonly poseDigest: string; readonly stride: number }
export type LocomotionRecord = Readonly<Record<string, Readonly<Record<Gait, GaitPrint>>>>;

function steadyGait(walking: boolean): { readonly clip: number; readonly stride: number } {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const world = createRoster(1, [f]);
  const pose = createFighterPose();
  const input = neutralControls();
  input.direction = 1;
  input.walking = walking;
  const motion = walking ? IllidanLocomotion.walk : IllidanLocomotion.run;
  const samples: { clip: number | undefined; stride: number }[] = [];
  for (let frame = 1; frame <= SAMPLE_FRAMES; frame++) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    if (frame > SAMPLE_FRAMES - STEADY_FRAMES) samples.push({ clip: pose.motion.motion === motion ? pose.clipIndex : undefined, stride: Math.abs(f.motion.vx) / FRAME_SECONDS / pose.rate });
  }
  const clips = new Set(samples.map(({ clip }) => clip));
  const [clip] = clips;
  if (clips.size !== 1 || clip === undefined) throw new Error(`Illidan's steady ${walking ? "walk" : "run"} plays clips ${[...clips].join(", ")}, not one clip in that gait`);
  return { clip, stride: Math.round(samples.reduce((sum, { stride }) => sum + stride, 0) / samples.length * 10) / 10 };
}

function sequencePrint(model: mdx.Model, clip: number, stride: number): GaitPrint {
  const sequence = model.Sequences[clip];
  if (sequence === undefined) throw new Error(`Illidan's model has no sequence ${clip}`);
  const [start = 0, end = 0] = sequence.Interval;
  const hasher = new Bun.CryptoHasher("sha256");
  let keys = 0;
  transforms(model, (track, node, channel) => {
    const run = track.Keys.filter((key) => key.Frame >= start && key.Frame <= end);
    if (run.length === 0) return;
    keys += run.length;
    hasher.update(`${node.Name} ${channel} ${track.LineType}\n`);
    for (const key of run) hasher.update(`${key.Frame - start} ${Array.from(key.Vector as ArrayLike<number>).join(",")} ${Array.from((key.InTan ?? []) as ArrayLike<number>).join(",")} ${Array.from((key.OutTan ?? []) as ArrayLike<number>).join(",")}\n`);
  });
  return { sequence: sequence.Name, clip, frames: end - start, looping: sequence.NonLooping !== true, keys, poseDigest: hasher.digest("hex"), stride };
}

export function locomotionPrint(model: mdx.Model): Record<Gait, GaitPrint> {
  const walk = steadyGait(true), run = steadyGait(false);
  return { walk: sequencePrint(model, walk.clip, walk.stride), run: sequencePrint(model, run.clip, run.stride) };
}

export function changedGaits(expected: LocomotionRecord, actual: LocomotionRecord): string[] {
  return Object.entries(actual).flatMap(([fighter, gaits]) => (Object.keys(gaits) as Gait[])
    .filter((gait) => JSON.stringify(expected[fighter]?.[gait]) !== JSON.stringify(gaits[gait])).map((gait) => `${fighter} ${gait}`));
}

export const namedChanges = (trailers: readonly string[], changes: readonly string[]): string[] =>
  changes.filter((change) => !trailers.some((trailer) => trailer.toLowerCase().startsWith(change)));

const git = (...args: string[]) => runProcess(ChildProcess.make("git", args, { cwd: projectRoot }));

const recordAt = (commit: string) => git("show", `${commit}:${LOCOMOTION_RECORD}`).pipe(
  Effect.map((text) => JSON.parse(text) as LocomotionRecord),
  Effect.orElseSucceed((): LocomotionRecord => ({})),
);

const args = process.argv.slice(2);
const recording = args.includes("--record");
const modelArg = args.indexOf("--model") >= 0 ? args[args.indexOf("--model") + 1] : undefined;

const program = Effect.gen(function*() {
  const modelPath = modelArg ?? join(yield* wholeFamily(yield* readManifest(MANIFEST), "illidan-animation"), "DemonHunterFighter.mdx");
  if (!existsSync(modelPath)) {
    if (process.env.GITHUB_ACTIONS === "true") return yield* Console.log(`locomotion lock: skipped on a hosted runner, which has no private input store (${INPUTS_STORE})`);
    yield* Console.error(`locomotion lock: ${modelPath} is missing; run \`bun wisp inputs fetch gex45\` from ts/`);
    return yield* Effect.sync(() => process.exit(1));
  }
  const actual: LocomotionRecord = { [FIGHTER]: locomotionPrint(parseModelMDX(yield* Effect.promise(() => Bun.file(modelPath).arrayBuffer()))) };
  const recordPath = join(projectRoot, LOCOMOTION_RECORD);
  if (recording) {
    writeFileSync(recordPath, `${JSON.stringify(actual, null, 2)}\n`);
    return yield* Console.log(`locomotion lock: recorded ${changedGaits({}, actual).join(", ")} in ${LOCOMOTION_RECORD}; name each changed gait in a ${LOCOMOTION_TRAILER} trailer`);
  }
  const committed = JSON.parse(readFileSync(recordPath, "utf8")) as LocomotionRecord;
  const drifted = changedGaits(committed, actual);
  if (drifted.length > 0) {
    yield* Console.error([`locomotion lock: ${drifted.join(", ")} no longer ${drifted.length === 1 ? "matches" : "match"} ${LOCOMOTION_RECORD} (model ${modelPath}).`,
      ...drifted.map((change) => { const [fighter = "", gait = ""] = change.split(" "); return `  ${change}: recorded ${JSON.stringify(committed[fighter]?.[gait as Gait])}\n  ${" ".repeat(change.length)}  now      ${JSON.stringify(actual[fighter]?.[gait as Gait])}`; }),
      "A change to another move must not change locomotion: regenerate the model from the current pinned input so these clips keep their keys.",
      `Only an intended walk or run change re-records: bun scripts/locomotionLock.ts --record, with a "${LOCOMOTION_TRAILER}: ${drifted[0]}: why" trailer.`].join("\n"));
    return yield* Effect.sync(() => process.exit(1));
  }
  if (modelArg === undefined) {
    const base = yield* git("merge-base", "HEAD", "origin/main");
    const trailers = (yield* git("log", `--format=%(trailers:key=${LOCOMOTION_TRAILER},valueonly)`, `${base}..HEAD`)).split("\n").filter((line) => line.trim() !== "");
    const unnamed = namedChanges(trailers, changedGaits(yield* recordAt(base), committed));
    if (unnamed.length > 0) {
      yield* Console.error(`locomotion lock: ${LOCOMOTION_RECORD} changes ${unnamed.join(", ")} without naming it; add a "${LOCOMOTION_TRAILER}: ${unnamed[0]}: why" trailer to the commit that re-records it.`);
      return yield* Effect.sync(() => process.exit(1));
    }
  }
  yield* Console.log(`locomotion lock: ${changedGaits({}, actual).map((change) => { const [fighter = "", gait = ""] = change.split(" "); const print = actual[fighter]![gait as Gait]; return `${change} plays ${print.sequence} (${print.keys} keys, stride ${print.stride})`; }).join("; ")} as recorded`);
});

if (import.meta.main) BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
