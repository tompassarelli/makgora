import { model as mdx } from "./clipNodes";

export function ensureMotionHelper(model: mdx.Model, name: string, pivot: readonly number[], sequences: readonly { readonly Interval: ArrayLike<number> }[]): mdx.Helper {
  const existing = model.Helpers.find(node => node.Name === name);
  if (existing) return existing;
  const root = model.Nodes.length;
  const helper: mdx.Helper = { Name: name, ObjectId: root, Parent: null, Flags: 0, PivotPoint: new Float32Array(pivot), Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
  for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments]) if (node.Parent == null) node.Parent = root;
  model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);
  for (const sequence of sequences) for (const Frame of Array.from(sequence.Interval)) helper.Rotation?.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0, 1]) });
  return helper;
}
