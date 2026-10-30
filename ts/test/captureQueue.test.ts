import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { git as gitEffect } from "../scripts/captureQueue";
import { capturedWhole, foldLanes, laneIdentical } from "../scripts/captureQueueServe";

const git = (repo: string, args: readonly string[]) => Effect.runSync(gitEffect(repo, args));

const commit = (repo: string, files: Readonly<Record<string, string>>, message: string) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(repo, path, ".."), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git(repo, ["add", "--", ...Object.keys(files)]);
  git(repo, ["commit", "-q", "-m", message]);
  return git(repo, ["rev-parse", "HEAD"]).out;
};

const job = (lane: string, revision: string, fighter: string) => ({ version: 1 as const, id: lane, lane, revision, fighter, move: "up-air", submitted: "" });

test("lanes on different fighters fold into one map revision holding each lane's exact files, and a lane whose files conflict gets its own [k1 scenario]", () => {
  const repo = mkdtempSync(join(tmpdir(), "capture-queue-"));
  try {
    git(repo, ["init", "-q", "-b", "main"]);
    const base = commit(repo, { "build-inputs/hero-models/peon": "p0\n", "build-inputs/hero-models/thrall": "t0\n", "clips/peon.ts": "p\n", "clips/thrall.ts": "t\n" }, "base");
    const peon = commit(repo, { "build-inputs/hero-models/peon": "p1\n", "clips/peon.ts": "p1\n" }, "peon take");
    git(repo, ["checkout", "-q", base]);
    const thrall = commit(repo, { "build-inputs/hero-models/thrall": "t1\n", "clips/thrall.ts": "t1\n" }, "thrall take");
    git(repo, ["checkout", "-q", base]);
    const clash = commit(repo, { "clips/thrall.ts": "t9\n" }, "other thrall take");
    const groups = Effect.runSync(foldLanes(repo, [job("peon-lane", peon, "peon"), job("thrall-lane", thrall, "thrall"), job("clash-lane", clash, "thrall")], base));
    expect(groups.map(group => group.jobs.map(member => member.lane))).toEqual([["peon-lane", "thrall-lane"], ["clash-lane"]]);
    const merged = groups[0]?.commit ?? "";
    expect([git(repo, ["show", `${merged}:clips/peon.ts`]).out, git(repo, ["show", `${merged}:build-inputs/hero-models/thrall`]).out]).toEqual(["p1", "t1"]);
    expect(Effect.runSync(laneIdentical(repo, job("peon-lane", peon, "peon"), merged, base))).toBe(true);
    expect(Effect.runSync(laneIdentical(repo, job("clash-lane", clash, "thrall"), merged, base))).toBe(false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("a batch that misses one clip's frame still returns every job whose clips it captured whole [k3 measure #614]", () => {
  const manifest = [{ name: "a-R01", frames: [41, 50] }, { name: "a-R02", frames: [41] }, { name: "b-R01", frames: [41, 50] }, { name: "c-R01", frames: [41] }];
  const captures = [{ fixture: "a-R01", frame: 41 }, { fixture: "a-R01", frame: 50 }, { fixture: "a-R02", frame: 41 }, { fixture: "b-R01", frame: 41 }, { fixture: "c-R01", frame: 41 }];
  const fixtures = new Map([["a", ["a-R01", "a-R02"]], ["b", ["b-R01"]], ["c", ["c-R01"]], ["d", []], ["e", ["c-R01", "b-R01"]]]);
  expect([...capturedWhole(fixtures, manifest, captures)].sort()).toEqual(["a", "c"]);
});
