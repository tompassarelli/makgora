import { delimiter, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { AcceptFailure } from "wisp/scripts/wisp/accept";
import { type Command } from "wisp/scripts/wisp/command";
import { projectRoot } from "../project";
import { ACCEPT_OUTER_PID } from "./pairGuard";
import { privateDesktopUnitEnv } from "./privateDesktopUnitEnv";

export const ACCEPT_IN_UNIT = "SMASHCRAFT_ACCEPT_IN_UNIT";
const WISP_PROGRAM = join(import.meta.dir, "../../wisp.ts");

/** Pool clients' processes are only readable from the user manager's own namespace, so a native accept runs there as a transient service. */
export const acceptUnitCommand = (args: readonly string[], path: string, pid: number, runtime = process.execPath, env = process.env, readDisplay?: (run: string) => string): readonly string[] => [
  "systemd-run", "--user", "--wait", "--pipe", "--collect", `--unit=smashcraft-accept-${pid}`,
  `--working-directory=${projectRoot}`, `--setenv=PATH=${path}`, `--setenv=${ACCEPT_IN_UNIT}=1`, `--setenv=${ACCEPT_OUTER_PID}=${pid}`,
  ...(env["NORTH_FLEET_SESSION"] === undefined ? [] : [`--setenv=NORTH_FLEET_SESSION=${env["NORTH_FLEET_SESSION"]}`]),
  ...privateDesktopUnitEnv(env, readDisplay),
  "--", runtime, WISP_PROGRAM, "accept", ...args,
];

export const inAcceptUnit = (rawArgs: readonly string[], env: Readonly<Record<string, string | undefined>>) =>
  env[ACCEPT_IN_UNIT] === undefined && !rawArgs.includes("--dry-run");

const unitPath = () => [...(process.env["PATH"] ?? "").split(delimiter), "/run/current-system/sw/bin", "/run/wrappers/bin"].filter((entry) => entry !== "").join(delimiter);

export const runAcceptInUnit = (rawArgs: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const [program = "", ...rest] = acceptUnitCommand(rawArgs, unitPath(), process.pid);
  const handle = yield* ChildProcess.make(program, rest, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const code = yield* handle.exitCode;
  if (code !== 0) return yield* new AcceptFailure({ operation: "accept unit", problem: `the accept service exited ${code}` });
})).pipe(
  Effect.catchTag("PlatformError", (cause) => Effect.fail(new AcceptFailure({ operation: "accept unit", problem: cause.message }))),
  Effect.provide(BunServices.layer),
);

export const withAcceptUnit = (run: Command): Command => (rawArgs) =>
  inAcceptUnit(rawArgs, process.env) ? runAcceptInUnit(rawArgs) : run(rawArgs);
