import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { newestFullGreen } from "./wisp/fullGreenMain";

BunRuntime.runMain(newestFullGreen.pipe(Effect.tap(sha => Effect.sync(() => console.log(sha)))));
