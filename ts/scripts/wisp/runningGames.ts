import { Effect } from "effect";
import { platformLayer } from "wisp/scripts/platform/layer";
import { ProcessTable } from "wisp/scripts/platform/services";
import { prefixFromDocuments } from "wisp/scripts/warcraft/battleNet";
import { PlayProblem } from "wisp/scripts/wisp/play";

export const runningGames = (documents: string) => Effect.gen(function*() {
  const prefix = prefixFromDocuments(documents);
  if (prefix === undefined) return yield* new PlayProblem({ problem: `${documents} is not a Warcraft III prefix's documents folder` });
  const games = yield* ProcessTable.use((table) => table.games(prefix)).pipe(Effect.provide(platformLayer()), Effect.mapError((cause) => new PlayProblem({ problem: cause.message })));
  return games.map(({ pid }) => pid);
});

export const clientHold = (documents: string) => runningGames(documents).pipe(Effect.map((pids) => pids.length === 0
  ? undefined
  : `Warcraft III is running in Tom's prefix (pid ${pids.join(", ")}); its maps and controller stay as they are until it closes`));
