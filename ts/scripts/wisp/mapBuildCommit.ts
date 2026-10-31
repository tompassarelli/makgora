import { readFileSync } from "node:fs";
import { BunServices } from "@effect/platform-bun";
import { Effect, Option } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "../hostProcess";
import { projectRoot } from "./projectRoot";

/** The sentence a released map's description ends with, naming the Smashcraft commit it was built from. */
export const buildSentence = (commit: string) => `Build ${commit}.`;

/** The commit a map's script names in its description's `buildSentence`, if any. */
export const stampedCommit = (script: string) => /Build ([0-9a-f]{40})\./.exec(script)?.[1];

/** Why `--player-assets-only` cannot play `map` from this checkout: the map's art comes from `mapCommit` and the game's code from `checkoutCommit`, so models one names and the other lacks would go missing. */
export const commitMismatch = (map: string, mapCommit: string | undefined, checkoutCommit: string | undefined) =>
  mapCommit === undefined || checkoutCommit === undefined || mapCommit === checkoutCommit ? undefined
    : `${map} was built from Smashcraft ${mapCommit.slice(0, 10)} and this checkout is at ${checkoutCommit.slice(0, 10)}; play a map built from ${checkoutCommit.slice(0, 10)}, or check out ${mapCommit.slice(0, 10)}`;

declare const PLAYER_COMMIT: string | undefined;

/** The commit this code was built from: stamped into a packaged player at build time, else the checkout's HEAD. */
const codeCommit = Effect.gen(function*() {
  if (typeof PLAYER_COMMIT === "string") return PLAYER_COMMIT;
  const checkout = yield* Effect.option(runProcess(ChildProcess.make("git", ["-C", projectRoot, "rev-parse", "HEAD"])).pipe(Effect.provide(BunServices.layer)));
  return Option.getOrUndefined(checkout);
});

export const mapCommitMismatch = (map: string, imports: readonly { readonly entry: string; readonly source: string }[]) => Effect.gen(function*() {
  const script = imports.find((entry) => entry.entry.toLowerCase() === "war3map.lua");
  const mapCommit = script === undefined ? undefined : stampedCommit(readFileSync(script.source, "latin1"));
  return commitMismatch(map, mapCommit, yield* codeCommit);
});
