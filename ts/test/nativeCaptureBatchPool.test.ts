import { expect, test } from "bun:test";
import { poolArguments } from "../scripts/nativeCaptureBatch";

test("a capture batch's pool start waits in the capacity queue instead of failing when the host defers it, and keeps its network flag [k2 property]", () => {
  expect(poolArguments(3, "desktop.sh", "capacity.mjs", false)).toEqual(["lan", "pool", "--foreground", "--queue", "--pair", "3", "--pool-profile", "visual", "--desktop", "desktop.sh", "--capacity", "capacity.mjs"]);
  expect(poolArguments(3, "desktop.sh", "capacity.mjs", true).at(-1)).toBe("--network");
});
