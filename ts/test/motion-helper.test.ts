import { expect, test } from "bun:test";
import type { model as mdx } from "../scripts/clipNodes";
import { ensureMotionHelper } from "../scripts/motionHelper";

const bone = (ObjectId: number, Parent: number | null) => ({ Name: `b${ObjectId}`, ObjectId, Parent, Flags: 0, PivotPoint: new Float32Array(3) }) as unknown as mdx.Bone;

test("ensureMotionHelper adds one root helper however often a model is re-authored, so jump-clips output is byte-stable (#75) [k2 property]", () => {
  const model = { Bones: [bone(0, null), bone(1, 0)], Helpers: [], Attachments: [], Nodes: [] as mdx.Node[], PivotPoints: [] as Float32Array[] } as unknown as mdx.Model;
  model.Nodes.push(...model.Bones);
  const sequences = [{ Interval: new Uint32Array([0, 1000]) }];
  const first = ensureMotionHelper(model, "Double Jump Motion", [0, 0, 50], sequences);
  const snapshot = JSON.stringify([model.Nodes.map((n) => [n.Name, n.ObjectId, n.Parent]), model.Helpers.length, first.Rotation?.Keys.length]);
  for (let run = 0; run < 3; run++) expect(ensureMotionHelper(model, "Double Jump Motion", [0, 0, 50], sequences)).toBe(first);
  expect(JSON.stringify([model.Nodes.map((n) => [n.Name, n.ObjectId, n.Parent]), model.Helpers.length, first.Rotation?.Keys.length])).toBe(snapshot);
  expect(model.Bones[0]!.Parent).toBe(first.ObjectId);
  expect(model.Bones[1]!.Parent).toBe(0);
});
