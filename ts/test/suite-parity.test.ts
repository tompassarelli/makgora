import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Option } from "effect";
import { type Check, type CheckRun, type FarmVerdict, type Local, autolandLands, checkKey, directoryCache, farmOutcome, laptop, prePush, runChecks } from "../scripts/prePush";
import { FARM_TEST, HOOKED_PUSH, hookGaps, readWorkflow, suiteGaps, type Workflow } from "../scripts/suiteParity";
import { CUE_MODEL_RECORD } from "../scripts/wisp/cueModels";

const farm = readWorkflow(".github/workflows/farm-test.yml");
const autoland = readWorkflow(".github/workflows/autoland.yml");
const inlined = (dropped: readonly string[]): Workflow => ({
  ...autoland,
  env: { ...autoland.env, ...farm.env },
  jobs: Object.fromEntries([
    ...Object.entries(autoland.jobs).filter(([, job]) => job.uses !== FARM_TEST),
    ...Object.entries(farm.jobs).filter(([name]) => !dropped.includes(name)).map(([name, job]) => [`suite-${name}`, job]),
  ]),
});

test("Autoland's suite runs every farm-test job with the same inputs, and dropping any one job or narrowing the call is a gap [k2 property]", () => {
  expect(suiteGaps(farm, autoland)).toEqual([]);
  expect(suiteGaps(farm, inlined([]))).toEqual([]);
  for (const name of Object.keys(farm.jobs)) expect(suiteGaps(farm, inlined([name]))).toEqual([`Autoland's suite lacks farm-test job ${name}`]);
  const narrowed: Workflow = { ...autoland, jobs: Object.fromEntries(Object.entries(autoland.jobs).map(([name, job]) => [name, job.uses === FARM_TEST ? { ...job, with: { ...job.with, only: "bun" } } : job])) };
  expect(suiteGaps(farm, narrowed)).toEqual(Object.entries(autoland.jobs).filter(([, job]) => job.uses === FARM_TEST).map(([name]) => `Autoland's ${name} job passes farm-test.yml the undeclared input only`));
});

test("a main push Autoland lands waits for no farm run, and a direct main push still runs the farm gate [k5 boundary pre-push-farm-gate]", async () => {
  expect(autolandLands("autoland", ["ts/scripts/prePush.ts"])).toBe(true);
  expect(autolandLands("autoland", ["ts/scripts/prePush.ts", ".github/workflows/autoland.yml"])).toBe(false);
  expect(autolandLands("", ["ts/scripts/prePush.ts"])).toBe(false);
  const head = (await Bun.$`git rev-parse HEAD`.quiet().text()).trim();
  const gated = async (queue: string): Promise<string[]> => {
    const heads: string[] = [];
    await Effect.runPromise(prePush(`HEAD ${head} refs/heads/main ${head}\n`, { gate: (sha) => Effect.sync(() => void heads.push(sha)), queue: Effect.succeed(queue) }));
    return heads;
  };
  expect(await gated("autoland")).toEqual([]);
  expect(await gated("")).toEqual([head]);
});

const LOCAL_ONLY = ["generated models stored", "animation jitter [k3 measure #479]"];
const HOSTED = ["clean room", "kind tags and type-check ts", "Autoland suite covers the farm suite", "cue models recorded in both looks"];
const EVERY_PATH = ["ts/scripts/prePush.ts", "build-inputs/original-clips-static-lights/kobold", CUE_MODEL_RECORD];

const stubbed = (paths: readonly string[], ran: string[], exitCode = (_: Check) => 0): Local => ({
  changed: () => Effect.succeed(paths),
  head: Effect.succeed("c0ffee"),
  dirty: () => Effect.succeed(""),
  runner: (check) => Effect.sync(() => (ran.push(check.name), { exitCode: exitCode(check), stdout: "", stderr: "" })),
  key: () => Effect.succeedNone,
  cache: { has: () => Effect.succeed(false), record: () => Effect.void },
});

test("an Autoland hand-off push runs only the checks that need local inputs, and a direct main push, farm push or workflow lane runs every check [k2 property]", async () => {
  const pushed = async (queue: string, paths: readonly string[], ref = "refs/heads/claude/land-lane-c0ffee") => {
    const ran: string[] = [], gated: string[] = [];
    await Effect.runPromise(prePush(`HEAD c0ffee ${ref} 0000000000000000000000000000000000000000\n`, { gate: (sha) => Effect.sync(() => void gated.push(sha)), queue: Effect.succeed(queue), notice: Effect.void }, stubbed(paths, ran)));
    return { ran, gated };
  };
  expect(await pushed("autoland", EVERY_PATH)).toEqual({ ran: LOCAL_ONLY, gated: [] });
  expect(await pushed("autoland", ["docs/ci.md"])).toEqual({ ran: [], gated: [] });
  expect(await pushed("autoland", EVERY_PATH, "refs/heads/main")).toEqual({ ran: LOCAL_ONLY, gated: [] });
  expect((await pushed("", EVERY_PATH, "refs/heads/main")).ran.toSorted()).toEqual([...HOSTED, ...LOCAL_ONLY].toSorted());
  expect((await pushed("", EVERY_PATH, "refs/heads/main")).gated).toEqual(["c0ffee"]);
  expect((await pushed("autoland", EVERY_PATH, "refs/heads/farm/autoland-c0ffee")).ran.toSorted()).toEqual([...HOSTED, ...LOCAL_ONLY].toSorted());
  expect((await pushed("autoland", [...EVERY_PATH, ".github/workflows/autoland.yml"])).ran.toSorted()).toEqual([...HOSTED, ...LOCAL_ONLY].toSorted());
});

test("Autoland's build pushes each candidate through the pre-push hook, and a --no-verify push or a dropped hooks path is a gap [k2 property]", () => {
  expect(hookGaps(autoland)).toEqual([]);
  const build = autoland.jobs.build!;
  const steps = build.steps as readonly { readonly run?: string }[];
  const rewritten = (edit: (run: string) => string): Workflow => ({ ...autoland, jobs: { ...autoland.jobs, build: { ...build, steps: steps.map((step) => (step.run === undefined ? step : { ...step, run: edit(step.run) })) } } });
  const gap = [`Autoland's build no longer pushes the candidate with the pre-push hook (${HOOKED_PUSH} after git config core.hooksPath .githooks), so the checks safe-push leaves to it never run`];
  expect(hookGaps(rewritten((run) => run.replaceAll(HOOKED_PUSH, 'git push --no-verify origin "HEAD:refs/heads/$scratch"')))).toEqual(gap);
  expect(hookGaps(rewritten((run) => run.replaceAll("git config core.hooksPath .githooks", "true")))).toEqual(gap);
});

test("a passed check is skipped while its input tree and bun.lock stay the same, a failure is never cached, and a changed input runs it again [k5 boundary pre-push-cache]", async () => {
  const repo = mkdtempSync(join(tmpdir(), "prepush-cache-repo-")), store = mkdtempSync(join(tmpdir(), "prepush-cache-"));
  try {
    const sh = async (...command: string[]) => void await Bun.$`${command}`.cwd(repo).quiet();
    const commit = async (path: string, text: string) => {
      writeFileSync(join(repo, path), text);
      await sh("git", "add", "-A");
      await sh("git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", path);
    };
    await sh("git", "init", "-q");
    await Bun.$`mkdir -p a b ts`.cwd(repo).quiet();
    await commit("a/x", "1");
    await commit("b/y", "1");
    await commit("ts/bun.lock", "1");
    const ran: string[] = [];
    const exits = new Map<string, number>();
    const local: Local = { ...laptop, key: (check) => checkKey(repo, check), cache: directoryCache(store), runner: (check) => Effect.sync((): CheckRun => (ran.push(check.name), { exitCode: exits.get(check.name) ?? 0, stdout: "", stderr: "" })) };
    const scoped: Check = { name: "scoped", directory: ".", args: [], hosted: false, inputs: ["a"] };
    const whole: Check = { name: "whole", directory: ".", args: [], hosted: false };
    const runs = async (check: Check) => {
      const before = ran.length;
      const result = await Effect.runPromise(runChecks([check], local).pipe(Effect.as("passed"), Effect.catchTag("PrePushRefusal", () => Effect.succeed("refused"))));
      return { result, ran: ran.length - before };
    };
    expect(await runs(scoped)).toEqual({ result: "passed", ran: 1 });
    expect(await runs(scoped)).toEqual({ result: "passed", ran: 0 });
    expect(await runs(whole)).toEqual({ result: "passed", ran: 1 });
    expect(await runs(whole)).toEqual({ result: "passed", ran: 0 });
    await commit("b/y", "2");
    expect(await runs(scoped)).toEqual({ result: "passed", ran: 0 });
    expect(await runs(whole)).toEqual({ result: "passed", ran: 1 });
    await commit("a/x", "2");
    expect(await runs(scoped)).toEqual({ result: "passed", ran: 1 });
    await commit("ts/bun.lock", "2");
    expect(await runs(scoped)).toEqual({ result: "passed", ran: 1 });
    writeFileSync(join(repo, "a/x"), "dirty");
    expect(Option.isNone(await Effect.runPromise(checkKey(repo, scoped)))).toBe(true);
    expect(await runs(scoped)).toEqual({ result: "passed", ran: 1 });
    expect(await runs(scoped)).toEqual({ result: "passed", ran: 1 });
    await sh("git", "checkout", "-q", "--", "a/x");
    const stored = readdirSync(store).length;
    exits.set("failing", 1);
    const failing: Check = { name: "failing", directory: ".", args: [], hosted: false, inputs: ["a"] };
    expect(await runs(failing)).toEqual({ result: "refused", ran: 1 });
    expect(await runs(failing)).toEqual({ result: "refused", ran: 1 });
    expect(readdirSync(store).length).toBe(stored);
    exits.set("failing", 0);
    expect(await runs(failing)).toEqual({ result: "passed", ran: 1 });
    expect(await runs(failing)).toEqual({ result: "passed", ran: 0 });
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store, { recursive: true, force: true });
  }
});

test("a farm run that never started is infrastructure and is started once more, a started run is judged by its own conclusion, and a red run is never restarted [k2 property]", async () => {
  const url = "https://github.com/tompassarelli/smashcraft/actions/runs/38678091576";
  const outcome = async (exits: readonly { readonly exitCode: number; readonly stderr: string }[], concluded: FarmVerdict = "green") => {
    let starts = 0, conclusions = 0;
    const result = await Effect.runPromise(farmOutcome("c0ffee", () => Effect.sync((): CheckRun => ({ stdout: "", ...exits[Math.min(starts++, exits.length - 1)]! })), () => Effect.sync(() => (conclusions++, concluded))));
    return { verdict: result.verdict, starts, conclusions };
  };
  const rejected = { exitCode: 1, stderr: "safe-push: cannot lock ref 'refs/heads/farm/17d6e4374124': unable to resolve reference" };
  expect(await outcome([rejected])).toEqual({ verdict: "infra", starts: 2, conclusions: 0 });
  expect(await outcome([rejected, { exitCode: 0, stderr: `Farm test c0ffee x: ${url}` }])).toEqual({ verdict: "green", starts: 2, conclusions: 0 });
  expect(await outcome([{ exitCode: 1, stderr: `Farm test c0ffee x: ${url}\nc0ffee failed on the farm: ${url}` }])).toEqual({ verdict: "red", starts: 1, conclusions: 0 });
  expect(await outcome([{ exitCode: 1, stderr: `Farm test c0ffee x: ${url}\ngh: i/o timeout` }])).toEqual({ verdict: "green", starts: 1, conclusions: 1 });
  expect(await outcome([{ exitCode: 1, stderr: `Farm test c0ffee x: ${url}\ngh: i/o timeout` }], "red")).toEqual({ verdict: "red", starts: 1, conclusions: 1 });
  expect(await outcome([{ exitCode: 1, stderr: `Farm test c0ffee x: ${url}\ngh: i/o timeout` }], "infra")).toEqual({ verdict: "infra", starts: 1, conclusions: 1 });
});
