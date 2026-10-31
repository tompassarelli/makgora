import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseModelMDX } from '../../ts/scripts/mdxCodec';
import { generateMDX, renumberNodes } from '../../ts/scripts/clipNodes';
import { encodeBlp, type Rgba } from '../../ts/scripts/blp';

const [source, textures, destination, prefix, ...flags] = Bun.argv.slice(2);
if (!source || !textures || !destination || !prefix) throw new Error('usage: hd-to-classic.ts HD.mdx TEXTURE_DIR OUT_DIR PREFIX [--lift Z] [--keep Seq]...');
const option = (name: string): string | undefined => flags[flags.indexOf(name) + 1];
const lift = Number(option('--lift') ?? 0);
const QUALITY = 85;
const WEIGHT_FLOOR = 64;
const MAX_BONES = 3;

function decodeDds(bytes: Uint8Array): Rgba {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const height = view.getUint32(12, true), width = view.getUint32(16, true);
    const fourCc = new TextDecoder().decode(bytes.subarray(84, 88));
    if (fourCc !== 'DXT1' && fourCc !== 'DXT5') throw new Error(`unsupported DDS format ${fourCc}`);
    const data = new Uint8Array(width * height * 4);
    const colour = (value: number): number[] => {
        const r = (value >> 11) & 31, g = (value >> 5) & 63, b = value & 31;
        return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
    };
    const block = fourCc === 'DXT1' ? 8 : 16;
    let offset = 128;
    for (let by = 0; by < height; by += 4) for (let bx = 0; bx < width; bx += 4) {
        const alphas = new Uint8Array(16).fill(255);
        let colourAt = offset;
        if (fourCc === 'DXT5') {
            const a0 = bytes[offset] ?? 0, a1 = bytes[offset + 1] ?? 0;
            const table = a0 > a1
                ? [a0, a1, ...Array.from({ length: 6 }, (_, i) => ((6 - i) * a0 + (i + 1) * a1) / 7)]
                : [a0, a1, ...Array.from({ length: 4 }, (_, i) => ((4 - i) * a0 + (i + 1) * a1) / 5), 0, 255];
            let bits = 0n;
            for (let i = 0; i < 6; i++) bits |= BigInt(bytes[offset + 2 + i] ?? 0) << BigInt(8 * i);
            for (let i = 0; i < 16; i++) alphas[i] = Math.round(table[Number((bits >> BigInt(3 * i)) & 7n)] ?? 0);
            colourAt += 8;
        }
        const c0 = view.getUint16(colourAt, true), c1 = view.getUint16(colourAt + 2, true), indices = view.getUint32(colourAt + 4, true);
        const p0 = colour(c0), p1 = colour(c1);
        const palette = [p0, p1,
            c0 > c1 || fourCc === 'DXT5' ? p0.map((v, i) => Math.round((2 * v + (p1[i] ?? 0)) / 3)) : p0.map((v, i) => Math.round((v + (p1[i] ?? 0)) / 2)),
            c0 > c1 || fourCc === 'DXT5' ? p0.map((v, i) => Math.round((v + 2 * (p1[i] ?? 0)) / 3)) : [0, 0, 0]];
        for (let i = 0; i < 16; i++) {
            const x = bx + (i & 3), y = by + (i >> 2), rgb = palette[(indices >> (2 * i)) & 3] ?? [0, 0, 0], to = (y * width + x) * 4;
            data[to] = rgb[0] ?? 0; data[to + 1] = rgb[1] ?? 0; data[to + 2] = rgb[2] ?? 0;
            data[to + 3] = fourCc === 'DXT5' ? alphas[i] ?? 255 : (c0 <= c1 && ((indices >> (2 * i)) & 3) === 3 ? 0 : 255);
        }
        offset += block;
    }
    return { width, height, data, alpha: fourCc === 'DXT5' };
}

const model = parseModelMDX(await Bun.file(source).arrayBuffer());
mkdirSync(destination, { recursive: true });

const diffuseOf = (material: typeof model.Materials[number]): number => {
    const id = material.Layers[0]?.TextureID;
    if (typeof id !== 'number') throw new Error('material without a static diffuse texture');
    return id;
};
const written = new Map<number, string>();
const outputTextures: { Image: string; ReplaceableId: number; Flags: number }[] = [];
for (const material of model.Materials) {
    const id = diffuseOf(material);
    if (written.has(id)) continue;
    const image = model.Textures[id]?.Image ?? '';
    const name = `${prefix}${image.replace(/^.*[\\/]/, '').replace(/^onyxia_/i, '').replace(/_diffuse\.dds$/i, '').replace(/^./, (c) => c.toUpperCase())}.blp`;
    const dds = decodeDds(new Uint8Array(await Bun.file(join(textures, image.replace(/^.*[\\/]/, ''))).arrayBuffer()));
    await Bun.write(join(destination, name), encodeBlp(dds, QUALITY));
    written.set(id, name);
    outputTextures.push({ Image: name, ReplaceableId: 0, Flags: 3 });
}
const textureIndex = (id: number): number => outputTextures.findIndex((texture) => texture.Image === written.get(id));

for (const material of model.Materials) {
    const first = material.Layers[0]!;
    const filter = material.Layers.length > 0 && (first.FilterMode ?? 0) === 0 ? 0 : first.FilterMode ?? 0;
    delete material.Shader;
    material.Layers = [{ FilterMode: filter, Shading: first.Shading ?? 0, TextureID: textureIndex(diffuseOf(material)), CoordId: 0, ...(first.Alpha !== undefined ? { Alpha: first.Alpha } : {}) }];
}
model.Textures = outputTextures;
model.Version = 800;
model.ParticleEmitters = []; model.ParticleEmitters2 = []; model.ParticleEmitterPopcorns = []; model.RibbonEmitters = [];
model.Lights = []; model.EventObjects = []; model.Cameras = []; model.CollisionShapes = [];
delete model.FaceFX; delete model.BindPoses;

let singles = 0;
for (const geoset of model.Geosets) {
    const skin = geoset.SkinWeights;
    if (skin === undefined) throw new Error(`${geoset.Name}: no skin weights`);
    const count = geoset.Vertices.length / 3;
    const groups: number[][] = [];
    const lookup = new Map<string, number>();
    geoset.VertexGroup = new Uint8Array(count);
    for (let v = 0; v < count; v++) {
        const influences = [0, 1, 2, 3].map((i) => ({ bone: skin[v * 8 + i] ?? 0, weight: skin[v * 8 + 4 + i] ?? 0 }))
            .filter((influence) => influence.weight > 0).sort((a, b) => b.weight - a.weight);
        const kept = influences.filter((influence, i) => i === 0 || influence.weight >= WEIGHT_FLOOR).slice(0, MAX_BONES).map((influence) => influence.bone).sort((a, b) => a - b);
        if (kept.length === 1) singles++;
        const key = kept.join(',');
        let group = lookup.get(key);
        if (group === undefined) { group = groups.length; groups.push(kept); lookup.set(key, group); }
        geoset.VertexGroup[v] = group;
    }
    if (groups.length > 255) throw new Error(`${geoset.Name}: ${groups.length} matrix groups`);
    geoset.Groups = groups;
    geoset.TotalGroupsCount = groups.reduce((sum, group) => sum + group.length, 0);
    delete geoset.SkinWeights; delete geoset.Tangents;
    for (let i = 2; i < geoset.Vertices.length; i += 3) geoset.Vertices[i] = (geoset.Vertices[i] ?? 0) + lift;
    geoset.MinimumExtent[2] = (geoset.MinimumExtent[2] ?? 0) + lift; geoset.MaximumExtent[2] = (geoset.MaximumExtent[2] ?? 0) + lift;
    for (const anim of geoset.Anims) { anim.MinimumExtent[2] = (anim.MinimumExtent[2] ?? 0) + lift; anim.MaximumExtent[2] = (anim.MaximumExtent[2] ?? 0) + lift; }
}
for (const sequence of model.Sequences) { sequence.MinimumExtent[2] = (sequence.MinimumExtent[2] ?? 0) + lift; sequence.MaximumExtent[2] = (sequence.MaximumExtent[2] ?? 0) + lift; }
model.Info.MinimumExtent[2] = (model.Info.MinimumExtent[2] ?? 0) + lift; model.Info.MaximumExtent[2] = (model.Info.MaximumExtent[2] ?? 0) + lift;
for (const pivot of model.PivotPoints) pivot[2] = (pivot[2] ?? 0) + lift;

renumberNodes(model);
await Bun.write(join(destination, `${prefix}.mdx`), generateMDX(model));
console.log(`${prefix}.mdx: ${model.Geosets.length} geosets, ${model.Bones.length} bones, ${outputTextures.length} textures, ${singles} rigid vertices, lift ${lift}`);
