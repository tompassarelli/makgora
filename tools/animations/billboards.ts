// Restores the billboard flags of an authored fighter's nodes from the stock model it came from: the Blender round trip writes every node as a plain bone, so glow quads that Warcraft turns toward the camera stood fixed in the model instead.
const BILLBOARD_BITS = 8 | 16 | 32 | 64;
const NAME_LENGTH = 80;
const NODE_CHUNKS: Record<string, number> = { BONE: 8, HELP: 0 };

export interface NodeFlags {
  readonly name: string;
  readonly flags: number;
  readonly offset: number;
}

const text = (view: DataView, at: number, length: number) => {
  let out = "";
  for (let index = 0; index < length; index++) {
    const code = view.getUint8(at + index);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
};

export function nodeFlags(bytes: Uint8Array): NodeFlags[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nodes: NodeFlags[] = [];
  for (let at = 4; at + 8 <= view.byteLength;) {
    const tag = text(view, at, 4), size = view.getUint32(at + 4, true), end = at + 8 + size;
    const trailer = NODE_CHUNKS[tag];
    if (trailer !== undefined) {
      for (let entry = at + 8; entry < end;) {
        const inclusive = view.getUint32(entry, true);
        nodes.push({ name: text(view, entry + 4, NAME_LENGTH), flags: view.getUint32(entry + 92, true), offset: entry + 92 });
        entry += inclusive + trailer;
      }
    }
    at = end;
  }
  return nodes;
}

export function restoreBillboards(authored: Uint8Array, stock: Uint8Array): { bytes: Uint8Array<ArrayBuffer>; restored: string[] } {
  const wanted = new Map(nodeFlags(stock).filter(({ flags }) => flags & BILLBOARD_BITS).map(({ name, flags }) => [name, flags & BILLBOARD_BITS]));
  const bytes = authored.slice();
  const view = new DataView(bytes.buffer);
  const restored: string[] = [];
  for (const node of nodeFlags(bytes)) {
    const bits = wanted.get(node.name);
    if (bits === undefined || (node.flags & BILLBOARD_BITS) === bits) continue;
    view.setUint32(node.offset, (node.flags & ~BILLBOARD_BITS) | bits, true);
    restored.push(node.name);
  }
  return { bytes, restored };
}

if (import.meta.main) {
  const [stockPath, authoredPath, outPath = authoredPath] = process.argv.slice(2);
  if (stockPath === undefined || authoredPath === undefined) throw new Error("usage: bun tools/animations/billboards.ts STOCK.mdx AUTHORED.mdx [OUT.mdx]");
  const { bytes, restored } = restoreBillboards(await Bun.file(authoredPath).bytes(), await Bun.file(stockPath).bytes());
  await Bun.write(outPath, bytes);
  console.log("BILLBOARDS_RESTORED", restored.length, restored.join(","));
}
