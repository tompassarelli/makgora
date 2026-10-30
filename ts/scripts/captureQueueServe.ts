import { appendFileSync, closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { Console, Effect, Fiber, Schema } from "effect";
import { UsageFailure } from "wisp/scripts/wisp/command";
import { SELECTABLE_CHARACTERS, fighterKey, fighterName, fighterSlug } from "../src/game/roster/kits";
import { CaptureQueueFailure, Job, type Result, git, queueDirectory, showcaseSlot, writeAtomic } from "./captureQueue";
import { reuseStore } from "wisp/scripts/wisp/mapReuse";
import { builtMapKey } from "./captureQueueRemote";
import { queueOnLaptop } from "./captureQueueLaptop";
import { lanState, pairDefaults } from "./captureQueuePair";
import { fanGroups } from "./captureQueueFan";
import { peerSpec } from "./captureQueuePeers";
import { pairAgentStatus } from "./pairAgentStatus";
import { attachedPoolReady } from "./wisp/nativePool";
import { type Checkout, servingCheckout } from "./captureQueueCheckout";
import { projectRoot } from "./wisp/projectRoot";

const option = (args: readonly string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const fail = (problem: string) => new CaptureQueueFailure({ problem });
const attempt = <A>(problem: string, run: () => A) => Effect.try({ try: run, catch: cause => fail(`${problem}: ${cause instanceof Error ? cause.message : String(cause)}`) });
const seconds = (since: number) => Math.round((performance.now() - since) / 100) / 10;
const HOLD_TICKS = 30;
const captureMinutes = (scripts: number) => Math.ceil((60 + scripts * 11) / 60);
const TILE_HEIGHT = 270;
const BODY_CROP: readonly number[] = [330, 40, 660, 480];
const FACING_ARROW = { right: "10,14 34,14 34,6 50,20 34,34 34,26 10,26", left: "50,14 26,14 26,6 10,20 26,34 26,26 50,26" } as const;
type Facing = keyof typeof FACING_ARROW;
interface PadRow { readonly fixture: string; readonly facing: Facing }

interface Settings { readonly pair: number; readonly desktop: string; readonly capacity: string; readonly clientsFile: string; readonly client: string; readonly install: string; readonly checkout: Checkout; readonly remote?: { readonly name: string } }
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

const pairReady = (pair: number) => pairAgentStatus(pair).pipe(
  Effect.map(text => attachedPoolReady(JSON.parse(text) as Parameters<typeof attachedPoolReady>[0])),
  Effect.orElseSucceed(() => false),
);

const claimedBy = (pair: number, pid: number) => {
  try { return (JSON.parse(readFileSync(join(lanState, `pair-${pair}`, "claim.json"), "utf8")) as { pid?: number }).pid === pid; } catch { return false; }
};

const warmPool = (settings: Settings, log: ReturnType<typeof logTo>, logFile: string) => Effect.gen(function*() {
  const started = performance.now();
  const child = yield* Effect.acquireRelease(
    attempt("start the warm pool", () => {
      const fd = openSync(logFile, "a");
      const spawned = Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "pool", "--foreground", "--pair", String(settings.pair), "--pool-profile", "visual", "--desktop", settings.desktop, "--capacity", settings.capacity, "--queue", "--owner", "capture-queue", "--owner-pid", String(process.pid), "--release-idle", "0"], { cwd: settings.checkout.ts, stdin: "ignore", stdout: fd, stderr: fd });
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
    yield* Effect.sleep("5 seconds");
  }
  yield* log({ step: "pool", pair: settings.pair, waitedSeconds: Math.round((admitted - started) / 100) / 10, clientsToDoorSeconds: seconds(admitted) });
  return child;
});

const movePads = (reelDirectory: string, job: Job, into: string) => attempt(`pick ${job.fighter} ${job.move}`, () => {
  const slot = showcaseSlot(job.move);
  const source = join(reelDirectory, job.fighter);
  const reel = new RegExp(`^#! reel \\S+ R\\d+ ${slot} (right|left) \\d+$`, "m");
  const facingOf = (name: string): Facing | undefined => { const facing = reel.exec(readFileSync(join(source, name), "utf8"))?.[1]; return facing === "right" || facing === "left" ? facing : undefined; };
  const picked = readdirSync(source).filter(name => name.endsWith(".pad")).sort().filter(name => facingOf(name) !== undefined);
  if (picked.length === 0) throw new Error(`${job.fighter} has no showcase row for ${job.move} (${slot}) at this revision`);
  mkdirSync(join(into, job.id), { recursive: true });
  const dummy = SELECTABLE_CHARACTERS.find(character => fighterSlug(character) === dummyOf(job));
  for (const name of picked) {
    if (dummy === undefined) cpSync(join(source, name), join(into, job.id, name));
    else writeFileSync(join(into, job.id, name), readFileSync(join(source, name), "utf8").replace(/^#! chat -dev quick hero (.+?) stocks \d+$/m, (_, hero: string) => `#! chat -dev quick pair ${hero} / ${fighterKey(dummy).toLowerCase()}`));
  }
  return picked.map(name => ({ fixture: `${job.id}-${name.replace(/\.pad$/, "")}`, facing: facingOf(name) ?? "right" }));
});

/** The capture target: the job's dummy, else a fighter unlike the mover, so a cold viewer can tell the attacker from the fighter he hits. */
export const dummyOf = (job: Pick<Job, "fighter" | "dummy">): string => job.dummy ?? (job.fighter === "peon" ? "rifleman" : "peon");

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

/** The jobs whose every manifest frame is in the checkpoint: a batch that misses one clip still returns every clip it captured whole. */
export const capturedWhole = (fixtures: ReadonlyMap<string, readonly string[]>, manifest: readonly { readonly name: string; readonly frames: readonly number[] }[], captures: readonly { readonly fixture: string; readonly frame: number }[]) => {
  const got = new Set(captures.map(capture => `${capture.fixture}@${capture.frame}`));
  const whole = new Set(manifest.filter(fixture => fixture.frames.every(frame => got.has(`${fixture.name}@${frame}`))).map(fixture => fixture.name));
  return new Set([...fixtures].filter(([, own]) => own.length > 0 && own.every(name => whole.has(name))).map(([job]) => job));
};

const sheetFor = (root: string, job: Job, fixtures: readonly PadRow[], captures: readonly { readonly fixture: string; readonly frame: number; readonly file: string }[], frames: string, logFile: string) => Effect.gen(function*() {
  const directory = join(queueDirectory("results"), job.id), judge = join(directory, "judge"), sheet = join(directory, "sheet.png");
  yield* attempt("create the result folder", () => mkdirSync(judge, { recursive: true }));
  const [left, top, width, height] = job.crop ?? BODY_CROP;
  const crop = ["-crop", `${width}x${height}+${left}+${top}`, "+repage"];
  const rows = fixtures.map(({ fixture, facing }) => ({ facing, row: captures.filter(capture => capture.fixture === fixture).sort((a, b) => a.frame - b.frame) }));
  if (rows.some(({ row }) => row.length === 0)) return yield* fail(`${job.id}: a fixture has no captured frames`);
  yield* spawnLogged(["magick", ...rows.flatMap(({ facing, row }) => ["(", ...row.flatMap(capture => ["(", join(frames, capture.file), ...crop, "-resize", `x${TILE_HEIGHT}`, "-fill", "white", "-stroke", "black", "-strokewidth", "2", "-draw", `polygon ${FACING_ARROW[facing]}`, ")"]), "+append", ")"]), "-append", "+repage", sheet], directory, logFile);
  const character = SELECTABLE_CHARACTERS.find(candidate => fighterSlug(candidate) === job.fighter) ?? 0;
  const dummy = SELECTABLE_CHARACTERS.find(candidate => fighterSlug(candidate) === dummyOf(job)) ?? 0;
  const brief = yield* attempt("read the judge brief", () => readFileSync(join(root, "docs/animation-judge-brief.md"), "utf8"));
  yield* attempt("write the judge batch", () => writeAtomic(join(judge, "batch-1.md"), `${brief}\n\n## Your moves (look: classic)\n\n- ${fighterName(character)} (\`${job.fighter}\`), \`${job.move}\`: ${sheet}\n  Native Classic frames in time order, one row per facing; the arrow in each frame's corner points the way ${fighterName(character)} faces. The other fighter is a ${fighterName(dummy)} standing in as the target.\n\nWrite your scores to ${join(judge, "scores-1.jsonl")}, one JSON line per move.\n`));
  return { sheet, judge };
});

/** Builds the group's map, then takes its pair through `pairReady` only once the map is built, so no idle lease release takes the pair from a group still building, and captures it there. */
const captureGroup = <R>(settings: Settings, batch: string, group: Group, index: number, log: ReturnType<typeof logTo>, pairReady: Effect.Effect<Settings, CaptureQueueFailure, R>) => Effect.gen(function*() {
  const directory = join(queueDirectory("batches"), batch), logFile = join(directory, "run.log"), source = join(directory, `src-${index}`), sourceTs = join(source, "ts");
  yield* git(settings.checkout.root, ["worktree", "add", "--detach", source, group.commit]);
  return yield* Effect.gen(function*() {
    const built = performance.now();
    yield* spawnLogged(["bun", "install", "--frozen-lockfile"], sourceTs, logFile);
    for (const fighter of new Set(group.jobs.map(job => job.fighter))) yield* spawnLogged(["bun", "scripts/nativeCapture.ts", "reel", "--out", join(directory, `reel-${index}`), "--fighter", fighter, "--hold-ticks", String(HOLD_TICKS)], sourceTs, logFile);
    const pads = new Map<string, readonly PadRow[]>();
    for (const job of group.jobs) pads.set(job.id, yield* movePads(join(directory, `reel-${index}`), job, join(directory, `pads-${index}`)));
    const fixtures = new Map([...pads].map(([id, rows]) => [id, rows.map(row => row.fixture)]));
    const map = join(directory, `g${index}.w3x`);
    yield* spawnLogged(["bun", settings.capacity, "session", "--class", "moderate", "--owner", `capture-queue-build-${batch}`, "--", "bun", "scripts/nativeCapture.ts", "build", "--out", map, "--name", `Smashcraft capture queue ${batch} g${index}`, ...group.jobs.map(job => join(directory, `pads-${index}`, job.id))], sourceTs, logFile);
    const manifest = `${map.replace(/\.w3x$/, "")}.captures.json`;
    const identity = yield* attempt("read the map manifest", () => JSON.parse(readFileSync(manifest, "utf8")) as { readonly mapSha256: string; readonly sourceRevision: string; readonly fixtures: readonly { readonly name: string; readonly frames: readonly number[] }[] });
    yield* log({ step: "map build", group: index, lanes: group.jobs.map(job => job.lane), fixtures: [...fixtures.values()].flat().length, seconds: seconds(built), mapSha256: identity.mapSha256, sourceRevision: identity.sourceRevision });
    const plan = join(directory, `plan-${index}.json`);
    yield* attempt("write the plan", () => writeAtomic(plan, `${JSON.stringify({ version: 1, sourceRevision: identity.sourceRevision, rows: [{ name: `g${index}`, map, manifest, mapSha256: identity.mapSha256, frames: identity.fixtures.flatMap(fixture => fixture.frames) }] })}\n`));
    const leased = yield* pairReady;
    yield* log({ step: "lease", group: index, host: leased.remote?.name ?? hostname(), pair: leased.pair, lanes: group.jobs.map(job => job.lane) });
    const captured = performance.now();
    const ran = yield* (leased.remote === undefined ? spawnLogged([process.execPath, "scripts/nativeCapture.ts", "batch", "--plan", plan, "--out", join(directory, `native-${index}`), "--pair", String(leased.pair), "--desktop", leased.desktop, "--capacity", leased.capacity, "--clients-file", leased.clientsFile, "--client", leased.client, "--install", leased.install, "--minutes", String(captureMinutes(identity.fixtures.length))], settings.checkout.ts, logFile)
      : captureThere(leased.remote, { batch, index, directory, logFile, manifest, plan, log, minutes: captureMinutes(identity.fixtures.length) }, leased.pair, leased.client)).pipe(Effect.result);
    yield* log({ step: "capture", group: index, host: leased.remote?.name ?? hostname(), seconds: seconds(captured) });
    const frames = join(directory, `native-${index}`, `g${index}`);
    const checkpoint = join(frames, "checkpoint.json");
    if (ran._tag === "Failure" && !existsSync(checkpoint)) return yield* ran.failure;
    const captures = yield* fixtureTimes(checkpoint, log, index);
    const whole = capturedWhole(fixtures, identity.fixtures, captures);
    for (const job of group.jobs) {
      const own = fixtures.get(job.id) ?? [];
      if (ran._tag === "Failure" && !whole.has(job.id)) {
        yield* finish(job, { batch, status: "failed", problem: ran.failure.message });
        yield* log({ step: "failed", id: job.id, problem: ran.failure.message });
        continue;
      }
      const { sheet, judge } = yield* sheetFor(settings.checkout.root, job, pads.get(job.id) ?? [], captures, frames, logFile);
      yield* finish(job, { batch, status: "captured", mapSha256: identity.mapSha256, sourceRevision: identity.sourceRevision, fixtures: own, sheet, judge, frames });
      yield* log({ step: "sheet", id: job.id, sheet });
    }
  }).pipe(Effect.ensuring(git(settings.checkout.root, ["worktree", "remove", "--force", source], true).pipe(Effect.ignore)));
});

/** Queues a group's capture batch for the pair's host, which pulls the stored map, plan and manifest from here, runs the batch and sends its frames back to `native-INDEX`; this host waits for that job to end. */
const captureThere = (host: { readonly name: string }, group: { readonly batch: string; readonly index: number; readonly directory: string; readonly logFile: string; readonly manifest: string; readonly plan: string; readonly log: ReturnType<typeof logTo>; readonly minutes: number }, pair: number, client: string) => Effect.gen(function*() {
  const key = yield* attempt("read the map build key", () => builtMapKey(group.logFile));
  if (key === undefined) return yield* fail(`the map build of group ${group.index} logged no stored map build; see ${group.logFile}`);
  yield* queueOnLaptop(host.name, { origin: hostname(), originStore: reuseStore(), key, plan: group.plan, manifest: group.manifest, out: join(group.directory, `native-${group.index}`), work: `${group.batch}-g${group.index}`, pair, client, minutes: group.minutes }, group.log);
});

const runBatch = <R>(settings: Settings, hosts: Hosts, maxPairs: number, jobs: readonly Job[], ensurePool: Effect.Effect<unknown, CaptureQueueFailure, R>) => Effect.gen(function*() {
  const batch = `b${Date.now().toString(36)}`, directory = join(queueDirectory("batches"), batch);
  yield* attempt("create the batch folder", () => mkdirSync(directory, { recursive: true }));
  const log = logTo(join(directory, "log.jsonl"));
  const folded = performance.now();
  const main = (yield* git(settings.checkout.root, ["rev-parse", "--verify", "origin/main"], true)).out || "HEAD";
  const folds = yield* foldLanes(settings.checkout.root, jobs, main);
  const free = yield* freePairs(settings.checkout, hosts);
  const groups = fanGroups(folds, Math.min(maxPairs, 1 + free));
  yield* log({ step: "fold", batch, jobs: jobs.map(job => job.id), freePairs: free, groups: groups.map(group => ({ commit: group.commit, lanes: group.jobs.map(job => job.lane) })), seconds: seconds(folded) });
  const pool = yield* Effect.forkChild(ensurePool);
  yield* Effect.forEach(groups.entries(), ([index, group]) => Effect.scoped(captureGroup(settings, batch, group, index, log, index === 0 ? Fiber.join(pool).pipe(Effect.as(settings)) : groupSettings(settings, hosts, `capture-queue-${batch}-g${index}`))).pipe(Effect.result, Effect.flatMap(outcome => outcome._tag === "Success" ? Effect.void : Effect.gen(function*() {
    yield* log({ step: "failed", group: index, problem: outcome.failure.message });
    for (const job of group.jobs) yield* finish(job, { batch, status: "failed", problem: outcome.failure.message });
  }))), { concurrency: "unbounded", discard: true });
  yield* log({ step: "batch", batch, seconds: seconds(folded) });
});

const settingsOf = (args: readonly string[], checkout: Checkout): Settings | undefined => {
  const pair = Number(option(args, "--pair"));
  if (!Number.isInteger(pair) || pair < 0) return undefined;
  const own = pairDefaults(pair, option(args, "--client"));
  return { pair, client: own.client, checkout, desktop: option(args, "--desktop") ?? own.desktop, capacity: option(args, "--capacity") ?? own.capacity, clientsFile: option(args, "--clients-file") ?? own.clientsFile, install: option(args, "--install") ?? own.install };
};

type Hosts = "local" | "any";

const lanLease = (checkout: Checkout, verb: "take" | "release" | "status", extra: readonly string[], hosts: Hosts) => Effect.gen(function*() {
  const remote = hosts === "any" ? yield* peerSpec : "";
  return yield* Effect.promise(async () => {
    const run = Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "lease", verb, ...extra], { cwd: checkout.ts, stdin: "ignore", stdout: "pipe", stderr: "inherit", env: { ...process.env, WISP_PAIR_REMOTE: remote } });
    const text = await new Response(run.stdout).text();
    return { code: await run.exited, text };
  });
});

const LEASE_WAIT_SECONDS = 1800;

const freePairs = (checkout: Checkout, hosts: Hosts) => lanLease(checkout, "status", [], hosts).pipe(Effect.map(({ code, text }) => {
  try { return code === 0 ? (JSON.parse(text.trim().split("\n").at(-1) ?? "{}") as { free?: unknown[] }).free?.length ?? 0 : 0; } catch { return 0; }
}));

/** The next free pair from the shared pair queue, on this host or with `any` on another, held until the scope ends; the lease also ends with this process. */
const leasePair = (checkout: Checkout, hosts: Hosts, owner: string) => Effect.acquireRelease(
  lanLease(checkout, "take", ["--owner", owner, "--pid", String(process.pid), "--hosts", hosts, "--wait", String(LEASE_WAIT_SECONDS)], hosts).pipe(Effect.flatMap(({ code, text }) => {
    const slot = code === 0 ? (JSON.parse(text.trim().split("\n").at(-1) ?? "{}") as { host?: string; pair?: number }) : undefined;
    return slot?.host === undefined || slot.pair === undefined ? Effect.fail(fail("no free pair from the shared pair queue; see its output above")) : Effect.succeed({ host: slot.host, pair: slot.pair });
  })),
  slot => lanLease(checkout, "release", ["--host", slot.host, "--pair", String(slot.pair)], hosts).pipe(Effect.ignore),
);

const groupSettings = (settings: Settings, hosts: Hosts, owner: string) => Effect.gen(function*() {
  const slot = yield* leasePair(settings.checkout, hosts, owner);
  const own = pairDefaults(slot.pair);
  return { pair: slot.pair, checkout: settings.checkout, desktop: settings.desktop, capacity: settings.capacity, clientsFile: settings.clientsFile, client: own.client, install: own.install, ...(slot.host === hostname() ? {} : { remote: { name: slot.host } }) } satisfies Settings;
});

export const serve = (given: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const pairs = given.flatMap((arg, index) => arg === "--pair" ? [index] : []);
  const auto = pairs.length === 0 || given[pairs[0]! + 1] === "auto";
  const hosts: Hosts = option(given, "--hosts") === "any" ? "any" : "local";
  const maxPairs = Number(option(given, "--max-pairs") ?? "64");
  yield* attempt("create the serve folder", () => mkdirSync(queueDirectory("serve"), { recursive: true }));
  const checkout = yield* servingCheckout(projectRoot, join(queueDirectory("serve"), `${process.pid}-${Date.now().toString(36)}`));
  const leased = auto ? yield* leasePair(checkout, hosts, "capture-queue") : undefined;
  const args = leased === undefined ? given : [...given.filter((arg, index) => !(pairs.includes(index) || pairs.includes(index - 1))), "--pair", String(leased.pair)];
  const local = settingsOf(args, checkout);
  const settings = local === undefined || leased === undefined || leased.host === hostname() ? local : { ...local, remote: { name: leased.host } };
  const once = args.includes("--once");
  const idleMinutes = Number(option(args, "--idle-minutes") ?? "30");
  if (settings === undefined || !Number.isFinite(idleMinutes) || idleMinutes < 0 || !Number.isInteger(maxPairs) || maxPairs < 1) return yield* new UsageFailure({ problem: "anim capture serve [--pair K|auto] [--hosts local|any] [--max-pairs N] [--once] [--idle-minutes N] [--client NAME] [--install DIR] [--clients-file FILE] [--desktop SH] [--capacity HELPER]" });
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
      yield* runBatch(settings, hosts, maxPairs, jobs, ensurePool);
      idleSince = performance.now();
      continue;
    }
    if (once || performance.now() - idleSince > idleMinutes * 60_000) break;
    yield* Effect.sleep("5 seconds");
  }
}));
