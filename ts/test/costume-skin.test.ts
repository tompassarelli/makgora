import { expect, test } from "bun:test";
import type { model as mdx } from "../scripts/clipNodes";
import { skinnedBody } from "../../tools/animations/costume-skin";

const texture = (Image: string, ReplaceableId = 0) => ({ Image, ReplaceableId, Flags: 0 });
const layer = (TextureID: number, FilterMode: number, Alpha: number | object = 1) => ({ TextureID, FilterMode, Alpha, Shading: 0, CoordId: 0 });

test("a costume skin draws the replacement where the stock texture was and drops the layer that then repeats it, leaving the rest of the body alone [k2 property]", () => {
  const fade = { Keys: [{ Frame: 0, Vector: new Float32Array([0]) }, { Frame: 100, Vector: new Float32Array([1]) }], LineType: 0, GlobalSeqId: null };
  const body = {
    Textures: [texture("Units\\Orc\\Hellscream\\Hellscream.blp"), texture("Textures\\HellscreamChaos.blp"), texture("", 1)],
    Materials: [
      { PriorityPlane: 0, RenderMode: 0, Layers: [layer(0, 0), layer(1, 2, fade)] },
      { PriorityPlane: 0, RenderMode: 0, Layers: [layer(2, 0), layer(0, 2), layer(1, 2, fade)] },
    ],
    Geosets: [{ MaterialID: 0 }, { MaterialID: 1 }],
    Bones: [{ Name: "Bone_Root" }],
  } as unknown as mdx.Model;
  const fel = skinnedBody(body, { index: 1, textures: { "units/orc/hellscream/hellscream.blp": "Textures\\HellscreamChaos.blp" } });
  expect(fel.Materials.map(material => material.Layers.map(drawn => [drawn.TextureID, drawn.FilterMode, drawn.Alpha]))).toEqual([[[1, 0, 1]], [[2, 0, 1], [1, 2, 1]]]);
  expect(fel.Textures).toEqual(body.Textures);
  expect(fel.Geosets).toEqual(body.Geosets);
  expect(body.Materials[0]!.Layers.length).toBe(2);
});
