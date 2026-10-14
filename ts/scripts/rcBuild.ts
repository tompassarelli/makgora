import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { buildPlaytest, selectedRevision } from "./playtestBuild";

BunRuntime.runMain(selectedRevision(process.argv.slice(2), true).pipe(Effect.flatMap(buildPlaytest)));
