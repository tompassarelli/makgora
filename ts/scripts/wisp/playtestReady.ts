import { basename } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";

export const readyPlaytest = (map: string, command: ChildProcess.StandardCommand = ChildProcess.make(process.execPath, ["run", "playtest", map]), print: (line: string) => void = console.log) => Effect.gen(function*() {
  const output = yield* runProcess(command).pipe(Effect.mapError((cause) => new PlayProblem({ problem: cause.message })));
  const prefix = `LOBBY-READY ${basename(map)} screenshot=`;
  const confirmation = output.split("\n").find((line) => line.startsWith(prefix) && line.length > prefix.length);
  if (confirmation === undefined) return yield* new PlayProblem({ problem: `playtest exited without confirming the requested lobby: ${basename(map)}` });
  yield* Effect.sync(() => {
    for (const line of output.split("\n")) if (!line.startsWith("RC-READY")) print(line);
    print(`RC-READY ${basename(map)} screenshot=${confirmation.slice(prefix.length)}`);
  });
}).pipe(Effect.provide(BunServices.layer));
