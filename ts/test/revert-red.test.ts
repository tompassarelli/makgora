import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import {
  type Landing, gitIn, pushRevert, revertMessage,
} from "../scripts/revertRed";

const landing = (sha: string, message = "Render compare (Fixes #7)", extra: Partial<Landing> = {}): Landing => ({ sha, message, parents: 1, workflowFiles: [], ...extra });


const folder = mkdtempSync(join(tmpdir(), "revert-red-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

test("pushRevert pushes a new revert commit to origin main with the Reverts trailer and rewrites no history [k5 boundary revert-push]", async () => {
  const sh = (cwd: string, ...args: string[]) => {
    const out = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${out.stderr.toString()}`);
    return out.stdout.toString().trim();
  };
  const origin = join(folder, "origin.git");
  const work = join(folder, "work");
  const runner = join(folder, "runner");
  sh(folder, "init", "-q", "--bare", "-b", "main", origin);
  sh(folder, "clone", "-q", origin, work);
  writeFileSync(join(work, "a.txt"), "green\n");
  sh(work, "add", "a.txt");
  sh(work, "commit", "-q", "-m", "A green start");
  sh(work, "push", "-q", "origin", "HEAD:main");
  writeFileSync(join(work, "a.txt"), "broken\n");
  sh(work, "commit", "-q", "-am", "Break a.txt (Fixes #7)");
  sh(work, "push", "-q", "origin", "HEAD:main");
  const x = sh(work, "rev-parse", "HEAD");
  const parent = sh(work, "rev-parse", "HEAD~1");
  sh(folder, "clone", "-q", origin, runner);
  sh(runner, "config", "user.name", "t");
  sh(runner, "config", "user.email", "t@t");

  const message = revertMessage({ landing: landing(x, "Break a.txt (Fixes #7)"), jobs: ["framework"], runUrl: "u", issues: [7] });
  const pushed = await Effect.runPromise(pushRevert(landing(x, "Break a.txt (Fixes #7)"), message, gitIn(runner)));

  expect(sh(origin, "rev-parse", "main")).toBe(pushed);
  expect(sh(origin, "rev-parse", `${pushed}~1`)).toBe(x);
  expect(sh(origin, "log", "-1", "--format=%s", "main")).toBe('Revert "Break a.txt (Fixes #7)"');
  expect(sh(origin, "log", "-1", "--format=%(trailers:key=Reverts,valueonly)", "main")).toBe(x);
  expect(sh(origin, "merge-base", "--is-ancestor", parent, x)).toBe("");
  expect(sh(origin, "show", "main:a.txt")).toBe("green");
  expect(readFileSync(join(runner, "a.txt"), "utf8")).toBe("green\n");
});
