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
  for (let example = 0; example < 128; example++) {
    const width = bit() * (example + 1), height = bit() * (example + 1);
    const shape = { ...geometry, Geosets: geometry.Geosets.map((geoset) => ({ ...geoset, Vertices: new Float32Array([0, 0, 0, width, 0, 0, 0, height, 0]) })) };
    expect(effectVisibility(shape, use, () => true).status).toBe(width * height > 0 ? "visible" : "invisible");
    expect(effectVisibility(shape, { ...use, scale: 0 }, () => true).status).toBe("invisible");
    expect(effectVisibility(shape, { ...use, alpha: 0 }, () => true).status).toBe("invisible");
    expect(effectVisibility(shape, { ...use, lifetime: 0 }, () => true).status).toBe("invisible");
  }
  const collapsed = { ...geometry, Geosets: geometry.Geosets.map((geoset) => ({ ...geoset, Vertices: new Float32Array([0, 0, 0, 1, 1, 0, 2, 2, 0]) })) };
  expect(effectVisibility(collapsed, use, () => true).status).toBe("invisible");
  const skinned = { ...geometry, Geosets: geometry.Geosets.map((geoset) => ({ ...geoset, SkinWeights: new Uint8Array(24) })) };
  expect(effectVisibility(skinned, use, () => true).status).toBe("unknown");
  const transformed = parseMDL('Version { FormatVersion 800, } Model "synthetic transformed" { BlendTime 0, } Textures 1 { Bitmap { Image "triangle.blp", } } Materials 1 { Material { Layer { FilterMode None, static TextureID 0, } } } Bone "collapsed" { ObjectId 0, Scaling 1 { Linear, 0: {0,0,0}, } } Geoset { Vertices 3 { {0,0,0}, {1,0,0}, {0,1,0}, } VertexGroup { 0, 0, 0, } Faces 1 3 { Triangles { {0,1,2}, } } Groups 1 1 { Matrices { 0 }, } MaterialID 0, }');
  expect(effectVisibility(transformed, use, () => true).status).toBe("unknown");
  expect(effectVisibility(geometry, { ...use, scale: 0, scaleEnd: 1 }, () => true).status).toBe("unknown");
  const late = { ...geometry, Sequences: parseMDL('Version { FormatVersion 800, } Model "synthetic interval" { BlendTime 0, } Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, } }').Sequences, Materials: geometry.Materials.map((material) => ({ ...material, Layers: material.Layers.map((layer) => ({ ...layer, Alpha: { LineType: 0, GlobalSeqId: -1, Keys: [{ Frame: 0, Vector: new Float32Array([0]) }, { Frame: 750, Vector: new Float32Array([1]) }] } })) })) };
  expect(effectVisibility(late, { ...use, lifetime: 0.5 }, () => true).status).toBe("invisible");
  expect(effectVisibility(late, { ...use, lifetime: 1 }, () => true).status).toBe("visible");
  const clock = particle.ParticleEmitters2[0];
  if (clock === undefined) throw new Error("synthetic emitter is missing");
  const emitting = { ...particle, Textures: geometry.Textures, ParticleEmitters2: [{ ...clock, TextureID: 0, Alpha: new Uint8Array([255, 255, 255]), ParticleScaling: new Float32Array([1, 1, 1]), LifeSpan: 1 }] };
  expect(effectVisibility(emitting, use, () => true).status).toBe("visible");
  const scaledEmitter = { ...emitting, ParticleEmitters2: emitting.ParticleEmitters2.map((emitter) => ({ ...emitter, Scaling: { LineType: 0, GlobalSeqId: -1, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }] } })) };
  expect(effectVisibility(scaledEmitter, use, () => true).status).toBe("unknown");
});
