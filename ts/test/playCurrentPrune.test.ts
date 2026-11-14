import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GUESSED_NEWEST_PLAYTESTS_KEPT, pruneCurrentPlaytests } from "../scripts/wisp/inputsPrune";

test("a prune keeps the map a running playtest has open and the main revision, and removes older maps [k2 property]", () => {
  const root = mkdtempSync(join(tmpdir(), "play-current-prune-"));
  const builds = join(root, "play-current"), locks = join(root, "locks");
  const revision = (index: number) => index.toString(16).padStart(40, "0");
  const total = GUESSED_NEWEST_PLAYTESTS_KEPT + 3;
  for (let index = 0; index < total; index++) {
    const folder = join(builds, revision(index));
    mkdirSync(folder, { recursive: true });
    writeFileSync(`${folder}.version`, "");
    utimesSync(folder, 1_000_000 + index, 1_000_000 + index);
  }
  const open = join(builds, revision(0), "map.w3x");
  const pruned = pruneCurrentPlaytests(builds, (name) => join(locks, `play-${name}.lock`), revision(1), [{ path: open, reason: "is open in process 1" }], false);
  expect(pruned.removed).toEqual([join(builds, revision(2))]);
  expect(existsSync(join(builds, revision(0)))).toBe(true);
  expect(existsSync(join(builds, revision(1)))).toBe(true);
  expect(existsSync(`${join(builds, revision(2))}.version`)).toBe(false);
  rmSync(root, { recursive: true });
});
