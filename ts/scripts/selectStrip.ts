import { Effect, Schema } from "effect";
import { installHeadless, loadMapEntry, playHeadless } from "wisp/scripts/wisp/headless";
import { type RenderScene, captureScene, renderScenes } from "wisp/scripts/wisp/headlessRender";
import type { Journey } from "wisp/src/headless/journey";
import type { MapEntry } from "wisp/src/headless/client";
import { SMASHCRAFT_JOURNEYS } from "./wisp/journeys";
import { headlessRender } from "./wisp/headlessRender";
import { smashcraftNativeBehavior } from "./wisp/headlessNatives";

export const RETURNING_PLAYER_FILES: Readonly<Record<string, readonly string[]>> = { "SmashcraftTutorial.pld": ["seen"] };

class SelectStripFailure extends Schema.TaggedError<SelectStripFailure>()("SelectStripFailure", { problem: Schema.String }) {}

const USAGE = "usage: bun scripts/selectStrip.ts JOURNEY.json OUT_DIR --frames N... [--resolution WxH]";

export function selectScenes(entry: MapEntry, journey: Journey, frames: readonly number[], screen: { readonly width: number; readonly height: number }): RenderScene[] {
  const runtime = installHeadless({ ...SMASHCRAFT_JOURNEYS.map, natives: smashcraftNativeBehavior });
  const scenes: RenderScene[] = [];
  try {
    const files = { read: (name: string) => RETURNING_PLAYER_FILES[name], written: () => undefined };
    playHeadless(runtime.clients(entry, [0], { keepCalls: 1, screen, files: () => files }), journey, "select-strip", undefined, { observationFrames: frames, observe: (running) => { for (const client of running.clients) scenes.push(captureScene(client)); } });
  } finally {
    runtime.restore();
  }
  return scenes;
}

export const selectStrip = (args: readonly string[]) => Effect.gen(function*() {
  const [journeyPath, out] = args;
  const flag = (name: string) => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  const at = args.indexOf("--frames");
  const frames: number[] = [];
  for (const word of at < 0 ? [] : args.slice(at + 1)) {
    if (!/^\d+$/.test(word)) break;
    frames.push(Number(word));
  }
  if (journeyPath === undefined || out === undefined || frames.length === 0) return yield* new SelectStripFailure({ problem: USAGE });
  const [width = 1280, height = 720] = (flag("--resolution") ?? "1280x720").split("x").map(Number);
  const screen = { width, height };
  const journey = (yield* Effect.promise(() => Bun.file(journeyPath).json())) as Journey;
  const entry = yield* Effect.promise(() => loadMapEntry(SMASHCRAFT_JOURNEYS.entry));
  const scenes = selectScenes(entry, journey, frames, screen);
  const rendered = yield* renderScenes({ ...headlessRender(), ...screen }, scenes, out, "classic");
  yield* Effect.log(`${rendered.length} frames rendered to ${out}`);
});

if (import.meta.main) await Effect.runPromise(selectStrip(Bun.argv.slice(2)));
