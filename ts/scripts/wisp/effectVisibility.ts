import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Console, Effect, Schema } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { dirname, join, relative } from "node:path";
import { type model as mdx } from "wisp/vendor/war3-model.mjs";
import { parseModelMDX } from "wisp/scripts/wisp/models";
import { selectSequence } from "wisp/src/headless/animation";
import { Character } from "../../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug, heroDefinition } from "../../src/game/sim/heroes/registry";
import { HERO_CUES, fighterMoveCues, fighterBranchCues, fighterCueList, type Cue } from "../../src/game/presentation/specialCues";
import { ATTACK_CUES } from "../../src/game/presentation/attackCues";
import { DISJOINT_CUES } from "../../src/game/presentation/disjointCues";
import { PROJECTILE_DRAW_CUES, PROJECTILE_DRAW_OFFSETS, SPECIAL_SLOTS, heroProjectileArt, ultimateProjectiles, fighterProjectileModels } from "../../src/game/presentation/projectileArt";
import { STATIONARY_PARTICLE_MODELS } from "../../src/game/render/projectilePresentation";
import { FIGHTER_ULTIMATES } from "../../src/game/sim/ultimates";
import { summonClip, summonClipCount, SUMMON_BEAR } from "../../src/game/presentation/summonClipInfo";
import type { AuthoredSpecial, SpecialProjectile } from "../../src/game/sim/heroSpecials";
import { DEFINITIVE_CUE_EMITTERS } from "../../src/game/presentation/cueEmitterInfo";
import { impactModel, impactAnimation, impactStartSeconds } from "../../src/game/presentation/hitPresentation";
import { IMPACT_KIND_COUNT } from "../../src/game/presentation/impactState";
import { STOCK_MODELS } from "../../src/game/render/effects";
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL, IMPACT_DEFILE_MODEL } from "../../src/game/assets/impactAssetInfo";
import { readPins } from "./buildInputs";
import { headlessRender } from "./headlessRender";

/** How one move shows one model in Classic: the sequence and seek it plays, its time scale, and whether its anchor travels. */
export interface EffectUse {
  readonly fighter: string;
  readonly move: string;
  readonly kind: "special cue" | "attack cue" | "contact accent" | "projectile" | "impact" | "presentation effect";
  readonly model: string;
  readonly sequence: string | undefined;
  readonly seconds: number;
  readonly timeScale: number;
  readonly travels: boolean;
  readonly anchored: "fighter" | "projectile";
  readonly scale?: number | undefined;
  readonly scaleEnd?: number | undefined;
  readonly alpha?: number | undefined;
  readonly lifetime?: number | undefined;
  readonly anchor?: string | undefined;
  readonly playbackUnknown?: string;
}

export interface EffectVerdict {
  readonly status: "visible" | "invisible" | "unknown";
  readonly reason: string;
}

type Track = mdx.AnimVector | number | null | undefined;
type Window = readonly [from: number, to: number];

const scalar = (vector: unknown): number => (vector as ArrayLike<number> | undefined)?.[0] ?? 0;

const verdict = (status: EffectVerdict["status"], reason: string): EffectVerdict => ({ status, reason });

export function simultaneousPositive(model: mdx.Model, tracks: readonly Track[], sequence: Window, window: Window, fallbacks: readonly number[]): boolean | undefined {
  const keys = tracks.map((track) => track !== null && typeof track === "object" ? track.Keys.filter((key) => key.Frame >= sequence[0] && key.Frame <= sequence[1]) : []);
  if (tracks.some((track) => track !== null && typeof track === "object" && ((track.GlobalSeqId !== undefined && track.GlobalSeqId !== null && track.GlobalSeqId !== -1 && track.GlobalSeqId !== 0xffffffff) || track.LineType > 1))) return undefined;
  const points = [...new Set([window[0], window[1], ...keys.flatMap((entries) => entries.map((key) => key.Frame).filter((frame) => frame >= window[0] && frame <= window[1]))])].sort((a, b) => a - b);
  const samples = [...points, ...points.slice(1).map((point, index) => ((points[index] ?? point) + point) / 2)];
  const at = (track: Track, index: number, frame: number): number => {
    if (track == null) return fallbacks[index] ?? 0;
    if (typeof track === "number") return track;
    const entries = keys[index] ?? [];
    const before = entries.filter((key) => key.Frame <= frame).at(-1) ?? entries[0];
    if (before === undefined) return fallbacks[index] ?? 0;
    const after = entries.find((key) => key.Frame > frame);
    if (after === undefined || track.LineType === 0 || frame <= before.Frame) return scalar(before.Vector);
    const progress = (frame - before.Frame) / (after.Frame - before.Frame);
    return scalar(before.Vector) + (scalar(after.Vector) - scalar(before.Vector)) * progress;
  };
  return samples.some((frame) => tracks.every((track, index) => at(track, index, frame) > 0));
}

export function effectVisibility(model: mdx.Model, use: Pick<EffectUse, "sequence" | "seconds" | "timeScale"> & Partial<Pick<EffectUse, "travels" | "playbackUnknown" | "scale" | "scaleEnd" | "alpha" | "lifetime">>, textureResolves: (path: string) => boolean | undefined): EffectVerdict {
  if ((use.alpha ?? 255) <= 0 || (use.lifetime ?? Infinity) <= 0 || use.scale === 0 && (use.scaleEnd ?? 0) === 0) return verdict("invisible", "presentation scale, alpha or lifetime prevents drawing");
  if (use.playbackUnknown !== undefined) return verdict("unknown", use.playbackUnknown);
  if (use.scaleEnd !== undefined && use.scaleEnd !== use.scale) return verdict("unknown", "per-frame scale transition coverage is unmodeled");
  const particleCount = model.ParticleEmitters2.length + model.RibbonEmitters.length + model.ParticleEmitters.length + (model.ParticleEmitterPopcorns?.length ?? 0);
  if (use.travels && use.timeScale === 0 && particleCount > 0) return verdict("unknown", "travelling particle/ribbon effect is frozen; a visible geoset does not establish its moving spell art (#484)");
  const sequences = model.Sequences.map((sequence) => ({ name: sequence.Name, start: sequence.Interval[0] ?? 0, end: sequence.Interval[1] ?? 0, looping: !sequence.NonLooping, rarity: sequence.Rarity }));
  const wanted = use.sequence === undefined ? ["birth", "stand"] : [use.sequence];
  const found = wanted.map((name) => selectSequence(sequences, name)).filter((index) => index >= 0);
  const stand = selectSequence(sequences, "stand");
  const picked = found.length > 0 ? found : sequences.length > 0 ? [stand >= 0 ? stand : 0] : [];
  const windows = picked.length === 0 ? [{ sequence: [0, 0] as Window, window: [0, 0] as Window, name: "none" }] : picked.map((index) => {
    const { start, end, name } = sequences[index] ?? { start: 0, end: 0, name: "none" };
    const at = Math.min(end, start + use.seconds * 1000);
    return { sequence: [start, end] as Window, window: [at, use.timeScale > 0 ? Math.min(end, at + (use.lifetime ?? Infinity) * use.timeScale * 1000) : at] as Window, name };
  });
  const texture = (id: number | undefined, replaceable?: number): boolean | undefined => {
    if ((replaceable ?? 0) > 0) return undefined;
    const image = id === undefined ? undefined : model.Textures[id];
    if (image === undefined || (image.ReplaceableId ?? 0) > 0) return undefined;
    return textureResolves(image.Image);
  };
  const unknown: string[] = [];
  const supportedNode = (node: mdx.Model["Nodes"][number] | undefined, seen = new Set<number>()): boolean => {
    if (node === undefined || seen.has(node.ObjectId)) return false;
    seen.add(node.ObjectId);
    if (node.Translation?.Keys.length || node.Rotation?.Keys.length || node.Scaling?.Keys.length || (node.Flags & 255) !== 0) return false;
    return node.Parent == null || node.Parent === -1 || node.Parent === 0xffffffff || supportedNode(model.Nodes[node.Parent], seen);
  };
  const draws = (tracks: readonly Track[], fallbacks: readonly number[], sequence: Window, window: Window, resolved: boolean | undefined, label: string) => {
    const positive = simultaneousPositive(model, tracks, sequence, window, fallbacks);
    if (positive === undefined) unknown.push(`${label}: global or nonlinear track is unverified`);
    else if (positive && resolved === undefined) unknown.push(`${label}: texture or replaceable texture unresolved`);
    return positive === true && resolved === true;
  };
  for (const { sequence, window, name } of windows) {
    if (use.timeScale > 0) {
      for (const emitter of model.ParticleEmitters2) {
        if (!supportedNode(emitter)) { unknown.push(`emitter ${emitter.Name}: node transforms are unverified`); continue; }
        const shows = Math.max(0, ...(emitter.Alpha ?? [])) > 0 && Math.max(0, ...(emitter.ParticleScaling ?? [])) > 0 && (emitter.LifeSpan ?? 0) > 0;
        if (shows && draws([emitter.Visibility, emitter.EmissionRate], [1, 0], sequence, window, texture(emitter.TextureID, emitter.ReplaceableId), `emitter ${emitter.Name}`)) return verdict("visible", `MODEL-DATA: emitter ${emitter.Name} emits in ${name}`);
      }
      for (const emitter of model.RibbonEmitters) {
        if (typeof emitter.HeightAbove !== "number" || typeof emitter.HeightBelow !== "number" || !Number.isFinite(emitter.HeightAbove + emitter.HeightBelow)) { unknown.push(`ribbon ${emitter.Name}: height geometry is unverified`); continue; }
        if (emitter.HeightAbove + emitter.HeightBelow <= 0 || (emitter.LifeSpan ?? 0) <= 0) continue;
        if (!supportedNode(emitter)) { unknown.push(`ribbon ${emitter.Name}: node transforms are unverified`); continue; }
        const material = emitter.MaterialID === undefined ? undefined : model.Materials[emitter.MaterialID];
        for (const layer of material?.Layers ?? []) if (draws([emitter.Visibility, emitter.EmissionRate, emitter.Alpha, layer.Alpha], [1, 0, 1, 1], sequence, window, texture(typeof layer.TextureID === "number" ? layer.TextureID : undefined), `ribbon ${emitter.Name}`)) unknown.push(`ribbon ${emitter.Name}: nondegenerate trail motion is unverified`);
      }
      if (model.ParticleEmitters.length + (model.ParticleEmitterPopcorns?.length ?? 0) > 0) unknown.push("model-particle/Popcorn dependency playback is unverified");
    }
    for (const [index, geoset] of model.Geosets.entries()) {
      if (geoset.Faces.length < 3) continue;
      if ((geoset.SkinWeights?.length ?? 0) > 0 || (geoset.Groups ?? []).some((group) => group.some((id) => !supportedNode(model.Nodes[id])))) { unknown.push(`geoset ${index}: skinning or node transforms are unverified`); continue; }
      let area = false;
      for (let face = 0; face + 2 < geoset.Faces.length; face += 3) {
        const vertices = [0, 1, 2].map((offset) => {
          const vertex = geoset.Faces[face + offset];
          return vertex === undefined ? [] : Array.from(geoset.Vertices.slice(vertex * 3, vertex * 3 + 3));
        });
        if (vertices.some((vertex) => vertex.length !== 3 || vertex.some((value) => !Number.isFinite(value)))) { unknown.push(`geoset ${index}: invalid triangle vertices`); continue; }
        const [a, b, c] = vertices;
        const ab = [0, 1, 2].map((axis) => (b?.[axis] ?? 0) - (a?.[axis] ?? 0));
        const ac = [0, 1, 2].map((axis) => (c?.[axis] ?? 0) - (a?.[axis] ?? 0));
        area ||= [0, 1, 2].some((axis) => (ab[(axis + 1) % 3] ?? 0) * (ac[(axis + 2) % 3] ?? 0) - (ab[(axis + 2) % 3] ?? 0) * (ac[(axis + 1) % 3] ?? 0) !== 0);
      }
      if (!area) continue;
      const anim = model.GeosetAnims.find((entry) => entry.GeosetId === index);
      const material = model.Materials[geoset.MaterialID];
      for (const layer of material?.Layers ?? []) if (draws([anim?.Alpha, layer.Alpha], [1, 1], sequence, window, texture(typeof layer.TextureID === "number" ? layer.TextureID : undefined), `geoset ${index}`)) return verdict("visible", `MODEL-DATA: geoset ${index} draws in ${name}`);
    }
  }
  return unknown.length > 0 ? verdict("unknown", [...new Set(unknown)].join("; ")) : verdict("invisible", `nothing emits or draws in ${windows.map(({ name }) => name).join("/")}${use.timeScale > 0 ? "" : " at time scale 0"}`);
}

const slotMove = (slot: string) => `${slot}-special`;

function cueUse(fighter: string, move: string, kind: EffectUse["kind"], cue: Cue): EffectUse {
  const popcorn = kind !== "contact accent" && DEFINITIVE_CUE_EMITTERS[cue.model] === true;
  return { fighter, move, kind, model: cue.model, scale: cue.scale, scaleEnd: popcorn ? undefined : cue.scaleEnd, alpha: popcorn || kind === "contact accent" ? 255 : cue.alpha ?? 255, lifetime: popcorn ? 1 : undefined, anchor: cue.anchor, sequence: popcorn && cue.birth !== undefined ? "birth" : cue.sequence, seconds: popcorn && cue.birth !== undefined ? 0 : cue.seconds ?? 0, timeScale: popcorn ? 1 : cue.timeScale ?? (kind === "contact accent" ? 0 : 1), travels: false, anchored: "fighter", ...(popcorn ? { playbackUnknown: cue.birth?.lingerFrames === undefined ? "confirmed emitter births are hidden by predicted cue phase; active-window coverage is unverified (#365/#496)" : "confirmed emitter births retain a bounded phase handoff; native active-window coverage is unverified (#365/#496)" } : {}) };
}

function projectileUse(character: Character, fighter: string, move: string, spec: SpecialProjectile): EffectUse | undefined {
  const model = spec.model;
  if (model === undefined) return undefined;
  const draw = PROJECTILE_DRAW_OFFSETS[model];
  const cue = PROJECTILE_DRAW_CUES[model];
  const travels = spec.velocityX !== 0 || spec.velocityZ !== 0;
  const birthNamed = ["FreezingBreathMissile", "WaterElementalMissile", "FrostWyrmMissile"].some((name) => model.includes(name));
  const base = { fighter, move, kind: "projectile" as const, model, travels, anchored: "projectile" as const, scale: cue?.scale ?? 1, lifetime: spec.life / 60, anchor: "projectile" };
  if (character === Character.lichKing && spec.pool !== undefined) return { ...base, sequence: "stand", seconds: 0, timeScale: 1, playbackUnknown: "Defile per-frame age seeking and armed visibility is unmodeled" };
  if (character === Character.lichKing && model.includes("ImpaleHitTarget")) return { ...base, sequence: "birth", seconds: 0.3, timeScale: 0 };
  if (character === Character.lichKing && model.includes("AnimateDeadTarget")) return { ...base, sequence: "birth", seconds: 0, timeScale: 1, playbackUnknown: "Val'kyr tell per-frame lifetime seeking is unmodeled" };
  if (spec.modelRadius !== undefined) return { ...base, sequence: draw?.sequence, seconds: draw?.seconds ?? 0, timeScale: draw?.seconds === undefined ? 1 : 0, playbackUnknown: "per-frame projectile radius scale coverage is unmodeled" };
  if (draw?.seconds !== undefined) return { ...base, sequence: draw.sequence, seconds: draw.seconds, timeScale: 0 };
  if (cue?.birth !== undefined) return { ...base, sequence: "birth", seconds: 0, timeScale: 1 };
  const sequence = draw?.sequence ?? (birthNamed ? "birth" : "stand");
  if (!travels) return STATIONARY_PARTICLE_MODELS.includes(model) ? { ...base, sequence, seconds: 0.3, timeScale: 1 } : { ...base, sequence, seconds: 0.3, timeScale: 0 };
  return { ...base, sequence, seconds: 0, timeScale: 1 };
}

/** Every effect any fighter's move shows in Classic. */
export function effectUses(): EffectUse[] {
  const uses: EffectUse[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = fighterSlug(character);
    const cues = HERO_CUES[character];
    for (const slot of SPECIAL_SLOTS) {
      const move = fighterMoveCues(character)[SPECIAL_SLOTS.indexOf(slot)];
      if (move === undefined) continue;
      for (const [phase, cue] of [["startup", move.startup], ["active", move.active]] as const) {
        if (cue.drawn === true) {
          const specials = heroDefinition(character)?.specials;
          const travelling = specials !== undefined && specials[slot] !== undefined && heroProjectileArt(specials).some((art) => art.slot === slot && (art.spec.velocityX !== 0 || art.spec.velocityZ !== 0) && art.spec.model === cue.model);
          if (!travelling) uses.push({ ...cueUse(fighter, `${slotMove(slot)} ${move.spell} ${phase}`, "special cue", cue), playbackUnknown: "externally drawn cue playback/anchor is unmodeled" });
          continue;
        }
        uses.push(cueUse(fighter, `${slotMove(slot)} ${move.spell} ${phase}`, "special cue", cue));
      }
    }
    const named = new Set(fighterMoveCues(character).flatMap((move) => [move.startup, move.active]));
    for (const [index, cue] of fighterCueList(character).entries()) if (!named.has(cue) && cue.drawn !== true) {
      const branch = fighterBranchCues(character).find((move) => move.startup === cue || move.active === cue);
      const form = character === Character.dreadlord ? "Healing bite" : character === Character.kaelthas ? "Phoenix" : character === Character.kobold ? "Burrow trail" : `form cue ${index}`;
      uses.push(cueUse(fighter, `${branch?.spell ?? form} ${branch?.startup === cue ? "startup" : "active"}`, "special cue", cue));
    }
    for (const entries of Object.values(ATTACK_CUES[character] ?? {})) for (const entry of entries) uses.push(cueUse(fighter, entry.name, "attack cue", entry.cue));
    const accent = DISJOINT_CUES[character];
    if (accent !== undefined) uses.push(cueUse(fighter, "contact accent", "contact accent", accent));
    const specials = heroDefinition(character)?.specials;
    if (specials !== undefined) for (const { slot, spec } of heroProjectileArt(specials)) {
      const use = projectileUse(character, fighter, `${slotMove(slot)} ${cues?.[slot]?.spell ?? ""} projectile`.replace("  ", " "), spec);
      if (use !== undefined) uses.push(use);
    }
    for (const spec of ultimateProjectiles(character)) {
      const use = projectileUse(character, fighter, "ultimate projectile", spec);
      if (use !== undefined) uses.push(use);
    }
  }
  const supplemental = (fighter: string, move: string, model: string, playbackUnknown: string): EffectUse => ({ fighter, move, kind: "presentation effect", model, sequence: undefined, seconds: 0, timeScale: 1, travels: false, anchored: "fighter", playbackUnknown });
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = fighterSlug(character);
    if (heroDefinition(character) === undefined) for (const model of fighterProjectileModels(character)) if (!uses.some((use) => use.fighter === fighter && use.kind === "projectile" && use.model === model)) uses.push(supplemental(fighter, "legacy projectile", model, "legacy projectile playback requires an observed frame trace"));
    for (let kind = 0; kind < IMPACT_KIND_COUNT; kind++) uses.push({ fighter, move: `common impact ${kind}`, kind: "impact", model: impactModel(kind), sequence: impactAnimation(kind), seconds: impactStartSeconds(kind), timeScale: 1, travels: false, anchored: "fighter" });
    const visit = (special: AuthoredSpecial | undefined, move: string): void => {
      if (special === undefined) return;
      if (special.placement !== undefined) uses.push(supplemental(fighter, `${move} placed object`, special.placement.model?.path ?? heroDefinition(character)?.presentation.placedModel?.path ?? "Units\\Orc\\SerpentWard\\SerpentWard.mdx", "placed-object animation/lifetime is unmodeled"));
      visit(special.ex, `${move} EX`);
      for (const followUp of special.followUps ?? []) visit(followUp.special, `${move} follow-up`);
    };
    const specials = heroDefinition(character)?.specials;
    if (specials !== undefined) for (const slot of SPECIAL_SLOTS) {
      const kit = specials[slot];
      visit(kit.ground, `${slot} ground`); visit(kit.air, `${slot} air`); visit(kit.recall, `${slot} recall`); visit(kit.marked?.special, `${slot} marked`);
    }
    visit(FIGHTER_ULTIMATES[character], "ultimate");
  }
  for (let clip = 0; clip < summonClipCount(SUMMON_BEAR); clip++) uses.push(supplemental(fighterSlug(Character.rifleman), `Bear summon clip ${clip}`, summonClip(SUMMON_BEAR, clip).modelPath, "summonPresentation seeking playback is unmodeled"));
  for (const [move, model] of [["Fel Rush aura", IMPACT_ROLL_MODEL], ["Immolate flames", STOCK_MODELS.immolationTarget], ["Mana Burn hand", STOCK_MODELS.manaBurnTarget], ["Wing Ascent trail", IMPACT_DUST_MODEL], ["Mana Burn drain flash", IMPACT_TECH_MODEL], ["silence status", STOCK_MODELS.silenceTarget], ["Eye Blast marks", STOCK_MODELS.greenDragonMissile]] as const) uses.push(supplemental(fighterSlug(Character.demonHunter), move, model, "specialEffects producer playback requires an observed frame trace"));
  for (const [move, model] of [["raised skeleton", "Units\\Undead\\Skeleton\\Skeleton.mdx"], ["raised burst", "Abilities\\Spells\\Undead\\RaiseSkeletonWarrior\\RaiseSkeleton.mdx"], ["Defile boundary", IMPACT_DEFILE_MODEL], ["Defile frost", "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx"]] as const) uses.push(supplemental(fighterSlug(Character.lichKing), move, model, "projectilePresentation supplemental playback is unmodeled"));
  const seen = new Set<string>();
  return uses.filter((use) => {
    const key = JSON.stringify(use);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface EffectFinding extends EffectUse, EffectVerdict {}

/** Judges every use: a missing Classic model, a hidden sequence window, or a travelling effect held at a fighter anchor. */
export async function checkEffects(read: (path: string) => Promise<Uint8Array | undefined>, uses: readonly EffectUse[] = effectUses()): Promise<EffectFinding[]> {
  const models = new Map<string, mdx.Model | undefined>();
  const textures = new Map<string, boolean>();
  for (const use of uses) if (!models.has(use.model)) {
    const bytes = await read(use.model);
    let parsed: mdx.Model | undefined;
    try { parsed = bytes === undefined || bytes.length === 0 ? undefined : parseModelMDX(bytes.slice().buffer); } catch { parsed = undefined; }
    models.set(use.model, parsed);
    for (const texture of parsed?.Textures ?? []) if (texture.Image !== "" && !textures.has(texture.Image)) textures.set(texture.Image, ((await read(texture.Image))?.length ?? 0) > 0);
  }
  return uses.map((use) => {
    const model = models.get(use.model);
    if (model === undefined) return { ...use, status: "unknown", reason: "model missing from the selected Classic cache or unparseable" };
    if (use.playbackUnknown === undefined && use.travels && use.anchored === "fighter") return { ...use, status: "invisible", reason: "travelling effect drawn at a fixed fighter anchor, not with its projectile" };
    return { ...use, ...effectVisibility(model, use, (path) => textures.get(path) === true ? true : undefined) };
  });
}

export function stockCacheReader(root: string): (path: string) => Promise<Uint8Array | undefined> {
  if (!existsSync(join(root, "build-info.json"))) throw new Error("--stock-cache must name one exact Classic build cache with build-info.json");
  return async (path) => {
    const key = path.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx");
    const names = /\.(blp|tga|dds|png)$/.test(key) ? [".dds", ".png", ".blp", ".tga"].map((ext) => key.replace(/\.[^.]+$/, ext)) : [key];
    for (const name of names) {
      const file = join(root, name);
      if (existsSync(file)) return new Uint8Array(await Bun.file(file).arrayBuffer());
    }
    return undefined;
  };
}

/** Reads stock files from the cache and the map's own imports through the headless renderer. */
export function classicReader(stock: (path: string) => Promise<Uint8Array | undefined>): (path: string) => Promise<Uint8Array | undefined> {
  let render: ReturnType<typeof headlessRender> | undefined;
  return async (path) => (await stock(path)) ?? (/^war3mapImported[\\/]/i.test(path) ? (render ??= headlessRender()).readAsset(path, "classic") : undefined);
}

export const EFFECT_PLAYBACK_INPUTS = ["ts/scripts/wisp/effectVisibility.ts", "ts/scripts/cueModels.ts", "ts/scripts/wisp/cueModels.ts", "ts/scripts/prePush.ts", "ts/src/platform/shell/view.ts", "ts/src/game/presentation/specialCues.ts", "ts/src/game/presentation/attackCues.ts", "ts/src/game/presentation/projectileArt.ts", "ts/src/game/presentation/projectilePose.ts", "ts/wisp.lock", "ts/bun.lock", "ts/package.json", "typescript-toolchain.lock", "ts/src/game/render/specialCueEffects.ts", "ts/src/game/render/projectilePresentation.ts", "ts/src/game/render/hitAreaEffects.ts", "ts/src/game/render/specialEffects.ts", "ts/src/game/render/combatEffects.ts", "ts/src/game/render/placedObjectEffects.ts", "ts/src/game/render/summonPresentation.ts", "build-inputs/"];
export function effectPlaybackInputs(root = join(import.meta.dir, "../../..")): string[] {
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const seen = new Set<string>(EFFECT_PLAYBACK_INPUTS);
  const visit = (path: string) => {
    const file = join(root, path);
    if (!existsSync(file) || !/\.tsx?$/.test(path)) return;
    for (const entry of transpiler.scanImports(readFileSync(file, "utf8"))) {
      if (!entry.path.startsWith(".")) continue;
      const base = join(dirname(file), entry.path);
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((candidate) => existsSync(candidate) && /\.tsx?$/.test(candidate));
      if (found === undefined) continue;
      const input = relative(root, found);
      if (seen.has(input)) continue;
      seen.add(input);
      visit(input);
    }
  };
  for (const path of EFFECT_PLAYBACK_INPUTS) visit(path);
  return [...seen].sort();
}
export const effectUseDigest = (use: EffectUse) => createHash("sha256").update(JSON.stringify(use)).digest("hex");
export function effectSourceDigest(root = join(import.meta.dir, "../../..")): string {
  const hash = createHash("sha256").update(JSON.stringify(effectUses()));
  for (const path of effectPlaybackInputs(root)) if (existsSync(join(root, path))) hash.update(path).update(path.endsWith("/") ? JSON.stringify(readPins(join(root, path))) : readFileSync(join(root, path)));
  return hash.digest("hex");
}

export class EffectCheckFailure extends Schema.TaggedError<EffectCheckFailure>()("EffectCheckFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}
const CacheInfo = Schema.Struct({ fields: Schema.Struct({ Version: Schema.String }) });
export const readEffectReport = Effect.fnUntraced(function*(root: string) {
  const info = yield* Effect.tryPromise({ try: () => Bun.file(join(root, "build-info.json")).text(), catch: (cause) => new EffectCheckFailure({ problem: `Classic cache: ${String(cause)}` }) });
  const decoded = yield* Schema.decodeEffect(Schema.fromJsonString(CacheInfo))(info);
  if (decoded.fields.Version !== "3.0.0.24268") return yield* new EffectCheckFailure({ problem: `Classic calibration needs 3.0.0.24268, got ${decoded.fields.Version}` });
  const input = classicReader(stockCacheReader(root));
  const hashes = new Map<string, string>();
  const findings = yield* Effect.tryPromise({
    try: () => checkEffects(async (path) => { const bytes = await input(path); if (bytes !== undefined) hashes.set(path, createHash("sha256").update(bytes).digest("hex")); return bytes; }),
    catch: (cause) => new EffectCheckFailure({ problem: `Classic effect check: ${String(cause)}` }),
  });
  const provenance = createHash("sha256").update(info).update(JSON.stringify([...hashes].sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
  return { source: effectSourceDigest(), provenance, cache: root, inputs: [...hashes], findings };
});

if (import.meta.main) BunRuntime.runMain(Effect.gen(function*() {
  const at = process.argv.indexOf("--stock-cache"), root = at < 0 ? process.env.CLASSIC_EFFECT_CACHE : process.argv[at + 1];
  if (root === undefined) return yield* new EffectCheckFailure({ problem: "name one exact 24268 cache with --stock-cache DIRECTORY or CLASSIC_EFFECT_CACHE" });
  const report = yield* readEffectReport(root);
  const flagged = report.findings.filter(({ status }) => status !== "visible");
  if (process.argv.includes("--json")) yield* Console.log(JSON.stringify(report, null, 2));
  else for (const finding of flagged) yield* Console.log(`${finding.fighter}\t${finding.move}\t${finding.status}\t${finding.model}\t${finding.reason}`);
  yield* Console.error(`${flagged.length} invisible/Unknown of ${report.findings.length} Classic effect uses (${new Set(report.findings.map(({ model }) => model)).size} models); MODEL-DATA visibility only`);
  if (report.findings.some(({ status }) => status === "invisible") && process.argv.includes("--strict")) return yield* new EffectCheckFailure({ problem: "invisible Classic effects refuse the gate; Unknown uses remain report debt" });
}));
