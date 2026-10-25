import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { lan as frameworkLan } from "wisp/scripts/wisp/commands/lan";
import { LanFailure } from "wisp/scripts/wisp/lan/join";
import { agentSocket, readPool, stopPairScopes } from "wisp/scripts/wisp/lan/pool";
import { pollUntil } from "../../hostPoll";
import { runProcess } from "../../hostProcess";
import { readClientEntries } from "../nativeTools";
import { projectRoot } from "../project";
import { userSessionEnv } from "./nativeUnit";
import { privateDesktopUnitEnv } from "./privateDesktopUnitEnv";
import { claimPair, processIsAlive, readPairClaim, releasePair } from "./pairClaim";

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

const CPU_LIST = /^\d+(-\d+)?(,\d+(-\d+)?)*$/;

/** The `--cpus LIST` affinity of the pool unit, which every client's capacity scope inherits, so native evidence can run on the performance cores. */
export const poolCpus = (args: readonly string[]) => flagValues(args, "cpus")[0];

/** The transient user unit that owns a pool: it outlives the caller's shell, tool limits and cgroup, and `lan stop` stops it. */
export const poolUnitCommand = (args: readonly string[], path: string, uid: number, runtime = process.execPath, env = process.env, readDisplay?: (run: string) => string): readonly string[] => [
  "systemd-run", "--user", "--collect", `--unit=${poolUnitName(poolPairIds(args))}`,
  `--working-directory=${projectRoot}`, `--setenv=PATH=${path}`,
  ...Object.entries(userSessionEnv(uid)).map(([name, value]) => `--setenv=${name}=${value}`),
  ...privateDesktopUnitEnv(env, readDisplay),
  ...(env["NORTH_FLEET_SESSION"] === undefined ? [] : [`--setenv=NORTH_FLEET_SESSION=${env["NORTH_FLEET_SESSION"]}`]),
  "--property=KillMode=control-group", "--property=TimeoutStopSec=180",
  ...(poolCpus(args) === undefined ? [] : [`--property=CPUAffinity=${poolCpus(args)}`]),
  "--", runtime, WISP_PROGRAM, "lan", "pool", ...args.filter((arg) => arg !== FOREGROUND), FOREGROUND,
];

const currentUid = () => process.getuid?.() ?? 0;

const unitPath = () => [...(process.env["PATH"] ?? "").split(delimiter), "/run/current-system/sw/bin", "/run/wrappers/bin"].filter((entry) => entry !== "").join(delimiter);

/** A call on the user manager, on its own runtime dir and bus, never the caller's: inside a private desktop those name the desktop's private ones. */
export const userManager = (program: string, args: readonly string[], uid = currentUid()) =>
  ChildProcess.make(program, args, { env: { ...userSessionEnv(uid), PATH: unitPath() }, extendEnv: true, stdin: "ignore" });

const unitActive = (unit: string) => runProcess(userManager("systemctl", ["--user", "is-active", unit])).pipe(
  Effect.map((state) => state === "active"), Effect.orElseSucceed(() => false),
);

const withoutPairFlags = (args: readonly string[]) => args.filter((arg, index) => !["--pair", "--pairs"].includes(arg) && !arg.startsWith("--pair=") && !arg.startsWith("--pairs=") && !["--pair", "--pairs"].includes(args[index - 1] ?? ""));

export const poolStart: Command = (args) => {
  if (args.includes(FOREGROUND)) {
    const ids = poolPairIds(args);
    const session = process.env["NORTH_FLEET_SESSION"] ?? "";
    const [owner = session] = flagValues(args, "owner");
    const clean = args.filter((arg, index) => arg !== FOREGROUND && !["--owner", "--cpus"].includes(arg) && !["--owner", "--cpus"].includes(args[index - 1] ?? "") && !arg.startsWith("--owner=") && !arg.startsWith("--cpus="));
    return Effect.scoped(Effect.gen(function*() {
      for (const id of ids) if (id === 0) {
        yield* Effect.acquireRelease(
          Effect.try({ try: () => claimPair(id, owner, session), catch: cause => new LanFailure({ problem: String(cause) }) }),
          claim => Effect.sync(() => { if (claim.pid === process.pid) { try { releasePair(id, claim.session); } catch {} } }),
        );
      }
      yield* frameworkLan(["pool", ...clean]);
    })).pipe(Effect.asVoid);
  }
  const ids = poolPairIds(args);
  if (ids.length > 1) {
    const rest = withoutPairFlags(args);
    return Effect.forEach(ids, (id) => poolStart([...rest, "--pair", String(id)]), { discard: true });
  }
  const cpus = poolCpus(args);
  if (cpus !== undefined && !CPU_LIST.test(cpus)) return Effect.fail(new UsageFailure({ problem: `--cpus takes a CPU list such as 0-11, not ${cpus}` }));
  if (ids.includes(0) && process.env["NORTH_FLEET_SESSION"] === undefined) return Effect.fail(new LanFailure({ problem: "pair 0 pool requires NORTH_FLEET_SESSION so its claim names the fleet owner" }));
  const [owner] = flagValues(args, "owner");
  const ownedArgs = owner === undefined ? [...args, "--owner", process.env["NORTH_FLEET_SESSION"] ?? ""] : args;
  const unit = poolUnitName(ids);
  const [waitText = "1800"] = flagValues(args, "wait");
  return Effect.gen(function*() {
    if (yield* unitActive(unit)) {
      const claim = ids.includes(0) ? readPairClaim(0) : undefined;
      return yield* new UsageFailure({ problem: claim === undefined ? `${unit} is already running; stop it with \`bun wisp lan stop\`` : `pair 0 is held by ${claim.owner} (fleet session ${claim.session}, pid ${claim.pid})` });
    }
    const [program = "", ...rest] = poolUnitCommand(ownedArgs, unitPath(), currentUid());
    yield* runProcess(userManager(program, rest)).pipe(Effect.mapError((cause) => new LanFailure({ problem: `start ${unit}: ${cause.message}` })));
    yield* pollUntil(Effect.gen(function*() {
      if (!(yield* unitActive(unit))) return yield* new LanFailure({ problem: `${unit} stopped before its pairs were up; see \`journalctl --user -u ${unit}\`` });
      return ids.every((id) => existsSync(agentSocket(id))) ? true : undefined;
    }), { every: "2 seconds", within: `${Number(waitText) + 900} seconds`, orElse: () => Effect.fail(new LanFailure({ problem: `${unit}'s pairs weren't up in time; see \`journalctl --user -u ${unit}\`` })) });
    yield* Console.log(`pool unit ${unit} running; \`bun wisp lan stop\` stops it`);
  }).pipe(Effect.provide(BunServices.layer));
};

/** The fleet session a pool unit was started from, read from its `systemctl show --property=Environment` value. */
export const unitFleetSession = (environment: string) => /(?:^|\s)NORTH_FLEET_SESSION=(\S*)/.exec(environment)?.[1] ?? "";

export const poolStop: Command = (args) => Effect.gen(function*() {
  const ids = flagValues(args, "pair").map(Number);
  const listed = yield* runProcess(userManager("systemctl", ["--user", "list-units", "--plain", "--no-legend", "--all", `${POOL_UNIT_PREFIX}-*.service`])).pipe(Effect.mapError((cause) => new LanFailure({ problem: `list pool units: ${cause.message}` })));
  const units = listed.split("\n").flatMap((line) => /^(\S+)\.service/.exec(line.trim())?.[1] ?? []).filter((unit) => ids.length === 0 || ids.some((id) => unit.split("-").slice(3).map(Number).includes(id)));
  if (units.length === 0) return yield* Console.log("no pool unit is running");
  const session = process.env["NORTH_FLEET_SESSION"] ?? "";
  for (const unit of units) {
    const environment = yield* runProcess(userManager("systemctl", ["--user", "show", unit, "--property=Environment", "--value"])).pipe(Effect.mapError((cause) => new LanFailure({ problem: `read ${unit} owner: ${cause.message}` })));
    const owner = unitFleetSession(environment);
    if (owner !== session) {
      if (ids.length > 0) return yield* new LanFailure({ problem: `${unit} belongs to fleet session ${owner || "(none)"}; only that session stops it` });
      yield* Console.log(`left ${unit}: it belongs to fleet session ${owner || "(none)"}`);
      continue;
    }
    const pairIds = unit.split("-").slice(3).map(Number);
    for (const id of pairIds) {
      const claim = readPairClaim(id);
      if (claim !== undefined && claim.session !== (process.env["NORTH_FLEET_SESSION"] ?? "") && processIsAlive(claim.pid)) {
        return yield* new LanFailure({ problem: `pair ${id} is held by ${claim.owner} (fleet session ${claim.session}, pid ${claim.pid})` });
      }
    }
    yield* runProcess(userManager("systemctl", ["--user", "stop", unit])).pipe(Effect.mapError((cause) => new LanFailure({ problem: `stop ${unit}: ${cause.message}` })));
    for (const id of pairIds) {
      const left = yield* stopPairScopes(id, (name, lease) => Console.log(`${name} outlived ${unit} (lease ${lease}); killing its capacity scope`));
      if (left.length > 0) return yield* new LanFailure({ problem: `stopped ${unit}, but the capacity scope of ${left.join(" and ")} still runs` });
    }
    for (const id of pairIds) yield* Effect.try({ try: () => releasePair(id, process.env["NORTH_FLEET_SESSION"] ?? ""), catch: cause => new LanFailure({ problem: String(cause) }) });
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

export interface PairDrop {
  readonly pair: number;
  readonly dropped: readonly string[];
  readonly crashes: readonly string[];
}

export const crashReports = (clientsFile: string): string[] => {
  if (!existsSync(clientsFile)) return [];
  const since = statSync(clientsFile).mtimeMs;
  return readClientEntries(clientsFile).flatMap(({ name, documents }) => {
    const errors = join(documents, "Errors");
    return existsSync(errors) ? readdirSync(errors).filter(entry => statSync(join(errors, entry)).mtimeMs >= since).sort().map(entry => `${name}: Errors/${entry}`) : [];
  });
};

export const pairDropText = ({ pair, dropped, crashes }: PairDrop): string =>
  `pair ${pair} lost ${dropped.join(" and ")}; ${crashes.length === 0 ? "no Errors/ crash report since the pair started" : `crash ${crashes.join(", ")}`}`;

const pairDropOf = (pair: number) => Effect.gen(function*() {
  const status = yield* pairStatus(pair);
  if (!pairNeedsRestart(status)) return undefined;
  const known = yield* readPool.pipe(Effect.orElseSucceed(() => undefined));
  const clients = known?.pairs.find(item => item.id === pair)?.clients;
  const dropped = status === undefined ? ["its agent"] : status.clients.filter(({ pid }) => pid === undefined).map(({ name }) => `client ${name}`);
  const drop: PairDrop = { pair, dropped: dropped.length === 0 ? ["a client"] : dropped, crashes: clients === undefined ? [] : crashReports(clients) };
  return { drop, profile: known?.profile };
});

export const droppedPair = (pair: number) => pairDropOf(pair).pipe(Effect.map(found => found?.drop), Effect.provide(BunServices.layer));

export const pairRestartFile = (directory: string): string => join(directory, "pair-restart.txt");

/** Restarts a pair whose client dropped, through the pool's own unit; returns what dropped, or undefined when nothing did. */
export const restartDroppedPair = (pair: number) => Effect.gen(function*() {
  const found = yield* pairDropOf(pair);
  if (found === undefined) return undefined;
  yield* Console.log(`${pairDropText(found.drop)}; restarting the pair`);
  yield* poolStop(["--pair", String(pair)]);
  yield* poolStart(["--pair", String(pair), ...(found.profile === undefined ? [] : ["--pool-profile", found.profile])]);
  return found.drop;
}).pipe(Effect.provide(BunServices.layer));

export const restartDroppedPairInto = (pair: number, directory: string | undefined) => restartDroppedPair(pair).pipe(Effect.tap(drop => Effect.sync(() => {
  if (drop === undefined || directory === undefined) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(pairRestartFile(directory), `${pairDropText(drop)}; restarted the pair\n`);
})));
