import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { mapBuildKey } from "../scripts/wisp/mapBuildKey";

const keyOf = (repo: string, args: readonly string[]) => Effect.runPromise(mapBuildKey(repo, args));

const git = (repo: string, ...args: string[]) => {
  const run = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=lane", "-c", "user.email=lane@example.invalid", ...args]);
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
};

const checkout = () => {
  const repo = mkdtempSync(join(tmpdir(), "smashcraft-key-"));
  git(repo, "init", "-q");
  writeFileSync(join(repo, "source.ts"), "export const a = 1;\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "one");
  return repo;
};

const ARGS = ["--profile", "playable", "--edition", "classic", "--name", "Before", "--out", "build/a.w3x"];

test("a map build's key follows its checkout state and arguments, not where the map goes [k2 property]", async () => {
  const repo = checkout();
  const first = await keyOf(repo, ARGS);
  expect(await keyOf(repo, ["--out", "elsewhere/b.w3x", ...ARGS.slice(0, -2)])).toBe(first);
  expect(await keyOf(repo, ARGS.map((arg) => arg === "classic" ? "full" : arg))).not.toBe(first);
  expect(await keyOf(repo, ARGS.map((arg) => arg === "playable" ? "native-capture" : arg))).not.toBe(first);
  writeFileSync(join(repo, "source.ts"), "export const a = 2;\n");
  const edited = await keyOf(repo, ARGS);
  expect(edited).not.toBe(first);
  git(repo, "commit", "-q", "-am", "two");
  const committed = await keyOf(repo, ARGS);
  expect(committed).toBe(edited);
  writeFileSync(join(repo, "untracked.ts"), "x");
  expect(await keyOf(repo, ARGS)).not.toBe(committed);
});

test("two checkouts of one tree and arguments share a key [k2 property]", async () => {
  const first = checkout(), second = checkout();
  git(first, "commit", "-q", "--amend", "--date", "2026-01-01T00:00:00", "-m", "other message");
  expect(await keyOf(first, ARGS)).toBe(await keyOf(second, ARGS));
});
