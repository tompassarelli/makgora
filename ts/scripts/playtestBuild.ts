import { join } from "node:path";
import { BunRuntime } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { PLAYTEST_PREFIX } from "./wisp/commands/play";
import { type Edition, currentPlaytest } from "./wisp/currentPlaytest";
import { installLatest } from "./wisp/mapLibrary";
import { costPrediction } from "./wisp/greenBuilds";
import { readyPlaytest } from "./wisp/playtestReady";

export const installPlaytest = (revision?: string, predictCost = false, helper = true, edition: Edition = "full") => Effect.gen(function*() {
  const documents = documentsFolder(PLAYTEST_PREFIX);
  const current = yield* currentPlaytest(join(documents, "Maps/00-Smashcraft"), { ...(revision === undefined ? {} : { revision }), predictCost, helper, edition });
  yield* Effect.try({ try: () => installLatest(documents, current.map.source), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  return { ...current.map, installed: join(documents, "Maps", current.map.folder, current.map.file) };
});

export const buildPlaytest = (revision?: string, predictCost = false) =>
  installPlaytest(revision, predictCost).pipe(Effect.flatMap((map) => readyPlaytest(map.source)));

export const selectedRevision = (args: readonly string[], required = false) => Effect.gen(function*() {
  if (args.length > 1 || (required && args.length !== 1)) return yield* new PlayProblem({ problem: "takes one selected main commit SHA" });
  return args[0] === undefined ? undefined : yield* Schema.decodeEffect(Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/)))(args[0]).pipe(
    Effect.mapError(() => new PlayProblem({ problem: "the selected commit must be a full 40-character SHA" })),
  );
});

if (import.meta.main) {
  const { predict, args } = costPrediction(process.argv.slice(2));
  BunRuntime.runMain(selectedRevision(args).pipe(Effect.flatMap((revision) => buildPlaytest(revision, predict))));
}
