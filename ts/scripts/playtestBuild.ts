import { join } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { PLAYTEST_PREFIX } from "./wisp/commands/play";
import { currentPlaytest } from "./wisp/currentPlaytest";
import { installLatest } from "./wisp/mapLibrary";
import { readyPlaytest } from "./wisp/playtestReady";

export const buildPlaytest = (revision?: string) => Effect.gen(function*() {
  const documents = documentsFolder(PLAYTEST_PREFIX);
  const current = yield* currentPlaytest(join(documents, "Maps/00-Smashcraft"), revision === undefined ? {} : { revision });
  yield* Effect.try({ try: () => installLatest(documents, current.map.source), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  yield* readyPlaytest(current.map.source);
});

export const selectedRevision = (args: readonly string[], required = false) => Effect.gen(function*() {
  if (args.length > 1 || (required && args.length !== 1)) return yield* new PlayProblem({ problem: "takes one selected main commit SHA" });
  return args[0] === undefined ? undefined : yield* Schema.decodeEffect(Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/)))(args[0]).pipe(
    Effect.mapError(() => new PlayProblem({ problem: "the selected commit must be a full 40-character SHA" })),
  );
});

if (import.meta.main) BunRuntime.runMain(selectedRevision(process.argv.slice(2)).pipe(Effect.flatMap(buildPlaytest)));
