const TEXTURE_RECORD_BYTES = 268;
const LAYER_TAG_OFFSETS = [12, 92];
const NONE = 0xffffffff;

export interface ShippedFile {
  readonly entry: string;
  readonly bytes: () => Uint8Array;
}

interface Chunk { readonly start: number; readonly size: number }

const tagAt = (model: Uint8Array, at: number) => String.fromCharCode(model[at] ?? 0, model[at + 1] ?? 0, model[at + 2] ?? 0, model[at + 3] ?? 0);

function chunks(model: Uint8Array): Map<string, Chunk> | undefined {
  const tag = (at: number) => tagAt(model, at);
  if (tag(0) !== "MDLX") return undefined;
  const view = new DataView(model.buffer, model.byteOffset, model.byteLength);
  const found = new Map<string, Chunk>();
  for (let at = 4; at + 8 <= model.length;) {
    const size = view.getUint32(at + 4, true);
    found.set(tag(at), { start: at + 8, size });
    at += 8 + size;
  }
  return found;
}

function textureAnimationCount(view: DataView, chunk: Chunk | undefined): number {
  if (chunk === undefined) return 0;
  let count = 0;
  for (let at = chunk.start; at < chunk.start + chunk.size; at += view.getUint32(at, true)) count++;
  return count;
}

export function layerReferenceProblem(model: Uint8Array): string | undefined {
  const found = chunks(model);
  const materials = found?.get("MTLS");
  if (found === undefined || materials === undefined) return undefined;
  const view = new DataView(model.buffer, model.byteOffset, model.byteLength);
  const tag = (at: number) => tagAt(model, at);
  const version = found.has("VERS") ? view.getUint32(found.get("VERS")?.start ?? 0, true) : 800;
  const textures = (found.get("TEXS")?.size ?? 0) / TEXTURE_RECORD_BYTES;
  const animations = textureAnimationCount(view, found.get("TXAN"));
  let material = 0;
  for (let at = materials.start; at < materials.start + materials.size; material++) {
    const size = view.getUint32(at, true);
    const layersAt = LAYER_TAG_OFFSETS.map((offset) => at + offset).find((place) => tag(place) === "LAYS");
    if (layersAt === undefined) return `material ${material} has no layer list`;
    let layer = layersAt + 4;
    const layers = view.getUint32(layer, true);
    layer += 4;
    for (let index = 0; index < layers; index++) {
      const texture = view.getUint32(layer + 12, true), animation = view.getUint32(layer + 16, true);
      if (version < 1100 && texture >= textures) return `material ${material} layer ${index} names texture ${texture} of ${textures}`;
      if (animation !== NONE && animation >= animations) return `material ${material} layer ${index} names texture animation ${animation} of ${animations}`;
      layer += view.getUint32(layer, true);
    }
    at += size;
  }
  return undefined;
}

// Warcraft dereferences a layer's texture animation when it draws the model, so a missing one crashed Classic on Onyxia's dragon (makgora#938).
export function shippedLayerProblem(files: readonly ShippedFile[]): string | undefined {
  for (const file of files) {
    if (!file.entry.toLowerCase().endsWith(".mdx")) continue;
    const problem = layerReferenceProblem(file.bytes());
    if (problem !== undefined) return `${file.entry}: ${problem}; a converter must write TVertexAnimId -1 for a layer without one`;
  }
  return undefined;
}
