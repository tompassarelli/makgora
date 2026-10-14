import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { platformLayer } from "wisp/scripts/platform/layer";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { play } from "./wisp/commands/play";
import { reserveGame } from "./wisp/playtestReserve";

const program = Effect.gen(function*() {
  const [map, ...extra] = process.argv.slice(2);
  if (map === undefined || extra.length > 0 || !/\.w3x$/i.test(map)) return yield* new PlayProblem({ problem: "use bun run playtest MAP.w3x" });
  yield* reserveGame;
  yield* play(["--lobby-only", map]);
});

BunRuntime.runMain(program.pipe(Effect.provide(platformLayer())));
