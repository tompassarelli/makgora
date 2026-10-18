import { expect, test } from "bun:test";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const BANNED = ["defin" + "itive", "_de" + "\\.w3mod"].join("|");
const ABBREVIATION = "D" + "E";
const ABBREVIATED = [`\\b${ABBREVIATION}\\b`, `[a-z]${ABBREVIATION}\\.(mdx|mdl|fdf|toc|blp|tga|dds|png)`].join("|");
const ALLOWED = ["docs/design/roster.md", "AGENTS.md"];
const VENDORED = ["repos", "ts/vendor"];
const EXCLUDED = [...ALLOWED.map((path) => `:(exclude,top)${path}`), ...VENDORED.map((path) => `:(exclude,top)${path}/**`), ":(exclude,glob)**/node_modules/**"];

const matching = (flags: readonly string[], pattern: string): string[] => {
  const grep = Bun.spawnSync(["git", "-C", ROOT, "grep", "-l", ...flags, "-E", pattern, "--", ".", ...EXCLUDED], { stdout: "pipe", stderr: "pipe" });
  expect(grep.stderr.toString()).toBe("");
  expect([0, 1]).toContain(grep.exitCode);
  return grep.stdout.toString().split("\n").filter((line) => line !== "");
};

test("no tracked file outside the roster decision record, the root agent rules and vendored trees names the dropped edition, its archive layer or its abbreviation [k5 boundary repo-tree]", () => {
  expect(matching(["-i"], BANNED)).toEqual([]);
  expect(matching(["-I"], ABBREVIATED)).toEqual([]);
  const tracked = Bun.spawnSync(["git", "-C", ROOT, "ls-files", "--", ".", ...EXCLUDED], { stdout: "pipe" }).stdout.toString().split("\n");
  expect(tracked.filter((path) => new RegExp(`(^|/)de/|${ABBREVIATED}`).test(path))).toEqual([]);
});
