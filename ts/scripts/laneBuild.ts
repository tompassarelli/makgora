import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Clock, Effect } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/process";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "./hostProcess";
import { PLAYTEST_PREFIX } from "./wisp/project";
import { TOM_EDITION, nextPlayVersion, playableMapBuild } from "./wisp/currentPlaytest";
import { withLock } from "./wisp/fileLock";
import { installLaneMap, laneMapTitle, laneSlug } from "./wisp/laneMaps";
import { tomsLibrary } from "./wisp/mapLibrary";
import { tsDirectory } from "./wisp/project";

const inputsRoot = join(homedir(), ".local/share/smashcraft-build-inputs");
const laneCache = join(homedir(), ".local/state/smashcraft/lane-builds");

export interface LaneSteps<R> {
  readonly check: Effect.Effect<void, PlayProblem, R>;
  readonly version: Effect.Effect<string, PlayProblem, R>;
  readonly build: (title: string, out: string) => Effect.Effect<void, PlayProblem, R>;
}

export const laneBuild = <R>(steps: LaneSteps<R>, branch: string, staging: string, install?: string) => Effect.gen(function*() {
  const slug = laneSlug(branch);
  if (slug === "") return yield* new PlayProblem({ problem: `lane ${JSON.stringify(branch)} has no name to put in a map file` });
  yield* steps.check;
  const started = yield* Clock.currentTimeMillis;
  const title = laneMapTitle(yield* steps.version, slug);
  const out = join(staging, slug, `${title}.w3x`);
  yield* Effect.try({ try: () => { rmSync(join(staging, slug), { recursive: true, force: true }); mkdirSync(join(staging, slug), { recursive: true }); }, catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  yield* steps.build(title, out);
  const installed = install === undefined ? undefined : yield* Effect.try({ try: () => installLaneMap(install, out, slug), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  return { map: out, installed, seconds: ((yield* Clock.currentTimeMillis) - started) / 1000 };
});

const failed = (what: string) => () => new PlayProblem({ problem: `${what} failed` });

const run = (what: string, [program = "", ...args]: readonly string[], env: Record<string, string> = {}) =>
  runProcess(ChildProcess.make(program, args, { cwd: tsDirectory, stdin: "ignore", stdout: "inherit", stderr: "inherit", env: { ...process.env, ...env } })).pipe(
    Effect.asVoid, Effect.mapError(failed(what)),
  );

const git = (...args: readonly string[]) =>
  runProcess(ChildProcess.make("git", args, { cwd: tsDirectory, stdin: "ignore" })).pipe(Effect.map((text) => text.trim()), Effect.mapError(failed(`git ${args[0]}`)));

export const laneTests = (changed: readonly string[]) => {
  const present = changed.filter((file) => existsSync(join(tsDirectory, file)));
  return {
    host: present.filter((file) => /(?:\.test|_test|\.spec|_spec)\.(?:js|jsx|ts|tsx)$/.test(file)),
    game: present.flatMap((file) => /^src\/(.+\.tests\.ts)$/.exec(file)?.[1] ?? []),
  };
};

const hostSteps: LaneSteps<ChildProcessSpawner.ChildProcessSpawner> = {
  check: Effect.gen(function*() {
    yield* run("bun run check", ["bun", "run", "check"]);
    const base = yield* git("merge-base", "origin/main", "HEAD");
    const changed = [
      ...(yield* git("diff", "--name-only", "--relative", base)).split("\n"),
      ...(yield* git("ls-files", "--others", "--exclude-standard")).split("\n"),
    ].filter((file) => file !== "");
    const { host, game } = laneTests(changed);
    if (host.length > 0) yield* run("the lane's tests", ["bun", "run", "test", ...host]);
    if (game.length > 0) yield* run("the lane's game tests", ["bun", "test", "test/game.test.ts"], { GAME_MODULES: game.join(",") });
    if (host.length + game.length === 0) console.log("The lane changes no test files");
  }),
  version: git("rev-parse", "HEAD").pipe(Effect.map((head) => nextPlayVersion(tomsLibrary(), head))),
  build: (title, out) => run("the lane map build", playableMapBuild(title, out, false, TOM_EDITION)),
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const install = args.includes("--install");
  const rest = args.filter((arg) => arg !== "--install");
  const named = rest[0] === "--lane" ? rest[1] : undefined;
  if (rest.length !== 0 && (named === undefined || rest.length !== 2)) throw new Error("use laneBuild.ts [--lane BRANCH] [--install]");
  BunRuntime.runMain(Effect.gen(function*() {
    const branch = named ?? (yield* git("rev-parse", "--abbrev-ref", "HEAD"));
    const slug = laneSlug(branch);
    const { map, installed, seconds } = yield* withLock(join(inputsRoot, "locks", `lane-${slug}.lock`), `Waiting for another build of lane ${slug}`,
      laneBuild(hostSteps, branch, laneCache, install ? documentsFolder(PLAYTEST_PREFIX) : undefined));
    console.log(`${installed === undefined ? `Built ${map}` : `Installed ${installed}`} (${seconds.toFixed(1)} s)`);
  }).pipe(Effect.provide(BunServices.layer)));
}
