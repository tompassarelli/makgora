import { parseMDL, generateMDX, parseMDX } from "../animations/node_modules/war3-model";
import { join } from "node:path";

const output = join(import.meta.dir, "../../build/impact-assets");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
type Rgb = [number, number, number];
type Vec = [number, number, number];

function tga(width: number, height: number, pixel: (u: number, v: number) => [number, number, number, number]): Uint8Array {
    const bytes = new Uint8Array(18 + width * height * 4);
    bytes[2] = 2; bytes[12] = width & 255; bytes[13] = width >> 8; bytes[14] = height & 255; bytes[15] = height >> 8; bytes[16] = 32; bytes[17] = 0x28;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const [r, g, b, a] = pixel((x + .5) / width, (y + .5) / height);
        bytes.set([b, g, r, a], 18 + (y * width + x) * 4);
    }
    return bytes;
}

const RED: Rgb = [196, 52, 28], ORANGE: Rgb = [236, 128, 42], RIB: Rgb = [58, 24, 14], GOLD: Rgb = [232, 186, 64], WOOD: Rgb = [112, 70, 36], LACQUER: Rgb = [70, 20, 14];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * Math.max(0, Math.min(1, t)))) as Rgb;
const grain = (u: number, v: number) => 0.92 + 0.08 * Math.sin(v * 90 + Math.sin(u * 17) * 3);
const shade = (c: Rgb, k: number): Rgb => c.map((x) => Math.round(Math.min(255, x * k))) as Rgb;
const paper = tga(64, 64, (u, v) => {
    const edge = Math.min(u, 1 - u);
    let colour = shade(mix(ORANGE, RED, v * 1.2), grain(u, v));
    if (v > .9) colour = mix(colour, RIB, .55);
    if (v < .07) colour = GOLD;
    if (edge < .05) colour = RIB;
    return [...colour, 255];
});
const shaft = tga(16, 64, (_u, v) => {
    const colour = v < .06 ? GOLD : v > .84 ? LACQUER : Math.abs(((v * 6) % 1) - .5) < .04 ? shade(WOOD, .7) : WOOD;
    return [...colour, 255];
});
const paperName = `ParasolPaper-${hash(paper)}.tga`, shaftName = `ParasolShaft-${hash(shaft)}.tga`;

const RIBS = 10, RADIUS = 72, APEX = 100, RIM = 76, MID = 94, HANDLE = -14, TIP = 110, HALF = 1.6;
const OPEN = 83, STAND: [number, number] = [200, 1200], DEATH: [number, number] = [1400, 1467];


const fmt = (n: number) => Number(n.toFixed(4)).toString();
const vec = (v: readonly number[]) => `{ ${v.map(fmt).join(", ")} }`;
interface Mesh { vertices: Vec[]; uvs: [number, number][]; faces: number[] }
const canopy: Mesh = { vertices: [], uvs: [], faces: [] };
for (let rib = 0; rib < RIBS; rib++) {
    const at = (r: number, z: number, side: number): Vec => {
        const a = (rib + side) / RIBS * Math.PI * 2;
        return [Math.cos(a) * r, Math.sin(a) * r, z];
    };
    const base = canopy.vertices.length;
    canopy.vertices.push([0, 0, APEX], at(RADIUS * .6, MID, 0), at(RADIUS * .6, MID, 1), at(RADIUS, RIM, 0), at(RADIUS, RIM, 1));
    canopy.uvs.push([.5, 0], [0, .6], [1, .6], [0, 1], [1, 1]);
    canopy.faces.push(base, base + 1, base + 2, base + 1, base + 3, base + 4, base + 1, base + 4, base + 2);
}
const stick: Mesh = { vertices: [], uvs: [], faces: [] };
for (let side = 0; side < 4; side++) {
    const corner = (k: number): [number, number] => [Math.cos((k + .5) * Math.PI / 2) * HALF, Math.sin((k + .5) * Math.PI / 2) * HALF];
    const [ax, ay] = corner(side), [bx, by] = corner(side + 1), base = stick.vertices.length;
    stick.vertices.push([ax, ay, TIP], [bx, by, TIP], [ax, ay, HANDLE], [bx, by, HANDLE]);
    stick.uvs.push([0, 0], [1, 0], [0, 1], [1, 1]);
    stick.faces.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
}
const knob = stick.vertices.length;
stick.vertices.push([0, 0, TIP + 4]);
stick.uvs.push([.5, 0]);
for (let side = 0; side < 4; side++) stick.faces.push(knob, side * 4 + 1, side * 4);

const extent = "MinimumExtent { -80, -80, -20 }, MaximumExtent { 80, 80, 120 }, BoundsRadius 130,";
const geoset = (mesh: Mesh, material: number, group: number) => {
    const normals = mesh.vertices.map(([x, y, z]) => { const n = Math.hypot(x, y, z - RIM + 40) || 1; return [x / n, y / n, (z - RIM + 40) / n]; });
    return `Geoset {
    Vertices ${mesh.vertices.length} { ${mesh.vertices.map(vec).join(", ")}, }
    Normals ${normals.length} { ${normals.map(vec).join(", ")}, }
    TVertices ${mesh.uvs.length} { ${mesh.uvs.map(vec).join(", ")}, }
    VertexGroup { ${mesh.vertices.map(() => "0").join(", ")}, }
    Faces 1 ${mesh.faces.length} { Triangles { { ${mesh.faces.join(", ")} }, } }
    Groups 1 1 { Matrices { ${group} }, }
    ${extent}
    Anim { ${extent} }
    Anim { ${extent} }
    Anim { ${extent} }
    MaterialID ${material}, SelectionGroup 0,
}`;
};
const folded = "{ 0.12, 0.12, 1 }", open = "{ 1, 1, 1 }";
const held = (keys: [number, string][]) => keys.map(([at, value]) => `${at}: ${value},`).join(" ");

const mdl = `Version { FormatVersion 800, }
Model "Smashcraft Parasol" { NumGeosets 2, NumBones 2, BlendTime 0, ${extent} }
Sequences 3 {
    Anim "Birth" { Interval { 0, ${OPEN} }, NonLooping, ${extent} }
    Anim "Stand" { Interval { ${STAND.join(", ")} }, ${extent} }
    Anim "Death" { Interval { ${DEATH.join(", ")} }, NonLooping, ${extent} }
}
Textures 2 {
    Bitmap { Image "war3mapImported\\${paperName}", }
    Bitmap { Image "war3mapImported\\${shaftName}", }
}
Materials 2 {
    Material { Layer { FilterMode None, TwoSided, static TextureID 0, } }
    Material { Layer { FilterMode None, TwoSided, static TextureID 1, } }
}
${geoset(canopy, 0, 1)}
${geoset(stick, 1, 0)}
GeosetAnim { static Alpha 1, GeosetId 0, }
GeosetAnim { static Alpha 1, GeosetId 1, }
Bone "Shaft" {
    ObjectId 0, GeosetId Multiple, GeosetAnimId None,
}
Bone "Canopy" {
    ObjectId 1, Parent 0, GeosetId 0, GeosetAnimId None,
    Scaling 6 { Linear, ${held([[0, folded], [OPEN, open], [STAND[0], open], [STAND[1], open], [DEATH[0], open], [DEATH[1], folded]])} }
}
PivotPoints 2 { { 0, 0, 0 }, { 0, 0, ${APEX} }, }`;

const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
const decoded = parseMDX(bytes.buffer);
if (decoded.Geosets.length !== 2) throw new Error("the parasol lost its canopy or shaft");
if (decoded.Sequences.map((s) => s.Name).join() !== "Birth,Stand,Death") throw new Error("the parasol lost its open, held or close sequence");
const modelName = `Parasol-${hash(bytes)}.mdx`;
await Bun.write(join(output, modelName), bytes);
await Bun.write(join(output, "Parasol.mdl"), mdl);
await Bun.write(join(output, paperName), paper);
await Bun.write(join(output, shaftName), shaft);
await Bun.write(join(output, "parasol-imports.txt"), [paperName, shaftName, modelName].join("\n") + "\n");
await Bun.write(join(import.meta.dir, "../../ts/src/generated/assets/parasolAssetInfo.ts"),
    `// Generated by tools/effects/parasol.ts from the authored paper parasol; regenerate instead of editing.\nexport const PARASOL_MODEL = ${JSON.stringify(`war3mapImported\\${modelName}`)};\n`);
console.log(`Parasol: a ${RIBS}-rib red oiled-paper canopy ${RADIUS * 2} wide on a bamboo shaft with a gold tip, opening in ${OPEN} ms; ${modelName}`);
