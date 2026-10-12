import { expect, test } from "bun:test";
import { checkNativeSequenceHeap, parseMemoryRun } from "../scripts/wisp/memorySoak";

test("the native sequence's 32-bit Lua companion requires post-minute-10 heap growth below the headless 1 MB per 10 minutes [k3 measure #409]", () => {
  for (const perTenMinutes of [-1024, 0, 512, 1024, 2048]) {
    const text = [0, 10, 40, 70, 100].map((minute) => `sample kind=minute minute=${minute} frame=${minute * 3600} heap-kb=${9000 + perTenMinutes * (minute - 10) / 10}`).join("\n") + "\ndone frames=360000 matches=20 problems=0";
    const verdict = checkNativeSequenceHeap(parseMemoryRun(text));
    expect(verdict.failures.length === 0).toBe(perTenMinutes < 1024);
  }
  expect(checkNativeSequenceHeap(parseMemoryRun("sample kind=minute minute=10 frame=36000 heap-kb=9000\ndone frames=36000 matches=1 problems=0")).failures.length).toBe(2);
});
