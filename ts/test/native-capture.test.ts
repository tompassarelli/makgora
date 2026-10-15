import { expect, mock, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import type { Client } from "wisp/scripts/warcraft/desktop";
import * as platform from "wisp/scripts/platform/layer";
import { InputInjection, ScreenCapture } from "wisp/scripts/platform/services";
import { encodePpm } from "wisp/scripts/wisp/frameProbe";
import { stampCells } from "../src/game/core/drawnStamp";
import { CAPTURE_STATUS_FILE } from "../src/game/core/gameFiles";

let boundary: Layer.Layer<InputInjection | ScreenCapture> | undefined;
const realPlatformLayer = platform.platformLayer;
mock.module("wisp/scripts/platform/layer", () => ({ ...platform, platformLayer: () => boundary ?? realPlatformLayer() }));
const { nativeCapture } = await import("../scripts/nativeCapture");

function pixels(script: number, frame: number): Uint8Array {
  const cells = stampCells(script, frame);
  const side = 4;
  const width = cells.length * side;
  const height = side * 4;
  const rgb = new Uint8Array(width * height * 3);
  for (const top of [0, height - side]) for (let y = top; y < top + side; y++) {
    for (let x = 0; x < width; x++) {
      const cell = cells[Math.floor(x / side)];
      rgb[(y * width + x) * 3 + (cell === "one" ? 0 : cell === "guard" ? 1 : 2)] = 255;
    }
  }
  return encodePpm({ width, height, rgb });
}

test("collector waits for the new game's matching status before certification or idle, retaining total deadline and missing-frame idle [k1 scenario]", async () => {
  const build = join(import.meta.dir, "../build");
  mkdirSync(build, { recursive: true });
  const root = mkdtempSync(join(build, "native-capture-test-"));
  const start = 1700000000000;
  let now = start;
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  const output = spyOn(console, "log").mockImplementation(() => {});
  const fixture = "new-game";
  const held = 30;
  const documents = join(root, "documents");
  const data = join(documents, "CustomMapData");
  mkdirSync(data, { recursive: true });
  const statusPath = join(data, CAPTURE_STATUS_FILE);
  const status = (line: string, fresh: boolean) => {
    writeFileSync(statusPath, `function PreloadFiles takes nothing returns nothing\ncall Preload( "${line}" )\nendfunction\n`);
    const modified = new Date(start + (fresh ? 0 : -1));
    utimesSync(statusPath, modified, modified);
  };
  const tools = { grim: "unused", xdotool: "unused", wlrctl: "unused", tesseract: "unused" };
  const client: Client = { name: "fixture", documents, tools, x11: {}, wayland: {}, window: "fixture" };
  const clientsFile = join(root, "clients.json");
  const manifest = join(root, "map.captures.json");
  writeFileSync(clientsFile, JSON.stringify({ tools, clients: [{ name: client.name, run: root, documents }] }));
  writeFileSync(manifest, JSON.stringify({ map: "fixture.w3x", fixtures: [{ name: fixture, frames: [held] }] }));
  writeFileSync(join(root, ".build.info"), "Active|Version|Branch\n1|3.0.0.24268|us\n");
  const input = Layer.effect(InputInjection, Effect.map(InputInjection, service => ({ ...service, windows: () => Effect.succeed([client]) }))).pipe(Layer.provide(platform.unsupportedLayer("test")));
  const run = async (name: string, screen: () => Uint8Array) => {
    now = start;
    boundary = Layer.merge(input, Layer.succeed(ScreenCapture, { frame: () => Effect.sync(screen) }));
    const out = join(root, name);
    const exit = await Effect.runPromiseExit(nativeCapture(["run", "--clients-file", clientsFile, "--client", client.name, "--install", root, "--offline-build", "3.0.0.24268", "--manifest", manifest, "--out", out, "--minutes", "3", "--no-audio"]));
    const evidence = JSON.parse(readFileSync(join(out, "captures.json"), "utf8")) as { captured: number; missed: { fixture: string; frame: number; phase: string }[]; captures: { capturedMs: number }[]; log: { ms: number; stamp: string }[] };
    return { exit, evidence, elapsed: now - start };
  };
  try {
    status(`CAPTURE SCRIPT 1 ${fixture}`, false);
    let sample = 0;
    const journey = await run("fresh", () => {
      const at = sample++;
      now += 10001;
      if (at === 4) status(`CAPTURE SCRIPT 2 ${fixture}`, true);
      if (at === 5) status("CAPTURE SCRIPT 1 other-game", true);
      if (at === 6) status(`CAPTURE SCRIPT 1 ${fixture}`, true);
      return pixels(1, at >= 5 ? held : 0);
    });
    expect(journey.exit._tag).toBe("Success");
    expect(journey.evidence.captured).toBe(1);
    expect(journey.evidence.captures[0]?.capturedMs).toBe(70007);
    expect(journey.evidence.log.slice(0, 5).map(row => row.stamp)).toEqual(Array(5).fill("1/0"));
    expect(journey.evidence.missed).toEqual([]);

    status(`CAPTURE SCRIPT 1 ${fixture}`, false);
    const deadline = await run("deadline", () => { now += 10001; return pixels(1, 0); });
    expect(deadline.exit._tag).toBe("Failure");
    expect(deadline.elapsed).toBeGreaterThanOrEqual(180000);
    expect(deadline.elapsed).toBeLessThan(190001);
    expect(deadline.evidence.captured).toBe(0);
    expect(deadline.evidence.missed).toEqual([{ fixture, frame: held, phase: "held" }]);
    expect(String(deadline.exit)).toContain(`missed ${fixture}@${held}`);

    status(`CAPTURE SCRIPT 1 ${fixture}`, true);
    const idle = await run("idle", () => { now += 10001; return pixels(1, 0); });
    expect(idle.exit._tag).toBe("Failure");
    expect(idle.elapsed).toBe(40004);
    expect(idle.evidence.captured).toBe(0);
    expect(idle.evidence.missed).toEqual(deadline.evidence.missed);
    expect(String(idle.exit)).toContain(`missed ${fixture}@${held}`);
  } finally {
    boundary = undefined;
    clock.mockRestore();
    output.mockRestore();
    rmSync(root, { recursive: true });
  }
});
