import { expect, test } from "bun:test";
import { parseMDL, type model as mdx } from "wisp/vendor/war3-model.mjs";
import { effectVisibility, simultaneousPositive } from "../scripts/wisp/effectVisibility";

test("Classic effect visibility requires simultaneous supported tracks and moving particle playback [k2 property]", () => {
  const model = parseMDL('Version { FormatVersion 800, } Model "synthetic tracks" { BlendTime 0, }');
  let seed = 496;
  const bit = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 24) & 1; };
  for (let example = 0; example < 256; example++) {
    const values = [Array.from({ length: 11 }, bit), Array.from({ length: 11 }, bit)];
    const tracks: mdx.AnimVector[] = values.map((entries) => ({ LineType: 0, GlobalSeqId: -1, Keys: entries.map((value, Frame) => ({ Frame, Vector: new Float32Array([value]) })) }));
    const from = example % 10, to = Math.min(10, from + 1 + example % 5);
    const reference = values[0]?.slice(from, to + 1).some((value, offset) => value > 0 && (values[1]?.[from + offset] ?? 0) > 0);
    expect(simultaneousPositive(model, tracks, [0, 10], [from, to], [0, 0])).toBe(reference);
    const unsupported = tracks.map((track) => ({ ...track, LineType: 2 }));
    expect(simultaneousPositive(model, unsupported, [0, 10], [from, to], [0, 0])).toBeUndefined();
  }
  const use = { sequence: "stand", seconds: 0, timeScale: 1 };
  expect(effectVisibility(model, { ...use, playbackUnknown: "unmodeled presentation" }, () => true).status).toBe("unknown");
  expect(effectVisibility(model, use, () => true).status).toBe("invisible");
  const particle = parseMDL('Version { FormatVersion 800, } Model "synthetic frozen emitter" { BlendTime 0, } ParticleEmitter2 "clock" { ObjectId 0, static EmissionRate 1, }');
  const geometry = parseMDL('Version { FormatVersion 800, } Model "synthetic triangle" { BlendTime 0, } Textures 1 { Bitmap { Image "triangle.blp", } } Materials 1 { Material { Layer { FilterMode None, static TextureID 0, } } } Geoset { Vertices 3 { {0,0,0}, {1,0,0}, {0,1,0}, } Faces 1 3 { Triangles { {0,1,2}, } } MaterialID 0, }');
  expect(effectVisibility(geometry, { ...use, timeScale: 0, travels: true }, () => true).status).toBe("visible");
  expect(effectVisibility(geometry, use, () => undefined).status).toBe("unknown");
  expect(effectVisibility(particle, { ...use, timeScale: 0, travels: true }, () => true).status).toBe("unknown");
});
