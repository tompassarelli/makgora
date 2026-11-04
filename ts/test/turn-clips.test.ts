import { expect, test } from "bun:test";
import type { model as mdx } from "war3-model";
import { turnClip } from "../../tools/animations/turn-clips";

type Vec = readonly [number, number, number];
type Quat = readonly [number, number, number, number];

function rotate([x, y, z, w]: Quat, [vx, vy, vz]: Vec): Vec {
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

function placed(pivot: Vec, translation: Vec, rotation: Quat, point: Vec): Vec {
  const local: Vec = [point[0] - pivot[0], point[1] - pivot[1], point[2] - pivot[2]];
  const [x, y, z] = rotate(rotation, local);
  return [x + pivot[0] + translation[0], y + pivot[1] + translation[1], z + pivot[2] + translation[2]];
}

const key = (Frame: number, vector: readonly number[]): mdx.AnimKeyframe => ({ Frame, Vector: Float32Array.from(vector) });

function clipModel(): mdx.Model {
  const yawed: Quat = [0, 0, Math.sin(0.35), Math.cos(0.35)];
  const root = {
    Name: "root", ObjectId: 0, Parent: undefined, PivotPoint: Float32Array.of(4, -3, 70),
    Rotation: { LineType: 1, Keys: [key(0, [0, 0, 0, 1]), key(100, yawed), key(200, [0.1, 0, 0, Math.sqrt(0.99)])] },
    Translation: { LineType: 1, Keys: [key(0, [0, 0, 0]), key(100, [5, 2, 1]), key(200, [7, -1, 0])] },
  };
  const child = { Name: "hand", ObjectId: 1, Parent: 0, PivotPoint: Float32Array.of(10, 8, 90) };
  const extent = () => ({ MinimumExtent: Float32Array.of(-10, -20, 0), MaximumExtent: Float32Array.of(30, 20, 100) });
  return {
    Nodes: [root, child],
    Sequences: [{ Name: "Stand", Interval: Uint32Array.of(0, 100), ...extent() }, { Name: "Walk", Interval: Uint32Array.of(200, 300), ...extent() }],
    Geosets: [{ Anims: [extent(), extent()] }],
  } as unknown as mdx.Model;
}

function rootPose(model: mdx.Model, at: number): { readonly pivot: Vec; readonly translation: Vec; readonly rotation: Quat } {
  const root = model.Nodes[0]!;
  const [px = 0, py = 0, pz = 0] = root.PivotPoint!;
  const [tx = 0, ty = 0, tz = 0] = root.Translation!.Keys[at]!.Vector;
  const [x = 0, y = 0, z = 0, w = 1] = root.Rotation!.Keys[at]!.Vector;
  return { pivot: [px, py, pz], translation: [tx, ty, tz], rotation: [x, y, z, w] };
}

test("turning a clip yaws every point its root carries about the model's vertical axis by the given degrees on each of that clip's keys, keeps heights, and leaves other clips' keys unchanged [k2 property]", () => {
  const degrees = -95;
  const before = clipModel(), after = clipModel();
  expect(turnClip(after, { sequence: 0, degrees })).toEqual(["root"]);
  const angle = (degrees * Math.PI) / 180, c = Math.cos(angle), s = Math.sin(angle);
  const points: Vec[] = [[10, 8, 90], [-6, 12, 40], [4, -3, 70]];
  for (const at of [0, 1]) {
    const was = rootPose(before, at), now = rootPose(after, at);
    for (const point of points) {
      const [x, y, z] = placed(was.pivot, was.translation, was.rotation, point);
      const turned = placed(now.pivot, now.translation, now.rotation, point);
      expect(turned[0]).toBeCloseTo(c * x - s * y, 3);
      expect(turned[1]).toBeCloseTo(s * x + c * y, 3);
      expect(turned[2]).toBeCloseTo(z, 3);
    }
  }
  expect(rootPose(after, 2)).toEqual(rootPose(before, 2));
  expect(after.Sequences[1]).toEqual(before.Sequences[1]);
  const box = after.Sequences[0]!;
  for (const [x, y] of [[-10, -20], [-10, 20], [30, -20], [30, 20]] as const) {
    expect(c * x - s * y).toBeGreaterThanOrEqual(box.MinimumExtent[0]! - 1e-3);
    expect(c * x - s * y).toBeLessThanOrEqual(box.MaximumExtent[0]! + 1e-3);
    expect(s * x + c * y).toBeGreaterThanOrEqual(box.MinimumExtent[1]! - 1e-3);
    expect(s * x + c * y).toBeLessThanOrEqual(box.MaximumExtent[1]! + 1e-3);
  }
});
