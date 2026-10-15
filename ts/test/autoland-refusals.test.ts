import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "autoland-refusals-"));
const run = (command: string, flag: string, content: unknown, ...extra: string[]): string => {
  const file = join(dir, `${command}.json`);
  writeFileSync(file, JSON.stringify(content));
  const result = Bun.spawnSync(["bun", join(import.meta.dir, "../scripts/autoland.ts"), command, flag, file, ...extra]);
  expect(result.exitCode).toBe(0);
  return result.stdout.toString().trim();
};

const at = "2026-10-16T01:00:00Z";
const lane = (description: string, state = "pending") => ({ branch: "claude/a", tip: "a".repeat(40), status: { state, description, at } });

test("the loop check refuses a lane after three alone-tests and not before [k1 scenario]", () => {
  const alone = "testing alone on " + "b".repeat(40);
  expect(run("loop", "--statuses", [alone, "waiting to test alone", alone])).toBe("false");
  expect(run("loop", "--statuses", ["queued", alone, "waiting to test alone", alone, alone])).toBe("true");
});

test("a conflict left pending for ten minutes is handed back and not before [k1 scenario]", () => {
  const conflict = lane("conflicts with main 0123456789 in build-inputs/impact-assets/pin.json");
  expect(run("handback", "--lanes", [conflict], "--now", "2026-10-16T01:09:59Z")).toBe("");
  expect(run("handback", "--lanes", [conflict], "--now", "2026-10-16T01:10:00Z")).toBe(`claude/a\t${"a".repeat(40)}`);
  expect(run("handback", "--lanes", [lane("waiting to test alone")], "--now", "2026-10-16T02:00:00Z")).toBe("");
  expect(run("handback", "--lanes", [lane("conflicts with main 0123456789 in x", "failure")], "--now", "2026-10-16T02:00:00Z")).toBe("");
});
