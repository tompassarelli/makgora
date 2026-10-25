import { parseMDL, generateMDX, parseMDX } from "../animations/node_modules/war3-model";
import { join } from "node:path";

const output = join(import.meta.dir, "../../build/impact-assets");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
type Point = [number, number];
type Shape = { points: Point[], tile: number };
const colors = [[255, 204, 72], [74, 38, 8], [255, 246, 200], [255, 226, 140]];
const texture = new Uint8Array(18 + 256 * 64 * 4);
texture[2] = 2; texture[13] = 1; texture[14] = 64; texture[16] = 32; texture[17] = 0x28;
for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) {
    const tile = Math.floor(x / 64);
    const radius = Math.hypot(((x % 64) + .5 - 32) / 32, (y + .5 - 32) / 32);
    const alpha = tile === 3 ? Math.round(255 * Math.max(0, 1 - radius * radius) ** 1.5) : 255;
    const [r, g, b] = colors[tile]!;
    texture.set([b!, g!, r!, alpha], 18 + (y * 256 + x) * 4);
}
const textureName = `AnkhPalette-${hash(texture)}.tga`;
const vector = (v: number[]) => `{ ${v.map((n) => +n.toFixed(4)).join(", ")} }`;

function ankh(grow: number, tile: number): Shape[] {
    const shapes: Shape[] = [];
    const g = grow;
    shapes.push({ points: [[-14 - g, -g], [14 + g, -g], [7 + g, 70 + g], [-7 - g, 70 + g]], tile });
    for (const side of [-1, 1]) {
        const arm: Point[] = [[side * (6 - g), 53 - g], [side * (47 + g), 44 - g], [side * (47 + g), 76 + g], [side * (6 - g), 67 + g]];
        shapes.push({ points: arm, tile });
    }
    const segments = 32;
    const loop = (angle: number, rx: number, rz: number): Point => {
        const taper = .78 + .22 * Math.sin(angle);
        return [rx * taper * Math.cos(angle), 99 + rz * Math.sin(angle)];
    };
    for (let i = 0; i < segments; i++) {
        const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
        shapes.push({ points: [loop(a, 14 - g, 21 - g), loop(a, 27 + g, 34 + g), loop(b, 27 + g, 34 + g), loop(b, 14 - g, 21 - g)], tile });
    }
    return shapes;
}

function rays(count: number, rx: number, rz: number): Shape[] {
    const result: Shape[] = [];
    for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count;
        const length = i % 2 === 0 ? 1 : .6;
        const a = angle - .26, b = angle + .26;
        const points: Point[] = [[rx * .18 * Math.cos(a), rz * .18 * Math.sin(a)], [rx * length * Math.cos(angle), rz * length * Math.sin(angle)], [rx * .18 * Math.cos(b), rz * .18 * Math.sin(b)], [0, 0]];
        result.push({ points: points.map(([x, z]) => [x * 1.12, z * 1.12]), tile: 3 });
        result.push({ points, tile: 2 });
    }
    result.push({ points: Array.from({ length: 24 }, (_, i) => [rx * .24 * Math.cos(i * Math.PI / 12), rz * .24 * Math.sin(i * Math.PI / 12)] as Point), tile: 2 });
    return result;
}

function ring(rx: number, rz: number): Shape[] {
    const result: Shape[] = [];
    const point = (angle: number, scale: number): Point => [rx * scale * Math.cos(angle), rz * scale * Math.sin(angle)];
    for (let i = 0; i < 48; i++) {
        const a = i * Math.PI / 24, b = (i + 1) * Math.PI / 24;
        result.push({ points: [point(a, .8), point(a, 1.06), point(b, 1.06), point(b, .8)], tile: 1 });
        result.push({ points: [point(a, .93), point(a, 1), point(b, 1), point(b, .93)], tile: 2 });
    }
    return result;
}

const halo: Shape = { points: [[-80, -20], [80, -20], [80, 150], [-80, 150]], tile: -1 };
type Part = { shapes: Shape[], material: number, depth: number, bone?: number };
type Effect = { name: string, parts: Part[], interval: number, extent: string, scaling: string[], looping: boolean };
const effects: Effect[] = [
    {
        name: "Ankh", interval: 1000, looping: true,
        extent: "MinimumExtent { -80, -2, -20 }, MaximumExtent { 80, 2, 150 }, BoundsRadius 120,",
        parts: [{ shapes: [halo], material: 1, depth: 1.2 }, { shapes: ankh(4, 1), material: 0, depth: .6 }, { shapes: ankh(0, 0), material: 0, depth: 0 }, { shapes: ankh(-4, 2), material: 1, depth: -.4 }],
        scaling: [""],
    },
    {
        name: "AnkhBurst", interval: 400, looping: false,
        extent: "MinimumExtent { -220, -2, -130 }, MaximumExtent { 220, 2, 130 }, BoundsRadius 250,",
        parts: [{ shapes: rays(18, 190, 112), material: 1, depth: 0 }, { shapes: ring(200, 118), material: 1, depth: -.5, bone: 1 }],
        scaling: ["Scaling 3 { Linear, 0: { 0.85, 0.85, 0.85 }, 60: { 1, 1, 1 }, 400: { 1.15, 1.15, 1.15 }, }", "Scaling 3 { Linear, 0: { 0.6, 0.6, 0.6 }, 200: { 1.05, 1.05, 1.05 }, 400: { 1.15, 1.15, 1.15 }, }"],
    },
];

const imports = [textureName];
const assetInfo: string[] = [];
for (const { name, parts, interval, extent, scaling, looping } of effects) {
    const geometry = parts.map(({ shapes, material, depth, bone = 0 }) => {
        const points = shapes.flatMap((shape) => shape.points);
        let start = 0;
        const faces = shapes.flatMap((shape) => {
            const fan = Array.from({ length: shape.points.length - 2 }, (_, i) => [start, start + i + 1, start + i + 2]).flat();
            start += shape.points.length;
            return fan;
        });
        const uvs = shapes.flatMap(({ points, tile }) => tile < 0 ? [[.7501, .999], [.9999, .999], [.9999, .001], [.7501, .001]] : Array(points.length).fill([(tile + .5) / 4, .5]));
        const n = points.length;
        return `Geoset {
            Vertices ${n} { ${points.map(([x, z]) => vector([x, depth, z]) + ",").join(" ")} }
            Normals ${n} { ${Array(n).fill("{ 0, -1, 0 },").join(" ")} }
            TVertices ${n} { ${uvs.map((v) => vector(v) + ",").join(" ")} }
            VertexGroup { ${Array(n).fill("0,").join(" ")} }
            Faces 1 ${faces.length} { Triangles { ${vector(faces)}, } }
            Groups 1 1 { Matrices { ${bone} }, }
            ${extent} Anim { ${extent} } MaterialID ${material}, SelectionGroup 0,
        }`;
    }).join("\n");
    const mdl = `Version { FormatVersion 800, }
        Model "Smashcraft ${name}" { NumGeosets ${parts.length}, NumBones ${scaling.length}, BlendTime 0, ${extent} }
        Sequences 1 { Anim "Stand" { Interval { 0, ${interval} }, ${looping ? "" : "NonLooping,"} ${extent} } }
        Textures 1 { Bitmap { Image "war3mapImported\\${textureName}", } }
        Materials 2 {
            Material { Layer { FilterMode Blend, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 1, } }
            Material { Layer { FilterMode Additive, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 1, } }
        }
        ${geometry}
        ${scaling.map((track, id) => `Bone "${name}${id === 0 ? "" : id}" { ObjectId ${id}, GeosetId Multiple, GeosetAnimId None, ${track} }`).join("\n")}
        PivotPoints ${scaling.length} { ${scaling.map(() => "{ 0, 0, 0 },").join(" ")} }`;
    const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
    const decoded = parseMDX(bytes.buffer);
    if (decoded.Geosets.length !== parts.length || decoded.Sequences.length !== 1) throw new Error(`${name}: lost effect geometry`);
    for (const geoset of decoded.Geosets) if (!Array.from(geoset.Vertices).every(Number.isFinite)) throw new Error(`${name}: invalid vertex`);
    if (scaling.some((track, id) => track !== "" && decoded.Bones[id]?.Scaling === undefined)) throw new Error(`${name}: lost its expansion`);
    const filename = `${name}-${hash(bytes)}.mdx`;
    await Bun.write(join(output, filename), bytes);
    await Bun.write(join(output, `${name}.mdl`), mdl);
    imports.push(filename);
    assetInfo.push(`export const ${name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}_MODEL = ${JSON.stringify(`war3mapImported\\${filename}`)};`);
}
await Bun.write(join(output, textureName), texture);
await Bun.write(join(import.meta.dir, "../../ts/src/generated/assets/ankhAssetInfo.ts"),
    `// Generated by tools/effects/ankh.ts from the authored ankh models; regenerate instead of editing.\n${assetInfo.join("\n")}\n`);
await Bun.write(join(output, "ankh-imports.txt"), imports.join("\n") + "\n");
console.log("Two original Reincarnation models (ankh, burst): camera-facing, MDX roundtrip geometry and expansion checks passed.");
