import { parseMDL, generateMDX, parseMDX } from "../animations/node_modules/war3-model";
import { join } from "node:path";

const output = join(import.meta.dir, "../../build/impact-assets");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
type Rgb = [number, number, number];

function tga(width: number, height: number, pixel: (u: number, v: number) => [number, number, number, number]): Uint8Array {
    const bytes = new Uint8Array(18 + width * height * 4);
    bytes[2] = 2; bytes[12] = width & 255; bytes[13] = width >> 8; bytes[14] = height & 255; bytes[15] = height >> 8; bytes[16] = 32; bytes[17] = 0x28;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const [r, g, b, a] = pixel((x + .5) / width, (y + .5) / height);
        bytes.set([b, g, r, a], 18 + (y * width + x) * 4);
    }
    return bytes;
}

const HOT: Rgb = [250, 255, 225], FEL: Rgb = [110, 255, 70], DARK: Rgb = [15, 85, 20];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgb;
const crescent = tga(64, 64, (u, v) => {
    const colour = v < .35 ? mix(HOT, FEL, v / .35) : mix(FEL, DARK, (v - .35) / .65);
    const fade = Math.min(1, u * 6) * Math.min(1, (1 - v) * 4);
    return [...colour, Math.round(255 * fade)];
});
const ember = tga(32, 32, (u, v) => {
    const r = Math.hypot(u * 2 - 1, v * 2 - 1);
    return [255, 255, 255, Math.round(255 * Math.max(0, 1 - r * r) ** 2)];
});
const crescentName = `FelCrescentRibbon-${hash(crescent)}.tga`, emberName = `FelEmber-${hash(ember)}.tga`;
const bgr = ([r, g, b]: Rgb) => `{ ${b / 255}, ${g / 255}, ${r / 255} }`;
const STAND = [0, 1000], CUT = 100, SMOKE_END = 450, SWING = 80, REACH = 60, RISE = 50;
const aboutY = (degrees: number) => `{ 0, ${Math.sin(degrees * Math.PI / 360).toFixed(4)}, 0, ${Math.cos(degrees * Math.PI / 360).toFixed(4)} }`;
const extent = "MinimumExtent { -60, -60, -60 }, MaximumExtent { 60, 60, 60 }, BoundsRadius 90,";
const shown = (keys: [number, number][]) => `Visibility ${keys.length} { DontInterp, ${keys.map(([at, on]) => `${at}: ${on},`).join(" ")} }`;

const mdl = `Version { FormatVersion 800, }
Model "Smashcraft Fel Crescent" { BlendTime 0, ${extent} }
Sequences 1 {
    Anim "Stand" { Interval { ${STAND.join(", ")} }, NonLooping, ${extent} }
}
Textures 3 {
    Bitmap { Image "war3mapImported\\${crescentName}", }
    Bitmap { Image "war3mapImported\\${emberName}", }
    Bitmap { Image "Textures\\Clouds8x8FadeWhite.blp", }
}
Materials 1 { Material { Layer { FilterMode Additive, Unshaded, Unfogged, static TextureID 0, } } }
Bone "Swing" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, Rotation 2 { Linear, 0: ${aboutY(RISE)}, ${SWING}: ${aboutY(0)}, } }
RibbonEmitter "Crescent" {
    ObjectId 1, Parent 0,
    static HeightAbove 30, static HeightBelow 4, static Alpha 1, static Color ${bgr([255, 255, 255])}, static TextureSlot 0,
    ${shown([[0, 1], [CUT, 0]])}
    EmissionRate 240, LifeSpan 0.35, Gravity 0, Rows 1, Columns 1, MaterialID 0,
}
ParticleEmitter2 "Trail" {
    ObjectId 4, Parent 0, Unshaded, Unfogged,
    static Speed 0, static Variation 0, static Latitude 0, static Gravity 0, static EmissionRate 400,
    static Width 20, static Length 20, ${shown([[0, 1], [CUT, 0]])}
    LifeSpan 0.35, Additive, Rows 1, Columns 1, Head, TailLength 0, Time 0.2,
    SegmentColor { Color ${bgr(HOT)}, Color ${bgr(FEL)}, Color ${bgr(DARK)}, }
    Alpha { 255, 230, 0 }, ParticleScaling { 16, 20, 24 },
    LifeSpanUVAnim { 0, 0, 1 }, DecayUVAnim { 0, 0, 1 }, TailUVAnim { 0, 0, 1 }, TailDecayUVAnim { 0, 0, 1 },
    TextureID 1, ReplaceableId 0, PriorityPlane 0,
}
ParticleEmitter2 "Embers" {
    ObjectId 2, Parent 0, Unshaded, Unfogged,
    static Speed 70, static Variation 0.5, static Latitude 70, static Gravity 140, static EmissionRate 30,
    static Width 4, static Length 4, ${shown([[0, 1], [CUT + 20, 0]])}
    LifeSpan 0.4, Additive, Rows 1, Columns 1, Head, TailLength 0, Time 0.3,
    SegmentColor { Color ${bgr(HOT)}, Color ${bgr(FEL)}, Color ${bgr(DARK)}, }
    Alpha { 255, 200, 0 }, ParticleScaling { 4, 3, 1 },
    LifeSpanUVAnim { 0, 0, 1 }, DecayUVAnim { 0, 0, 1 }, TailUVAnim { 0, 0, 1 }, TailDecayUVAnim { 0, 0, 1 },
    TextureID 1, ReplaceableId 0, PriorityPlane 0,
}
ParticleEmitter2 "Smoke" {
    ObjectId 3, Parent 0, Unshaded,
    static Speed 18, static Variation 0.4, static Latitude 180, static Gravity -20, static EmissionRate 45,
    static Width 24, static Length 24, ${shown([[0, 0], [CUT - 20, 1], [SMOKE_END, 0]])}
    LifeSpan 0.6, Blend, Rows 8, Columns 8, Head, TailLength 0, Time 0.5,
    SegmentColor { Color ${bgr(mix(FEL, DARK, .5))}, Color ${bgr(DARK)}, Color ${bgr([30, 40, 30])}, }
    Alpha { 120, 70, 0 }, ParticleScaling { 10, 18, 26 },
    LifeSpanUVAnim { 0, 63, 1 }, DecayUVAnim { 0, 0, 1 }, TailUVAnim { 0, 0, 1 }, TailDecayUVAnim { 0, 0, 1 },
    TextureID 2, ReplaceableId 0, PriorityPlane 0,
}
PivotPoints 5 { { ${-REACH}, 0, 0 }, { 0, 0, 0 }, { 0, 0, 0 }, { 0, 0, 0 }, { 0, 0, 0 }, }`;

const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
const decoded = parseMDX(bytes.buffer);
if (decoded.RibbonEmitters.length !== 1) throw new Error("the crescent lost its ribbon");
if (decoded.ParticleEmitters2.length !== 3) throw new Error("the crescent lost its trail, embers or smoke");
const modelName = `FelCrescent-${hash(bytes)}.mdx`;
await Bun.write(join(output, modelName), bytes);
await Bun.write(join(output, "FelCrescent.mdl"), mdl);
await Bun.write(join(output, crescentName), crescent);
await Bun.write(join(output, emberName), ember);
await Bun.write(join(output, "crescent-imports.txt"), [crescentName, emberName, modelName].join("\n") + "\n");
await Bun.write(join(import.meta.dir, "../../ts/src/generated/assets/felCrescentAssetInfo.ts"),
    `// Generated by tools/effects/felCrescent.ts from the authored fel crescent; regenerate instead of editing.\nexport const FEL_CRESCENT_MODEL = ${JSON.stringify(`war3mapImported\\${modelName}`)};\n`);
console.log(`Fel crescent: a ribbon and a particle trail swung up to the heel with embers, dissolving into smoke; ${modelName}`);
