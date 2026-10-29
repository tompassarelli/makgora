import { expect, test } from "bun:test";
import { type model as mdx } from "../scripts/clipNodes";
import { BOB_LIMIT, bodyRoot, rootBob } from "../scripts/wisp/animJitter";

const bob = (frames: readonly number[]) => ({
  LineType: 0,
  GlobalSeqId: null,
  Keys: frames.map((Frame, at) => ({ Frame, Vector: Float32Array.from([0, 0, at % 2 === 0 ? 0 : 5]) })),
});

const still = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: Float32Array.from([0, 0, 0]) }, { Frame: 1000, Vector: Float32Array.from([0, 0, 0]) }] };

const FRAMES = [0, 16, 32, 48, 64];

function skeleton(bodyTrack: object, propTrack: object): mdx.Model {
  return {
    Bones: [
      { Name: "Prop", ObjectId: 0, Parent: null, Translation: propTrack },
      { Name: "Root", ObjectId: 1, Parent: null, Translation: bodyTrack },
      { Name: "Chest", ObjectId: 2, Parent: 1 },
    ],
    Helpers: [],
    Geosets: [{ Groups: [[0], [2]], VertexGroup: Uint8Array.from([0, 1, 1, 1, 1, 1]) }],
  } as unknown as mdx.Model;
}

test("a loose parentless prop that bobs is not the body root [k1 scenario]", () => {
  const model = skeleton(still, bob(FRAMES));
  expect(bodyRoot(model)).toBe(1);
  expect(rootBob(model, 0, 1000)).toBeUndefined();
});

test("a bobbing body root still fails the root bob limit [k1 scenario]", () => {
  const model = skeleton(bob(FRAMES), still);
  expect(rootBob(model, 0, 1000)?.node).toBe("Root");
  expect(rootBob(model, 0, 1000)!.excess).toBeGreaterThan(BOB_LIMIT);
});
