import { expect, test } from "bun:test";
import { generateMDX, type model as mdx } from "../scripts/clipNodes";
import { parseModelMDX } from "../scripts/mdxCodec";
import { layerReferenceProblem, shippedLayerProblem } from "../scripts/wisp/modelLayerReferences";

const translation = { Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }], LineType: 0, GlobalSeqId: null };

const model = (layers: readonly Record<string, unknown>[], textureAnims: number): Uint8Array => new Uint8Array(generateMDX({
  Version: 800,
  Info: { Name: "Probe", AnimationFile: "", MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0, BlendTime: 150, Flags: 0 },
  Sequences: [], GlobalSequences: [], Geosets: [], GeosetAnims: [], Bones: [], Helpers: [], Attachments: [], EventObjects: [], ParticleEmitters: [], ParticleEmitters2: [],
  ParticleEmitterPopcorns: [], Cameras: [], Lights: [], RibbonEmitters: [], CollisionShapes: [], PivotPoints: [], Nodes: [], FaceFX: [], BindPoses: [],
  Textures: [{ Image: "Probe.blp", ReplaceableId: 0, Flags: 0 }],
  TextureAnims: Array.from({ length: textureAnims }, () => ({ Translation: translation })),
  Materials: [{ PriorityPlane: 0, RenderMode: 0, Layers: layers }],
} as unknown as mdx.Model));

const layer = { FilterMode: 1, Shading: 16, TextureID: 0, CoordId: 0, Alpha: 1 };

test("a model whose layer leaves its texture animation unset is refused, because the writer stores animation 0 and Warcraft reads it on the first draw [k2 property]", () => {
  const bytes = model([layer], 0);
  expect(parseModelMDX(bytes.buffer as ArrayBuffer).Materials[0]?.Layers[0]?.TVertexAnimId).toBe(0);
  expect(layerReferenceProblem(bytes)).toBe("material 0 layer 0 names texture animation 0 of 0");
  expect(shippedLayerProblem([{ entry: "war3mapImported\\Probe.mdx", bytes: () => bytes }])).toContain("war3mapImported\\Probe.mdx: material 0 layer 0");
});

test("a layer with no texture animation, or one the model holds, passes, and only models are read [k2 property]", () => {
  expect(layerReferenceProblem(model([{ ...layer, TVertexAnimId: null }], 0))).toBeUndefined();
  expect(layerReferenceProblem(model([{ ...layer, TVertexAnimId: 0 }], 1))).toBeUndefined();
  expect(layerReferenceProblem(model([{ ...layer, TVertexAnimId: 1 }], 1))).toBe("material 0 layer 0 names texture animation 1 of 1");
  expect(layerReferenceProblem(model([{ ...layer, TVertexAnimId: null, TextureID: 1 }], 0))).toBe("material 0 layer 0 names texture 1 of 1");
  expect(shippedLayerProblem([{ entry: "war3mapImported\\Probe.blp", bytes: () => model([layer], 0) }])).toBeUndefined();
});
