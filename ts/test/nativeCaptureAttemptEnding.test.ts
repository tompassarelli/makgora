import { expect, test } from "bun:test";
import { attemptEnding } from "../scripts/nativeCaptureVerdict";

const advancing = [180, 181, 182, 184, 185, 187].map((frame, index) => ({ ms: 299531 + index * 25, stamp: `10/${frame}` }))
  .concat(Array.from({ length: 19 }, (_, index) => ({ ms: 299679 + index * 17, stamp: "10/188" })));
const stuck = [{ ms: 50000, stamp: "1/221" }, ...Array.from({ length: 20 }, (_, index) => ({ ms: 51000 + index * 1000, stamp: "1/223" })), ...Array.from({ length: 30 }, (_, index) => ({ ms: 72000 + index * 1000, stamp: "unreadable" }))];

test("a capture attempt that runs out of budget while the frame stamp is still advancing says so instead of reading as a freeze, and a stamp stuck on one frame names that frame and how long it held [k2 property]", () => {
  const ranOut = attemptEnding(advancing, 5);
  for (const fact of ["5-minute", "advanced", "script 10 frame 188"]) expect(ranOut).toContain(fact);
  expect(ranOut).not.toContain("stuck");
  const held = attemptEnding(stuck, undefined);
  for (const fact of ["stuck", "script 1 frame 223", "50 s"]) expect(held).toContain(fact);
  const unread = attemptEnding([{ ms: 400, stamp: "unreadable" }], undefined);
  expect(unread).toContain("readable");
  expect(unread).not.toMatch(/frame \d|stuck|advanced/);
});
