import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { HERO_STRIKE_MOMENTS } from "../src/game/presentation/heroStrikeMomentInfo";
import { type StrikeMoment, strikeMomentSources } from "../scripts/wisp/strikeMoments";

const committed: StrikeMoment[] = Object.entries(HERO_STRIKE_MOMENTS).flatMap(([character, styles]) =>
  Object.entries(styles ?? {}).flatMap(([style, row]) => row === undefined ? [] : [{ character: Number(character), style: Number(style), ...row }]));

const refit = (moments: readonly StrikeMoment[], heroes: ReadonlySet<number>): StrikeMoment[] =>
  moments.map((moment, index) => heroes.has(moment.character) && index === moments.findIndex((row) => row.character === moment.character) ? { ...moment, seconds: moment.seconds + 0.05 } : moment);

const heroes = [...new Set(committed.map(({ character }) => character))];
const firstHalf = new Set(heroes.slice(0, heroes.length / 2));
const secondHalf = new Set(heroes.slice(heroes.length / 2));

const git = (repo: string, ...args: string[]) => {
  const run = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=lane", "-c", "user.email=lane@example.invalid", ...args]);
  return { exitCode: run.exitCode, out: run.stdout.toString() + run.stderr.toString() };
};

const regenerate = (repo: string, moments: readonly StrikeMoment[], message: string) => {
  for (const [path, source] of strikeMomentSources(moments)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), source);
  }
  expect(git(repo, "add", "-A").exitCode).toBe(0);
  expect(git(repo, "commit", "-q", "-m", message).exitCode).toBe(0);
};

test("two lanes that refit the two halves of the roster, so a one-file table would hold their rows side by side in any order, land one after the other without a conflict, as Autoland's dry merge and train rebase run them, and the landed tables equal a fresh generation [k5 boundary git-strike-tables]", () => {
  const repo = mkdtempSync(join(tmpdir(), "smashcraft-strike-lanes-"));
  try {
    expect(git(repo, "init", "-q", "-b", "main").exitCode).toBe(0);
    regenerate(repo, committed, "base");
    const first = refit(committed, firstHalf);
    expect(git(repo, "checkout", "-q", "-b", "lane-first", "main").exitCode).toBe(0);
    regenerate(repo, first, "refit the first half");
    expect(git(repo, "checkout", "-q", "-b", "lane-second", "main").exitCode).toBe(0);
    regenerate(repo, refit(committed, secondHalf), "refit the second half");
    expect(git(repo, "checkout", "-q", "main").exitCode).toBe(0);
    expect(git(repo, "merge", "-q", "--ff-only", "lane-first").exitCode).toBe(0);
    const dry = git(repo, "merge-tree", "--write-tree", "main", "lane-second");
    expect(dry.out).not.toContain("CONFLICT");
    expect(dry.exitCode).toBe(0);
    expect(git(repo, "checkout", "-q", "lane-second").exitCode).toBe(0);
    const rebase = git(repo, "rebase", "-q", "main");
    expect(rebase.out).not.toContain("CONFLICT");
    expect(rebase.exitCode).toBe(0);
    const fresh = strikeMomentSources(refit(first, secondHalf));
    for (const [path, source] of fresh) expect({ path, source: readFileSync(join(repo, path), "utf8") }).toEqual({ path, source });
    expect(git(repo, "ls-files").out.trim().split("\n").sort()).toEqual([...fresh.keys()].sort());
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
