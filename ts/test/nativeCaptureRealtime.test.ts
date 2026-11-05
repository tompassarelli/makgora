import { expect, test } from "bun:test";
import { pairDefaults } from "../scripts/captureQueuePair";
import { poolArguments } from "../scripts/nativeCaptureBatch";
import { batchArguments, leaseOwner } from "../scripts/nativeCaptureRealtime";

test("a pair a real-time run leased is started by a pool under the lease's owner with no fleet session, which Wisp's pool otherwise refuses as leased to another owner; a named pair carries no owner [k2 property]", () => {
  const own = pairDefaults(2);
  const leased = batchArguments("out", 2, own, "14", leaseOwner(4242));
  expect(leased.at(-2)).toBe("--owner");
  expect(leased.at(-1)).toBe("realtime-4242");
  expect(batchArguments("out", 2, own, "14", undefined)).not.toContain("--owner");
  const poolOwner = poolArguments(2, own.desktop, own.capacity, false, leased.at(-1));
  expect(poolOwner[poolOwner.indexOf("--owner") + 1]).toBe(leaseOwner(4242));
});
