import { readFileSync, writeFileSync } from "node:fs";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";

class ThrowParityFailure extends Schema.TaggedError<ThrowParityFailure>()("ThrowParityFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const USAGE = "throw-parity [--check]   (frame advantage after every throw on a Fox-weight victim at 0-90%, against five Melee references, and the gap split by cause: tools/move-data/interactions/throw-parity.md)";

export const throwParity: Command = (args) => {
  const check = args.includes("--check");
  if (args.some((arg) => arg !== "--check")) return Effect.fail(new UsageFailure({ problem: USAGE }));
  return Effect.promise(() => import("../../throwParity")).pipe(
    Effect.map(({ THROW_PARITY_PAGE, meleeThrows, ourThrows, throwParityPage }) => ({ path: THROW_PARITY_PAGE, page: throwParityPage(ourThrows(), meleeThrows()) })),
    step("throw parity against Melee"),
    Effect.flatMap(({ path, page }) => {
      if (!check) {
        writeFileSync(path, page);
        return Console.log(`wrote ${path}`);
      }
      return readFileSync(path, "utf8") === page ? Console.log("throw parity page is current") : Effect.fail(new ThrowParityFailure({ problem: `${path} is stale; run bun wisp throw-parity` }));
    }),
  );
};

export const throwParityEntry = { usage: USAGE, load: async () => throwParity };
