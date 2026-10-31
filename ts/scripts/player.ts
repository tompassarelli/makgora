import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Cause, Effect, Exit, Layer } from "effect";
import type { Teardown } from "effect/Runtime";
import { PLAYER_USAGE, PRODUCT, playerArguments, playerMap } from "./playerArguments";

declare const PLAYER_COMMIT: string | undefined;
declare const PLAYER_VERSION: string | undefined;

const playerVersion = () => `${PRODUCT} ${typeof PLAYER_VERSION === "string" ? PLAYER_VERSION : "dev"}${typeof PLAYER_COMMIT === "string" ? ` (${PLAYER_COMMIT})` : ""}`;

const argv = process.argv.slice(2);
if (argv.includes("--version")) {
  console.log(playerVersion());
  process.exit(0);
}
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(PLAYER_USAGE);
  process.exit(0);
}

const chosen = playerMap(argv, [dirname(process.execPath), process.cwd()]);
if (typeof chosen === "string") {
  console.error(`${chosen}\n${PLAYER_USAGE}`);
  process.exit(2);
}

const EXE = process.platform === "win32" ? ".exe" : "";
for (const [variable, tool] of [["SMASHCRAFT_PACKAGER", "map-pack"], ["CASC_EXTRACTOR", "casc-extract"]] as const) {
  const beside = join(dirname(process.execPath), `${tool}${EXE}`);
  if (process.env[variable] === undefined && existsSync(beside)) process.env[variable] = beside;
}

const teardown: Teardown = (exit) => {
  if (Exit.isSuccess(exit)) process.exit();
  if (Cause.hasInterruptsOnly(exit.cause)) process.exit(130);
  console.error(Cause.pretty(exit.cause));
  process.exit(1);
};

const { standalonePlay } = await import("./wisp/standalone");
const { platformLayer } = await import("wisp/scripts/platform/layer");
BunRuntime.runMain(standalonePlay(playerArguments(chosen.map, chosen.rest)).pipe(
  Effect.provide(Layer.merge(BunServices.layer, platformLayer())),
  Effect.catch((failure) => Effect.sync(() => {
    console.error(failure.message);
    process.exitCode = failure._tag === "UsageFailure" ? 2 : 1;
  })),
), { disableErrorReporting: true, teardown });
