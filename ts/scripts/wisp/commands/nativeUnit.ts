import { delimiter, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { type Command } from "wisp/scripts/wisp/command";
import { NATIVE_OUTER_PID } from "./pairGuard";
import { privateDesktopUnitEnv } from "./privateDesktopUnitEnv";

export const NATIVE_IN_UNIT = "SMASHCRAFT_NATIVE_IN_UNIT";
const WISP_PROGRAM = join(import.meta.dir, "../../wisp.ts");

export type NativeCommand = "accept" | "pad";

export class NativeUnitFailure extends Schema.TaggedError<NativeUnitFailure, { readonly brand: unique symbol }>()("NativeUnitFailure", {
  command: Schema.String,
  problem: Schema.String,
}) {
  override get message(): string {
    return `${this.command} unit: ${this.problem}`;
  }
}

/** The user manager's runtime dir and session bus, never the caller's: inside a private desktop those name the desktop's own runtime and private bus. */
export const userSessionEnv = (uid: number) => ({ XDG_RUNTIME_DIR: `/run/user/${uid}`, DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${uid}/bus` });

/** Pool clients' processes are only readable from the user manager's own namespace, so a native run executes there as a transient service on the private desktop's display, in the caller's directory so relative paths resolve as typed. */
export const nativeUnitCommand = (command: NativeCommand, args: readonly string[], path: string, pid: number, uid: number, cwd: string, runtime = process.execPath, env = process.env, readDisplay?: (run: string) => string): readonly string[] => [
  "systemd-run", "--user", "--wait", "--pipe", "--collect", `--unit=smashcraft-${command}-${pid}`,
  `--working-directory=${cwd}`, `--setenv=PATH=${path}`, `--setenv=${NATIVE_IN_UNIT}=1`, `--setenv=${NATIVE_OUTER_PID}=${pid}`,
  ...Object.entries(userSessionEnv(uid)).map(([name, value]) => `--setenv=${name}=${value}`),
  ...(env["NORTH_FLEET_SESSION"] === undefined ? [] : [`--setenv=NORTH_FLEET_SESSION=${env["NORTH_FLEET_SESSION"]}`]),
  ...privateDesktopUnitEnv(env, readDisplay),
  "--", runtime, WISP_PROGRAM, command, ...args,
];

export const inNativeUnit = (env: Readonly<Record<string, string | undefined>>) => env[NATIVE_IN_UNIT] !== undefined;

const unitPath = () => [...(process.env["PATH"] ?? "").split(delimiter), "/run/current-system/sw/bin", "/run/wrappers/bin"].filter((entry) => entry !== "").join(delimiter);

const runInUnit = (command: NativeCommand, rawArgs: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const uid = process.getuid?.() ?? 0;
  const [program = "", ...rest] = yield* Effect.try({
    try: () => nativeUnitCommand(command, rawArgs, unitPath(), process.pid, uid, process.cwd()),
    catch: (cause) => new NativeUnitFailure({ command, problem: cause instanceof Error ? cause.message : String(cause) }),
  });
  const handle = yield* ChildProcess.make(program, rest, { env: userSessionEnv(uid), extendEnv: true, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const code = yield* handle.exitCode;
  if (code !== 0) return yield* new NativeUnitFailure({ command, problem: `the ${command} service exited ${code}` });
})).pipe(
  Effect.catchTag("PlatformError", (cause) => Effect.fail(new NativeUnitFailure({ command, problem: cause.message }))),
  Effect.provide(BunServices.layer),
);

/** Runs `run` in place inside the unit or when `native` says the arguments touch no Warcraft client, and otherwise re-runs the command as a native unit. */
export const withNativeUnit = (command: NativeCommand, native: (rawArgs: readonly string[]) => boolean, run: Command): Command => (rawArgs) =>
  !inNativeUnit(process.env) && native(rawArgs) ? runInUnit(command, rawArgs) : run(rawArgs);
