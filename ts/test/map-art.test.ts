import { expect, test } from "bun:test";
import { generateMDX, parseMDL, parseMDX } from "war3-model";
import { encodePreview } from "../scripts/mapPreview";
import { LOADING_SCREEN_CLEAR, classicModel, retargetLoadingModel } from "../scripts/loadingScreen";

function chunk(tag: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length);
  out.set(new TextEncoder().encode(tag));
  new DataView(out.buffer).setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}

function texture(id: number, path: string, flags: number): Uint8Array {
  const out = new Uint8Array(268), view = new DataView(out.buffer);
  view.setUint32(0, id, true);
  out.set(new TextEncoder().encode(path), 4);
  view.setUint32(264, flags, true);
  return out;
}

const pathAt = (model: Uint8Array, at: number): string => new TextDecoder().decode(model.subarray(at, at + 260)).replace(/\0+$/, "");

test("the loading model points its four quadrants at the picture and every other texture at the clear one, leaving the rest of the model alone [k2 property]", () => {
  const textures = Array.from({ length: 6 }, (_, index) => texture(index, `UI\\Glues\\Loading\\Backgrounds\\Tutorial\\Piece${index}LongerStockPathName.blp`, 3 + index));
  const before = chunk("VERS", new Uint8Array([0x20, 3, 0, 0]));
  const after = chunk("MTLS", new Uint8Array([9, 8, 7]));
  const model = Uint8Array.from([..."MDLX"].map((c) => c.charCodeAt(0)).concat([...before, ...chunk("TEXS", Uint8Array.from(textures.flatMap((t) => [...t]))), ...after]));
  const out = retargetLoadingModel(model);
  const first = 4 + before.length + 8;
  const paths = textures.map((_, index) => pathAt(out, first + index * 268 + 4));
  expect(paths.slice(0, 4)).toEqual(["war3mapImported\\SmashcraftLoadingBotLeft.blp", "war3mapImported\\SmashcraftLoadingBotRight.blp", "war3mapImported\\SmashcraftLoadingTopRight.blp", "war3mapImported\\SmashcraftLoadingTopLeft.blp"]);
  expect(paths.slice(4)).toEqual([LOADING_SCREEN_CLEAR, LOADING_SCREEN_CLEAR]);
  for (let index = 0; index < textures.length; index++) {
    const view = new DataView(out.buffer, first + index * 268);
    expect([view.getUint32(0, true), view.getUint32(264, true)]).toEqual([index, 3 + index]);
  }
  expect(out.length).toBe(model.length);
  expect(out.subarray(0, first)).toEqual(model.subarray(0, first));
  expect(out.subarray(out.length - after.length)).toEqual(after);
});

test("the lobby preview's palette reproduces every pixel of a 256-colour picture and refuses a 257th colour [k2 property]", () => {
  const width = 16, height = 16, data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([(i * 37) & 255, (i * 11) & 255, i >> 1, 255], i * 4);
  const blp = encodePreview({ width, height, data, alpha: false });
  const view = new DataView(blp.buffer);
  expect([view.getUint32(12, true), view.getUint32(16, true)]).toEqual([width, height]);
  const pixels = view.getUint32(28, true);
  for (let i = 0; i < width * height; i++) {
    const index = blp[pixels + i] ?? 0;
    expect([blp[156 + index * 4 + 2], blp[156 + index * 4 + 1], blp[156 + index * 4]]).toEqual([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  }
  const many = new Uint8Array(257 * 4);
  for (let i = 0; i < 257; i++) many.set([i & 255, i >> 8, 0, 255], i * 4);
  expect(() => encodePreview({ width: 257, height: 1, data: many, alpha: false })).toThrow("at most 256 colours");
});

const REFORGED_MODEL = `Version { FormatVersion 1000, }
Model "Probe" { NumGeosets 1, BlendTime 150, MinimumExtent { -1, -1, -1 }, MaximumExtent { 1, 1, 1 }, }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, NonLooping, MinimumExtent { -1, -1, -1 }, MaximumExtent { 1, 1, 1 }, BoundsRadius 1, } }
Textures 2 { Bitmap { Image "war3mapImported\\\\A.blp", } Bitmap { Image "war3mapImported\\\\B.blp", } }
Materials 2 { Material { Layer { FilterMode None, Unshaded, static TextureID 0, } } Material { Layer { FilterMode Blend, Unshaded, static TextureID 1, } } }
Geoset {
  Vertices 3 { { 0, 0, 0 }, { 1, 0, 0 }, { 0, 1, 0 }, }
  Normals 3 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
  TVertices 3 { { 0, 0 }, { 1, 0 }, { 0, 1 }, }
  VertexGroup { 0, 0, 0, }
  Faces 1 3 { Triangles { { 0, 1, 2 }, } }
  Groups 1 1 { Matrices { 0 }, }
  MinimumExtent { 0, 0, 0 }, MaximumExtent { 1, 1, 0 }, BoundsRadius 1,
  Anim { MinimumExtent { 0, 0, 0 }, MaximumExtent { 1, 1, 0 }, BoundsRadius 1, }
  MaterialID 1,
  SelectionGroup 0,
}
Bone "Root" { ObjectId 0, GeosetId 0, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;

test("the loading model ships in the classic 800 format with its textures, materials and geometry unchanged [k2 property]", () => {
  const source = parseMDL(REFORGED_MODEL);
  const classic = parseMDX(classicModel(new Uint8Array(generateMDX(source))).buffer as ArrayBuffer);
  expect(classic.Version).toBe(800);
  expect(classic.Textures.map((texture) => texture.Image)).toEqual(source.Textures.map((texture) => texture.Image));
  expect(classic.Materials.map((material) => material.Layers.map((layer) => [layer.FilterMode, layer.TextureID]))).toEqual(source.Materials.map((material) => material.Layers.map((layer) => [layer.FilterMode, layer.TextureID])));
  expect([...(classic.Geosets[0]?.Vertices ?? [])]).toEqual([...(source.Geosets[0]?.Vertices ?? [])]);
});
