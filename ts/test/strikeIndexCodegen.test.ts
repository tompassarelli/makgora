import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { renderStrikeIndex } from "../codegen/strikeIndex";
import { GENERATED_CODE, resolveConflicts } from "../scripts/autolandCore";
import { rebaseLane } from "../scripts/autolandRebase";

for (const role of ["AUTHOR", "COMMITTER"]) {
  process.env[`GIT_${role}_NAME`] = "lane";
  process.env[`GIT_${role}_EMAIL`] = "lane@example.invalid";
}

const INDEX = "ts/src/generated/strikes/heroStrikeMomentInfo.ts";

const addFighter = (fighters: string, folder: string, key: string) => {
  mkdirSync(join(fighters, folder), { recursive: true });
  writeFileSync(join(fighters, folder, "strikeMoments.ts"), `export const ${key}StrikeMoments = {};\n`);
};

const git = (repo: string, ...args: string[]) => {
  const run = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=lane", "-c", "user.email=lane@example.invalid", ...args]);
  return { exitCode: run.exitCode, out: run.stdout.toString() + run.stderr.toString() };
};

const regenerate = (repo: string) => {
  mkdirSync(dirname(join(repo, INDEX)), { recursive: true });
  writeFileSync(join(repo, INDEX), renderStrikeIndex(join(repo, "fighters")));
};

const commit = (repo: string, message: string) => {
  expect(git(repo, "add", "-A").exitCode).toBe(0);
  expect(git(repo, "commit", "-q", "-m", message).exitCode).toBe(0);
};

test("adding a fighter directory with a strikeMoments.ts changes the generated strike index by exactly its import and its map line, in sorted place [k2 property]", () => {
  const fighters = mkdtempSync(join(tmpdir(), "makgora-strike-index-"));
  try {
    addFighter(fighters, "akama", "akama");
    addFighter(fighters, "lich-king", "lichKing");
    mkdirSync(join(fighters, "no-strikes"));
    const before = renderStrikeIndex(fighters).split("\n");
    addFighter(fighters, "lady-vashj", "ladyVashj");
    const after = renderStrikeIndex(fighters).split("\n");
    const added = after.filter((line) => !before.includes(line));
    expect(added).toEqual([
      'import { ladyVashjStrikeMoments } from "../../game/fighters/lady-vashj/strikeMoments";',
      "  [Character.ladyVashj]: ladyVashjStrikeMoments,",
    ]);
    expect(after.length).toBe(before.length + 2);
    expect(after.filter((line) => line.startsWith("import {")).map((line) => line.match(/import \{ (\w+) \}/)?.[1])).toEqual(["Character", "akamaStrikeMoments", "ladyVashjStrikeMoments", "lichKingStrikeMoments"]);
    expect(after.filter((line) => line.startsWith("  [Character.")).map((line) => line.match(/Character\.(\w+)/)?.[1])).toEqual(["akama", "ladyVashj", "lichKing"]);
  } finally {
    rmSync(fighters, { recursive: true, force: true });
  }
});

test("two lanes that add different fighters conflict on the strike index alone and land through Autoland's rebase regenerated, equal to a fresh generation [k5 boundary git-strike-index-lanes]", async () => {
  expect(GENERATED_CODE.test(INDEX)).toBe(true);
  expect(resolveConflicts([{ path: INDEX }])).toMatchObject({ resolve: true, code: [INDEX] });
  const repo = mkdtempSync(join(tmpdir(), "makgora-strike-index-lanes-"));
  const lane = (branch: string, folder: string, key: string) => {
    expect(git(repo, "checkout", "-q", "-b", branch, "main").exitCode).toBe(0);
    addFighter(join(repo, "fighters"), folder, key);
    regenerate(repo);
    commit(repo, `add ${folder}`);
  };
  try {
    expect(git(repo, "init", "-q", "-b", "main").exitCode).toBe(0);
    addFighter(join(repo, "fighters"), "akama", "akama");
    regenerate(repo);
    commit(repo, "base");
    lane("lane-first", "butcher", "butcher");
    lane("lane-second", "chen", "chen");
    expect(git(repo, "checkout", "-q", "main").exitCode).toBe(0);
    expect(git(repo, "merge", "-q", "--ff-only", "lane-first").exitCode).toBe(0);

    const plain = git(repo, "merge-tree", "--write-tree", "--name-only", "main", "lane-second");
    expect(plain.exitCode).toBe(1);
    expect(plain.out).toContain(INDEX);
    expect(plain.out).not.toContain("fighters/");

    expect(git(repo, "checkout", "-q", "lane-second").exitCode).toBe(0);
    const rebased = await rebaseLane({
      repo,
      onto: "main",
      resolve: async (stages) => ({ resolution: resolveConflicts(stages.map(({ path }) => ({ path }))), note: "" }),
      regenerate: () => { regenerate(repo); git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "regenerate"); return undefined; },
    });
    expect(`${rebased.ok} ${rebased.why}`).toBe("true ");
    const landed = readFileSync(join(repo, INDEX), "utf8");
    expect(landed).not.toContain("<<<<<<<");
    expect(landed).toBe(renderStrikeIndex(join(repo, "fighters")));
    for (const key of ["akama", "butcher", "chen"]) expect(landed).toContain(`[Character.${key}]: ${key}StrikeMoments,`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
