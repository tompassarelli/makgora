import { Effect } from "effect";
import { BunServices } from "@effect/platform-bun";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { checkReleaseTree } from "../../releaseTree";

export const release: Command = args => args[0] === "tree" && args.slice(1).every(arg => arg === "--fix")
  ? checkReleaseTree(args.includes("--fix")).pipe(Effect.provide(BunServices.layer))
  : Effect.fail(new UsageFailure({ problem: "release tree [--fix]" }));

export const releaseEntry = { usage: "release tree [--fix]", load: async () => release };
