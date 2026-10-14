import { expect, test } from "bun:test";
import { Effect } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { measureFootprint, calibrateScreen, screenReport, screenAcceptanceProblem, screenRequiredFrames, SCREEN_POSITIVES, SCREEN_NEGATIVES, SCREEN_MOVES, type ScreenSample } from "../scripts/wisp/classicEffectScreen";
import { readScreenCaptures } from "../scripts/classicEffectScreen";

test("paired effect pixels exclude body/HUD, repeated-control noise and reject foreign scene changes [k2 property]", () => {
  const image = () => ({ width: 16, height: 12, rgb: new Uint8Array(16 * 12 * 3) });
  const region = { x: 4, y: 4, width: 8, height: 4 }, body = { x: 4, y: 4, width: 2, height: 4 };
  for (let example = 0; example < 96; example++) {
    const shown = image(), off = image(), repeated = image();
    const count = example % 6;
    for (let pixel = 0; pixel < count; pixel++) shown.rgb[(6 * 16 + 6 + pixel) * 3] = 255;
    shown.rgb[(5 * 16 + 4) * 3] = 255;
    repeated.rgb[(5 * 16 + 6) * 3] = 255;
    shown.rgb[(5 * 16 + 6) * 3] = 255;
    const footprint = measureFootprint(shown, off, repeated, region, [body]);
    expect(footprint).toEqual({ pixels: count, contamination: 0, unstable: 1 });
    shown.rgb[0] = 255;
    expect(measureFootprint(shown, off, repeated, region, [body])?.contamination).toBe(1);
    expect(measureFootprint(shown, { ...off, width: 15 }, repeated, region, [body])).toBeUndefined();
  }
  const sample = (move: string, role: ScreenSample["role"], pixels: number, length = 4): ScreenSample => ({ move, role, source: "source", version: role === "negative" ? "0.0.192" : "candidate", width: 16, height: 12, first: 1, last: length, frames: Array.from({ length }, (_, index) => ({ frame: index + 1, pixels, contamination: 0, unstable: 0 })) });
  for (let example = 1; example < 32; example++) {
    const references = [...SCREEN_POSITIVES.map(move => sample(move, "positive", example + 1)), ...SCREEN_NEGATIVES.map(move => sample(move, "negative", example))];
    expect(calibrateScreen(references).calibration).toMatchObject({ pixels: example + 1, frames: 4 });
    expect(calibrateScreen(references.slice(1)).calibration).toBeUndefined();
    expect(calibrateScreen(references.map(row => row.role === "negative" ? { ...row, frames: row.frames.map(frame => ({ ...frame, pixels: example + 1 })) } : row)).calibration).toBeUndefined();
    const candidates = SCREEN_MOVES.map(move => sample(move, "candidate", example + 1, Math.max(4, screenRequiredFrames(move))));
    const report = screenReport([...references, ...candidates], "a".repeat(64), "source");
    expect(screenAcceptanceProblem(report, "source")).toBeUndefined();
    expect(screenAcceptanceProblem(report, "stale")).toBeDefined();
    expect(screenReport(references, "a".repeat(64), "source").rows.every(row => row.status === "unproven")).toBe(true);
    const omitted = screenReport([...references, ...candidates.slice(1)], "a".repeat(64), "source");
    expect(screenAcceptanceProblem(omitted, "source")).toBeDefined();
    const first = candidates[0];
    if (first === undefined) throw new Error("no authored screen requirements");
    const contaminated = screenReport([...references, { ...first, frames: first.frames.map(frame => ({ ...frame, contamination: 1 })) }], "a".repeat(64), "source");
    expect(contaminated.rows[0]?.status).toBe("unproven");
  }
});

test("native screen producer refuses renderer/model-only input before consuming its image files [k5 boundary classic-screen-captures]", async () => {
  const directory = await mkdtemp(join(tmpdir(), "smashcraft-screen-test-"));
  try {
    const path = join(directory, "pack.json");
    await Bun.write(path, JSON.stringify({ samples: [{ move: SCREEN_MOVES[0], role: "candidate", engine: "wisp", camera: "normal-match", stage: "sky-deck", source: "source", version: "candidate", manifest: "not-native.json", map: "not-native.w3x", mapSha256: "a".repeat(64), first: 1, last: 1, frames: [] }] }));
    const report = await Effect.runPromise(readScreenCaptures(path));
    expect(report.rows.every(row => row.status === "unproven")).toBe(true);
    expect(report.rows[0]?.reason).toContain("requires native Classic captures");
    expect(screenAcceptanceProblem(report)).toBeDefined();
  } finally { await rm(directory, { recursive: true }); }
});
