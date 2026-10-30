import { assertEquals, test } from "wisp/src/runtime/testing";
import { clockHundredths, clockMain, clockSeconds, hundredthsLabel } from "./clockReadout";

function assertReads(frames: number, main: string, hundredths: string): void {
  assertEquals(clockMain(clockSeconds(frames)), main);
  assertEquals(hundredthsLabel(clockHundredths(frames)), hundredths);
}

test("The match clock reads MM:SS with hundredths from the 60 Hz frame count: 342.85 s is 05:42 and 85, 59.99 s is 00:59 and 99, zero is 00:00 and 00 [k3 measure docs/design/match-flow.md]", () => {
  assertReads(20571, "05:42", "85");
  assertReads(3599, "00:59", "99");
  assertReads(0, "00:00", "00");
  assertReads(20580, "05:43", "00");
  assertReads(60 * 60 * 7, "07:00", "00");
});
