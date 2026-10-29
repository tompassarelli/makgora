import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Console, Effect, Exit, Option, Schema } from "effect";
import { FarmFailure, currentRepo, dispatch, resolveRef, run, runTag, waitFor } from "wisp/scripts/wisp/farm";
import { FULL_SUITE_VARIABLE, type Group, UNKNOWN_BASE, landingGroups } from "./landingChecks";
import { groupInputKey } from "./landingInputs";
import { PREPUSH_CACHE, PrePushRefusal, type Check, checksFor, cueInputs, directoryCache, laptop, runChecks, strikeInputs } from "./prePush";

const Summary = Schema.fromJsonString(Schema.Struct({ failures: Schema.Array(Schema.String), problems: Schema.Array(Schema.String) }));

const needsPrivateStore = (check: Check) => check.privateStore === true
  ? "it reads the private input store, which hosted runners lack"
  : "it reads build inputs that only the landing machine holds";

/** The pre-push hook's checks the farm cannot run: the ones that read the private stores. */
export const localChecks = (checks: readonly Check[]): Check[] => checks.filter(({ hosted, machineTool }) => !hosted && machineTool !== true);

const farmRun: FarmRunner = (head, base, groups) => Effect.scoped(Effect.gen(function*() {
  const repo = yield* currentRepo;
  const { ref, scratch } = yield* resolveRef(head, repo);
  const found = yield* dispatch(repo, "farm-test.yml", { ref, base, checks: groups.join(","), tag: runTag() }, scratch);
  const started = performance.now();
  const state = yield* waitFor(repo, found.databaseId);
  const minutes = ((performance.now() - started) / 60000).toFixed(1);
  if (state.conclusion === "success") return yield* Console.error(`landing farm: ${groups.join(", ")} passed on ${ref.slice(0, 12)} (${minutes} min): ${found.url}`);
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
export type FarmRunner = (head: string, base: string, groups: readonly Group[]) => Effect.Effect<void, unknown>;

export interface Gate { readonly farm: FarmRunner; readonly cache: ReturnType<typeof directoryCache>; readonly listing: (head: string) => Effect.Effect<string, unknown> }

const machine: Gate = { farm: farmRun, cache: directoryCache(PREPUSH_CACHE), listing: (head) => run(["git", "ls-tree", "-r", "--full-tree", head]) };

export const landOnFarm = (base: string, head: string, { farm: farmer, cache, listing: listingOf }: Gate = machine) => Effect.gen(function*() {
  const paths = base === "" ? [UNKNOWN_BASE] : (yield* run(["git", "diff", "--name-only", base, head])).split("\n").filter((path) => path !== "");
  const groups = landingGroups(paths, process.env[FULL_SUITE_VARIABLE] === "1");
  const here = localChecks(checksFor(paths, cueInputs(), strikeInputs()));
  yield* Console.error(`landing farm: ${paths.length} changed path${paths.length === 1 ? "" : "s"}; farm groups ${groups.length === 0 ? "none" : groups.join(", ")}`);
  for (const check of here) yield* Console.error(`landing local: ${check.name}: ${needsPrivateStore(check)}`);
  const dirty = here.length === 0 ? "" : yield* laptop.dirty(["."]);
  if (dirty !== "") return yield* new PrePushRefusal({ problem: `landing local: the checks read the working tree, so land the clean checked-out commit.\n${dirty}` });
  const listing = groups.length === 0 ? "" : yield* listingOf(head);
  const keys = new Map(groups.map((group) => [group, groupInputKey(group, paths, true, listing)] as const));
  const proven = yield* Effect.filter(groups, (group) => cache.has(keys.get(group) ?? ""));
  for (const group of proven) yield* Console.error(`landing farm: ${group} reused, it passed before on these inputs (${(keys.get(group) ?? "").slice(0, 12)})`);
  const pending = groups.filter((group) => !proven.includes(group));
  const farm = groups.length === 0 ? Console.error("landing farm: no farm group is reached, so nothing runs there")
    : pending.length === 0 ? Effect.void
    : farmer(head, base, pending).pipe(Effect.tap(() => Effect.forEach(pending, (group) => cache.record(keys.get(group) ?? ""), { discard: true })));
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
