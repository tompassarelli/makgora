import { expect, test } from "bun:test";
import { parseMDL, type model as mdx } from "wisp/vendor/war3-model.mjs";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { effectVisibility, simultaneousPositive, effectUses, effectSourceDigest, effectPlaybackInputs, EFFECT_RECORD_INPUTS } from "../scripts/wisp/effectVisibility";
import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";

import { formatEffectRecord, effectRecordProblem, effectRecordUnknowns } from "../scripts/wisp/cueModels";

test("Classic effect visibility requires simultaneous supported tracks and moving particle playback [k2 property]", () => {
  const model = parseMDL('Version { FormatVersion 800, } Model "synthetic tracks" { BlendTime 0, }');
  let seed = 496;
  const bit = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 24) & 1; };
  for (let example = 0; example < 256; example++) {
    const values = [Array.from({ length: 11 }, bit), Array.from({ length: 11 }, bit)];
    const tracks: mdx.AnimVector[] = values.map((entries) => ({ LineType: 0, GlobalSeqId: -1, Keys: entries.map((value, Frame) => ({ Frame, Vector: new Float32Array([value]) })) }));
    const from = example % 10, to = Math.min(10, from + 1 + example % 5);
    const reference = values[0]?.slice(from, to + 1).some((value, offset) => value > 0 && (values[1]?.[from + offset] ?? 0) > 0);
    expect(simultaneousPositive(model, tracks, [0, 10], [from, to], [0, 0])).toBe(reference);
    const unsupported = tracks.map((track) => ({ ...track, LineType: 2 }));
    expect(simultaneousPositive(model, unsupported, [0, 10], [from, to], [0, 0])).toBeUndefined();
  }
  const use = { sequence: "stand", seconds: 0, timeScale: 1 };
  expect(effectVisibility(model, { ...use, playbackUnknown: "unmodeled presentation" }, () => true).status).toBe("unknown");
  expect(effectVisibility(model, use, () => true).status).toBe("invisible");
  const particle = parseMDL('Version { FormatVersion 800, } Model "synthetic frozen emitter" { BlendTime 0, } ParticleEmitter2 "clock" { ObjectId 0, static EmissionRate 1, }');
  const geometry = parseMDL('Version { FormatVersion 800, } Model "synthetic triangle" { BlendTime 0, } Textures 1 { Bitmap { Image "triangle.blp", } } Materials 1 { Material { Layer { FilterMode None, static TextureID 0, } } } Geoset { Vertices 3 { {0,0,0}, {1,0,0}, {0,1,0}, } Faces 1 3 { Triangles { {0,1,2}, } } MaterialID 0, }');
  expect(effectVisibility(geometry, { ...use, timeScale: 0, travels: true }, () => true).status).toBe("visible");
  expect(effectVisibility(geometry, use, () => undefined).status).toBe("unknown");
  expect(effectVisibility(particle, { ...use, timeScale: 0, travels: true }, () => true).status).toBe("unknown");
  for (let example = 0; example < 128; example++) {
    const width = bit() * (example + 1), height = bit() * (example + 1);
    const shape = { ...geometry, Geosets: geometry.Geosets.map((geoset) => ({ ...geoset, Vertices: new Float32Array([0, 0, 0, width, 0, 0, 0, height, 0]) })) };
    expect(effectVisibility(shape, use, () => true).status).toBe(width * height > 0 ? "visible" : "invisible");
    expect(effectVisibility(shape, { ...use, scale: 0 }, () => true).status).toBe("invisible");
    expect(effectVisibility(shape, { ...use, alpha: 0 }, () => true).status).toBe("invisible");
    expect(effectVisibility(shape, { ...use, lifetime: 0 }, () => true).status).toBe("invisible");
  }
  const ribbon = parseMDL('Version { FormatVersion 800, } Model "synthetic ribbon" { BlendTime 0, } Textures 1 { Bitmap { Image "ribbon.blp", } } Materials 1 { Material { Layer { FilterMode None, static TextureID 0, } } } RibbonEmitter "trail" { ObjectId 0, static HeightAbove 0, static HeightBelow 0, static Alpha 1, static Visibility 1, EmissionRate 1, LifeSpan 1, Rows 1, Columns 1, MaterialID 0, }');
  for (let example = 0; example < 128; example++) {
    const above = bit() * (example + 1), below = bit() * (example + 1);
    const shape = { ...ribbon, RibbonEmitters: ribbon.RibbonEmitters.map((emitter) => ({ ...emitter, HeightAbove: above, HeightBelow: below })) };
    expect(effectVisibility(shape, use, () => true).status).toBe(above + below > 0 ? "unknown" : "invisible");
    expect(effectVisibility(shape, { ...use, travels: true }, () => true).status).toBe(above + below > 0 ? "unknown" : "invisible");
  }
  const animatedRibbon = { ...ribbon, RibbonEmitters: ribbon.RibbonEmitters.map((emitter) => ({ ...emitter, HeightAbove: { LineType: 0, GlobalSeqId: -1, Keys: [{ Frame: 0, Vector: new Float32Array([1]) }] } })) };
  expect(effectVisibility(animatedRibbon, use, () => true).status).toBe("unknown");
  const collapsed = { ...geometry, Geosets: geometry.Geosets.map((geoset) => ({ ...geoset, Vertices: new Float32Array([0, 0, 0, 1, 1, 0, 2, 2, 0]) })) };
  expect(effectVisibility(collapsed, use, () => true).status).toBe("invisible");
  const skinned = { ...geometry, Geosets: geometry.Geosets.map((geoset) => ({ ...geoset, SkinWeights: new Uint8Array(24) })) };
  expect(effectVisibility(skinned, use, () => true).status).toBe("unknown");
  const transformed = parseMDL('Version { FormatVersion 800, } Model "synthetic transformed" { BlendTime 0, } Textures 1 { Bitmap { Image "triangle.blp", } } Materials 1 { Material { Layer { FilterMode None, static TextureID 0, } } } Bone "collapsed" { ObjectId 0, Scaling 1 { Linear, 0: {0,0,0}, } } Geoset { Vertices 3 { {0,0,0}, {1,0,0}, {0,1,0}, } VertexGroup { 0, 0, 0, } Faces 1 3 { Triangles { {0,1,2}, } } Groups 1 1 { Matrices { 0 }, } MaterialID 0, }');
  expect(effectVisibility(transformed, use, () => true).status).toBe("unknown");
  expect(effectVisibility(geometry, { ...use, scale: 0, scaleEnd: 1 }, () => true).status).toBe("unknown");
  const late = { ...geometry, Sequences: parseMDL('Version { FormatVersion 800, } Model "synthetic interval" { BlendTime 0, } Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, } }').Sequences, Materials: geometry.Materials.map((material) => ({ ...material, Layers: material.Layers.map((layer) => ({ ...layer, Alpha: { LineType: 0, GlobalSeqId: -1, Keys: [{ Frame: 0, Vector: new Float32Array([0]) }, { Frame: 750, Vector: new Float32Array([1]) }] } })) })) };
  expect(effectVisibility(late, { ...use, lifetime: 0.5 }, () => true).status).toBe("invisible");
  expect(effectVisibility(late, { ...use, lifetime: 1 }, () => true).status).toBe("visible");
  const clock = particle.ParticleEmitters2[0];
  if (clock === undefined) throw new Error("synthetic emitter is missing");
  const emitting = { ...particle, Textures: geometry.Textures, ParticleEmitters2: [{ ...clock, TextureID: 0, Alpha: new Uint8Array([255, 255, 255]), ParticleScaling: new Float32Array([1, 1, 1]), LifeSpan: 1 }] };
  expect(effectVisibility(emitting, use, () => true).status).toBe("visible");
  const scaledEmitter = { ...emitting, ParticleEmitters2: emitting.ParticleEmitters2.map((emitter) => ({ ...emitter, Scaling: { LineType: 0, GlobalSeqId: -1, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }] } })) };
  expect(effectVisibility(scaledEmitter, use, () => true).status).toBe("unknown");
  const uses = effectUses(), source = effectSourceDigest(), cacheInfo = "a".repeat(64);
  const models = new Map(uses.map(({ model }) => [model, createHash("sha256").update(model).digest("hex")]));
  for (let example = 0; example < 2; example++) {
    const findings = uses.map((entry) => ({ ...entry, status: bit() ? "visible" as const : "unknown" as const, reason: `unsupported playback ${example}` }));
    const text = formatEffectRecord({ source, cacheInfo, models, findings });
    expect(effectRecordProblem(text)).toBeUndefined();
    expect(effectRecordUnknowns(text)).toEqual(findings.filter(({ status }) => status === "unknown").map((entry) => `${entry.fighter}\t${entry.move}\tUnknown\t${entry.model}\t${entry.reason}`));
    expect(effectRecordProblem(formatEffectRecord({ source, cacheInfo, models, findings: findings.slice(1) }))).toBeDefined();
    expect(effectRecordProblem(formatEffectRecord({ source, cacheInfo, models, findings: findings.map((entry, index) => index === example ? { ...entry, status: "invisible" } : entry) }))).toBeDefined();
    expect(effectRecordProblem(text.replace(source, "b".repeat(64)))).toBeDefined();
    const row = text.split("\n").filter((line) => line.startsWith("classic-use\t"))[example] ?? "";
    expect(effectRecordProblem(text.replace(row, row.replace(/^(classic-use\t[0-9a-f]{64}\t\w+\t)[0-9a-f]{64}/, `$1${"c".repeat(64)}`)))).toBeDefined();
    expect(effectRecordProblem(text.replaceAll("\tunknown\t", "\tmalformed\t").replaceAll("\tvisible\t", "\tmalformed\t"))).toBeDefined();
  }
});

test("re-recording one model's changed Classic inputs rewrites only its row and the header [k1 scenario]", () => {
  const uses = effectUses(), source = effectSourceDigest(), cacheInfo = "a".repeat(64);
  const models = new Map(uses.map(({ model }) => [model, createHash("sha256").update(model).digest("hex")]));
  const findings = uses.map((use) => ({ ...use, status: "visible" as const, reason: "MODEL-DATA" }));
  const lone = uses.find((use) => uses.filter(({ model }) => model === use.model).length === 1)?.model ?? "";
  const before = formatEffectRecord({ source, cacheInfo, models, findings }).split("\n");
  const after = formatEffectRecord({ source, cacheInfo, models: new Map([...models, [lone, "d".repeat(64)]]), findings }).split("\n");
  expect(before.length).toBe(uses.length + 2);
  expect(after.length).toBe(before.length);
  expect(before.flatMap((line, index) => line === after[index] ? [] : [line.split("\t")[0]])).toEqual(["classic-use"]);
  expect(effectRecordProblem(after.join("\n"))).toBeUndefined();
});

test("unrelated main changes keep a Classic effect record valid while effect input changes refuse it [k1 scenario]", () => {
  const repo = join(import.meta.dir, "../.."), root = mkdtempSync(join(tmpdir(), "classic-record-"));
  try {
    const previous = effectPlaybackInputs(repo);
    for (const path of new Set([...previous, ...EFFECT_RECORD_INPUTS])) cpSync(join(repo, path), join(root, path), { recursive: true });
    const uses = effectUses(), source = effectSourceDigest(root), cacheInfo = "a".repeat(64);
    expect(source).toBe(effectSourceDigest(repo));
    const models = new Map(uses.map(({ model }) => [model, createHash("sha256").update(model).digest("hex")]));
    const findings = uses.map((use) => ({ ...use, status: "visible" as const, reason: "MODEL-DATA" }));
    const text = formatEffectRecord({ source, cacheInfo, models, findings });
    const unrelated = previous.filter((path) => !path.endsWith("/") && !EFFECT_RECORD_INPUTS.includes(path));
    expect(unrelated).toContain("ts/src/platform/shell/view.ts");
    for (const path of unrelated) appendFileSync(join(root, path), "\nexport const unrelatedMainChange = 1;\n");
    for (const family of ["hero-models", "impact-assets", "stage-assets", "original-clips-static-lights"]) writeFileSync(join(root, "build-inputs", family), "f".repeat(64));
    expect(effectRecordProblem(text, root)).toBeUndefined();
    for (const path of EFFECT_RECORD_INPUTS) {
      const original = join(repo, path), copy = join(root, path);
      appendFileSync(copy, "\n");
      expect(effectRecordProblem(text, root)).toBeDefined();
      cpSync(original, copy);
    }
    expect(effectRecordProblem(text, root)).toBeUndefined();
    const changed = uses.findIndex((use) => uses.filter(({ model }) => model === use.model).length === 1);
    const stale = formatEffectRecord({ source, cacheInfo, models, findings: findings.map((entry, index) => index === changed ? { ...entry, seconds: entry.seconds + 1 } : entry) });
    expect(effectRecordProblem(stale, root)).toContain(`${uses[changed]?.fighter}/${uses[changed]?.move}`);
    const otherRecording = formatEffectRecord({ source: "b".repeat(64), cacheInfo, models, findings }).split("\n").filter((line) => line.startsWith("classic-use\t"));
    const merged = text.split("\n").map((line, index) => index === 1 ? otherRecording[0] ?? line : line).join("\n");
    expect(effectRecordProblem(merged, root)).toBeDefined();
    expect(uses.filter(({ model }) => /^war3mapImported[\\/]/i.test(model) && !/-[0-9a-f]{64}\.mdx$/i.test(model)).map(({ model }) => model).filter((model) => !IMPORTED_MODEL_FILES.some(({ entry }) => entry === model))).toEqual([]);
    expect(EFFECT_RECORD_INPUTS.every((path) => previous.includes(path) || previous.some((input) => input.endsWith("/") && path.startsWith(input)))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
