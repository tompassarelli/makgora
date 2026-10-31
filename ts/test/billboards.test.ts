import { expect, test } from "bun:test";
import { nodeFlags, restoreBillboards } from "../../tools/animations/billboards";

const NODE_BYTES = 96;

function mdx(bones: [string, number][], helpers: [string, number][]): Uint8Array {
  const chunk = (tag: string, nodes: [string, number][], trailer: number) => {
    const body = new Uint8Array(nodes.length * (NODE_BYTES + trailer));
    const view = new DataView(body.buffer);
    nodes.forEach(([name, flags], index) => {
      const at = index * (NODE_BYTES + trailer);
      view.setUint32(at, NODE_BYTES, true);
      body.set(new TextEncoder().encode(name), at + 4);
      view.setInt32(at + 84, index, true);
      view.setInt32(at + 88, -1, true);
      view.setUint32(at + 92, flags, true);
    });
    const head = new Uint8Array(8);
    head.set(new TextEncoder().encode(tag));
    new DataView(head.buffer).setUint32(4, body.length, true);
    return [head, body];
  };
  const parts = [new TextEncoder().encode("MDLX"), ...chunk("BONE", bones, 8), ...chunk("HELP", helpers, 0)];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  parts.reduce((at, part) => (out.set(part, at), at + part.length), 0);
  return out;
}

test("an authored fighter gets back the stock model's billboard flags by node name, and nothing else changes (Illidan's glow quads stood fixed after the Blender round trip) [k2 property]", () => {
  const stock = mdx([["heroglowtall", 256 | 64], ["Plane27", 256 | 8], ["Bone_Head", 256]], [["Glow Helper", 8]]);
  const authored = mdx([["Bone_Head", 256], ["Plane27", 256], ["heroglowtall", 256], ["Authored Only", 256]], [["Glow Helper", 0]]);
  const { bytes, restored } = restoreBillboards(authored, stock);
  expect(restored).toEqual(["Plane27", "heroglowtall", "Glow Helper"]);
  expect(nodeFlags(bytes).map(({ name, flags }) => [name, flags])).toEqual([["Bone_Head", 256], ["Plane27", 264], ["heroglowtall", 320], ["Authored Only", 256], ["Glow Helper", 8]]);
  expect(bytes.length).toBe(authored.length);
  expect(restoreBillboards(bytes, stock).restored).toEqual([]);
});
