import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { resolveGiven } from "../scripts/wisp/commands/farm";

const git = (cwd: string, ...args: string[]) => {
  const done = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd });
  if (done.exitCode !== 0) throw new Error(done.stderr.toString());
  return done.stdout.toString().trim();
};

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "farm-ref-"));
  const origin = join(root, "origin.git");
  const mine = join(root, "mine");
  const other = join(root, "other");
  git(root, "init", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, mine);
  git(mine, "commit", "-q", "--allow-empty", "-m", "stale");
  git(mine, "push", "-q", "origin", "main");
  git(root, "clone", "-q", origin, other);
  git(other, "commit", "-q", "--allow-empty", "-m", "fresh");
  git(other, "push", "-q", "origin", "main");
  return { root, mine, stale: git(mine, "rev-parse", "main"), fresh: git(other, "rev-parse", "HEAD") };
};

test("farm --ref main resolves origin/main's sha, never a stale local main [k1 scenario]", async () => {
  const { root, mine, stale, fresh } = fixture();
  try {
    expect(git(mine, "rev-parse", "main")).toBe(stale);
    expect(await Effect.runPromise(resolveGiven("main", mine))).toBe(fresh);
    expect(await Effect.runPromise(resolveGiven(fresh, mine))).toBe(fresh);
    expect(await Effect.runPromise(resolveGiven(stale.slice(0, 10), mine))).toBe(stale);
    expect(await Effect.runPromise(resolveGiven(undefined, mine))).toBe(stale);
  } finally {
    rmSync(root, { recursive: true });
  }
});
