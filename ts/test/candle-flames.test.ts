import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { parseMDX } from "war3-model";
import { INPUTS_STORE, assetsView, pinHashes, readManifest } from "../scripts/wisp/buildInputs";
import { CANDLE_COLOUR_FRAMES, CANDLE_FLAME_MODELS } from "../src/game/presentation/candleLook";
import { CandlePresentation } from "../src/game/render/candlePresentation";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";
import type { EffectPose } from "wisp/src/headless/client";

const manifest = Effect.runSync(readManifest());
const stored = pinHashes(manifest["impact-assets"]).every((hash) => existsSync(join(INPUTS_STORE, "impact-assets", hash)));
const MODEL_SPACE = 0x80000;
const headless = testHeadless(SMASHCRAFT_HEADLESS);
const hidden = (pose: EffectPose) => pose.alpha === 0 || pose.scale === 0;

test("the candle cycles a red, a blue and a green flame whose particles stay in model space, so a moving Kobold leaves no fire trail [k3 measure #78]", async () => {
  if (!stored) return;
  const family = join(assetsView(manifest), "impact-assets");
  const flames = await Promise.all(CANDLE_FLAME_MODELS.map(async (model) => {
    const path = join(family, model.replace(/^war3mapImported\\/, ""));
    if (!existsSync(path)) return { model, emitters: [], trailing: [], hue: "missing" };
    const emitters = parseMDX(await Bun.file(path).arrayBuffer()).ParticleEmitters2;
    const body = Array.from(emitters[0]?.SegmentColor?.[1] ?? []);
    const [r = 0, g = 0, b = 0] = body;
    const hue = r > g && r > b ? "red" : b > r && b > g ? "blue" : g > r && g > b ? "green" : "grey";
    return { model, emitters: emitters.map((emitter) => emitter.Name), trailing: emitters.filter((emitter) => (emitter.Flags & MODEL_SPACE) === 0).map((emitter) => emitter.Name), hue };
  }));
  expect(flames.map(({ hue }) => hue)).toEqual(["red", "blue", "green"]);
  expect(flames.filter(({ emitters }) => emitters.length === 0).map(({ model }) => model)).toEqual([]);
  expect(flames.flatMap(({ trailing }) => trailing)).toEqual([]);
});

test("a held lit candle shows red, blue, green and red again, each for its colour period [k2 property]", () => {
  const client = headless.clients({ start: () => {}, install: () => {} }, [0]).client(0);
  client.run(() => {
    const candle = new CandlePresentation({ x: 0, y: 0, z: 100 });
    const kobold = createFighter(Character.kobold, 0, 1);
    const runs: [string, number][] = [];
    for (let frame = 0; frame < 4 * CANDLE_COLOUR_FRAMES; frame++) {
      candle.present(kobold, 0, frame);
      const shown = client.effectPoses({ visibleOnly: true }).filter(pose => pose.model.includes("CandleFlame") && !hidden(pose));
      expect(shown).toHaveLength(1);
      const colour = shown[0]?.model.match(/CandleFlame(Red|Blue|Green)-/)?.[1] ?? "none";
      if (runs.at(-1)?.[0] === colour) runs[runs.length - 1]![1]++;
      else runs.push([colour, 1]);
    }
    expect(runs).toEqual([["Red", CANDLE_COLOUR_FRAMES], ["Blue", CANDLE_COLOUR_FRAMES], ["Green", CANDLE_COLOUR_FRAMES], ["Red", CANDLE_COLOUR_FRAMES]]);
  });
  expect(client.errors).toEqual([]);
});
