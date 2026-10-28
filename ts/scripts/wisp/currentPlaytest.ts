




import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";
import { buildOnce } from "./buildInputs";
import { capacityHelper } from "../heavyCapacity";
import { withLock } from "./fileLock";
import { PREDICT_COST, installName } from "./greenBuilds";
import { MAP_FOLDER } from "./mapLibrary";
import { projectRoot } from "./project";

const inputsRoot = join(homedir(), ".local/share/smashcraft-build-inputs");
const builds = join(inputsRoot, "play-current");
const locks = join(inputsRoot, "locks");
const playProblem = (cause: unknown) => new PlayProblem({ problem: String(cause) });

const run = (cwd: string, [program = "", ...args]: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd, stdin: "ignore", stdout: "inherit", stderr: "inherit" })).pipe(
    Effect.asVoid,
    Effect.mapError(() => playProblem(new Error(`${program} failed while preparing the current build`))),
  );

const capture = (cwd: string, [program = "", ...args]: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd, stdin: "ignore" })).pipe(Effect.orElseSucceed(() => undefined));
const tryPlay = <A>(run: () => A) => Effect.try({ try: run, catch: playProblem });


export function releaseTarget(described: string | undefined): string | undefined {
  const match = /^v(\d+)\.(\d+)\.(\d+)(-\d+-g[0-9a-f]+)?$/.exec(described?.trim() ?? "");
  if (match === null) return undefined;
  return `${match[1]}.${match[2]}.${Number(match[3]) + (match[4] === undefined ? 0 : 1)}`;
}

export function buildName(tags: readonly string[], target: string, revision: string): string {
  if (tags.includes(`v${target}`)) return `Smashcraft ${target}`;
  const candidates = tags.flatMap((tag) => {
    const [version, number = ""] = tag.slice(1).split("-rc.");
    return tag.startsWith("v") && version === target && /^\d+$/.test(number) ? [Number(number)] : [];
  });
  if (candidates.length > 0) return `Smashcraft ${target} RC-${Math.max(...candidates)}`;
  return installName(target, revision);
}

const tagsAt = (revision: string) =>
  capture(projectRoot, ["git", "tag", "--points-at", revision]).pipe(Effect.map((text) => (text ?? "").split("\n").map((tag) => tag.trim()).filter((tag) => tag !== "")));

/** The release `revision` builds toward: its own vX.Y.Z tag, else the patch after the newest one it descends from. */
export const playTarget = (revision: string) => Effect.gen(function*() {
  const target = releaseTarget(yield* capture(projectRoot, ["git", "describe", "--tags", "--match", "v[0-9]*.[0-9]*.[0-9]*", "--exclude", "v*-*", revision]));
  if (target === undefined) return yield* playProblem(new Error(`no vX.Y.Z release tag is reachable from ${revision.slice(0, 12)}`));
  return target;
}).pipe(Effect.provide(BunServices.layer));

export const playName = (revision: string) => Effect.gen(function*() {
  const target = yield* playTarget(revision);
  return buildName(yield* tagsAt(revision), target, revision);
}).pipe(Effect.provide(BunServices.layer));


const mainCheckoutOf = Effect.gen(function*() {
  const registry = yield* capture(projectRoot, ["git", "worktree", "list", "--porcelain"]);
  const mainCheckout = registry?.split("\n\n")[0]?.split("\n").find((line) => line.startsWith("worktree "))?.slice(9);
  if (mainCheckout === undefined) return yield* playProblem(new Error("couldn't locate the main checkout"));
  return mainCheckout;
});


const resolveMain = Effect.gen(function*() {
  const resolved = yield* capture(projectRoot, ["git", "rev-parse", "origin/main", "origin/main:controller"]);
  const [revision, controller] = (resolved ?? "").split("\n");
  if (resolved === undefined || revision === undefined || controller === undefined || !/^[a-f0-9]{40}$/.test(revision) || !/^[a-f0-9]{40}$/.test(controller)) return yield* playProblem(new Error("couldn't resolve Smashcraft main"));
  return { mainCheckout: yield* mainCheckoutOf, revision, controller };
});


const resolveRevision = (revision: string) => Effect.gen(function*() {
  const controller = (yield* capture(projectRoot, ["git", "rev-parse", `${revision}:controller`]))?.trim();
  if (controller === undefined || !/^[a-f0-9]{40}$/.test(controller)) return yield* playProblem(new Error(`couldn't resolve commit ${revision}`));
  return { mainCheckout: yield* mainCheckoutOf, revision, controller };
});


const revisionLock = (revision: string) => join(locks, `play-${revision}.lock`);





export interface BuildStage {
  readonly name: string;
  readonly millis: number;
}

export const timedStage = (stages: BuildStage[], name: string) => <A, E, R>(work: Effect.Effect<A, E, R>) => Effect.gen(function*() {
  const started = yield* Clock.currentTimeMillis;
  const value = yield* work;
  stages.push({ name, millis: (yield* Clock.currentTimeMillis) - started });
  return value;
});

export const COMPILE_INPUT = /^(ts\/(src\/|plugins\/|vendor\/|scripts\/wisp\/bundleConfigs\.ts$|wisp\.lock$|package\.json$|bun\.lock$|tsconfig[^/]*\.json$)|typescript-toolchain\.lock$)/;

export const compileInputsChanged = (changed: string | undefined) =>
  changed === undefined || changed.split("\n").some((path) => COMPILE_INPUT.test(path.trim()));

const discardBundles = (lane: string) => tryPlay(() => {
  const built = join(lane, "ts", "build");
  if (!existsSync(built)) return;
  for (const name of readdirSync(built)) if (/\.lua(\.map)?$/.test(name)) rmSync(join(built, name), { force: true });
});

const moveBuildCheckout = (lane: string, revision: string) => Effect.gen(function*() {
  const previous = existsSync(lane) ? (yield* capture(lane, ["git", "rev-parse", "HEAD"]))?.trim() : undefined;
  if (previous === undefined) {
    yield* capture(projectRoot, ["git", "worktree", "remove", "--force", lane]);
    yield* tryPlay(() => rmSync(lane, { recursive: true, force: true }));
    yield* capture(projectRoot, ["git", "worktree", "prune"]);
    yield* run(projectRoot, ["git", "worktree", "add", "--detach", lane, revision]);
    return;
  }
  if (previous === revision) return;
  if (compileInputsChanged(yield* capture(lane, ["git", "diff", "--name-only", previous, revision]))) yield* discardBundles(lane);
  yield* run(lane, ["git", "checkout", "--quiet", "--force", "--detach", revision]);
  yield* run(lane, ["git", "clean", "-fdq"]);
});

const withBuildCheckout = <A, E, R>(mainCheckout: string, revision: string, stages: BuildStage[], use: (lane: string) => Effect.Effect<A, E, R>) => {
  const lane = join(dirname(mainCheckout), "worktrees", "play-build");
  return withLock(join(locks, "play-build-checkout.lock"), "Waiting for the play build checkout", Effect.gen(function*() {
    yield* moveBuildCheckout(lane, revision).pipe(timedStage(stages, "checkout"));
    return yield* use(lane);
  }));
};

const helperPath = (controller: string) => join(inputsRoot, "play-helpers", controller, "wc3-journal");
const helperTarget = join(inputsRoot, "play-helper-target");


const buildHelper = (lane: string, helper: string) => withLock(join(locks, "play-helper-target.lock"), "Waiting for another controller helper build", Effect.gen(function*() {
  const capacity = capacityHelper;
  // The pinned padbridge service comes from the plug-in's git dependency (controller/Cargo.toml).
  const build = (target: string) => `cargo build --release --locked --jobs 2 --target-dir '${helperTarget}' ${target}`;
  yield* run(join(lane, "controller"), ["nix-shell", "-p", "stdenv.cc", "cmake", "pkg-config", "libxkbcommon", "udev", "--run",
    `PATH=${join(homedir(), ".rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin")}:$PATH bun '${capacity}' run --class tom --owner smashcraft:play-helper --timeout-seconds 900 -- sh -c "${build("--bin wc3-journal")} && ${build("-p padbridge --bin padbridge")}"`]);

  yield* tryPlay(() => {
    mkdirSync(dirname(helper), { recursive: true });
    for (const name of ["padbridge", "wc3-journal"]) {
      const staged = join(dirname(helper), `${name}.${process.pid}.tmp`);
      copyFileSync(join(helperTarget, "release", name), staged);
      renameSync(staged, join(dirname(helper), name));
    }
  });
}));


export const currentHelper = Effect.gen(function*() {
  const { revision, controller, mainCheckout } = yield* resolveMain;
  const helper = helperPath(controller);
  if (existsSync(helper)) return helper;
  return yield* withLock(revisionLock(revision), `Waiting for another build of ${revision.slice(0, 12)}`, Effect.gen(function*() {
    if (existsSync(helper)) return helper;
    console.log("Building the controller helper");
    yield* withBuildCheckout(mainCheckout, revision, [], (lane) => buildHelper(lane, helper));
    return helper;
  }));
}).pipe(Effect.provide(BunServices.layer));








export interface PlaytestOptions {
  readonly revision?: string;
  readonly helper?: boolean;
  readonly predictCost?: boolean;
  readonly edition?: Edition;
}

export type Edition = "classic" | "full";
export const TOM_EDITION: Edition = "classic";

export const playableMapBuild = (title: string, out: string, predictCost = false, edition: Edition = "full") =>
  ["bun", "wisp", "map", "build", "--profile", "playable", "--edition", edition, "--name", title, "--out", out, ...(predictCost ? [PREDICT_COST] : [])];

export const currentPlaytest = ({ revision: wanted, helper: wantsHelper = true, predictCost = false, edition = "full" }: PlaytestOptions = {}) => Effect.gen(function*() {
  const { revision, controller, mainCheckout } = yield* (wanted === undefined ? resolveMain : resolveRevision(wanted));
  const title = yield* playName(revision);
  const final = join(builds, edition === "full" ? revision : `${revision}-${edition}`);
  const map = { folder: MAP_FOLDER, file: `${title}.w3x`, title, source: join(final, `${title}.w3x`) };
  const helper = helperPath(controller);
  const stages: BuildStage[] = [];
  yield* buildOnce(revisionLock(revision), final, (folder) => existsSync(join(folder, map.file)), `Waiting for another build of ${title}`, (staging) => Effect.gen(function*() {
    console.log(`Building ${title}`);
    yield* withBuildCheckout(mainCheckout, revision, stages, (lane) => Effect.gen(function*() {
      yield* run(join(lane, "ts"), ["bun", "install", "--frozen-lockfile"]).pipe(timedStage(stages, "bun-install"));
      yield* run(join(lane, "ts"), playableMapBuild(title, join(staging, map.file), predictCost, edition)).pipe(timedStage(stages, "map-build"));
      if (wantsHelper && !existsSync(helper)) {
        yield* buildHelper(lane, helper).pipe(Effect.catch((problem) => Effect.sync(() => console.log(`No controller helper for this build (${problem.problem}); the keyboard plays`))));
      }
    }));
  })).pipe(Effect.mapError((cause) => cause instanceof PlayProblem ? cause : new PlayProblem({ problem: cause.message })));
  return { map, helper: existsSync(helper) ? helper : undefined, stages };
}).pipe(Effect.provide(BunServices.layer));
