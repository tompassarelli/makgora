import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { GENERATED_CODE, resolveConflicts } from "../scripts/autolandCore";
import { rebaseLane } from "../scripts/autolandRebase";

for (const role of ["AUTHOR", "COMMITTER"]) {
  process.env[`GIT_${role}_NAME`] = "lane";
  process.env[`GIT_${role}_EMAIL`] = "lane@example.invalid";
}

const GENERATED = "ts/src/generated/state/fighterState.ts";
const HEROES = ["chen", "murloc", "tyrande"] as const;

const render = (repo: string): string =>
  `// Generated\n${readdirSync(join(repo, "heroes")).sort().map((hero) => readFileSync(join(repo, "heroes", hero), "utf8")).join("")}`;

const git = (repo: string, ...args: string[]) => {
  const run = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=lane", "-c", "user.email=lane@example.invalid", ...args]);
  return { exitCode: run.exitCode, out: run.stdout.toString() + run.stderr.toString() };
};

const write = (repo: string, path: string, text: string) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};

const lane = (repo: string, branch: string, hero: string) => {
  expect(git(repo, "checkout", "-q", "-b", branch, "main").exitCode).toBe(0);
  write(repo, `heroes/${hero}`, `copy ${hero} state\n`);
  write(repo, GENERATED, render(repo));
  expect(git(repo, "add", "-A").exitCode).toBe(0);
  expect(git(repo, "commit", "-q", "-m", `${hero} state`).exitCode).toBe(0);
};

test("two lanes that add state for different heroes, whose rows sit side by side in the one generated state file, conflict on it alone and land through Autoland's rebase regenerated, equal to a fresh generation [k5 boundary git-state-lanes]", async () => {
  const repo = mkdtempSync(join(tmpdir(), "smashcraft-state-lanes-"));
  try {
    expect(git(repo, "init", "-q", "-b", "main").exitCode).toBe(0);
    write(repo, "heroes/base", "copy base state\n");
    write(repo, GENERATED, render(repo));
    expect(git(repo, "add", "-A").exitCode).toBe(0);
    expect(git(repo, "commit", "-q", "-m", "base").exitCode).toBe(0);
    lane(repo, "lane-first", HEROES[0]);
    lane(repo, "lane-second", HEROES[1]);
    lane(repo, "lane-third", HEROES[2]);
    expect(git(repo, "checkout", "-q", "main").exitCode).toBe(0);
    expect(git(repo, "merge", "-q", "--ff-only", "lane-first").exitCode).toBe(0);

    const plain = git(repo, "merge-tree", "--write-tree", "--name-only", "main", "lane-second");
    expect(plain.exitCode).toBe(1);
    expect(plain.out).toContain(GENERATED);
    expect(plain.out).not.toContain("heroes/");

    const outcomes: string[] = [];
    for (const branch of ["lane-second", "lane-third"]) {
      expect(git(repo, "checkout", "-q", branch).exitCode).toBe(0);
      const rebased = await rebaseLane({
        repo,
        onto: "main",
        resolve: async (stages) => ({ resolution: resolveConflicts(stages.map(({ path }) => ({ path }))), note: "" }),
        regenerate: () => { write(repo, GENERATED, render(repo)); git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "regenerate"); return undefined; },
      });
      outcomes.push(`${branch} ${rebased.ok} ${rebased.why}`);
      expect(readFileSync(join(repo, GENERATED), "utf8")).toBe(render(repo));
      expect(readFileSync(join(repo, GENERATED), "utf8")).not.toContain("<<<<<<<");
      expect(git(repo, "checkout", "-q", "main").exitCode).toBe(0);
      expect(git(repo, "merge", "-q", "--ff-only", branch).exitCode).toBe(0);
    }
    expect(outcomes).toEqual(["lane-second true ", "lane-third true "]);
    expect(readFileSync(join(repo, GENERATED), "utf8")).toBe(`// Generated\n${["base", ...HEROES].sort().map((hero) => `copy ${hero} state\n`).join("")}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("a conflict in the state or fighter-art tables resolves only when no source file conflicts beside it [k2 property]", () => {
  const tables = [GENERATED, "ts/src/generated/state/fighterDifference.ts", "ts/src/generated/fighterArtData.ts", "ts/src/generated/fighter-art/chen.ts"];
  for (const path of tables) expect(GENERATED_CODE.test(path)).toBe(true);
  for (const path of ["ts/src/generated/assets/white-facts/chen.ts", "ts/src/generated/clips/chen.ts", "ts/src/game/sim/state/fighterSchema.ts"]) expect(GENERATED_CODE.test(path)).toBe(false);
  expect(resolveConflicts(tables.map((path) => ({ path })))).toMatchObject({ resolve: true, code: tables });
  const beside = resolveConflicts([{ path: GENERATED }, { path: "ts/src/game/sim/state/fighterSchema.ts" }]);
  expect(beside).toEqual({ resolve: false, why: "ts/src/game/sim/state/fighterSchema.ts is not generated; Autoland never resolves source" });
});
