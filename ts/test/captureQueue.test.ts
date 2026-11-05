import { expect, test } from "bun:test";
import { capturedWhole } from "../scripts/captureQueueServe";




test("a batch that misses one clip's frame still returns every job whose clips it captured whole [k3 measure #614]", () => {
  const manifest = [{ name: "a-R01", frames: [41, 50] }, { name: "a-R02", frames: [41] }, { name: "b-R01", frames: [41, 50] }, { name: "c-R01", frames: [41] }];
  const captures = [{ fixture: "a-R01", frame: 41 }, { fixture: "a-R01", frame: 50 }, { fixture: "a-R02", frame: 41 }, { fixture: "b-R01", frame: 41 }, { fixture: "c-R01", frame: 41 }];
  const fixtures = new Map([["a", ["a-R01", "a-R02"]], ["b", ["b-R01"]], ["c", ["c-R01"]], ["d", []], ["e", ["c-R01", "b-R01"]]]);
  expect([...capturedWhole(fixtures, manifest, captures)].sort()).toEqual(["a", "c"]);
});
