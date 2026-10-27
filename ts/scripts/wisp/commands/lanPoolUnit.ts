import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Duration, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { type Command, type CommandFailure, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import type { Platform } from "wisp/scripts/platform/services";
import { lan as frameworkLan } from "wisp/scripts/wisp/commands/lan";
import { LanFailure } from "wisp/scripts/wisp/lan/join";
import { agentSocket, alive, poolHolder, readClaim, readPool, stopPairScopes } from "wisp/scripts/wisp/lan/pool";
import { pollUntil } from "../../hostPoll";
import { runProcess } from "../../hostProcess";
import { readClientEntries } from "../nativeTools";
import { projectRoot } from "../project";
import { userSessionEnv } from "./nativeUnit";
import { privateDesktopUnitEnv } from "./privateDesktopUnitEnv";

export const POOL_UNIT_PREFIX = "smashcraft-lan-pool";
const FOREGROUND = "--foreground";
const WISP_PROGRAM = join(import.meta.dir, "../../wisp.ts");

export const poolPairIds = (args: readonly string[]): readonly number[] => {
  const chosen = flagValues(args, "pair").map(Number);
  if (chosen.length > 0) return chosen;
  const [count = "1"] = flagValues(args, "pairs");
  return Array.from({ length: Number(count) }, (_, index) => index);
};

/** One unit per fleet session and pairs, so a second session's pool can wait in wisp's line for a pair the first holds. */
export const poolUnitName = (ids: readonly number[], session = process.env["NORTH_FLEET_SESSION"] ?? "") =>
  `${POOL_UNIT_PREFIX}-${ids.join("-")}${session === "" ? "" : `-s${createHash("sha256").update(session).digest("hex").slice(0, 8)}`}`;

/** The pairs a pool unit runs, read back from its name. */
export const unitPairIds = (unit: string): readonly number[] =>
  unit.slice(POOL_UNIT_PREFIX.length + 1).split("-").filter((part) => /^\d+$/.test(part)).map(Number);

const parentOf = (pid: number) => {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
  } catch {
    return undefined;
  }
};

const carries = (pid: number, variable: string) => {
  try { return readFileSync(`/proc/${pid}/environ`, "latin1").split("\0").includes(variable); } catch { return false; }
};

/** The fleet session's own process, which a pool unit names with `--owner-pid` because it runs outside that process tree: the outermost ancestor carrying the same `NORTH_FLEET_SESSION`. */
export const fleetSessionPid = (session: string, from = process.pid) => {
  let outermost = from;
  for (let pid = parentOf(from); pid !== undefined && pid > 1 && carries(pid, `NORTH_FLEET_SESSION=${session}`); pid = parentOf(pid)) outermost = pid;
  return outermost;
};

/** A pool's arguments with `--queue`, so it waits its turn behind earlier waiters instead of being refused. */
export const queuedPoolArgs = (args: readonly string[]) => args.includes("--queue") ? args : [...args, "--queue"];

const CPU_LIST = /^\d+(-\d+)?(,\d+(-\d+)?)*$/;

/** The `--cpus LIST` affinity of the pool unit, which every client's capacity scope inherits, so native evidence can run on the performance cores. */
export const poolCpus = (args: readonly string[]) => flagValues(args, "cpus")[0];

/** The transient user unit that owns a pool: it outlives the caller's shell, tool limits and cgroup, and `lan stop` stops it. Its pool waits in wisp's line and names the fleet session's process with `--owner-pid`, so it stops once that session ends. */
export const poolUnitCommand = (args: readonly string[], path: string, uid: number, runtime = process.execPath, env = process.env, readDisplay?: (run: string) => string, ownerPid = (session: string) => fleetSessionPid(session)): readonly string[] => [
  "systemd-run", "--user", "--collect", `--unit=${poolUnitName(poolPairIds(args), env["NORTH_FLEET_SESSION"] ?? "")}`,
  `--working-directory=${projectRoot}`, `--setenv=PATH=${path}`,
  ...Object.entries(userSessionEnv(uid)).map(([name, value]) => `--setenv=${name}=${value}`),
  ...privateDesktopUnitEnv(env, readDisplay),
  ...(env["NORTH_FLEET_SESSION"] === undefined ? [] : [`--setenv=NORTH_FLEET_SESSION=${env["NORTH_FLEET_SESSION"]}`]),
  "--property=KillMode=control-group", "--property=TimeoutStopSec=180",
  ...(poolCpus(args) === undefined ? [] : [`--property=CPUAffinity=${poolCpus(args)}`]),
  "--", runtime, WISP_PROGRAM, "lan", "pool", ...queuedPoolArgs(args.filter((arg) => arg !== FOREGROUND)),
  ...(env["NORTH_FLEET_SESSION"] === undefined || env["NORTH_FLEET_SESSION"] === "" || flagValues(args, "owner-pid").length > 0 ? [] : ["--owner-pid", String(ownerPid(env["NORTH_FLEET_SESSION"]))]),
  FOREGROUND,
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
    const clean = args.filter((arg, index) => arg !== FOREGROUND && arg !== "--cpus" && args[index - 1] !== "--cpus" && !arg.startsWith("--cpus="));
    return frameworkLan(["pool", ...queuedPoolArgs(clean)]);
  }
  const ids = poolPairIds(args);
  if (ids.length > 1) {
    const rest = withoutPairFlags(args);
    return Effect.forEach(ids, (id) => poolStart([...rest, "--pair", String(id)]), { discard: true });
  }
  const cpus = poolCpus(args);
  if (cpus !== undefined && !CPU_LIST.test(cpus)) return Effect.fail(new UsageFailure({ problem: `--cpus takes a CPU list such as 0-11, not ${cpus}` }));
  const unit = poolUnitName(ids);
  const [waitText = "1800"] = flagValues(args, "wait");
  return Effect.gen(function*() {
    if (yield* unitActive(unit)) return yield* new UsageFailure({ problem: `${unit} is already running or waiting; stop it with \`bun wisp lan stop\`` });
    const [program = "", ...rest] = poolUnitCommand(args, unitPath(), currentUid());
    yield* runProcess(userManager(program, rest)).pipe(Effect.mapError((cause) => new LanFailure({ problem: `start ${unit}: ${cause.message}` })));
    const stopped = new LanFailure({ problem: `${unit} stopped before its pairs were up; see \`journalctl --user -u ${unit}\`` });
    let said = "";
    yield* pollUntil(Effect.gen(function*() {
      if (!(yield* unitActive(unit))) return yield* stopped;
      const pid = Number((yield* runProcess(userManager("systemctl", ["--user", "show", unit, "--property=MainPID", "--value"])).pipe(Effect.orElseSucceed(() => ""))).trim());
      const waiting = ids.filter((id) => readClaim(id)?.pid !== pid);
      if (waiting.length === 0) return true;
      const line = waiting.map((id) => { const claim = readClaim(id); return `pair ${id}: waiting in line${claim === undefined ? "" : `; held by ${claim.owner} (fleet session ${claim.session || "(none)"}, pool ${claim.pid})`}`; }).join("; ");
      if (line !== said) yield* Console.log(line);
      said = line;
      return undefined;
    }), { every: "2 seconds", within: Duration.infinity, orElse: () => Effect.void });
    yield* pollUntil(Effect.gen(function*() {
      if (!(yield* unitActive(unit))) return yield* stopped;
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
  const units = listed.split("\n").flatMap((line) => /^(\S+)\.service/.exec(line.trim())?.[1] ?? []).filter((unit) => ids.length === 0 || ids.some((id) => unitPairIds(unit).includes(id)));
  if (units.length === 0) return yield* Console.log("no pool unit is running");
  const session = process.env["NORTH_FLEET_SESSION"] ?? "";
  for (const unit of units) {
    const environment = yield* runProcess(userManager("systemctl", ["--user", "show", unit, "--property=Environment", "--value"])).pipe(Effect.mapError((cause) => new LanFailure({ problem: `read ${unit} owner: ${cause.message}` })));
    const owner = unitFleetSession(environment);
    if (owner !== session) {
      yield* Console.log(`left ${unit}: it belongs to fleet session ${owner || "(none)"}`);
      continue;
    }
    const pairIds = unitPairIds(unit);
    yield* runProcess(userManager("systemctl", ["--user", "stop", unit])).pipe(Effect.mapError((cause) => new LanFailure({ problem: `stop ${unit}: ${cause.message}` })));
    for (const id of pairIds) {
      const next = poolHolder(id);
      if (next !== undefined && alive(next)) {
        yield* Console.log(`pair ${id}: pool ${next} has taken the pair`);
        continue;
      }
      const left = yield* stopPairScopes(id, (name, lease) => Console.log(`${name} outlived ${unit} (lease ${lease}); killing its capacity scope`));
      if (left.length > 0) return yield* new LanFailure({ problem: `stopped ${unit}, but the capacity scope of ${left.join(" and ")} still runs` });
    }
    yield* Console.log(`stopped ${unit}`);
  }
}).pipe(Effect.provide(BunServices.layer));

export interface PairStatus { readonly clients: readonly { readonly name: string; readonly pid?: number }[] }

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

const pairDropOf = (pair: number, status: PairStatus | undefined) => Effect.gen(function*() {
  if (!pairNeedsRestart(status)) return undefined;
  const known = yield* readPool.pipe(Effect.orElseSucceed(() => undefined));
  const clients = known?.pairs.find(item => item.id === pair)?.clients;
  const dropped = status === undefined ? ["its agent"] : status.clients.filter(({ pid }) => pid === undefined).map(({ name }) => `client ${name}`);
  const drop: PairDrop = { pair, dropped: dropped.length === 0 ? ["a client"] : dropped, crashes: clients === undefined ? [] : crashReports(clients) };
  return { drop, profile: known?.profile };
});

export const droppedPair = (pair: number) => pairStatus(pair).pipe(Effect.flatMap(status => pairDropOf(pair, status)), Effect.map(found => found?.drop), Effect.provide(BunServices.layer));

export const pairRestartFile = (directory: string): string => join(directory, "pair-restart.txt");

export interface PairControl {
  readonly status: Effect.Effect<PairStatus | undefined>;
  readonly listed: Effect.Effect<boolean>;
  readonly stop: Effect.Effect<void, CommandFailure, Platform>;
  readonly start: (profile: string | undefined) => Effect.Effect<void, CommandFailure, Platform>;
  readonly every: Duration.Input;
  readonly within: Duration.Input;
}

const stopHolder = (pair: number) => Effect.gen(function*() {
  yield* poolStop(["--pair", String(pair)]);
  const holder = poolHolder(pair);
  if (holder === undefined || !alive(holder)) return;
  const claim = readClaim(pair);
  const session = process.env["NORTH_FLEET_SESSION"] ?? "";
  if (claim?.session !== session) return yield* new LanFailure({ problem: `pair ${pair} is still held by pool ${holder}${claim === undefined ? "" : ` of fleet session ${claim.session || "(none)"}`}; only that session restarts it` });
  yield* frameworkLan(["stop", "--pair", String(pair)]);
});

const livePairControl = (pair: number): PairControl => ({
  status: pairStatus(pair),
  listed: readPool.pipe(Effect.map(pool => pool?.pairs.some(({ id }) => id === pair) ?? false), Effect.orElseSucceed(() => false)),
  stop: stopHolder(pair),
  start: (profile) => poolStart(["--pair", String(pair), ...(profile === undefined ? [] : ["--pool-profile", profile])]),
  every: "2 seconds",
  within: "10 minutes",
});

export const restartPair = (pair: number, control: PairControl) => Effect.gen(function*() {
  const found = yield* pairDropOf(pair, yield* control.status);
  if (found === undefined) return undefined;
  yield* Console.log(`${pairDropText(found.drop)}; restarting the pair`);
  yield* control.stop;
  yield* control.start(found.profile);
  const back = Effect.all([control.status, control.listed]);
  yield* pollUntil(back.pipe(Effect.map(([status, listed]) => pairNeedsRestart(status) || !listed ? undefined : status)), {
    every: control.every,
    within: control.within,
    orElse: () => back.pipe(Effect.flatMap(([status]) => Effect.fail(new LanFailure({ problem: `pair ${pair} wasn't back after its restart: ${status === undefined ? "its agent doesn't answer" : pairNeedsRestart(status) ? status.clients.filter(({ pid }) => pid === undefined).map(({ name }) => name).join(" and ") + " not running" : "the pool hasn't listed it"}` })))),
  });
  yield* Console.log(`pair ${pair} is back`);
  return found.drop;
}).pipe(Effect.provide(BunServices.layer));

export const restartDroppedPair = (pair: number) => restartPair(pair, livePairControl(pair));

export const restartDroppedPairInto = (pair: number, directory: string | undefined) => restartDroppedPair(pair).pipe(Effect.tap(drop => Effect.sync(() => {
  if (drop === undefined || directory === undefined) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(pairRestartFile(directory), `${pairDropText(drop)}; restarted the pair\n`);
})));
