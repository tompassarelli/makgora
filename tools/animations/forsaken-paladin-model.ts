import { mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Effect, Schema } from 'effect';
import { BunRuntime } from '@effect/platform-bun';
import { vec3 } from 'gl-matrix';
import { model as mdx } from '../../ts/scripts/clipNodes';
import { checkBodySkin, generateHdBody, parseHdBody } from './hd-retarget';

export const FORSAKEN_HAMMER_TEXTURE = 'ForsakenPaladinHammerSteel.tga';

interface MeshData { vertices: number[]; normals: number[]; faces: number[]; uv: number[] }
const meshData = (): MeshData => ({ vertices: [], normals: [], faces: [], uv: [] });

function face(mesh: MeshData, points: readonly vec3[], tile: number): void {
    const start = mesh.vertices.length / 3;
    const normal = vec3.normalize(vec3.create(), vec3.cross(vec3.create(),
        vec3.subtract(vec3.create(), points[1], points[0]), vec3.subtract(vec3.create(), points[2], points[0])));
    const left = (tile % 2) * 0.5 + 0.025, top = Math.floor(tile / 2) * 0.5 + 0.025;
    const corners = [[left, top], [left + 0.45, top], [left + 0.45, top + 0.45], [left, top + 0.45]];
    for (const [index, point] of points.entries()) {
        mesh.vertices.push(...point); mesh.normals.push(...normal); mesh.uv.push(...corners[index % 4]);
    }
    for (let index = 1; index < points.length - 1; index++) mesh.faces.push(start, start + index, start + index + 1);
}

function palette(): Uint8Array {
    const size = 64, bytes = new Uint8Array(18 + size * size * 4), header = new DataView(bytes.buffer);
    bytes[2] = 2; header.setUint16(12, size, true); header.setUint16(14, size, true); bytes[16] = 32; bytes[17] = 0x28;
    const colors = [[144, 157, 165], [168, 123, 48], [49, 42, 34], [215, 186, 107]];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const tile = Math.floor(x / 32) + Math.floor(y / 32) * 2, color = colors[tile];
        const line = x % 32 < 3 || x % 32 > 28 || y % 32 < 3 || y % 32 > 28;
        const grain = ((x * 13 + y * 7) % 11) - 5, light = line ? 24 : grain + (31 - y % 32) / 3;
        const offset = 18 + (y * size + x) * 4;
        bytes[offset] = Math.min(255, color[2] + light); bytes[offset + 1] = Math.min(255, color[1] + light);
        bytes[offset + 2] = Math.min(255, color[0] + light); bytes[offset + 3] = 255;
    }
    return bytes;
}

function geoset(source: mdx.Geoset, mesh: MeshData, bone: number, material: number, name: string): mdx.Geoset {
    const result = structuredClone(source), count = mesh.vertices.length / 3;
    result.Name = name; result.Vertices = Float32Array.from(mesh.vertices); result.Normals = Float32Array.from(mesh.normals);
    result.Faces = Uint16Array.from(mesh.faces); result.TVertices = [Float32Array.from(mesh.uv)];
    result.VertexGroup = new Uint8Array(count); result.Groups = [[bone]]; result.TotalGroupsCount = 1;
    result.SkinWeights = new Uint8Array(count * 8);
    for (let index = 0; index < count; index++) { result.SkinWeights[index * 8] = bone; result.SkinWeights[index * 8 + 4] = 255; }
    result.MaterialID = material;
    result.MinimumExtent = Float32Array.from([0, 1, 2].map(axis => Math.min(...mesh.vertices.filter((_, index) => index % 3 === axis))));
    result.MaximumExtent = Float32Array.from([0, 1, 2].map(axis => Math.max(...mesh.vertices.filter((_, index) => index % 3 === axis))));
    result.BoundsRadius = vec3.length(vec3.subtract(vec3.create(), result.MaximumExtent, result.MinimumExtent)) / 2;
    return result;
}

export function authorForsakenHammer(source: mdx.Model): { model: mdx.Model; head: readonly number[]; triangles: number } {
    const model = structuredClone(source), weapon = model.Nodes.find(node => node?.Name === 'Wep01_R0_0_jnt');
    const reference = model.Nodes.find(node => node?.Name === 'Weapon Ref');
    const sword = model.Geosets.findIndex(mesh => mesh.Name?.includes('_Sword'));
    if (weapon === undefined || reference === undefined || sword < 0) throw new Error('Expected the canonical Forsaken sword rig');
    const grip = model.PivotPoints[weapon.ObjectId], head = model.PivotPoints[reference.ObjectId];
    const axis = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), head, grip));
    const across = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), axis, vec3.fromValues(0, 0, 1)));
    const depth = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), across, axis));
    const steel = meshData(), team = meshData();
    const point = (center: vec3, along: number, side: number, back: number) => {
        const result = vec3.clone(center); vec3.scaleAndAdd(result, result, axis, along);
        vec3.scaleAndAdd(result, result, across, side); return vec3.scaleAndAdd(result, result, depth, back);
    };
    const box = (mesh: MeshData, center: vec3, a: number, b: number, c: number, tile: number) => {
        const p = [point(center, -a, -b, -c), point(center, a, -b, -c), point(center, a, b, -c), point(center, -a, b, -c),
            point(center, -a, -b, c), point(center, a, -b, c), point(center, a, b, c), point(center, -a, b, c)];
        for (const indices of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]) {
            face(mesh, indices.map(index => p[index]), tile);
        }
    };
    const length = vec3.distance(grip, head), shaft = vec3.scaleAndAdd(vec3.create(), grip, axis, (length - 9) / 2 - 5);
    box(steel, shaft, (length - 9) / 2 + 5, 2.6, 2.6, 2);
    box(steel, point(grip, -8, 0, 0), 2.7, 4, 4, 1);
    box(steel, point(head, -11, 0, 0), 2.6, 5.2, 5.2, 3);
    const outline = [[-9, -5], [-6, -8], [6, -8], [9, -5], [9, 5], [6, 8], [-6, 8], [-9, 5]];
    const ends = [-17, 17].map(side => outline.map(([along, back]) => point(head, along, side, back)));
    face(steel, [...ends[0]].reverse(), 1); face(steel, ends[1], 1);
    for (let index = 0; index < outline.length; index++) {
        const next = (index + 1) % outline.length;
        face(steel, [ends[0][index], ends[0][next], ends[1][next], ends[1][index]], index % 2 === 0 ? 0 : 3);
    }
    for (const side of [-11.5, 11.5]) box(team, point(head, 0, side, 0), 9.15, 1.25, 8.15, 0);
    box(steel, point(head, 0, 0, 8.4), 5.5, 1.7, 0.8, 3);
    box(steel, point(head, 0, 0, 8.4), 1.7, 5.5, 0.8, 3);
    box(steel, point(head, 0, 0, -8.4), 5.5, 1.7, 0.8, 3);
    box(steel, point(head, 0, 0, -8.4), 1.7, 5.5, 0.8, 3);
    const template = model.Geosets[sword];
    const texture = model.Textures.push({ Image: `war3mapImported\\${FORSAKEN_HAMMER_TEXTURE}`, ReplaceableId: 0, Flags: 0 }) - 1;
    const material = structuredClone(model.Materials[template.MaterialID]);
    material.Layers = [structuredClone(material.Layers[material.Layers.length - 1])];
    Object.assign(material.Layers[0], { FilterMode: 0, TextureID: texture, Alpha: 1, Shading: 0 });
    const steelMaterial = model.Materials.push(material) - 1;
    const teamMaterial = structuredClone(material); teamMaterial.Layers[0].TextureID = model.Textures.findIndex(texture => texture.ReplaceableId === 1);
    if (teamMaterial.Layers[0].TextureID < 0) throw new Error('Forsaken team-color texture missing');
    const teamIndex = model.Materials.push(teamMaterial) - 1;
    model.Geosets[sword] = geoset(template, steel, weapon.ObjectId, steelMaterial, 'ForsakenPaladin_Hammer');
    const teamGeoset = model.Geosets.push(geoset(template, team, weapon.ObjectId, teamIndex, 'ForsakenPaladin_HammerTeam')) - 1;
    const visibility = model.GeosetAnims.find(animation => animation.GeosetId === sword);
    if (visibility !== undefined) model.GeosetAnims.push({ ...structuredClone(visibility), GeosetId: teamGeoset });
    return { model, head: Array.from(head), triangles: (steel.faces.length + team.faces.length) / 3 };
}

class HammerFailure extends Schema.TaggedError<HammerFailure>()('HammerFailure', { cause: Schema.Unknown }) {}

if (import.meta.main) BunRuntime.runMain(Effect.tryPromise({ try: async () => {
    const [input, outputArg] = process.argv.slice(2);
    if (input === undefined || outputArg === undefined) throw new Error('usage: bun tools/animations/forsaken-paladin-model.ts AUTHORED_FORSAKEN.mdx PRIVATE_OUTPUT.mdx');
    const output = resolve(outputArg);
    if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('Authored model stays in private storage');
    const source = parseHdBody(await Bun.file(input).arrayBuffer()), result = authorForsakenHammer(source);
    const bytes = generateHdBody(result.model), decoded = parseHdBody(bytes);
    if (!isDeepStrictEqual(decoded.Nodes, source.Nodes) || !isDeepStrictEqual(decoded.PivotPoints, source.PivotPoints)
        || !isDeepStrictEqual(decoded.Sequences, source.Sequences)) throw new Error('Hammer changed the canonical rig or motion');
    for (let index = 0; index < source.Geosets.length; index++) {
        if (source.Geosets[index].Name?.includes('_Sword')) continue;
        if (!isDeepStrictEqual(source.Geosets[index], decoded.Geosets[index])) throw new Error(`Hammer changed body geoset ${index}`);
    }
    const skin = checkBodySkin({ ...decoded, Geosets: decoded.Geosets.filter(mesh => mesh.SkinWeights !== undefined) });
    await mkdir(dirname(output), { recursive: true }); await Bun.write(output, bytes);
    await Bun.write(join(dirname(output), FORSAKEN_HAMMER_TEXTURE), palette());
    const receipt = { input, output, hash: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
        rigNodes: decoded.Nodes.length, sequences: decoded.Sequences.length, hammerHead: result.head, hammerTriangles: result.triangles, skin };
    await Bun.write(join(dirname(output), 'forsaken-paladin-model.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt));
}, catch: cause => new HammerFailure({ cause }) }));
