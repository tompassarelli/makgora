import { homedir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";

export const PLAYTEST_RESERVE = join(homedir(), ".local/share/north/bin/playtest");

export const reserveGame = runProcess(ChildProcess.make(PLAYTEST_RESERVE, ["on"])).pipe(
  Effect.asVoid,
  Effect.mapError((cause) => new PlayProblem({ problem: `could not reserve the game slice: ${cause.message}` })),
  Effect.provide(BunServices.layer),
);

export const reserveStatus = Effect.gen(function*() {
  yield* reserveGame;
  const status = yield* runProcess(ChildProcess.make(PLAYTEST_RESERVE, ["status"]));
  const placed = /Warcraft III (\d+)\/(\d+) in playtest\.slice/.exec(status);
  if (placed === null || Number(placed[1]) === 0 || placed[1] !== placed[2]) return yield* new PlayProblem({ problem: `the Warcraft III tree is not in the playtest reserve: ${status}` });
}).pipe(
  Effect.mapError((cause) => new PlayProblem({ problem: `playtest reserve is not ready: ${cause.message}` })),
  Effect.provide(BunServices.layer),
);
