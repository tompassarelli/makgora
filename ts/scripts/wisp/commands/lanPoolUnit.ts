import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { lan as frameworkLan } from "wisp/scripts/wisp/commands/lan";
import { LanFailure } from "wisp/scripts/wisp/lan/join";
import { agentSocket, readPool } from "wisp/scripts/wisp/lan/pool";
import { pollUntil } from "../../hostPoll";
import { runProcess } from "../../hostProcess";
import { projectRoot } from "../project";

export const POOL_UNIT_PREFIX = "smashcraft-lan-pool";
const FOREGROUND = "--foreground";
const WISP_PROGRAM = join(import.meta.dir, "../../wisp.ts");

export const poolPairIds = (args: readonly string[]): readonly number[] => {
  const chosen = flagValues(args, "pair").map(Number);
  if (chosen.length > 0) return chosen;
  const [count = "1"] = flagValues(args, "pairs");
  return Array.from({ length: Number(count) }, (_, index) => index);
};

export const poolUnitName = (ids: readonly number[]) => `${POOL_UNIT_PREFIX}-${ids.join("-")}`;

/** The transient user unit that owns a pool: it outlives the caller's shell, tool limits and cgroup, and `lan stop` stops it. */
export const poolUnitCommand = (args: readonly string[], path: string, runtime = process.execPath): readonly string[] => [
  "systemd-run", "--user", "--collect", `--unit=${poolUnitName(poolPairIds(args))}`,
  `--working-directory=${projectRoot}`, `--setenv=PATH=${path}`,
  "--property=KillMode=control-group", "--property=TimeoutStopSec=180",
  "--", runtime, WISP_PROGRAM, "lan", "pool", ...args.filter((arg) => arg !== FOREGROUND), FOREGROUND,
];

const unitActive = (unit: string) => runProcess(ChildProcess.make("systemctl", ["--user", "is-active", unit], { stdin: "ignore" })).pipe(
  Effect.map((state) => state === "active"), Effect.orElseSucceed(() => false),
);

const unitPath = () => [...(process.env["PATH"] ?? "").split(delimiter), "/run/current-system/sw/bin", "/run/wrappers/bin"].filter((entry) => entry !== "").join(delimiter);

const withoutPairFlags = (args: readonly string[]) => args.filter((arg, index) => !["--pair", "--pairs"].includes(arg) && !arg.startsWith("--pair=") && !arg.startsWith("--pairs=") && !["--pair", "--pairs"].includes(args[index - 1] ?? ""));

export const poolStart: Command = (args) => {
  if (args.includes(FOREGROUND)) return frameworkLan(["pool", ...args.filter((arg) => arg !== FOREGROUND)]);
  const ids = poolPairIds(args);
  if (ids.length > 1) {
    const rest = withoutPairFlags(args);
    return Effect.forEach(ids, (id) => poolStart([...rest, "--pair", String(id)]), { discard: true });
  }
  const unit = poolUnitName(ids);
  const [waitText = "1800"] = flagValues(args, "wait");
  return Effect.gen(function*() {
    if (yield* unitActive(unit)) return yield* new UsageFailure({ problem: `${unit} is already running; stop it with \`bun wisp lan stop\`` });
    const [program = "", ...rest] = poolUnitCommand(args, unitPath());
    yield* runProcess(ChildProcess.make(program, rest, { stdin: "ignore" })).pipe(Effect.mapError((cause) => new LanFailure({ problem: `start ${unit}: ${cause.message}` })));
    yield* pollUntil(Effect.gen(function*() {
      if (!(yield* unitActive(unit))) return yield* new LanFailure({ problem: `${unit} stopped before its pairs were up; see \`journalctl --user -u ${unit}\`` });
      return ids.every((id) => existsSync(agentSocket(id))) ? true : undefined;
    }), { every: "2 seconds", within: `${Number(waitText) + 900} seconds`, orElse: () => Effect.fail(new LanFailure({ problem: `${unit}'s pairs weren't up in time; see \`journalctl --user -u ${unit}\`` })) });
    yield* Console.log(`pool unit ${unit} running; \`bun wisp lan stop\` stops it`);
  }).pipe(Effect.provide(BunServices.layer));
};

export const poolStop: Command = (args) => Effect.gen(function*() {
  const ids = flagValues(args, "pair").map(Number);
  const listed = yield* runProcess(ChildProcess.make("systemctl", ["--user", "list-units", "--plain", "--no-legend", "--all", `${POOL_UNIT_PREFIX}-*.service`], { stdin: "ignore" })).pipe(Effect.orElseSucceed(() => ""));
  const units = listed.split("\n").flatMap((line) => /^(\S+)\.service/.exec(line.trim())?.[1] ?? []).filter((unit) => ids.length === 0 || ids.some((id) => unit.split("-").slice(3).map(Number).includes(id)));
  if (units.length === 0) return yield* Console.log("no pool unit is running");
  for (const unit of units) {
    yield* runProcess(ChildProcess.make("systemctl", ["--user", "stop", unit], { stdin: "ignore" })).pipe(Effect.mapError((cause) => new LanFailure({ problem: `stop ${unit}: ${cause.message}` })));
    yield* Console.log(`stopped ${unit}`);
  }
}).pipe(Effect.provide(BunServices.layer));

interface PairStatus { readonly clients: readonly { readonly name: string; readonly pid?: number }[] }

/** A pair is dropped when its agent is unreachable or either of its two clients has no process. */
export const pairNeedsRestart = (status: PairStatus | undefined): boolean =>
  status === undefined || status.clients.length !== 2 || status.clients.some(({ pid }) => pid === undefined);

const pairStatus = (pair: number) => Effect.tryPromise({
  try: async () => {
    const response = await fetch("http://pair/status", { unix: agentSocket(pair), signal: AbortSignal.timeout(5000) });
    return response.ok ? (await response.json()) as PairStatus : undefined;
  },
  catch: () => undefined,
}).pipe(Effect.orElseSucceed(() => undefined));

/** Restarts a pair whose client dropped, through the pool's own unit; reports whether it did. */
export const restartDroppedPair = (pair: number) => Effect.gen(function*() {
  if (!pairNeedsRestart(yield* pairStatus(pair))) return false;
  const known = yield* readPool.pipe(Effect.orElseSucceed(() => undefined));
  yield* Console.log(`pair ${pair}: a client dropped; restarting the pair`);
  yield* poolStop(["--pair", String(pair)]);
  yield* poolStart(["--pair", String(pair), ...(known?.profile === undefined ? [] : ["--pool-profile", known.profile])]);
  return true;
}).pipe(Effect.provide(BunServices.layer));
