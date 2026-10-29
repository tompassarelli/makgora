import { readFileSync } from "node:fs";
import { CHECKS, GROUPS, type Group, type LandingCheck, UNKNOWN_BASE, reachedChecks } from "./landingChecks";

/** The checks a farm-test.yml group runs: those of its own a changed path reaches (every one for an unknown base or the full suite). */
export function groupChecks(group: Group, paths: readonly string[]): LandingCheck[] {
  const inGroup = CHECKS.filter((check) => check.farm.includes(group));
  const reached = new Set(reachedChecks(paths).map(({ check }) => check));
  return inGroup.filter((check) => reached.has(check));
}

/**
 * A hash of everything a group's checks can read: the group, the checks that run and the
 * blob of every tracked file one of their reach rules matches (`git ls-tree -r` lines), so
 * a pass is reused wherever those files are unchanged, however the rest of the tree moved.
 */
export function groupInputKey(group: Group, paths: readonly string[], listing: string): string {
  const checks = groupChecks(group, paths);
  const rules = checks.flatMap((check) => check.reaches);
  const hasher = new Bun.CryptoHasher("sha256").update(`${group}\0${checks.map(({ name }) => name).join("\0")}\n`);
  for (const line of listing.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const path = line.slice(tab + 1);
    if (rules.some((rule) => rule.matches(path))) hasher.update(`${line.slice(0, tab).split(" ")[2]}\0${path}\n`);
  }
  return hasher.digest("hex");
}

if (import.meta.main) {
  const [group, changedFile] = process.argv.slice(2);
  const known = GROUPS.find((candidate) => candidate === group);
  if (known === undefined || changedFile === undefined) throw new Error("usage: git ls-tree -r --full-tree HEAD | bun scripts/landingInputs.ts GROUP CHANGED-PATHS-FILE");
  const changed = readFileSync(changedFile, "utf8").split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const listing = await Bun.stdin.text();
  console.log(groupInputKey(known, changed.length === 0 ? [UNKNOWN_BASE] : changed, listing));
}
