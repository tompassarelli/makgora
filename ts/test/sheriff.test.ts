import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bisect, decide, landedLanes, LANE_TRAILER, suiteProbe, type Commit, type LandedLane, type Probe, type ProbeResult } from "../scripts/sheriff";

const sha = (value: number) => value.toString(16).padStart(40, "0");
function train(seed: number, count: number) {
  const base = sha(0);
  const commits: Commit[] = [];
  const expected: LandedLane[] = [];
  let id = 1;
  let random = seed;
  const next = () => { random = Math.imul(random, 1664525) + 1013904223 | 0; return random >>> 0; };
  for (let lane = 0; lane < count; lane++) {
    const parent = commits.at(-1)?.sha ?? base;
    const length = 1 + next() % 4;
    const branch = `claude/generated-${seed}-${lane}`;
    const ids = Array.from({ length }, () => sha(id++));
    commits.push(...ids.map((sha, index) => ({ sha, message: `Refs #${513 + lane}${index === length - 1 ? `\n\n${LANE_TRAILER} ${JSON.stringify({ branch, count: length, issues: [513 + lane] })}` : ""}` })));
    expected.push({ branch, issues: [513 + lane], parent, head: ids.at(-1)!, commits: ids });
    if (next() % 2 === 0 || lane === count - 1) commits.push({ sha: sha(id++), message: "Regenerated\n\nAutoland-Reports: 1", files: ["tools/move-data/advantage-state.md"] });
  }
  const main = sha(id++);
  const snapshots = new Map([[base, [] as string[]], ...commits.map((commit, index) => [commit.sha, commits.slice(0, index + 1).map((entry) => entry.sha)] as const), [main, commits.map((entry) => entry.sha)]]);
  return { base, commits, expected, main, snapshots };
}

function search(fixture: ReturnType<typeof train>, culprits: readonly number[], override?: (probe: Probe) => ProbeResult | undefined) {
  const lanes = landedLanes(fixture.base, fixture.commits)!;
  const search = bisect(lanes, fixture.main);
  const probes: { probe: Probe; result: ProbeResult }[] = [];
  let next = search.next();
  while (!next.done) {
    const probe = next.value;
    const present = new Set(fixture.snapshots.get(probe.head)!.filter((commit) => !probe.without?.includes(commit)));
    const result = override?.(probe) ?? (culprits.some((index) => fixture.expected[index]!.commits.some((commit) => present.has(commit))) ? "fail" : "pass");
    probes.push({ probe, result });
    next = search.next(result);
  }
  return { culprit: next.value, probes };
}

const failedRun = { conclusion: "failure", jobs: [{ name: "Background sweeps (bun)", conclusion: "failure", steps: [{ name: "Run bun run test", conclusion: "failure" }] }] };

test("sheriff reverts all and only the confirmed lane across generated trains and otherwise alarms [k2 property]", () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let count = 1; count <= 6; count++) {
      const fixture = train(seed, count);
      expect(landedLanes(fixture.base, fixture.commits)).toEqual(fixture.expected);
      for (let culprit = 0; culprit < count; culprit++) {
        const result = search(fixture, [culprit]);
        expect(result.culprit).toEqual(fixture.expected[culprit]);
        expect(search(fixture, [culprit], (probe) => probe.without === undefined && probe.head === fixture.base ? "fail" : undefined).culprit).toBeUndefined();
        expect(search(fixture, [culprit], (probe) => probe.without === undefined && probe.head === fixture.expected[culprit]!.head ? "unmeasured" : undefined).culprit).toBeUndefined();
        expect(search(fixture, [culprit], (probe) => probe.without !== undefined ? "unmeasured" : undefined).culprit).toBeUndefined();
        const parent = fixture.expected[culprit]!.parent;
        expect(search(fixture, [culprit], (probe) => probe.without === undefined && probe.head === parent ? "fail" : undefined).culprit).toBeUndefined();
      }
      expect(search(fixture, []).culprit).toBeUndefined();
      for (let first = 0; first < count; first++) for (let second = first + 1; second < count; second++) expect(search(fixture, [first, second]).culprit).toBeUndefined();
      const partial = fixture.commits.slice(1).map((commit, index) => index === 0 && fixture.expected[0]!.commits.length === 1 ? { ...commit, message: `${commit.message}\n${LANE_TRAILER} ${JSON.stringify({ branch: "claude/truncated", count: fixture.commits.length + 1, issues: [513] })}` } : commit);
      expect(landedLanes(fixture.base, partial)).toBeUndefined();
      expect(landedLanes(fixture.base, [{ sha: sha(900), message: "direct" }, ...fixture.commits])).toBeUndefined();
      expect(landedLanes(fixture.base, fixture.commits.map((commit) => commit.message.includes("Autoland-Reports:") ? { ...commit, files: ["ts/src/game/sim/attacks.ts"] } : commit))).toBeUndefined();
      const missing = fixture.commits.map((commit) => ({ ...commit, message: commit.message.replace(`${LANE_TRAILER} `, "Unknown: ") }));
      expect(landedLanes(fixture.base, missing)).toBeUndefined();
      const verdict = decide({ run: failedRun, previous: { conclusion: "success", jobs: [], ancestor: true }, commits: fixture.commits, workflowFiles: [] });
      expect(verdict.kind).toBe("bisect");
      expect(suiteProbe("Background sweeps", "Background census: Every fighter pair's worst frame within the margin of main's fixture (#405)")).toBeUndefined();
    }
  }
});

test("sheriff bisects 1-6 lanes within ceil(log2(n))+5 probes and confirms the actual reports parent [k3 measure #513]", () => {
  for (let seed = 41; seed <= 80; seed++) {
    for (let count = 1; count <= 6; count++) {
      const fixture = train(seed, count);
      for (let culprit = 0; culprit < count; culprit++) {
        const result = search(fixture, [culprit]);
        const expected = fixture.expected[culprit]!;
        expect(result.culprit).toEqual(expected);
        expect(result.probes.length).toBeLessThanOrEqual(Math.ceil(Math.log2(count)) + 5);
        expect(result.probes.some(({ probe, result }) => probe.head === expected.parent && probe.without === undefined && result === "pass")).toBe(true);
        expect(result.probes.some(({ probe, result }) => probe.head === expected.head && probe.without === undefined && result === "fail")).toBe(true);
        expect(result.probes.at(-1)).toEqual({ probe: { head: fixture.main, without: expected.commits.toReversed() }, result: "pass" });
      }
    }
  }
});


test("sheriff replays the recorded suite with inherited environment and every failed name before reopening only its lane refs [k5 boundary sheriff-replay]", async () => {
  const build = resolve(import.meta.dir, "../../build");
  mkdirSync(build, { recursive: true });
  const root = mkdtempSync(join(build, "sheriff-boundary-"));
  const fixture = train(7, 1);
  const revert = sha(999);
  const culprit = fixture.expected[0]!;
  const names = ["first recorded failure [k1 scenario]", "second recorded failure [k1 scenario]"];
  const commits = fixture.commits.map((commit) => culprit.commits.includes(commit.sha)
    ? { ...commit, message: `Subject only (#777)${commit.sha === culprit.head ? `\n\n${LANE_TRAILER} ${JSON.stringify({ branch: culprit.branch, count: culprit.commits.length, issues: [] })}` : ""}` }
    : commit);
  const bin = join(root, "bin");
  mkdirSync(bin);
  const runner = `#!${process.execPath}
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
const fixture = JSON.parse(readFileSync(process.env.SHERIFF_FIXTURE, "utf8"));
const args = process.argv.slice(2);
const command = basename(process.argv[1]);
appendFileSync(fixture.calls, JSON.stringify({ command, args }) + "\\n");
const print = (value) => console.log(typeof value === "string" ? value : JSON.stringify(value));
if (command === "gh") {
  if (args[0] === "api") print([]);
  else if (args[0] === "issue" && args[1] === "view") print({ state: "CLOSED" });
  else if (args[1] === "list") print([{ databaseId: 200, conclusion: "failure", headSha: fixture.main }, { databaseId: 100, conclusion: "success", headSha: fixture.base }]);
  else if (args.includes("--log-failed") && fixture.mode !== "report") fixture.names.forEach((name) => print("Sweeps (Bun)\\tRun bun run test\\t2026-10-12T20:00:00Z (fail) " + name));
  else if (args[0] === "run" && args[1] === "view") print({ conclusion: "failure", headBranch: "main", headSha: fixture.main, url: "https://example.invalid/run/200", workflowName: "CI", databaseId: 200, attempt: 1, jobs: [{ name: "Sweeps (Bun)", conclusion: "failure", databaseId: 300, steps: [{ name: "Run bun run test", conclusion: "failure" }] }] });
  else if (args[0] === "workflow" && ((fixture.mode === "ci-failure" && args[2] === "ci.yml") || (fixture.mode === "background-failure" && args[2] === "background-sweeps.yml"))) { console.error("dispatch refused"); process.exit(1); }
} else if (command === "git") {
  if (args[0] === "log") process.stdout.write(fixture.commits.map((commit) => commit.sha + "\\n" + commit.message).join(String.fromCharCode(0)) + String.fromCharCode(0));
  else if (args[0] === "rev-parse") print(args[1] === "HEAD" ? fixture.revert : fixture.main);
  else if (args[0] === "push" && fixture.mode === "push-failure") { console.error("push refused"); process.exit(1); }
  else if (args[0] === "diff-tree") print("tools/move-data/advantage-state.md");
  else if (args[0] === "worktree" && args[1] === "add") { const path = args.at(-2); mkdirSync(join(path, "ts"), { recursive: true }); writeFileSync(join(path, "probe"), args.at(-1)); }
  else if (args[0] === "worktree" && args[1] === "remove") rmSync(args.at(-1), { recursive: true, force: true });
  else if (args[0] === "-C") writeFileSync(join(args[1], "without"), "yes");
} else if (command === "bun" && args[0] !== "install") {
  if (process.env.HOME !== fixture.root || !process.env.PATH?.startsWith(fixture.bin + ":") || process.env.SWEEP_PLACEMENT !== "gate" || process.env.SWEEPS !== "1") process.exit(2);
  const head = readFileSync(join(process.cwd(), "../probe"), "utf8");
  if (head !== fixture.base) {
    try { readFileSync(join(process.cwd(), "../without")); } catch {
      const failures = fixture.subset && head === fixture.head ? fixture.names.slice(0, 1) : fixture.names;
      failures.forEach((name) => print("(fail) " + name));
      process.exit(1);
    }
  }
}
`;
  for (const command of ["gh", "git", "bun"]) {
    writeFileSync(join(bin, command), runner);
    chmodSync(join(bin, command), 0o755);
  }
  try {
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: root, SHERIFF_FIXTURE: join(root, "fixture.json"), GITHUB_OUTPUT: join(root, "output"), GITHUB_STEP_SUMMARY: join(root, "summary") };
    for (const mode of ["confirmed", "subset", "report", "push-failure", "ci-failure", "background-failure"]) {
      const subset = mode === "subset";
      const confirmed = mode === "confirmed" || mode === "ci-failure" || mode === "background-failure";
      const calls = join(root, "calls");
      writeFileSync(calls, "");
      writeFileSync(env.GITHUB_OUTPUT, "");
      writeFileSync(env.SHERIFF_FIXTURE, JSON.stringify({ root, bin, calls, base: fixture.base, main: fixture.main, head: culprit.head, revert, commits, names, subset, mode }));
      const child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../scripts/sheriff.ts"), "200"], { env, stdout: "pipe", stderr: "pipe" });
      const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      expect(exitCode).toBe(mode === "push-failure" ? 1 : 0);
      if (mode === "push-failure") expect(stdout + stderr).toContain("push refused");
      else if (mode.endsWith("failure")) expect(stdout + stderr).toContain("dispatch refused");
      else expect(stderr).toBe("");
      const recorded: { command: string; args: string[] }[] = readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line));
      const reopened = recorded.filter(({ command, args }) => command === "gh" && args[0] === "issue" && args[1] === "reopen").map(({ args }) => Number(args[2]));
      expect(reopened).toEqual(confirmed ? [777] : []);
      expect(readFileSync(env.GITHUB_OUTPUT, "utf8")).toBe(confirmed ? `reverted=${revert}\n` : "");
      const push = recorded.findIndex(({ command, args }) => command === "git" && args[0] === "push");
      expect(push >= 0).toBe(confirmed || mode === "push-failure");
      const workflows = recorded.flatMap(({ command, args }, index) => command === "gh" && args[0] === "workflow" && args[1] === "run" ? [{ args, index }] : []);
      expect(workflows.map(({ args }) => args[2])).toEqual(confirmed ? ["ci.yml", "background-sweeps.yml"] : []);
      for (const { args, index } of workflows) {
        expect(index).toBeGreaterThan(push);
        expect(args[args.indexOf("--ref") + 1]).toBe("main");
        if (args[2] === "background-sweeps.yml") expect(args[args.indexOf("-f") + 1]).toBe(`ref=${revert}`);
      }
      if (mode !== "push-failure") expect(stdout).toContain(confirmed ? "confirmed culprit lane" : subset ? "no lane confirmed" : "no recorded failed test");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
