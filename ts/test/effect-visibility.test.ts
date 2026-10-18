import { expect, test } from "bun:test";
import { parseMDL, type model as mdx } from "wisp/vendor/war3-model.mjs";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { effectVisibility, effectVerdict, simultaneousPositive, trackFacts, classicModelFacts, judgeUse, effectUses, modelFactsKey, FACTS_VERSION, type EffectUse, type ModelFacts } from "../scripts/wisp/effectVisibility";
import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";
import { RISEN_ALPHA } from "../src/game/render/projectilePresentation";
import { STOCK_MODELS } from "../src/game/render/effects";
import { merge } from "../scripts/mergeGenerated";
import { formatEffectRecord, effectRecordProblem, effectRecordUnknowns, effectFindings, CUE_MODEL_RECORD, RECORD_COMMAND } from "../scripts/wisp/cueModels";

const triangle = parseMDL('Version { FormatVersion 800, } Model "synthetic triangle" { BlendTime 0, } Textures 1 { Bitmap { Image "triangle.blp", } } Materials 1 { Material { Layer { FilterMode None, static TextureID 0, } } } Geoset { Vertices 3 { {0,0,0}, {1,0,0}, {0,1,0}, } Faces 1 3 { Triangles { {0,1,2}, } } MaterialID 0, }');
const drawn = classicModelFacts(triangle, () => true);
const digestOf = (model: string) => createHash("sha256").update(model).digest("hex");
const factsRecord = (models: Iterable<string>, facts: (model: string) => ModelFacts | null = () => drawn, cacheInfo = "a".repeat(64)) => {
  const list = [...new Set(models)];
  return formatEffectRecord({ cacheInfo, models: new Map(list.map((model) => [model, digestOf(model)])), facts: new Map(list.map((model) => [model, facts(model)])) });
};

test("Classic effect visibility requires simultaneous supported tracks and moving particle playback [k2 property]", () => {
  const model = parseMDL('Version { FormatVersion 800, } Model "synthetic tracks" { BlendTime 0, }');
  let seed = 496;
  const bit = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 24) & 1; };
  for (let example = 0; example < 256; example++) {
    const values = [Array.from({ length: 11 }, bit), Array.from({ length: 11 }, bit)];
    const tracks: mdx.AnimVector[] = values.map((entries) => ({ LineType: 0, GlobalSeqId: -1, Keys: entries.map((value, Frame) => ({ Frame, Vector: new Float32Array([value]) })) }));
    const from = example % 10, to = Math.min(10, from + 1 + example % 5);
    const reference = values[0]?.slice(from, to + 1).some((value, offset) => value > 0 && (values[1]?.[from + offset] ?? 0) > 0);
    expect(simultaneousPositive(tracks.map(trackFacts), [0, 10], [from, to], [0, 0])).toBe(reference);
    const unsupported = tracks.map((track) => ({ ...track, LineType: 2 }));
    expect(simultaneousPositive(unsupported.map(trackFacts), [0, 10], [from, to], [0, 0])).toBeUndefined();
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
    expect(effectVisibility(shape, { ...use, width: 0 }, () => true).status).toBe("invisible");
    expect(effectVisibility(shape, { ...use, height: 0 }, () => true).status).toBe("invisible");
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
  const infinite = { ...late, Materials: late.Materials.map((material) => ({ ...material, Layers: material.Layers.map((layer) => ({ ...layer, Alpha: { LineType: 1, GlobalSeqId: -1, Keys: [{ Frame: 0, Vector: new Float32Array([-Infinity]) }, { Frame: 750, Vector: new Float32Array([Infinity]) }] } })) })) };
  const samples: readonly mdx.Model[] = [model, particle, geometry, ribbon, animatedRibbon, collapsed, skinned, transformed, late, emitting, scaledEmitter, infinite];
  const uses = effectUses();
  const sample = (model: string) => samples[[...model].reduce((sum, char) => sum + char.charCodeAt(0), 0) % samples.length] ?? geometry;
  for (const resolves of [() => true, () => undefined]) {
    const facts = (model: string) => classicModelFacts(sample(model), resolves);
    const text = factsRecord(uses.map(({ model }) => model), facts);
    const judged = effectFindings(text, uses);
    expect("findings" in judged && judged.findings).toEqual(uses.map((use) => ({ ...use, ...judgeUse(use, facts(use.model)) })));
    expect("findings" in judged && judged.findings.map(({ status, reason }) => ({ status, reason }))).toEqual(uses.map((use) => use.playbackUnknown === undefined && use.travels && use.anchored === "fighter" ? { status: "invisible", reason: "travelling effect drawn at a fixed fighter anchor, not with its projectile" } : effectVisibility(sample(use.model), use, resolves)));
    expect(effectRecordUnknowns(text, uses)).toEqual(uses.map((use) => judgeUse(use, facts(use.model))).filter(({ status }) => status === "unknown").map((entry) => `${entry.fighter}\t${entry.move}\tUnknown\t${entry.model}\t${entry.reason}`));
  }
  const text = factsRecord(uses.map(({ model }) => model));
  expect(effectRecordProblem(text, uses)).toBeUndefined();
  const judged = uses.find((use) => use.playbackUnknown === undefined);
  expect(effectRecordProblem(factsRecord(uses.map(({ model }) => model), (model) => model === judged?.model ? classicModelFacts(collapsed, () => true) : drawn), uses)).toContain(`${judged?.fighter}/${judged?.move}`);
  expect(effectRecordProblem(factsRecord(uses.slice(1).filter(({ model }) => model !== uses[0]?.model).map(({ model }) => model)), uses)).toContain(`${uses[0]?.model} (${uses[0]?.fighter}/${uses[0]?.move}`);
  expect(effectRecordProblem(text.replace(`classic-facts\t${FACTS_VERSION}\t`, `classic-facts\t${FACTS_VERSION + 1}\t`), uses)).toContain(RECORD_COMMAND);
  expect(effectRecordProblem(text.replace("a".repeat(64), "b".repeat(64)), uses)).toBeDefined();
  const row = text.split("\n").find((line) => line.startsWith("classic-model\t")) ?? "";
  expect(effectRecordProblem(text.replace(row, row.replace('"area":true', '"area":false')), uses)).toContain("1 model facts rows edited by hand");
  expect(effectVerdict(classicModelFacts(infinite, () => true), { ...use, lifetime: 1 })).toEqual(effectVisibility(infinite, { ...use, lifetime: 1 }, () => true));
});

test("re-recording one model's changed Classic facts rewrites only its row [k1 scenario]", () => {
  const uses = effectUses(), models = uses.map(({ model }) => model);
  const lone = uses.find((use) => uses.filter(({ model }) => model === use.model).length === 1)?.model ?? "";
  const before = factsRecord(models).split("\n");
  const after = factsRecord(models, (model) => model === lone ? classicModelFacts(triangle, () => undefined) : drawn).split("\n");
  expect(before.length).toBe(new Set(models).size + 2);
  expect(after.length).toBe(before.length);
  expect(before.flatMap((line, index) => line === after[index] ? [] : [line.split("\t")[1]])).toEqual([modelFactsKey(lone)]);
  expect(effectRecordProblem(after.join("\n"), uses)).toBeUndefined();
});

test("two lanes' Classic model facts merge row by row; changed uses are rejudged without a record change and only newly used models refuse [k1 scenario]", () => {
  const uses = effectUses();
  const record = (list: readonly EffectUse[]) => factsRecord(list.map(({ model }) => model));
  const changed = uses.findIndex((use) => use.kind === "impact");
  const addedA: EffectUse = { ...uses[0] as EffectUse, move: "lane a move", model: "Abilities\\Spells\\Other\\LaneA\\LaneA.mdx" };
  const addedB: EffectUse = { ...uses[0] as EffectUse, move: "lane b move", model: "Abilities\\Spells\\Other\\LaneB\\LaneB.mdx" };
  const laneA = [...uses, addedA];
  const laneB = [...uses.map((use, index) => index === changed ? { ...use, alpha: 128, seconds: use.seconds + 1 } : use), addedB];
  const both = [...laneB, addedA];
  expect(record(uses.map((use, index) => index === changed ? { ...use, alpha: 128, seconds: use.seconds + 1 } : use))).toBe(record(uses));
  const merged = merge("record", record(uses), record(laneA), record(laneB));
  expect(merged.conflicts).toBe(0);
  expect(effectRecordProblem(merged.text, both)).toBeUndefined();
  expect(merged.text.split("\n").filter((line) => line.startsWith("classic-model\t")).length).toBe(new Set(both.map(({ model }) => model)).size);
  for (const [lane, list, added] of [[laneA, both, addedB], [laneB, both, addedA]] as const) expect(effectRecordProblem(record(lane), list)).toBe(`Classic effect record is missing or stale: no model facts for 1 newly used models; from ts/ on a machine with the Warcraft III 3.0.0.24268 install run ${RECORD_COMMAND} and commit the record: ${added.model} (${added.fighter}/${added.move})`);
  expect(effectRecordProblem(record(uses), laneB.map((use, index) => index === changed ? { ...use, alpha: 0 } : use).filter((use) => use !== addedB))).toBe(`Classic effects: 1 invisible uses refuse the gate: ${uses[changed]?.fighter}/${uses[changed]?.move}`);
});

test("render, lockfile and producer edits keep the Classic record valid; a changed visibility value is rejudged and a new model path refuses with the record command [k1 scenario]", () => {
  const repo = join(import.meta.dir, "../.."), root = mkdtempSync(join(tmpdir(), "classic-record-"));
  try {
    for (const path of ["ts/src", "ts/scripts", "ts/package.json", "ts/tsconfig.json", "build-inputs/imported-models"]) cpSync(join(repo, path), join(root, path), { recursive: true });
    symlinkSync(join(repo, "ts/node_modules"), join(root, "ts/node_modules"));
    const uses = effectUses();
    writeFileSync(join(root, CUE_MODEL_RECORD), factsRecord(uses.map(({ model }) => model)));
    writeFileSync(join(root, "ts/check.ts"), 'import { readFileSync } from "node:fs";\nimport { effectRecordProblem } from "./scripts/wisp/cueModels";\nconsole.log(effectRecordProblem(readFileSync(new URL("../' + CUE_MODEL_RECORD + '", import.meta.url), "utf8")) ?? "valid");\n');
    const check = () => new TextDecoder().decode(Bun.spawnSync(["bun", "check.ts"], { cwd: join(root, "ts"), env: { ...process.env, NODE_ENV: "test" } }).stdout).trim();
    const edit = (path: string, from: string, to: string) => {
      const file = join(root, path), text = readFileSync(file, "utf8");
      expect(text).toContain(from);
      writeFileSync(file, text.replace(from, to));
    };
    expect(check()).toBe("valid");
    edit("ts/src/game/render/hitAreaEffects.ts", "this.origin.y - 14.0, this.origin.z + pose.z);\n        BlzSetSpecialEffectYaw(model, facingYaw", "this.origin.y - 15.0, this.origin.z + pose.z);\n        BlzSetSpecialEffectYaw(model, facingYaw");
    edit("ts/src/game/render/specialEffects.ts", "const SIPHON_LIGHTNING", "export const unrelatedRenderChange = 1;\nconst SIPHON_LIGHTNING");
    edit("ts/src/game/render/combatEffects.ts", "const STAR_KO_DEPTH = 1400.0;", "const STAR_KO_DEPTH = 1500.0;");
    edit("ts/package.json", '"private": true,', '"private": true,\n  "description": "unrelated",');
    for (const path of ["ts/bun.lock", "ts/wisp.lock", "typescript-toolchain.lock"]) writeFileSync(join(root, path), "unrelated landing\n");
    expect(check()).toBe("valid");
    edit("ts/src/game/render/projectilePresentation.ts", `export const RISEN_ALPHA = ${RISEN_ALPHA};`, "export const RISEN_ALPHA = 100;");
    expect(check()).toBe("valid");
    edit("ts/src/game/render/projectilePresentation.ts", "export const RISEN_ALPHA = 100;", "export const RISEN_ALPHA = 0;");
    const risen = uses.filter((use) => use.alpha === RISEN_ALPHA && use.kind === "projectile");
    expect(risen.length).toBeGreaterThan(0);
    expect(check()).toBe(`Classic effects: ${risen.length} invisible uses refuse the gate: ${risen.map((use) => `${use.fighter}/${use.move}`).join("; ")}`);
    edit("ts/src/game/render/projectilePresentation.ts", "export const RISEN_ALPHA = 0;", `export const RISEN_ALPHA = ${RISEN_ALPHA};`);
    edit("ts/src/game/render/effects.ts", '"Abilities\\\\Spells\\\\Other\\\\Silence\\\\SilenceTarget.mdx"', '"Abilities\\\\Spells\\\\Other\\\\Silence\\\\SilenceLaneTarget.mdx"');
    const silenced = uses.filter((use) => use.model === STOCK_MODELS.silenceTarget && use.kind === "presentation effect");
    expect(silenced.length).toBe(1);
    expect(check()).toBe(`Classic effect record is missing or stale: no model facts for 1 newly used models; from ts/ on a machine with the Warcraft III 3.0.0.24268 install run ${RECORD_COMMAND} and commit the record: ${STOCK_MODELS.silenceTarget.replace("SilenceTarget", "SilenceLaneTarget")} (${silenced.map((use) => `${use.fighter}/${use.move}`).join(", ")})`);
    expect(uses.filter(({ model }) => /^war3mapImported[\\/]/i.test(model) && !/-[0-9a-f]{64}\.mdx$/i.test(model)).map(({ model }) => model).filter((model) => !IMPORTED_MODEL_FILES.some(({ entry }) => entry === model))).toEqual([]);
    edit("build-inputs/imported-models", readFileSync(join(repo, "build-inputs/imported-models"), "utf8").trim(), "f".repeat(64));
    expect(check()).toContain(`@${"f".repeat(64)} (cairne-bloodhoof/`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
