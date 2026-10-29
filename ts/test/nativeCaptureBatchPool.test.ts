import { expect, test } from "bun:test";
import { Effect } from "effect";
import { pairDesktops, poolArguments } from "../scripts/nativeCaptureBatch";

test("a capture batch's pool start waits in the capacity queue instead of failing when the host defers it, holds its pair for the batch's whole life instead of letting it go idle while the batch builds or between rows, and keeps its network flag [k2 property]", () => {
  expect(poolArguments(3, "desktop.sh", "capacity.mjs", false)).toEqual(["lan", "pool", "--foreground", "--queue", "--release-idle", "0", "--pair", "3", "--pool-profile", "visual", "--desktop", "desktop.sh", "--capacity", "capacity.mjs"]);
  expect(poolArguments(3, "desktop.sh", "capacity.mjs", true).at(-1)).toBe("--network");
});

test("a pair's desktops come from its own pair.json, one for a single-client pair and two for a pair of clients [k2 property]", async () => {
  const single = JSON.stringify({ id: 4, clients: "c.json", runs: { a: "run-a" }, profile: "visual" });
  const both = JSON.stringify({ id: 4, clients: "c.json", runs: { a: "run-a", b: "run-b" }, profile: "visual" });
  expect(await Effect.runPromise(pairDesktops(single))).toEqual(["run-a"]);
  expect(await Effect.runPromise(pairDesktops(both))).toEqual(["run-a", "run-b"]);
});
