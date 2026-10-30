import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Console, Effect, Exit, Option, Schedule, Schema } from "effect";
import { FarmFailure, RunState, currentRepo, decoded, dispatch, resolveRef, run, runTag, waitFor } from "wisp/scripts/wisp/farm";
import { FULL_SUITE_VARIABLE, GROUPS, type Group, UNKNOWN_BASE, landingGroups } from "./landingChecks";
import { groupInputKey } from "./landingInputs";
import { PREPUSH_CACHE, PrePushRefusal, type Check, checksFor, cueInputs, directoryCache, laptop, runChecks, strikeInputs } from "./prePush";

const Summary = Schema.fromJsonString(Schema.Struct({ failures: Schema.Array(Schema.String), problems: Schema.Array(Schema.String) }));

const needsPrivateStore = (check: Check) => check.privateStore === true
  ? "it reads the private input store, which hosted runners lack"
  : "it reads build inputs that only the landing machine holds";

/** The pre-push hook's checks the farm cannot run: the ones that read the private stores. */
export const localChecks = (checks: readonly Check[]): Check[] => checks.filter(({ hosted, machineTool }) => !hosted && machineTool !== true);

const WORKFLOW = "farm-test.yml";
const POLL = "3 seconds";
const PASSING = new Set(["success", "skipped"]);
const RUN_URL = /\/actions\/runs\/(\d+)/;
const TRANSIENT = /HTTP (404|50[234])/;

/** A landing's verdict from the check jobs alone, since the merge job only summarises them: failed once one fails, passed once all pass. */
export function checksVerdict(state: RunState, groups: readonly Group[] = GROUPS): "passed" | "failed" | "pending" {
  const checks = state.jobs.filter(({ name }) => (groups as readonly string[]).includes(name));
  if (checks.some(({ status, conclusion }) => status === "completed" && !PASSING.has(conclusion))) return "failed";
  if (checks.length === groups.length && checks.every(({ status, conclusion }) => status === "completed" && PASSING.has(conclusion))) return "passed";
  if (state.status === "completed") return state.conclusion === "success" ? "passed" : "failed";
  return "pending";
}

const dispatchRun = (repo: string, inputs: Readonly<Record<string, string>> & { readonly tag: string }, workflowRef: string) => Effect.gen(function*() {
  const printed = yield* run(["gh", "workflow", "run", WORKFLOW, "-R", repo, "--ref", workflowRef, ...Object.entries(inputs).flatMap(([name, value]) => ["-f", `${name}=${value}`])]);
  const id = RUN_URL.exec(printed)?.[1];
  if (id === undefined) return yield* dispatch(repo, WORKFLOW, inputs, workflowRef);
  return { databaseId: Number(id), url: `https://github.com/${repo}/actions/runs/${id}` };
});

const RunJobs = Schema.Struct({
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  jobs: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.String, conclusion: Schema.NullOr(Schema.String) })),
});

/** A run's state read over this process's own HTTPS connection, since a gh process per poll cost the landing machine more CPU than the rest of the landing gate. */
const fetchRunState = (repo: string, id: number, token: string) => Effect.tryPromise({
  try: async () => {
    const read = async (path: string) => {
      const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${id}${path}`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "smashcraft-landing-farm" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for run ${id}${path}`);
      return response.json() as Promise<object>;
    };
    const [state, jobs] = await Promise.all([read(""), read("/jobs?per_page=100")]);
    return JSON.stringify({ ...state, ...jobs });
  },
  catch: (cause) => new FarmFailure({ problem: cause instanceof Error ? cause.message : String(cause) }),
}).pipe(
  Effect.flatMap((text) => decoded(RunJobs, text)),
  Effect.map(({ status, conclusion, jobs }): RunState => ({
    status, conclusion: conclusion ?? "", jobs: jobs.map((job) => ({ ...job, conclusion: job.conclusion ?? "" })),
  })),
);

const awaitChecks = (repo: string, id: number, groups: readonly Group[]) => Effect.gen(function*() {
  const token = yield* run(["gh", "auth", "token"]);
  for (;;) {
    const verdict = checksVerdict(yield* fetchRunState(repo, id, token).pipe(
      // GitHub answers 404 for a just-dispatched run's jobs until it lists them, and a passing 502, 503 or 504 under load.
      Effect.retry({ while: (failure) => TRANSIENT.test(failure.message), schedule: Schedule.spaced(POLL).pipe(Schedule.upTo({ duration: "1 minute" })) }),
    ), groups);
    if (verdict !== "pending") return verdict;
    yield* Effect.sleep(POLL);
  }
});

const farmRun: FarmRunner = (head, base, groups, full) => Effect.scoped(Effect.gen(function*() {
  const repo = yield* currentRepo;
  const published = process.env.SAFE_PUSH_LAND_REF ?? "";
  const { ref, scratch } = published === "" ? yield* resolveRef(head, repo) : { ref: yield* run(["git", "rev-parse", `${head}^{commit}`]), scratch: published };
  const found = yield* dispatchRun(repo, { ref, base, checks: JSON.stringify(groups), ...(full ? { full: "1" } : {}), tag: runTag() }, scratch ?? "main");
  yield* Console.error(`landing farm: ${found.url}`);
  const started = performance.now();
  const verdict = yield* awaitChecks(repo, found.databaseId, groups);
  const seconds = ((performance.now() - started) / 1000).toFixed(0);
  if (verdict === "passed") return yield* Console.error(`landing farm: ${groups.join(", ")} passed on ${ref.slice(0, 12)} (${seconds} s): ${found.url}`);
  const state = yield* waitFor(repo, found.databaseId);
  const folder = mkdtempSync(join(tmpdir(), "landing-farm-"));
  const detail = yield* run(["gh", "run", "download", String(found.databaseId), "-R", repo, "-n", "farm-test-summary", "-D", folder]).pipe(
    Effect.flatMap(() => Schema.decodeEffect(Summary)(readFileSync(join(folder, "summary.json"), "utf8"))),
    Effect.map(({ failures, problems }) => [...failures.map((name) => `FAIL ${name}`), ...problems.map((problem) => `PROBLEM ${problem}`)]),
    Effect.orElseSucceed(() => [`no summary: gh run view ${found.databaseId} -R ${repo} --log-failed`]),
    Effect.ensuring(Effect.sync(() => rmSync(folder, { recursive: true, force: true }))),
  );
  return yield* new FarmFailure({ problem: `${[...detail, `landing farm: ${state.conclusion} on ${ref.slice(0, 12)}: ${found.url}`].join("\n")}` });
}));

/**
 * The landing gate for safe-push's land.check: the farm-test.yml groups the diff reaches
 * run on GitHub's runners beside the checks that need this machine's private stores.
 */
export type FarmRunner = (head: string, base: string, groups: readonly Group[], full: boolean) => Effect.Effect<void, unknown>;

export interface Gate { readonly farm: FarmRunner; readonly cache: ReturnType<typeof directoryCache>; readonly listing: (head: string) => Effect.Effect<string, unknown> }

const machine: Gate = { farm: farmRun, cache: directoryCache(PREPUSH_CACHE), listing: (head) => run(["git", "ls-tree", "-r", "--full-tree", head]) };

export const landOnFarm = (base: string, head: string, { farm: farmer, cache, listing: listingOf }: Gate = machine) => Effect.gen(function*() {
  const paths = base === "" ? [UNKNOWN_BASE] : (yield* run(["git", "diff", "--name-only", base, head])).split("\n").filter((path) => path !== "");
  const full = process.env[FULL_SUITE_VARIABLE] === "1";
  const groups = landingGroups(paths, full);
  const here = localChecks(checksFor(paths, cueInputs(), strikeInputs()));
  yield* Console.error(`landing farm: ${paths.length} changed path${paths.length === 1 ? "" : "s"}; farm groups ${groups.length === 0 ? "none" : groups.join(", ")}`);
  for (const check of here) yield* Console.error(`landing local: ${check.name}: ${needsPrivateStore(check)}`);
  const dirty = here.length === 0 ? "" : yield* laptop.dirty(["."]);
  if (dirty !== "") return yield* new PrePushRefusal({ problem: `landing local: the checks read the working tree, so land the clean checked-out commit.\n${dirty}` });
  const listing = groups.length === 0 ? "" : yield* listingOf(head);
  const keys = new Map(groups.map((group) => [group, groupInputKey(group, full ? [UNKNOWN_BASE] : paths, listing)] as const));
  const proven = yield* Effect.filter(groups, (group) => cache.has(keys.get(group) ?? ""));
  for (const group of proven) yield* Console.error(`landing farm: ${group} reused, it passed before on these inputs (${(keys.get(group) ?? "").slice(0, 12)})`);
  const pending = groups.filter((group) => !proven.includes(group));
  const farm = groups.length === 0 ? Console.error("landing farm: no farm group is reached, so nothing runs there")
    : pending.length === 0 ? Effect.void
    : farmer(head, base, pending, full).pipe(Effect.tap(() => Effect.forEach(pending, (group) => cache.record(keys.get(group) ?? ""), { discard: true })));
  yield* Effect.all([farm, runChecks(here, laptop)], { concurrency: "unbounded", discard: true });
});

if (import.meta.main) {
  const exit = await Effect.runPromiseExit(landOnFarm(process.env.SAFE_PUSH_LAND_BASE || "", process.env.SAFE_PUSH_LAND_HEAD || "HEAD"));
  if (Exit.isFailure(exit)) {
    const failure = Exit.findErrorOption(exit);
    console.error(Option.isSome(failure) ? (failure.value as Error).message : String(exit.cause));
    process.exit(1);
  }
}
