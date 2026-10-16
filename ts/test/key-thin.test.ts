import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { model as mdx } from "../scripts/clipNodes";
import { KEY_BOUND, slopeTangents } from "../scripts/keyThin";
import { clipJitter, jitters } from "../scripts/wisp/animJitter";

function staleRoot(seed: number): mdx.Model {
  let state = seed;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const keys: mdx.AnimKeyframe[] = [];
  let value = [random() * 20 - 10, random() * 20 - 10, random() * 20 - 10];
  for (let index = 0; index < 40; index++) {
    value = value.map((axis) => axis + random() * 2 - 1);
    const handle = Float32Array.from(value);
    const lift = random() < 0.5 ? random() * 3 : 0;
    const vector = Float32Array.from(value.map((axis, at) => at === 2 ? axis + lift : axis));
    keys.push({ Frame: 1000 + index * 17, Vector: vector, InTan: handle, OutTan: handle.slice() });
  }
  const root = { Name: "Bone_Root", ObjectId: 0, Parent: -1, Flags: 0, Translation: { LineType: mdx.LineType.Hermite, GlobalSeqId: null, Keys: keys } };
  return { Sequences: [{ Name: "Attack", Interval: new Uint32Array([1000, 1000 + 39 * 17]) }], Bones: [root], Helpers: [], Attachments: [], CollisionShapes: [] } as unknown as mdx.Model;
}

test("slope tangents leave no close-key translation segment past the jitter limit, whatever stale handles a generator wrote (#4) [k2 property]", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const model = staleRoot(seed);
    const repaired = slopeTangents(model);
    const [from, to] = model.Sequences[0]!.Interval;
    expect(jitters(clipJitter(repaired, from!, to!)), `seed ${seed}`).toBe(false);
    expect(repaired.Bones[0]!.Translation!.Keys.map((key) => Array.from(key.Vector)), `seed ${seed}`).toEqual(model.Bones[0]!.Translation!.Keys.map((key) => Array.from(key.Vector)));
  }
});

const RETIRED_TANGENT_POLICIES = ["slope"];

const TANGENT_POLICY = { tangents: "slope-jitter", implementation: "2625c68e50e1de9fe62bad0ee2fbd5189ee43e4b211cef05cdc9e8f91439d024" };

test("a thinKeys change renames KEY_BOUND's tangent policy, so export-original-clips --keep-unchanged re-exports every fighter instead of keeping keys the producer no longer makes [k3 measure docs/typescript.md]", () => {
  const implementation = new Bun.CryptoHasher("sha256").update(["keyThin.ts", "wisp/animJitter.ts"].map((file) => readFileSync(join(import.meta.dir, "../scripts", file), "utf8")).join("")).digest("hex");
  expect(RETIRED_TANGENT_POLICIES, "a retired tangent policy name came back").not.toContain(KEY_BOUND.tangents);
  expect({ tangents: KEY_BOUND.tangents, implementation }, "thinKeys changed: retire KEY_BOUND.tangents into RETIRED_TANGENT_POLICIES, name the new policy, and record it here").toEqual(TANGENT_POLICY);
});
