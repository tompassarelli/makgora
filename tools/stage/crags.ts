import { join } from "node:path";
import { parseMDL, generateMDX } from "../animations/node_modules/war3-model";

type Crag = { readonly name: string; readonly height: number; readonly rings: number; readonly segments: number; readonly seed: number; readonly radius: (h: number) => number; readonly lean: number };

export const STAGE_CRAGS: readonly Crag[] = [
  { name: "Peak", height: 320, rings: 14, segments: 18, seed: 7, radius: (h) => 100 * Math.pow(1 - h, 1.15) + 6, lean: 22 },
  { name: "Crag", height: 240, rings: 12, segments: 18, seed: 19, radius: (h) => 100 * (1 - 0.72 * Math.pow(h, 1.8)), lean: 14 },
  { name: "Knoll", height: 120, rings: 8, segments: 18, seed: 31, radius: (h) => 100 * Math.sqrt(Math.max(0, 1 - h * h * 0.85)), lean: 8 },
];

// war3-model keeps MDL strings raw, so an escaped backslash stays doubled in the MDX path and native Classic loads no texture.
const TEXTURE = "Doodads\\LordaeronSummer\\Terrain\\LoardaeronRockChunks\\LordaeronRockChunks.blp";
const STRIP_U = 0.48, STRIP_V0 = 0.015, STRIP_V1 = 0.48, BAND = 140;
const tri = (x: number) => 1 - Math.abs((x % 2) - 1);
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const fmt = (n: number) => Number(n.toFixed(3)).toString();

function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function cragMdl(crag: Crag): string {
  const next = random(crag.seed);
  const flutes = Array.from({ length: crag.segments }, () => 0.8 + next() * 0.4);
  const angles = Array.from({ length: crag.segments }, (_, j) => 2 * Math.PI * (j + (j === 0 ? 0 : (next() - 0.5) * 0.4)) / crag.segments);
  const points: { x: number; y: number; z: number; u: number; v: number }[] = [];
  let slant = 0, previous = { r: 0, z: 0 };
  for (let i = 0; i <= crag.rings; i++) {
    const h = i / crag.rings;
    const z = i === 0 ? -20 : crag.height * Math.min(1, h + (i < crag.rings ? (next() - 0.5) * 0.04 : 0));
    const lift = crag.lean * Math.pow(h, 1.5);
    const cx = lift * Math.cos(crag.seed), cy = lift * Math.sin(crag.seed);
    const r0 = Math.max(3, crag.radius(h)) * (i === 0 ? 1.08 : 1);
    if (i > 0) slant += Math.hypot(r0 - previous.r, z - previous.z);
    previous = { r: r0, z };
    for (let j = 0; j <= crag.segments; j++) {
      const k = j % crag.segments;
      const r = r0 * (i === crag.rings ? 0.6 : flutes[k]! * (0.92 + next() * 0.16));
      points.push({ x: cx + r * Math.cos(angles[k]!), y: cy + r * Math.sin(angles[k]!), z, u: STRIP_U * tri(3 * j / crag.segments), v: STRIP_V1 - (STRIP_V1 - STRIP_V0) * tri(slant / BAND) });
    }
    const first = points[points.length - crag.segments - 1]!;
    points[points.length - 1] = { ...first, u: points[points.length - 1]!.u };
  }
  const top = points.slice(-crag.segments - 1, -1);
  points.push({ x: top.reduce((s, p) => s + p.x, 0) / crag.segments, y: top.reduce((s, p) => s + p.y, 0) / crag.segments, z: crag.height + 10, u: STRIP_U * 0.5, v: STRIP_V0 });
  const apex = points.length - 1, row = crag.segments + 1;
  const triangles: [number, number, number][] = [];
  for (let i = 0; i < crag.rings; i++) for (let j = 0; j < crag.segments; j++) {
    const a = i * row + j, b = a + 1, c = a + row + 1, d = a + row;
    triangles.push([a, b, c], [a, c, d]);
  }
  for (let j = 0; j < crag.segments; j++) triangles.push([crag.rings * row + j, crag.rings * row + j + 1, apex]);
  const key = (p: { x: number; y: number; z: number }) => `${fmt(p.x)},${fmt(p.y)},${fmt(p.z)}`;
  const sums = new Map<string, number[]>();
  for (const [a, b, c] of triangles) {
    const p = points[a]!, q = points[b]!, s = points[c]!;
    const e1 = [q.x - p.x, q.y - p.y, q.z - p.z], e2 = [s.x - p.x, s.y - p.y, s.z - p.z];
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    for (const v of [p, q, s]) { const sum = sums.get(key(v)) ?? [0, 0, 0]; sums.set(key(v), [sum[0]! + n[0]!, sum[1]! + n[1]!, sum[2]! + n[2]!]); }
  }
  const normal = (p: { x: number; y: number; z: number }) => { const n = sums.get(key(p))!; const l = Math.hypot(n[0]!, n[1]!, n[2]!) || 1; return n.map((c) => fmt(c / l)).join(", "); };
  const min = [0, 1, 2].map((k) => Math.min(...points.map((p) => [p.x, p.y, p.z][k]!)));
  const max = [0, 1, 2].map((k) => Math.max(...points.map((p) => [p.x, p.y, p.z][k]!)));
  const count = points.length;
  const extent = `MinimumExtent { ${min.map(fmt).join(", ")} }, MaximumExtent { ${max.map(fmt).join(", ")} }, BoundsRadius ${fmt(Math.hypot(...max.map((m, k) => Math.max(m, -min[k]!))))},`;
  return `Version { FormatVersion 800, }
Model "Smashcraft ${crag.name}" { NumGeosets 1, NumBones 1, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
Textures 1 { Bitmap { Image "${TEXTURE}", } }
Materials 1 { Material { Layer { FilterMode None, TwoSided, static TextureID 0, static Alpha 1, } } }
Geoset {
Vertices ${count} { ${points.map((p) => `{ ${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)} },`).join("\n")} }
Normals ${count} { ${points.map((p) => `{ ${normal(p)} },`).join("\n")} }
TVertices ${count} { ${points.map((p) => `{ ${fmt(p.u)}, ${fmt(p.v)} },`).join("\n")} }
VertexGroup { ${Array(count).fill("0,").join(" ")} }
Faces 1 ${triangles.length * 3} { Triangles { { ${triangles.flat().join(", ")} }, } }
Groups 1 1 { Matrices { 0 }, }
${extent} Anim { ${extent} } MaterialID 0, SelectionGroup 0,
}
Bone "Rock" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
}

export async function packageCrags(output: string): Promise<string[]> {
  const names: string[] = [], rows: string[] = [];
  for (const crag of STAGE_CRAGS) {
    const mdl = cragMdl(crag);
    const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
    const name = `StageCrag${crag.name}-${hash(bytes)}.mdx`;
    await Bun.write(join(output, name), bytes);
    await Bun.write(join(output, `StageCrag${crag.name}.mdl`), mdl);
    names.push(name);
    rows.push(`export const STAGE_CRAG_${crag.name.toUpperCase()}_MODEL = ${JSON.stringify(`war3mapImported\\${name}`)};`);
  }
  await Bun.write(join(import.meta.dir, "../../ts/src/generated/stages/cragAssetInfo.ts"), `// Generated by tools/stage/package.ts; regenerate instead of editing.\n${rows.join("\n")}\nexport const STAGE_CRAG_MODELS = [${STAGE_CRAGS.map((crag) => `STAGE_CRAG_${crag.name.toUpperCase()}_MODEL`).join(", ")}] as const;\n`);
  console.log(`Stage crags: ${STAGE_CRAGS.length} generated granite crags, stock Lordaeron rock-chunk texture, no emitters`);
  return names;
}
