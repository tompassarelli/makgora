import { Console, Effect, Exit, Option } from "effect";
import { run } from "wisp/scripts/wisp/farm";
import { FULL_SUITE_VARIABLE, UNKNOWN_BASE, landingGroups } from "./landingChecks";
import { PrePushRefusal, type Check, checksFor, cueInputs, laptop, runChecks, strikeInputs } from "./prePush";

const needsPrivateStore = (check: Check) => check.privateStore === true
  ? "it reads the private input store, which hosted runners lack"
  : "it reads build inputs that only the landing machine holds";

/** The pre-push hook's checks the farm cannot run: the ones that read the private stores. */
export const localChecks = (checks: readonly Check[]): Check[] => checks.filter(({ hosted, machineTool }) => !hosted && machineTool !== true);

export const DISPATCH = "north land dispatch: ";

/** The paths a landing's checks are selected by: its diff, or an unknown base when the diff is empty, since the lander's rerun of a base commit has no changed path and would otherwise pass on no check at all. */
export const selectionPaths = (changed: readonly string[]): readonly string[] => (changed.length === 0 ? [UNKNOWN_BASE] : changed);

/** The farm-test.yml inputs the lander dispatches beside the ref and base it sets itself: the groups the paths reach, with every check of them when no path selects. */
export const farmInputs = (paths: readonly string[], full: boolean): Readonly<Record<string, string>> => ({
  checks: JSON.stringify(landingGroups(paths, full)),
  ...(full || paths.includes(UNKNOWN_BASE) ? { full: "1" } : {}),
});

/**
 * The landing gate for safe-push's `north land dispatch farm` (makgora:.safe-push): it runs the
 * checks that need this machine's private stores and returns the Farm test inputs, which the
 * lander dispatches and judges (north#1148).
 */
export const landOnFarm = (base: string, head: string, local: (checks: readonly Check[]) => Effect.Effect<void, unknown> = (checks) => runChecks(checks, laptop)) => Effect.gen(function*() {
  const changed = base === "" ? [] : (yield* run(["git", "diff", "--name-only", base, head])).split("\n").filter((path) => path !== "");
  const paths = selectionPaths(changed);
  const inputs = farmInputs(paths, process.env[FULL_SUITE_VARIABLE] === "1");
  const here = localChecks(checksFor(paths, cueInputs(), strikeInputs()));
  yield* Console.error(`landing farm: ${changed.length} changed path${changed.length === 1 ? "" : "s"}; farm groups ${inputs.checks}${inputs.full === "1" ? ", every check of them" : ""}`);
  for (const check of here) yield* Console.error(`landing local: ${check.name}: ${needsPrivateStore(check)}`);
  const dirty = here.length === 0 ? "" : yield* laptop.dirty(["."]);
  if (dirty !== "") return yield* new PrePushRefusal({ problem: `landing local: the checks read the working tree, so land the clean checked-out commit.\n${dirty}` });
  yield* local(here);
  return inputs;
});

if (import.meta.main) {
  const exit = await Effect.runPromiseExit(landOnFarm(process.env.SAFE_PUSH_LAND_BASE || "", process.env.SAFE_PUSH_LAND_HEAD || "HEAD"));
  if (Exit.isFailure(exit)) {
    const failure = Exit.findErrorOption(exit);
    console.error(Option.isSome(failure) ? (failure.value as Error).message : String(exit.cause));
    process.exit(1);
  }
  console.log(`${DISPATCH}${JSON.stringify(exit.value)}`);
}
