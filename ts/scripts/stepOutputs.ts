import { BunRuntime } from "@effect/platform-bun";
import { Cause, type Effect, Exit } from "effect";

/** Runs a script whose stdout a workflow step appends to $GITHUB_OUTPUT: a failure goes to stderr, where the job log shows it, instead of into the outputs file. */
export const runStepOutputs = <A, E>(program: Effect.Effect<A, E>): void => BunRuntime.runMain(program, {
  disableErrorReporting: true,
  teardown: (exit) => {
    if (Exit.isSuccess(exit)) process.exit(0);
    if (Cause.hasInterruptsOnly(exit.cause)) process.exit(130);
    console.error(Cause.pretty(exit.cause));
    process.exit(1);
  },
});
