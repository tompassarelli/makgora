import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TINTABLE_FRAME_KINDS, tintProblems, type SourceLine } from "../scripts/frameTint";

const root = join(import.meta.dir, "..");

const sourceLines = (): SourceLine[] => [...new Bun.Glob("src/**/*.ts").scanSync(root)].flatMap(path => readFileSync(join(root, path), "utf8").split("\n").map((text, index) => ({ path, line: index + 1, text })));

test("No map source tints a frame: Classic drew the hand label white whatever setFrameColor asked [k1 scenario]", () => {
  expect(TINTABLE_FRAME_KINDS).toEqual([]);
  expect(tintProblems(sourceLines())).toEqual([]);
});

test("The tint check names a file that calls setFrameColor or BlzFrameSetVertexColor [k2 property]", () => {
  const found = tintProblems([
    { path: "src/game/ui/example.ts", line: 3, text: "  setFrameColor(frame, frameColor(255, 255, 0, 0));" },
    { path: "src/game/ui/example.ts", line: 4, text: "  BlzFrameSetVertexColor(frame, color);" },
    { path: "src/game/ui/example.ts", line: 5, text: "  setFrameAlpha(frame, 255);" },
  ]);
  expect(found.length).toBe(2);
  expect(found[0]).toContain("src/game/ui/example.ts:3");
});
