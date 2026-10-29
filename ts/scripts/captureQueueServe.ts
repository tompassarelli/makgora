import { appendFileSync, closeSync, cpSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { Console, Effect, Fiber, Schema } from "effect";
import { UsageFailure } from "wisp/scripts/wisp/command";
import { SELECTABLE_CHARACTERS, fighterKey, fighterName, fighterSlug } from "../src/game/roster/kits";
import { CaptureQueueFailure, Job, type Result, git, queueDirectory, showcaseSlot, writeAtomic } from "./captureQueue";
import { type RemoteHost, builtMapKey, fetchFolder, remoteHost, runThere, sendFile, shipStoredMap } from "./captureQueueRemote";
import { fanGroups } from "./captureQueueFan";
import { peerSpec } from "./captureQueuePeers";
import { attachedPoolReady } from "./wisp/nativePool";
import { projectRoot, tsDirectory } from "./wisp/projectRoot";

const option = (args: readonly string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const fail = (problem: string) => new CaptureQueueFailure({ problem });
const attempt = <A>(problem: string, run: () => A) => Effect.try({ try: run, catch: cause => fail(`${problem}: ${cause instanceof Error ? cause.message : String(cause)}`) });
const seconds = (since: number) => Math.round((performance.now() - since) / 100) / 10;
const HOLD_TICKS = 30;
const TILE_HEIGHT = 270;
const lanState = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/lan");

interface Settings { readonly pair: number; readonly desktop: string; readonly capacity: string; readonly clientsFile: string; readonly client: string; readonly install: string; readonly minutes: number; readonly remote?: RemoteHost }
interface Group { commit: string; readonly jobs: Job[] }

const logTo = (file: string) => (row: Record<string, unknown>) => Effect.sync(() => {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row });
  appendFileSync(file, `${line}\n`);
  console.log(line);
});

const spawnLogged = (command: readonly string[], cwd: string, logFile: string) => Effect.acquireUseRelease(
  attempt(`start ${command.slice(0, 4).join(" ")}`, () => {
    const fd = openSync(logFile, "a");
    const child = Bun.spawn([...command], { cwd, stdin: "ignore", stdout: fd, stderr: fd });
    closeSync(fd);
    return child;
  }),
  child => Effect.promise(() => child.exited).pipe(Effect.flatMap(code => code === 0 ? Effect.void : Effect.fail(fail(`${command.slice(1, 4).join(" ")} exited ${code}; see ${logFile}`)))),
  child => Effect.sync(() => { if (child.exitCode === null) child.kill("SIGINT"); }),
);

const fighterPaths = (fighter: string) => [`:(glob)build-inputs/*/${fighter}`, `:(glob)build-inputs/*/${fighter}/**`];

export const laneIdentical = (repo: string, job: Job, commit: string, main: string) => Effect.gen(function*() {
  const base = (yield* git(repo, ["merge-base", main, job.revision], true)).out || job.revision;
  const own = (yield* git(repo, ["diff", "--name-only", base, job.revision])).out.split("\n").filter(path => path !== "");
  return (yield* git(repo, ["diff", "--quiet", job.revision, commit, "--", ...own.map(path => `:(literal)${path}`), ...fighterPaths(job.fighter)], true)).code === 0;
});

const mergeInto = (repo: string, current: string, revision: string) => Effect.gen(function*() {
  if ((yield* git(repo, ["merge-base", "--is-ancestor", revision, current], true)).code === 0) return current;
  if ((yield* git(repo, ["merge-base", "--is-ancestor", current, revision], true)).code === 0) return revision;
  const tree = yield* git(repo, ["merge-tree", "--write-tree", current, revision], true);
  if (tree.code !== 0) return undefined;
  return (yield* git(repo, ["commit-tree", tree.out.split("\n")[0] ?? "", "-p", current, "-p", revision, "-m", "capture queue batch"])).out;
});

const joins = (repo: string, group: Group, job: Job, main: string) => Effect.gen(function*() {
  const merged = yield* mergeInto(repo, group.commit, job.revision);
  if (merged === undefined) return false;
  for (const member of [...group.jobs, job]) if (!(yield* laneIdentical(repo, member, merged, main))) return false;
  group.commit = merged;
  group.jobs.push(job);
  return true;
});

export const foldLanes = (repo: string, jobs: readonly Job[], main: string) => Effect.gen(function*() {
  const groups: Group[] = [];
  for (const job of jobs) {
    let placed = false;
    for (const group of groups) if (!placed) placed = yield* joins(repo, group, job, main);
    if (!placed) groups.push({ commit: job.revision, jobs: [job] });
  }
  return groups;
});

const takePending = () => attempt("take pending jobs", () => {
  const pending = queueDirectory("pending"), taken = queueDirectory("taken");
  mkdirSync(pending, { recursive: true });
  mkdirSync(taken, { recursive: true });
  return readdirSync(pending).filter(name => name.endsWith(".json")).sort().map(name => {
    renameSync(join(pending, name), join(taken, name));
    return Schema.decodeSync(Schema.fromJsonString(Job))(readFileSync(join(taken, name), "utf8"));
  });
});

const finish = (job: Job, result: Omit<Result, "id" | "lane" | "revision" | "fighter" | "move">) => attempt(`record ${job.id}`, () => {
  const directory = join(queueDirectory("results"), job.id);
  mkdirSync(directory, { recursive: true });
  writeAtomic(join(directory, "result.json"), `${JSON.stringify({ id: job.id, lane: job.lane, revision: job.revision, fighter: job.fighter, move: job.move, ...result }, null, 1)}\n`);
  rmSync(join(queueDirectory("taken"), `${job.id}.json`), { force: true });
});

const pairReady = (pair: number) => Effect.promise(async () => {
  const run = Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "status", "--pair", String(pair)], { cwd: tsDirectory, stdout: "pipe", stderr: "ignore" });
  const text = await new Response(run.stdout).text();
  if (await run.exited !== 0) return false;
  try { return attachedPoolReady(JSON.parse(text) as Parameters<typeof attachedPoolReady>[0]); } catch { return false; }
});

const claimedBy = (pair: number, pid: number) => {
  try { return (JSON.parse(readFileSync(join(lanState, `pair-${pair}`, "claim.json"), "utf8")) as { pid?: number }).pid === pid; } catch { return false; }
};

const warmPool = (settings: Settings, log: ReturnType<typeof logTo>, logFile: string) => Effect.gen(function*() {
  const started = performance.now();
  const child = yield* Effect.acquireRelease(
    attempt("start the warm pool", () => {
      const fd = openSync(logFile, "a");
      const spawned = Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "pool", "--foreground", "--pair", String(settings.pair), "--pool-profile", "visual", "--desktop", settings.desktop, "--capacity", settings.capacity, "--queue", "--owner", "capture-queue", "--owner-pid", String(process.pid)], { cwd: tsDirectory, stdin: "ignore", stdout: fd, stderr: fd });
      closeSync(fd);
      return spawned;
    }),
    spawned => Effect.gen(function*() {
      if (spawned.exitCode !== null) return;
      spawned.kill("SIGINT");
      const stopped = yield* Effect.promise(() => spawned.exited).pipe(Effect.timeoutOption("90 seconds"));
      if (stopped._tag === "None") spawned.kill("SIGTERM");
    }),
  );
  let admitted: number | undefined;
  while (true) {
    if (child.exitCode !== null) return yield* fail(`the pool for pair ${settings.pair} exited ${child.exitCode}; see ${logFile}`);
    const deferred = readFileSync(logFile, "utf8").trimEnd().split("\n").at(-1)?.includes("capacity helper defers") === true;
    if (deferred) admitted = undefined;
    else if (admitted === undefined && claimedBy(settings.pair, child.pid)) admitted = performance.now();
    if (admitted !== undefined && (yield* pairReady(settings.pair))) break;
    yield* Effect.sleep("2 seconds");
  }
  yield* log({ step: "pool", pair: settings.pair, waitedSeconds: Math.round((admitted - started) / 100) / 10, clientsToDoorSeconds: seconds(admitted) });
  return child;
});

const movePads = (reelDirectory: string, job: Job, into: string) => attempt(`pick ${job.fighter} ${job.move}`, () => {
  const slot = showcaseSlot(job.move);
  const source = join(reelDirectory, job.fighter);
  const picked = readdirSync(source).filter(name => name.endsWith(".pad")).sort().filter(name => new RegExp(`^#! reel \\S+ R\\d+ ${slot} (right|left) \\d+$`, "m").test(readFileSync(join(source, name), "utf8")));
  if (picked.length === 0) throw new Error(`${job.fighter} has no showcase row for ${job.move} (${slot}) at this revision`);
  mkdirSync(join(into, job.id), { recursive: true });
  const dummy = job.dummy === undefined ? undefined : SELECTABLE_CHARACTERS.find(character => fighterSlug(character) === job.dummy);
  for (const name of picked) {
    if (dummy === undefined) cpSync(join(source, name), join(into, job.id, name));
    else writeFileSync(join(into, job.id, name), readFileSync(join(source, name), "utf8").replace(/^#! chat -dev quick hero (.+?) stocks \d+$/m, (_, hero: string) => `#! chat -dev quick pair ${hero} / ${fighterKey(dummy).toLowerCase()}`));
  }
  return picked.map(name => `${job.id}-${name.replace(/\.pad$/, "")}`);
});

const CaptureRecord = Schema.Struct({ fixture: Schema.String, frame: Schema.Finite, file: Schema.String, capturedMs: Schema.Finite });
const Checkpoint = Schema.fromJsonString(Schema.Struct({ captures: Schema.Array(CaptureRecord) }));

const fixtureTimes = (checkpoint: string, log: ReturnType<typeof logTo>, group: number) => Effect.gen(function*() {
  const captures = [...(yield* attempt("read the checkpoint", () => Schema.decodeSync(Checkpoint)(readFileSync(checkpoint, "utf8")))).captures].sort((a, b) => a.capturedMs - b.capturedMs);
  const last = new Map<string, number>();
  for (const capture of captures) last.set(capture.fixture, capture.capturedMs);
  let previous = 0;
  for (const [fixture, at] of last) {
    yield* log({ step: "fixture", group, fixture, seconds: Math.round((at - previous) / 100) / 10 });
    previous = at;
  }
  return captures;
});

const sheetFor = (job: Job, fixtures: readonly string[], captures: readonly { readonly fixture: string; readonly frame: number; readonly file: string }[], frames: string, logFile: string) => Effect.gen(function*() {
  const directory = join(queueDirectory("results"), job.id), judge = join(directory, "judge"), sheet = join(directory, "sheet.png");
  yield* attempt("create the result folder", () => mkdirSync(judge, { recursive: true }));
  const crop = job.crop === undefined ? [] : ["-crop", `${job.crop[2]}x${job.crop[3]}+${job.crop[0]}+${job.crop[1]}`, "+repage"];
  const rows = fixtures.map(fixture => captures.filter(capture => capture.fixture === fixture).sort((a, b) => a.frame - b.frame));
  if (rows.some(row => row.length === 0)) return yield* fail(`${job.id}: a fixture has no captured frames`);
  yield* spawnLogged(["magick", ...rows.flatMap(row => ["(", ...row.flatMap(capture => ["(", join(frames, capture.file), ...crop, "-resize", `x${TILE_HEIGHT}`, ")"]), "+append", ")"]), "-append", "+repage", sheet], directory, logFile);
  const character = SELECTABLE_CHARACTERS.find(candidate => fighterSlug(candidate) === job.fighter) ?? 0;
  const brief = yield* attempt("read the judge brief", () => readFileSync(join(projectRoot, "docs/animation-judge-brief.md"), "utf8"));
  yield* attempt("write the judge batch", () => writeAtomic(join(judge, "batch-1.md"), `${brief}\n\n## Your moves (look: classic)\n\n- ${fighterName(character)} (\`${job.fighter}\`), \`${job.move}\`: ${sheet}\n  Native Classic frames in time order, one row per facing (top row faces right).\n\nWrite your scores to ${join(judge, "scores-1.jsonl")}, one JSON line per move.\n`));
  return { sheet, judge };
});

const captureGroup = <R>(settings: Settings, batch: string, group: Group, index: number, log: ReturnType<typeof logTo>, poolReady: Effect.Effect<unknown, CaptureQueueFailure, R>) => Effect.gen(function*() {
  const directory = join(queueDirectory("batches"), batch), logFile = join(directory, "run.log"), source = join(directory, `src-${index}`), sourceTs = join(source, "ts");
  yield* git(projectRoot, ["worktree", "add", "--detach", source, group.commit]);
  return yield* Effect.gen(function*() {
    const built = performance.now();
    yield* spawnLogged(["bun", "install", "--frozen-lockfile"], sourceTs, logFile);
    for (const fighter of new Set(group.jobs.map(job => job.fighter))) yield* spawnLogged(["bun", "scripts/nativeCapture.ts", "reel", "--out", join(directory, `reel-${index}`), "--fighter", fighter, "--hold-ticks", String(HOLD_TICKS)], sourceTs, logFile);
    const fixtures = new Map<string, readonly string[]>();
    for (const job of group.jobs) fixtures.set(job.id, yield* movePads(join(directory, `reel-${index}`), job, join(directory, `pads-${index}`)));
    const map = join(directory, `g${index}.w3x`);
    yield* spawnLogged(["bun", settings.capacity, "session", "--class", "moderate", "--owner", `capture-queue-build-${batch}`, "--", "bun", "scripts/nativeCapture.ts", "build", "--out", map, "--name", `Smashcraft capture queue ${batch} g${index}`, ...group.jobs.map(job => join(directory, `pads-${index}`, job.id))], sourceTs, logFile);
    const manifest = `${map.replace(/\.w3x$/, "")}.captures.json`;
    const identity = yield* attempt("read the map manifest", () => JSON.parse(readFileSync(manifest, "utf8")) as { readonly mapSha256: string; readonly sourceRevision: string; readonly fixtures: readonly { readonly frames: readonly number[] }[] });
    yield* log({ step: "map build", group: index, lanes: group.jobs.map(job => job.lane), fixtures: [...fixtures.values()].flat().length, seconds: seconds(built), mapSha256: identity.mapSha256, sourceRevision: identity.sourceRevision });
    const plan = join(directory, `plan-${index}.json`);
    yield* attempt("write the plan", () => writeAtomic(plan, `${JSON.stringify({ version: 1, sourceRevision: identity.sourceRevision, rows: [{ name: `g${index}`, map, manifest, mapSha256: identity.mapSha256, frames: identity.fixtures.flatMap(fixture => fixture.frames) }] })}\n`));
    yield* poolReady;
    const captured = performance.now();
    if (settings.remote === undefined) yield* spawnLogged([process.execPath, "scripts/nativeCapture.ts", "batch", "--plan", plan, "--out", join(directory, `native-${index}`), "--pair", String(settings.pair), "--desktop", settings.desktop, "--capacity", settings.capacity, "--clients-file", settings.clientsFile, "--client", settings.client, "--install", settings.install, "--minutes", String(settings.minutes)], tsDirectory, logFile);
    else yield* captureThere(settings, settings.remote, { batch, index, directory, logFile, manifest, plan, log });
    yield* log({ step: "capture", group: index, host: settings.remote?.name ?? hostname(), seconds: seconds(captured) });
    const frames = join(directory, `native-${index}`, `g${index}`);
    const captures = yield* fixtureTimes(join(frames, "checkpoint.json"), log, index);
    for (const job of group.jobs) {
      const own = fixtures.get(job.id) ?? [];
      const { sheet, judge } = yield* sheetFor(job, own, captures, frames, logFile);
      yield* finish(job, { batch, status: "captured", mapSha256: identity.mapSha256, sourceRevision: identity.sourceRevision, fixtures: own, sheet, judge, frames });
      yield* log({ step: "sheet", id: job.id, sheet });
    }
  }).pipe(Effect.ensuring(git(projectRoot, ["worktree", "remove", "--force", source], true).pipe(Effect.ignore)));
});

/** Runs a group's capture batch on the pair's host: its stored map goes into that host's map store under the same key, the batch runs from that host's main checkout and its frames come back to `native-INDEX`. */
const captureThere = (settings: Settings, host: RemoteHost, group: { readonly batch: string; readonly index: number; readonly directory: string; readonly logFile: string; readonly manifest: string; readonly plan: string; readonly log: ReturnType<typeof logTo> }) => Effect.gen(function*() {
  const key = yield* attempt("read the map build key", () => builtMapKey(group.logFile));
  if (key === undefined) return yield* fail(`the map build of group ${group.index} logged no stored map build; see ${group.logFile}`);
  const there = join(host.home, ".local/state/smashcraft/capture-queue/remote", `${group.batch}-g${group.index}`);
  const map = yield* shipStoredMap(host, key, group.logFile);
  yield* group.log({ step: "ship", group: group.index, host: host.name, key, map });
  const plan = yield* attempt("read the plan", () => JSON.parse(readFileSync(group.plan, "utf8")) as { readonly rows: readonly Record<string, unknown>[] });
  const remotePlan = `${group.plan.replace(/\.json$/, "")}.${host.name.replaceAll(/[^\w.-]/g, "_")}.json`;
  yield* attempt("write the remote plan", () => writeAtomic(remotePlan, `${JSON.stringify({ ...plan, rows: plan.rows.map(row => ({ ...row, map, manifest: join(there, "manifest.json") })) })}\n`));
  yield* sendFile(host, group.manifest, join(there, "manifest.json"), group.logFile);
  yield* sendFile(host, remotePlan, join(there, "plan.json"), group.logFile);
  const north = join(host.home, "code/north/main/harness/skills");
  yield* runThere(host, join(host.home, "code/smashcraft/main/ts"), ["bun", "scripts/nativeCapture.ts", "batch", "--plan", join(there, "plan.json"), "--out", join(there, "native"), "--pair", String(settings.pair),
    "--desktop", join(north, "private-desktop-development/scripts/private-desktop.sh"), "--capacity", join(north, "machine-capacity/scripts/machine-capacity.mjs"),
    "--clients-file", join(host.home, ".local/state/wisp/lan/clients.json"), "--client", settings.client,
    "--install", join(host.home, `.local/share/wisp/lan/clients/${settings.client}/pfx/drive_c/Program Files (x86)/Warcraft III`), "--minutes", String(settings.minutes)], group.logFile);
  yield* fetchFolder(host, join(there, "native"), join(group.directory, `native-${group.index}`), group.logFile);
});

const runBatch = <R>(settings: Settings, hosts: Hosts, jobs: readonly Job[], ensurePool: Effect.Effect<unknown, CaptureQueueFailure, R>) => Effect.gen(function*() {
  const batch = `b${Date.now().toString(36)}`, directory = join(queueDirectory("batches"), batch);
  yield* attempt("create the batch folder", () => mkdirSync(directory, { recursive: true }));
  const log = logTo(join(directory, "log.jsonl"));
  const folded = performance.now();
  const main = (yield* git(projectRoot, ["rev-parse", "--verify", "origin/main"], true)).out || "HEAD";
  const folds = yield* foldLanes(projectRoot, jobs, main);
  const free = yield* freePairs(hosts);
  const groups = fanGroups(folds, 1 + free);
  yield* log({ step: "fold", batch, jobs: jobs.map(job => job.id), freePairs: free, groups: groups.map(group => ({ commit: group.commit, lanes: group.jobs.map(job => job.lane) })), seconds: seconds(folded) });
  const pool = yield* Effect.forkChild(ensurePool);
  yield* Effect.forEach(groups.entries(), ([index, group]) => Effect.scoped(Effect.gen(function*() {
    const own = index === 0 ? settings : yield* groupSettings(settings, hosts, `capture-queue-${batch}-g${index}`);
    yield* log({ step: "lease", group: index, host: own.remote?.name ?? hostname(), pair: own.pair, lanes: group.jobs.map(job => job.lane) });
    return yield* captureGroup(own, batch, group, index, log, index === 0 ? Fiber.join(pool) : Effect.void);
  })).pipe(Effect.result, Effect.flatMap(outcome => outcome._tag === "Success" ? Effect.void : Effect.gen(function*() {
    yield* log({ step: "failed", group: index, problem: outcome.failure.message });
    for (const job of group.jobs) yield* finish(job, { batch, status: "failed", problem: outcome.failure.message });
  }))), { concurrency: "unbounded", discard: true });
  yield* log({ step: "batch", batch, seconds: seconds(folded) });
});

const settingsOf = (args: readonly string[]): Settings | undefined => {
  const pair = Number(option(args, "--pair"));
  const minutes = Number(option(args, "--minutes") ?? "4");
  if (!Number.isInteger(pair) || pair < 0 || !Number.isFinite(minutes) || minutes < 1 || minutes > 5) return undefined;
  const north = join(homedir(), "code/north/main/harness/skills");
  const client = option(args, "--client") ?? `lan${pair}a`;
  return {
    pair, minutes, client,
    desktop: option(args, "--desktop") ?? join(north, "private-desktop-development/scripts/private-desktop.sh"),
    capacity: option(args, "--capacity") ?? join(north, "machine-capacity/scripts/machine-capacity.mjs"),
    clientsFile: option(args, "--clients-file") ?? join(lanState, "clients.json"),
    install: option(args, "--install") ?? join(homedir(), `.local/share/wisp/lan/clients/${client}/pfx/drive_c/Program Files (x86)/Warcraft III`),
  };
};

type Hosts = "local" | "any";

const lanLease = (verb: "take" | "release" | "status", extra: readonly string[], hosts: Hosts) => Effect.gen(function*() {
  const remote = hosts === "any" ? yield* peerSpec : "";
  return yield* Effect.promise(async () => {
    const run = Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "lease", verb, ...extra], { cwd: tsDirectory, stdin: "ignore", stdout: "pipe", stderr: "inherit", env: { ...process.env, WISP_PAIR_REMOTE: remote } });
    const text = await new Response(run.stdout).text();
    return { code: await run.exited, text };
  });
});

const LEASE_WAIT_SECONDS = 1800;

const freePairs = (hosts: Hosts) => lanLease("status", [], hosts).pipe(Effect.map(({ code, text }) => {
  try { return code === 0 ? (JSON.parse(text.trim().split("\n").at(-1) ?? "{}") as { free?: unknown[] }).free?.length ?? 0 : 0; } catch { return 0; }
}));

/** The next free pair from the shared pair queue, on this host or with `any` on another, held until the scope ends; the lease also ends with this process. */
const leasePair = (hosts: Hosts, owner: string) => Effect.acquireRelease(
  lanLease("take", ["--owner", owner, "--pid", String(process.pid), "--hosts", hosts, "--wait", String(LEASE_WAIT_SECONDS)], hosts).pipe(Effect.flatMap(({ code, text }) => {
    const slot = code === 0 ? (JSON.parse(text.trim().split("\n").at(-1) ?? "{}") as { host?: string; pair?: number }) : undefined;
    return slot?.host === undefined || slot.pair === undefined ? Effect.fail(fail("no free pair from the shared pair queue; see its output above")) : Effect.succeed({ host: slot.host, pair: slot.pair });
  })),
  slot => lanLease("release", ["--host", slot.host, "--pair", String(slot.pair)], hosts).pipe(Effect.ignore),
);

const groupSettings = (settings: Settings, hosts: Hosts, owner: string) => Effect.gen(function*() {
  const slot = yield* leasePair(hosts, owner);
  const client = `lan${slot.pair}a`;
  const remote = slot.host === hostname() ? undefined : yield* remoteHost(slot.host);
  return { pair: slot.pair, minutes: settings.minutes, desktop: settings.desktop, capacity: settings.capacity, clientsFile: settings.clientsFile, client, install: join(homedir(), `.local/share/wisp/lan/clients/${client}/pfx/drive_c/Program Files (x86)/Warcraft III`), ...(remote === undefined ? {} : { remote }) } satisfies Settings;
});

export const serve = (given: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const pairs = given.flatMap((arg, index) => arg === "--pair" ? [index] : []);
  const auto = pairs.length === 0 || given[pairs[0]! + 1] === "auto";
  const hosts: Hosts = option(given, "--hosts") === "any" ? "any" : "local";
  const leased = auto ? yield* leasePair(hosts, "capture-queue") : undefined;
  const args = leased === undefined ? given : [...given.filter((arg, index) => !(pairs.includes(index) || pairs.includes(index - 1))), "--pair", String(leased.pair)];
  const local = settingsOf(args);
  const settings = local === undefined || leased === undefined || leased.host === hostname() ? local : { ...local, remote: yield* remoteHost(leased.host) };
  const once = args.includes("--once");
  const idleMinutes = Number(option(args, "--idle-minutes") ?? "30");
  if (settings === undefined || !Number.isFinite(idleMinutes) || idleMinutes < 0) return yield* new UsageFailure({ problem: "anim capture serve [--pair K|auto] [--hosts local|any] [--once] [--idle-minutes N] [--minutes 1..5] [--client NAME] [--install DIR] [--clients-file FILE] [--desktop SH] [--capacity HELPER]" });
  yield* attempt("create the queue", () => mkdirSync(queueDirectory("batches"), { recursive: true }));
  const poolLog = join(queueDirectory("batches"), `pool-${settings.pair}.log`);
  let pool: Bun.Subprocess | undefined;
  const ensurePool = Effect.gen(function*() {
    if (pool !== undefined && pool.exitCode === null) return;
    if (settings.remote === undefined) pool = yield* warmPool(settings, logTo(join(queueDirectory("batches"), "pool.jsonl")), poolLog);
  });
  let idleSince = performance.now();
  yield* Console.log(`capture queue serving ${queueDirectory("pending")} on pair ${settings.pair}${settings.remote === undefined ? "" : ` of ${settings.remote.name}`}${once ? " (once)" : `, stopping after ${idleMinutes} idle minutes`}`);
  while (true) {
    const jobs = yield* takePending();
    if (jobs.length > 0) {
      yield* runBatch(settings, hosts, jobs, ensurePool);
      idleSince = performance.now();
      continue;
    }
    if (once || performance.now() - idleSince > idleMinutes * 60_000) break;
    yield* Effect.sleep("5 seconds");
  }
}));
