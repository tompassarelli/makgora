import { expect, test } from "bun:test";
import { rowStamp } from "../scripts/nativeCaptureChunks";
import { pairDefaults } from "../scripts/captureQueuePair";
import { poolArguments } from "../scripts/nativeCaptureBatch";
import { type VideoStamp, batchArguments, leaseOwner, stampRow, stillFrame } from "../scripts/nativeCaptureRealtime";

const rows = ["rain-a", "rain-b", "rain-c"];
const run = (row: number, video: number, from: number, frames: readonly number[]): VideoStamp[] => frames.map((frame, offset) => ({ video, index: from + offset, script: rowStamp(row), frame }));

test("a real-time still maps each stamp to the row that drew it, so a frame shared by two rows comes from the asked row [k2 property]", () => {
  const stamps = [...run(0, 1, 0, [329, 330, 331]), ...run(1, 1, 100, [329, 330, 331]), ...run(2, 2, 0, [330])];
  for (const [index, row] of rows.entries()) expect(stampRow(rows, rowStamp(index))).toBe(row);
  expect(stillFrame(stamps, rows, "rain-b", 330)).toEqual({ video: 1, index: 101, script: rowStamp(1), frame: 330 });
  expect(stillFrame(stamps, rows, "rain-c", 330)?.video).toBe(2);
});

test("a real-time still takes the first video frame showing the game frame, else the next within two game frames [k2 property]", () => {
  const stamps = run(0, 1, 0, [40, 40, 42, 45, 45, 49]);
  expect(stillFrame(stamps, rows, "rain-a", 45)?.index).toBe(3);
  expect(stillFrame(stamps, rows, "rain-a", 41)?.index).toBe(2);
  expect(stillFrame(stamps, rows, "rain-a", 46)).toBeUndefined();
});

test("a pair a real-time run leased is started by a pool under the lease's owner with no fleet session, which Wisp's pool otherwise refuses as leased to another owner; a named pair carries no owner [k2 property]", () => {
  const own = pairDefaults(2);
  const leased = batchArguments("out", 2, own, "14", leaseOwner(4242));
  expect(leased.at(-2)).toBe("--owner");
  expect(leased.at(-1)).toBe("realtime-4242");
  expect(batchArguments("out", 2, own, "14", undefined)).not.toContain("--owner");
  const poolOwner = poolArguments(2, own.desktop, own.capacity, false, leased.at(-1));
  expect(poolOwner[poolOwner.indexOf("--owner") + 1]).toBe(leaseOwner(4242));
});
