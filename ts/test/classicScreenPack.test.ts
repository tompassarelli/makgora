import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packSample, type PackRun } from "../scripts/wisp/classicScreenPack";

const recorded = JSON.parse(readFileSync(join(import.meta.dir, "fixtures/screenPack/receipt.json"), "utf8")) as Omit<PackRun, "path">;
const run = (path: string): PackRun => ({ ...recorded, path });
const fixture = "positives-blademaster-side-special";
const manifest = { path: "main-positives.captures.json", map: "main-positives.w3x", fixtures: [{ name: fixture, frames: [47, 46] }] };
const request = { move: "blademaster:side-special", role: "positive", version: "main", source: "digest", fixture, excluded: [], crop: { x: 245, y: 140, width: 1470, height: 840 }, regionMargin: 10, bodyMargin: 0 } as const;

test("a recorded Blademaster receipt packs into frames in order, with boxes moved into the cropped image and both cue-off controls from separate runs [k1 scenario]", () => {
  const sample = packSample(request, manifest, "main-positives.w3x", "hash", [run("one/captures.json"), run("two/captures.json")]);
  expect([sample.first, sample.last, sample.frames.map(frame => frame.frame)]).toEqual([46, 47, [46, 47]]);
  const [first] = sample.frames;
  expect(first?.region).toEqual({ x: 901 - 245 - 10, y: 520 - 140 - 10, width: 57 + 20, height: 159 + 20 });
  expect(first?.body).toEqual({ x: 901 - 245, y: 520 - 140, width: 57, height: 159 });
  expect([first?.shown.receipt, first?.off.receipt, first?.repeatedOff.receipt]).toEqual(["one/captures.json", "one/captures.json", "two/captures.json"]);
  expect([first?.shown.phase, first?.off.phase, first?.repeatedOff.phase]).toEqual(["shown", "hidden", "hidden"]);
  expect(first?.off.file).toBe("one/positives-blademaster-side-special/46-hidden.png");
  expect(first?.repeatedOff.file).toBe("two/positives-blademaster-side-special/46-hidden.png");
  expect(() => packSample(request, manifest, "main-positives.w3x", "hash", [run("one/captures.json"), run("one/captures.json")])).toThrow("second, independent capture run");
});
