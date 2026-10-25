import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { formatOracle, oracleProblems, runOracle } from "../../meleeOracle";
import { compareThresholds, formatThresholds } from "../../meleeThresholds";

class OracleFailure extends Schema.TaggedError<OracleFailure>()("OracleFailure", { problems: Schema.Array(Schema.String) }) {
  override get message(): string {
    return this.problems.join("\n");
  }
}

export const oracle: Command = (args) => {
  if (args.length > 0) return Effect.fail(new UsageFailure({ problem: "oracle takes no arguments" }));
  return Effect.gen(function* () {
    const rows = yield* Effect.sync(runOracle).pipe(step("Melee oracle scenarios"));
    yield* Console.log(formatOracle(rows));
    const thresholds = yield* Effect.sync(() => compareThresholds()).pipe(step("FightCore knockdown thresholds"));
    yield* Console.log(formatThresholds(thresholds));
    const problems = [...oracleProblems(rows), ...thresholds.problems];
    if (problems.length > 0) return yield* new OracleFailure({ problems });
  });
};
