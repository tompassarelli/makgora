import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { AcceptFailure } from "wisp/scripts/wisp/accept";
import type { Client } from "wisp/scripts/warcraft/desktop";
import { runProcess } from "../hostProcess";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

// A fresh private desktop's Xwayland drops the first XTEST motion.
const POINTER_MOVE_ATTEMPTS = 3;

const xdotool = (client: Client, args: readonly string[]) => ChildProcess.make(client.tools.xdotool, [...args], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" });

export const pointerAt = (client: Client, operation: string) => runProcess(xdotool(client, ["getmouselocation", "--shell"])).pipe(
  Effect.map(output => ({ x: Number(/^X=(\d+)$/m.exec(output)?.[1]), y: Number(/^Y=(\d+)$/m.exec(output)?.[1]) })),
  Effect.mapError(fail(operation)),
);

export const movePointer = (client: Client, target: { readonly x: number; readonly y: number }, operation: string) => Effect.gen(function*() {
  let at = yield* pointerAt(client, operation);
  for (let attempt = 0; attempt < POINTER_MOVE_ATTEMPTS && (at.x !== target.x || at.y !== target.y); attempt++) {
    if (attempt > 0) yield* Effect.sleep("100 millis");
    yield* runProcess(xdotool(client, ["mousemove_relative", "--", String(target.x - at.x), String(target.y - at.y)])).pipe(Effect.mapError(fail(operation)));
    at = yield* pointerAt(client, operation);
  }
  if (at.x !== target.x || at.y !== target.y) return yield* new AcceptFailure({ operation, problem: `pointer at ${at.x},${at.y}; wanted ${target.x},${target.y}` });
});
