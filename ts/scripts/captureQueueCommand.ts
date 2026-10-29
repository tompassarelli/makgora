import { Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { enqueue, status, wait } from "./captureQueue";
import { serve } from "./captureQueueServe";

export const capture: Command = ([verb, ...rest]) => {
  if (verb === "enqueue") return enqueue(rest);
  if (verb === "wait") return wait(rest);
  if (verb === "status") return status(rest);
  if (verb === "serve") return serve(rest);
  return Effect.fail(new UsageFailure({ problem: "anim capture enqueue --lane NAME --fighter SLUG --move MOVE [--rev REV] [--crop X,Y,W,H] | anim capture wait ID [--minutes N] | anim capture status | anim capture serve [--pair K|auto] [--hosts local|any] [--once] [--idle-minutes N]" }));
};
