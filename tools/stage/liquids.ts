import { join } from "node:path";
import { generateMDX, parseMDL } from "../animations/node_modules/war3-model";
import { GROUND_TEXTURE_SIZE, groundTexel, lavaGlowTexel, liquidTexel, liquidTga, PLAGUE_TEXTURE_SIZE, plagueGlowTexel, plagueTexel, tombWaterTexel, TOMB_LIQUID_TEXTURE_SIZE } from "../../ts/scripts/stageLiquid";

const WATER_FRAMES = 45;
const WATER_FRAME_MS = 90;
const WATER_FIRST_TEXTURE = 2;

const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

export async function packageLiquids(output: string): Promise<readonly string[]> {
  const names: string[] = [];
  const models: string[] = [];
  for (const kind of ["Water", "Lava", "Sea", "TombWater", "TombSea"] as const) {
    const tomb = kind === "TombWater" || kind === "TombSea";
    const texture = liquidTga((x, y) => {
      const color = tomb ? tombWaterTexel(x, y) : liquidTexel(kind === "Lava" ? "Lava" : "Water", x, y);
      return kind === "Sea" || kind === "TombSea" ? [color[0], color[1], color[2], 255] : color;
    }, tomb ? TOMB_LIQUID_TEXTURE_SIZE : undefined);
    const textureName = `Stage${kind}-${hash(texture)}.tga`;

    const glow = kind === "Lava" ? liquidTga(lavaGlowTexel) : undefined;
    const glowName = glow === undefined ? undefined : `Stage${kind}Glow-${hash(glow)}.tga`;
    const highlights = tomb ? liquidTga((x, y) => {
      const [red] = tombWaterTexel(x, y);
      const crest = Math.max(0, (red - 111) / 31);
      return [104, 166, 180, Math.round(255 * crest * crest)];
    }, TOMB_LIQUID_TEXTURE_SIZE) : undefined;
    const highlightsName = highlights === undefined ? undefined : `Stage${kind}Highlights-${hash(highlights)}.tga`;
    const sea = kind === "TombSea";
    const waterBitmaps = Array.from({ length: WATER_FRAMES - 1 }, (_, index) => `Bitmap { Image "ReplaceableTextures\\Water\\Water${String(index + 1).padStart(2, "0")}.blp", WrapWidth, WrapHeight, }`).join(" ");
    const waterTexture = (frame: number) => frame === 0 ? WATER_FIRST_TEXTURE : WATER_FIRST_TEXTURE + 1 + frame;
    const waterFlipbook = `TextureID ${waterTexture(0)} { DontInterp, GlobalSeqId 1, ${Array.from({ length: WATER_FRAMES + 1 }, (_, frame) => `${frame * WATER_FRAME_MS}: ${waterTexture(frame % WATER_FRAMES)}`).join(", ")}, }`;
    const extent = 'MinimumExtent { -50, -60, 0 }, MaximumExtent { 50, 60, 0 }, BoundsRadius 80,';
    const vec = (values: readonly number[]) => `{ ${values.join(", ")} }`;
    const quad = (corners: readonly number[][], uv: readonly number[][], material: number, index: number, tint?: readonly number[]) => `Geoset {
Vertices 4 { ${corners.map(point => `${vec(point)},`).join(" ")} }
Normals 4 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
TVertices 4 { ${uv.map(point => `${vec(point)},`).join(" ")} }
VertexGroup { 0, 0, 0, 0, } Faces 1 6 { Triangles { { 0, 1, 2, 0, 2, 3 }, } }
Groups 1 1 { Matrices { 0 }, } ${extent} Anim { ${extent} } MaterialID ${material}, SelectionGroup 0,
} ${tint === undefined ? "" : `GeosetAnim { static Alpha 1, static Color ${vec([...tint].reverse())}, GeosetId ${index}, }`}`;
    const bands = [-60, -32, -20, -12, 0, 18, 36, 60];
    const tones = [0.72, 0.9, 1, 0.96, 0.86, 0.76, 0.7];
    const surface = sea ? bands.slice(0, -1).map((low, index) => {
      const high = bands[index + 1] ?? 60;
      const tone = tones[index] ?? 1;
      return quad([[-50, low, 0], [50, low, 0], [50, high, 0], [-50, high, 0]], [[0, (low + 60) * 7 / 120], [10, (low + 60) * 7 / 120], [10, (high + 60) * 7 / 120], [0, (high + 60) * 7 / 120]], 0, index, [tone * 0.92, tone, tone]);
    }).join("\n") : "";
    const foam = sea ? [
      [-2.75, -16.8, 5.5, 0.42], [-2.75, -15.1, 5.5, 0.3],
      [-2.8, -16.5, 0.18, 1.5], [2.62, -16.5, 0.18, 1.5],
      [-17.2, 10, 4.8, 0.8], [-14, 11.2, 3.8, 0.65],
      [-6.2, 12.9, 5.6, 0.75], [-0.7, 15.2, 5.8, 0.65],
      [5.1, 16.5, 5.4, 0.8], [11.7, 11.9, 5.1, 0.7],
    ].map(([x = 0, y = 0, width = 1, depth = 1], index) => quad([[x, y, 0.03], [x + width, y, 0.03], [x + width, y + depth, 0.03], [x, y + depth, 0.03]], [[0, 0], [1, 0], [1, 1], [0, 1]], 1, bands.length - 1 + index)).join("\n") : "";
    const mdl = `Version { FormatVersion 800, }
Model "Smashcraft ${kind}" { ${sea ? "NumGeosets 17, NumGeosetAnims 7," : "NumGeosets 1,"} NumBones 1, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 12000 }, ${extent} } }
${sea ? `GlobalSequences 2 { Duration 240000, Duration ${WATER_FRAMES * WATER_FRAME_MS}, }` : tomb ? "GlobalSequences 1 { Duration 240000, }" : ""}
Textures ${sea ? 3 + WATER_FRAMES : glowName === undefined && highlightsName === undefined ? 1 : 2} { Bitmap { Image "war3mapImported\\${textureName}", WrapWidth, WrapHeight, } ${glowName === undefined ? "" : `Bitmap { Image "war3mapImported\\${glowName}", WrapWidth, WrapHeight, }`} ${highlightsName === undefined ? "" : `Bitmap { Image "war3mapImported\\${highlightsName}", WrapWidth, WrapHeight, }`} ${sea ? `Bitmap { Image "ReplaceableTextures\\Water\\Water00.blp", WrapWidth, WrapHeight, } Bitmap { Image "Textures\\White_64_Foam1.blp", } ${waterBitmaps}` : ""} }
TextureAnims ${sea ? 3 : tomb ? 2 : 1} {
  TVertexAnim { Translation 2 { Linear, ${tomb ? "GlobalSeqId 0," : ""} 0: { 0, 0, 0 }, ${tomb ? 240000 : 12000}: { ${tomb ? "2, 1" : "1, 0"}, 0 }, } }
  ${tomb ? "TVertexAnim { Translation 2 { Linear, GlobalSeqId 0, 0: { 0.37, 0.61, 0 }, 240000: { -2.63, 2.61, 0 }, } Scaling 1 { DontInterp, 0: { 1.375, 0.875, 1 }, } }" : ""}
  ${sea ? "TVertexAnim { Translation 2 { Linear, GlobalSeqId 0, 0: { 0.18, 0.43, 0 }, 240000: { -5.82, 3.43, 0 }, } Scaling 1 { DontInterp, 0: { 1.75, 1.25, 1 }, } }" : ""}
}
Materials ${sea ? 2 : 1} { Material { Layer { FilterMode Blend, Unshaded, TwoSided, static TextureID 0, TVertexAnimId 0, static Alpha 1, } ${glowName === undefined ? "" : "Layer { FilterMode Additive, Unshaded, TwoSided, static TextureID 1, TVertexAnimId 0, static Alpha 1, }"} ${highlightsName === undefined ? "" : "Layer { FilterMode Additive, Unshaded, TwoSided, static TextureID 1, TVertexAnimId 1, Alpha 9 { Linear, GlobalSeqId 0, 0: 0.22, 30000: 0.38, 60000: 0.26, 90000: 0.34, 120000: 0.22, 150000: 0.38, 180000: 0.26, 210000: 0.34, 240000: 0.22, } }"} ${sea ? `Layer { FilterMode Additive, Unshaded, TwoSided, ${waterFlipbook}, TVertexAnimId 2, static Alpha 0.38, }` : ""} } ${sea ? "Material { Layer { FilterMode Additive, Unshaded, TwoSided, static TextureID 3, static Alpha 0.9, } }" : ""} }
${sea ? surface + "\n" + foam : `Geoset {
Vertices 4 { { -50, -60, 0 }, { 50, -60, 0 }, { 50, 60, 0 }, { -50, 60, 0 }, }
Normals 4 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
TVertices 4 { { 0, 0 }, { ${tomb ? 0.5 : kind === "Sea" ? 96 : 4}, 0 }, { ${tomb ? 0.5 : kind === "Sea" ? 96 : 4}, ${tomb ? 0.05 : kind === "Sea" ? 64 : 1} }, { 0, ${tomb ? 0.05 : kind === "Sea" ? 64 : 1} }, }
VertexGroup { 0, 0, 0, 0, }
Faces 1 6 { Triangles { { 0, 1, 2, 0, 2, 3 }, } }
Groups 1 1 { Matrices { 0 }, }
${extent} Anim { ${extent} } MaterialID 0, SelectionGroup 0,
}
`}
Bone "Surface" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
    const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
    const modelName = `Stage${kind}-${hash(bytes)}.mdx`;
    await Bun.write(join(output, textureName), texture);
    await Bun.write(join(output, modelName), bytes);
    if (glow !== undefined && glowName !== undefined) {
      await Bun.write(join(output, glowName), glow);
      names.push(glowName);
    }
    if (highlights !== undefined && highlightsName !== undefined) {
      await Bun.write(join(output, highlightsName), highlights);
      names.push(highlightsName);
    }
    names.push(textureName, modelName);
    models.push(`export const STAGE_${kind.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}_MODEL = ${JSON.stringify(`war3mapImported\\${modelName}`)};`);
  }
  const groundTexture = liquidTga(groundTexel, GROUND_TEXTURE_SIZE);
  const groundTextureName = `StageGround-${hash(groundTexture)}.tga`;
  const groundExtent = 'MinimumExtent { -50, -60, 0 }, MaximumExtent { 50, 60, 0 }, BoundsRadius 80,';
  const groundMdl = `Version { FormatVersion 800, }
Model "Smashcraft Ground" { NumGeosets 1, NumBones 1, BlendTime 0, ${groundExtent} }
Sequences 1 { Anim "Stand" { Interval { 0, 12000 }, ${groundExtent} } }
Textures 1 { Bitmap { Image "war3mapImported\\${groundTextureName}", WrapWidth, WrapHeight, } }
Materials 1 { Material { Layer { FilterMode None, Unshaded, TwoSided, static TextureID 0, static Alpha 1, } } }
Geoset {
Vertices 4 { { -50, -60, 0 }, { 50, -60, 0 }, { 50, 60, 0 }, { -50, 60, 0 }, }
Normals 4 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
TVertices 4 { { 0, 0 }, { 12, 0 }, { 12, 8 }, { 0, 8 }, }
VertexGroup { 0, 0, 0, 0, }
Faces 1 6 { Triangles { { 0, 1, 2, 0, 2, 3 }, } }
Groups 1 1 { Matrices { 0 }, }
${groundExtent} Anim { ${groundExtent} } MaterialID 0, SelectionGroup 0,
}
Bone "Surface" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
  const groundBytes = new Uint8Array(generateMDX(parseMDL(groundMdl)));
  const groundName = `StageGround-${hash(groundBytes)}.mdx`;
  await Bun.write(join(output, groundTextureName), groundTexture);
  await Bun.write(join(output, groundName), groundBytes);
  names.push(groundTextureName, groundName);
  models.push(`export const STAGE_GROUND_MODEL = ${JSON.stringify(`war3mapImported\\${groundName}`)};`);
  const plagueTexture = liquidTga(plagueTexel, PLAGUE_TEXTURE_SIZE);
  const plagueTextureName = `StagePlague-${hash(plagueTexture)}.tga`;
  const plagueGlow = liquidTga(plagueGlowTexel, PLAGUE_TEXTURE_SIZE);
  const plagueGlowName = `StagePlagueGlow-${hash(plagueGlow)}.tga`;
  const plagueMdl = `Version { FormatVersion 800, }
Model "Smashcraft Plague" { NumGeosets 1, NumBones 1, BlendTime 0, ${groundExtent} }
Sequences 1 { Anim "Stand" { Interval { 0, 12000 }, ${groundExtent} } }
GlobalSequences 1 { Duration 120000, }
Textures 2 { Bitmap { Image "war3mapImported\\${plagueTextureName}", WrapWidth, WrapHeight, } Bitmap { Image "war3mapImported\\${plagueGlowName}", WrapWidth, WrapHeight, } }
TextureAnims 2 {
  TVertexAnim { Translation 2 { Linear, GlobalSeqId 0, 0: { 0, 0, 0 }, 120000: { 1, 1, 0 }, } }
  TVertexAnim { Translation 2 { Linear, GlobalSeqId 0, 0: { 0.31, 0.57, 0 }, 120000: { -1.69, 1.57, 0 }, } Scaling 1 { DontInterp, 0: { 1.25, 0.875, 1 }, } }
}
Materials 1 { Material { Layer { FilterMode None, Unshaded, TwoSided, static TextureID 0, TVertexAnimId 0, static Alpha 1, } Layer { FilterMode Additive, Unshaded, TwoSided, static TextureID 1, TVertexAnimId 1, Alpha 5 { Linear, GlobalSeqId 0, 0: 0.4, 30000: 0.6, 60000: 0.45, 90000: 0.6, 120000: 0.4, } } } }
Geoset {
Vertices 4 { { -50, -60, 0 }, { 50, -60, 0 }, { 50, 60, 0 }, { -50, 60, 0 }, }
Normals 4 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
TVertices 4 { { 0, 0 }, { 12, 0 }, { 12, 8 }, { 0, 8 }, }
VertexGroup { 0, 0, 0, 0, }
Faces 1 6 { Triangles { { 0, 1, 2, 0, 2, 3 }, } }
Groups 1 1 { Matrices { 0 }, }
${groundExtent} Anim { ${groundExtent} } MaterialID 0, SelectionGroup 0,
}
Bone "Surface" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
  const plagueBytes = new Uint8Array(generateMDX(parseMDL(plagueMdl)));
  const plagueName = `StagePlague-${hash(plagueBytes)}.mdx`;
  await Bun.write(join(output, plagueTextureName), plagueTexture);
  await Bun.write(join(output, plagueGlowName), plagueGlow);
  await Bun.write(join(output, plagueName), plagueBytes);
  names.push(plagueTextureName, plagueGlowName, plagueName);
  models.push(`export const STAGE_PLAGUE_MODEL = ${JSON.stringify(`war3mapImported\\${plagueName}`)};`);
  await Bun.write(join(import.meta.dir, "../../ts/src/generated/stages/terrainAssetInfo.ts"), `// Generated by tools/stage/package.ts.\n${models.join("\n")}\n`);
  return names;
}
