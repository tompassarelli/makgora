import { expect, test } from "bun:test";
import { parseButtonList, parseClickLog, sweepMisses, sweepPoints } from "../scripts/wisp/buttonSweep";

const LISTING = [
  "BUTTON ui.settings.1.click#0:preset visible=1 x=0.05000 y=0.50000 width=0.10000 height=0.04000",
  "BUTTON ui.settings.1.click#1:dismiss visible=0 box=none",
  "BUTTON ui.pause.click#2:button visible=1 box=none",
  "noise",
];

test("the button listing keeps each registered button with its box or none [k2 property]", () => {
  const buttons = parseButtonList(LISTING);
  expect(buttons.map(({ label, visible, box }) => [label, visible, box?.width])).toEqual([
    ["ui.settings.1.click#0:preset", true, 0.1],
    ["ui.settings.1.click#1:dismiss", false, undefined],
    ["ui.pause.click#2:button", true, undefined],
  ]);
});

test("five points run across a button's width at its vertical middle, inside its edges [k2 property]", () => {
  const points = sweepPoints({ x: 0.2, y: 0.3, width: 0.1, height: 0.04 });
  expect(points).toHaveLength(5);
  expect(points.map(({ x }) => Math.round(x * 1000) / 1000)).toEqual([0.21, 0.23, 0.25, 0.27, 0.29]);
  expect(points.every(({ y }) => Math.abs(y - 0.28) < 1e-9)).toBe(true);
});

test("a point that produced no click, or another button's click, is a miss naming the button [k2 property]", () => {
  const [button] = parseButtonList(LISTING);
  const misses = sweepMisses(button!, [button!.label, undefined, button!.label, "ui.other#9:close", button!.label]);
  expect(misses.map(({ problem }) => problem)).toEqual([
    "ui.settings.1.click#0:preset took no click at point 2 of 5",
    "ui.settings.1.click#0:preset point 4 of 5 clicked ui.other#9:close",
  ]);
  expect(sweepMisses(button!, Array(5).fill(button!.label))).toEqual([]);
});

test("the click log lists the labels clicked in order [k2 property]", () => {
  expect(parseClickLog(["CLICK a#0:x n=1", "junk", "CLICK b#1:y n=2"])).toEqual(["a#0:x", "b#1:y"]);
});
