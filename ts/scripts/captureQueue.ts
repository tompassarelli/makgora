import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";
import { SCORED_NORMALS, SCORED_SPECIALS } from "./wisp/animScoreSample";

export class CaptureQueueFailure extends Schema.TaggedError<CaptureQueueFailure>()("CaptureQueueFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

export const queueRoot = (): string => process.env.SMASHCRAFT_CAPTURE_QUEUE ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "smashcraft/capture-queue");
export const queueDirectory = (part: "pending" | "taken" | "results" | "batches") => join(queueRoot(), part);

export const Job = Schema.Struct({
  version: Schema.Literal(1), id: Schema.String, lane: Schema.String, revision: Schema.String,
  fighter: Schema.String, move: Schema.String, crop: Schema.optionalKey(Schema.Array(Schema.Int)), submitted: Schema.String,
});
export type Job = typeof Job.Type;
export const Result = Schema.Struct({
  id: Schema.String, lane: Schema.String, revision: Schema.String, fighter: Schema.String, move: Schema.String, batch: Schema.String,
  status: Schema.Literals(["captured", "failed"]), problem: Schema.optionalKey(Schema.String),
  mapSha256: Schema.optionalKey(Schema.String), sourceRevision: Schema.optionalKey(Schema.String), fixtures: Schema.optionalKey(Schema.Array(Schema.String)),
  sheet: Schema.optionalKey(Schema.String), judge: Schema.optionalKey(Schema.String), frames: Schema.optionalKey(Schema.String),
});
export type Result = typeof Result.Type;

const SPECIAL_SLOTS: Readonly<Record<string, string>> = { "neutral-special": "neutral_b", "side-special": "side_b", "up-special": "up_b", "down-special": "down_b", ultimate: "ultimate" };
export const showcaseSlot = (move: string): string => SPECIAL_SLOTS[move] ?? move.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
export const capturableMove = (move: string): boolean => [...SCORED_NORMALS, ...SCORED_SPECIALS].some(row => row.move === move);

export const writeAtomic = (path: string, text: string) => {
  writeFileSync(`${path}.tmp`, text);
  renameSync(`${path}.tmp`, path);
};

export const git = (cwd: string, args: readonly string[], allowFailure = false) => Effect.gen(function*() {
  const run = yield* Effect.try({ try: () => Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "capture-queue", GIT_AUTHOR_EMAIL: "capture-queue@localhost", GIT_COMMITTER_NAME: "capture-queue", GIT_COMMITTER_EMAIL: "capture-queue@localhost" } }), catch: cause => new CaptureQueueFailure({ problem: `git ${args.join(" ")}: ${String(cause)}` }) });
  if (run.exitCode !== 0 && !allowFailure) return yield* new CaptureQueueFailure({ problem: `git ${args.join(" ")}: ${run.stderr.toString().trim()}` });
  return { code: run.exitCode ?? 1, out: run.stdout.toString().trim() };
});

const option = (args: readonly string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

const fail = (problem: string) => new CaptureQueueFailure({ problem });

const attempt = <A>(problem: string, run: () => A | Promise<A>) =>
  Effect.tryPromise({ try: async () => run(), catch: cause => new CaptureQueueFailure({ problem: `${problem}: ${cause instanceof Error ? cause.message : String(cause)}` }) });

export const newJob = (input: { readonly lane: string; readonly fighter: string; readonly move: string; readonly crop: string | undefined; readonly cwd: string; readonly rev: string; readonly now: Date }) => Effect.gen(function*() {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(input.lane)) return yield* fail("--lane is a lowercase lane name such as sc-568");
  if (!SELECTABLE_CHARACTERS.some(character => fighterSlug(character) === input.fighter)) return yield* fail(`unknown fighter ${input.fighter}`);
  if (!capturableMove(input.move)) return yield* fail(`unknown move ${input.move}; use an anim score move name such as up-air or side-special`);
  const crop = input.crop?.split(",").map(Number);
  if (crop !== undefined && (crop.length !== 4 || !crop.every(value => Number.isInteger(value) && value >= 0))) return yield* fail("--crop takes X,Y,W,H in whole captured-screen pixels");
  const revision = (yield* git(input.cwd, ["rev-parse", "--verify", `${input.rev}^{commit}`])).out;
  if (input.rev === "HEAD" && (yield* git(input.cwd, ["status", "--porcelain", "--untracked-files=no"])).out !== "") return yield* fail("the lane has uncommitted changes to tracked files; commit the take first so the capture is of exactly that revision");
  const id = `${input.lane}-${input.fighter.replace(/[^a-z0-9]+/g, "")}-${input.move}-${input.now.getTime().toString(36)}`;
  const job: Job = { version: 1, id, lane: input.lane, revision, fighter: input.fighter, move: input.move, ...(crop === undefined ? {} : { crop }), submitted: input.now.toISOString() };
  return job;
});

export const enqueue: Command = args => Effect.gen(function*() {
  const lane = option(args, "--lane"), fighter = option(args, "--fighter"), move = option(args, "--move");
  if (lane === undefined || fighter === undefined || move === undefined) return yield* new UsageFailure({ problem: "anim capture enqueue --lane NAME --fighter SLUG --move MOVE [--rev REV] [--crop X,Y,W,H]" });
  const job = yield* newJob({ lane, fighter, move, crop: option(args, "--crop"), cwd: process.cwd(), rev: option(args, "--rev") ?? "HEAD", now: new Date() });
  yield* attempt("write the job", () => {
    mkdirSync(queueDirectory("pending"), { recursive: true });
    writeAtomic(join(queueDirectory("pending"), `${job.id}.json`), `${JSON.stringify(job, null, 1)}\n`);
  });
  yield* Console.log(`queued ${job.id} (${job.fighter} ${job.move} at ${job.revision.slice(0, 10)}); wait with: bun wisp anim capture wait ${job.id}`);
});

export const readResult = (id: string): Result | undefined => {
  const path = join(queueDirectory("results"), id, "result.json");
  return existsSync(path) ? Schema.decodeSync(Schema.fromJsonString(Result))(readFileSync(path, "utf8")) : undefined;
};

export const wait: Command = args => Effect.gen(function*() {
  const [id] = args;
  const minutes = Number(option(args, "--minutes") ?? "45");
  if (id === undefined || !Number.isFinite(minutes) || minutes <= 0) return yield* new UsageFailure({ problem: "anim capture wait ID [--minutes N]" });
  const deadline = Date.now() + minutes * 60_000;
  let result = yield* attempt("read the result", () => readResult(id));
  while (result === undefined) {
    if (Date.now() > deadline) return yield* new CaptureQueueFailure({ problem: `${id}: no result within ${minutes} minutes; is \`bun wisp anim capture serve\` running on this host? (${queueRoot()})` });
    yield* Effect.sleep("5 seconds");
    result = yield* attempt("read the result", () => readResult(id));
  }
  yield* Console.log(JSON.stringify(result, null, 1));
  if (result.status === "failed") return yield* new CaptureQueueFailure({ problem: `${id}: ${result.problem ?? "capture failed"}` });
  yield* Console.log(`judge it with: bun wisp anim judge run ${result.judge}`);
});

export const status: Command = () => attempt("read the queue", () => {
  const list = (part: "pending" | "taken") => existsSync(queueDirectory(part)) ? readdirSync(queueDirectory(part)).filter(name => name.endsWith(".json")).map(name => name.replace(/\.json$/, "")) : [];
  console.log(JSON.stringify({ root: queueRoot(), pending: list("pending"), capturing: list("taken") }, null, 1));
});

