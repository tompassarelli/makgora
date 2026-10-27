import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Console, Effect, Schema } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { dirname, join, relative } from "node:path";
import { type model as mdx } from "wisp/vendor/war3-model.mjs";
import { parseModelMDX } from "wisp/scripts/wisp/models";
import { selectSequence } from "wisp/src/headless/animation";
import { Character } from "../../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug, heroDefinition } from "../../src/game/roster/kits";
import { HERO_CUES, fighterMoveCues, fighterBranchCues, fighterCueList, type Cue } from "../../src/game/presentation/specialCues";
import { ATTACK_CUES } from "../../src/game/presentation/attackCues";
import { DISJOINT_CUES } from "../../src/game/presentation/disjointCues";
import { PROJECTILE_DRAW_CUES, PROJECTILE_DRAW_OFFSETS, SPECIAL_SLOTS, heroProjectileArt, ultimateProjectiles, fighterProjectileModels } from "../../src/game/presentation/projectileArt";
import { STATIONARY_PARTICLE_MODELS, STATIONARY_SECONDS, BIRTH_MISSILES, RISEN_ALPHA } from "../../src/game/render/projectilePresentation";
import { projectileModelScale } from "../../src/game/presentation/projectilePose";
import { ACCENT_SECONDS, ACCENT_SEQUENCE } from "../../src/game/render/hitAreaEffects";
import { FIGHTER_ULTIMATES } from "../../src/game/sim/ultimates";
import { summonClip, summonClipCount, SUMMON_BEAR } from "../../src/game/presentation/summonClipInfo";
import type { AuthoredSpecial, SpecialProjectile } from "../../src/game/sim/specials/schema";
import { specialPlacements } from "../../src/game/sim/specials/placements";
import { POPCORN_CUE_MODELS } from "../../src/game/presentation/cueEmitterInfo";
import { CLASSIC_BUILDS } from "./classicBuilds";
import { impactModel, impactAnimation, impactStartSeconds, impactModelScale } from "../../src/game/presentation/hitPresentation";
import { IMPACT_KIND_COUNT } from "../../src/game/presentation/impactState";
import { STOCK_MODELS } from "../../src/game/render/effects";
import { CANDLE_FLAME_MODELS, CANDLE_FLAME_SCALES, CANDLE_SMOKE } from "../../src/game/presentation/candleLook";
import { characterModelScale } from "../../src/game/presentation/modelScale";
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL, IMPACT_DEFILE_MODEL } from "../../src/game/assets/impactAssetInfo";
import { headlessRender } from "./headlessRender";
import { readStockBuild, stockStorage, type RenderAssetOptions } from "./renderAssetStore";
import { heroLook } from "../../src/game/roster/looks";
import { meterCueFit, meterCueMoves } from "../../src/game/presentation/meterCues";

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
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

export interface EffectVerdict {
  readonly status: "visible" | "invisible" | "unknown";
  readonly reason: string;
}

type Track = mdx.AnimVector | number | null | undefined;
type Window = readonly [from: number, to: number];

/** A track reduced to what the judge reads: its line type, whether a global sequence drives it, and each key's frame and first component. */
export type TrackFacts = number | null | { readonly line: number; readonly global: boolean; readonly keys: readonly (readonly [frame: number, value: number])[] };
interface LayerFacts { readonly alpha: TrackFacts; readonly texture: boolean }

/** Everything the Classic judge reads from one model and its textures, extracted once from the stock cache and committed in the record. */
export interface ModelFacts {
  readonly sequences: readonly { readonly name: string; readonly start: number; readonly end: number; readonly looping: boolean; readonly rarity: number }[];
  readonly particles: number;
  readonly legacyParticles: boolean;
  readonly emitters: readonly { readonly name: string; readonly supported: boolean; readonly shows: boolean; readonly visibility: TrackFacts; readonly emission: TrackFacts; readonly texture: boolean }[];
  readonly ribbons: readonly { readonly name: string; readonly geometry: boolean; readonly extent: boolean; readonly supported: boolean; readonly visibility: TrackFacts; readonly emission: TrackFacts; readonly alpha: TrackFacts; readonly layers: readonly LayerFacts[] }[];
  readonly geosets: readonly { readonly faces: boolean; readonly supported: boolean; readonly invalid: boolean; readonly area: boolean; readonly alpha: TrackFacts; readonly layers: readonly LayerFacts[] }[];
}

const scalar = (vector: unknown): number => (vector as ArrayLike<number> | undefined)?.[0] ?? 0;

const verdict = (status: EffectVerdict["status"], reason: string): EffectVerdict => ({ status, reason });

export const trackFacts = (track: Track): TrackFacts => track == null ? null : typeof track === "number" ? track : { line: track.LineType, global: track.GlobalSeqId !== undefined && track.GlobalSeqId !== null && track.GlobalSeqId !== -1 && track.GlobalSeqId !== 0xffffffff && track.GlobalSeqId !== 0, keys: track.Keys.map((key) => [key.Frame, scalar(key.Vector)] as const) };

export function simultaneousPositive(tracks: readonly TrackFacts[], sequence: Window, window: Window, fallbacks: readonly number[]): boolean | undefined {
  const keys = tracks.map((track) => track !== null && typeof track === "object" ? track.keys.filter(([frame]) => frame >= sequence[0] && frame <= sequence[1]) : []);
  if (tracks.some((track) => track !== null && typeof track === "object" && (track.global || track.line > 1))) return undefined;
  const points = [...new Set([window[0], window[1], ...keys.flatMap((entries) => entries.map(([frame]) => frame).filter((frame) => frame >= window[0] && frame <= window[1]))])].sort((a, b) => a - b);
  const samples = [...points, ...points.slice(1).map((point, index) => ((points[index] ?? point) + point) / 2)];
  const at = (track: TrackFacts, index: number, frame: number): number => {
    if (track === null) return fallbacks[index] ?? 0;
    if (typeof track === "number") return track;
    const entries = keys[index] ?? [];
    const before = entries.filter(([key]) => key <= frame).at(-1) ?? entries[0];
    if (before === undefined) return fallbacks[index] ?? 0;
    const after = entries.find(([key]) => key > frame);
    if (after === undefined || track.line === 0 || frame <= before[0]) return before[1];
    const progress = (frame - before[0]) / (after[0] - before[0]);
    return before[1] + (after[1] - before[1]) * progress;
  };
  return samples.some((frame) => tracks.every((track, index) => at(track, index, frame) > 0));
}

export const FACTS_VERSION = 2;

/** Extracts the judge's model facts; a texture counts only when it is not replaceable and the cache resolves it. */
export function classicModelFacts(model: mdx.Model, textureResolves: (path: string) => boolean | undefined): ModelFacts {
  const texture = (id: number | undefined, replaceable?: number): boolean => {
    if ((replaceable ?? 0) > 0) return false;
    const image = id === undefined ? undefined : model.Textures[id];
    if (image === undefined || (image.ReplaceableId ?? 0) > 0) return false;
    return textureResolves(image.Image) === true;
  };
  const supportedScale = (track: mdx.AnimVector | null | undefined): boolean => {
    if (track == null || track.Keys.length === 0) return true;
    if (track.LineType > 1) return false;
    const scales = track.Keys.map(({ Vector }) => Array.from(Vector));
    return [0, 1, 2].every((axis) => {
      let sign: number | undefined;
      for (const scale of scales) {
        const value = scale[axis];
        if (value === undefined || !Number.isFinite(value) || value === 0) return false;
        const nextSign = value < 0 ? -1 : 1;
        if (track.LineType === 1 && sign !== undefined && sign !== nextSign) return false;
        sign = nextSign;
      }
      return true;
    });
  };
  const supportedNode = (node: mdx.Model["Nodes"][number] | undefined, seen = new Set<number>()): boolean => {
    if (node === undefined || seen.has(node.ObjectId)) return false;
    seen.add(node.ObjectId);
    if (!supportedScale(node.Scaling)) return false;
    return node.Parent == null || node.Parent === -1 || node.Parent === 0xffffffff || supportedNode(model.Nodes[node.Parent], seen);
  };
  const layers = (materialId: number | undefined): LayerFacts[] => ((materialId === undefined ? undefined : model.Materials[materialId])?.Layers ?? []).map((layer) => ({ alpha: trackFacts(layer.Alpha), texture: texture(typeof layer.TextureID === "number" ? layer.TextureID : undefined) }));
  return {
    sequences: model.Sequences.map((sequence) => ({ name: sequence.Name, start: sequence.Interval[0] ?? 0, end: sequence.Interval[1] ?? 0, looping: !sequence.NonLooping, rarity: sequence.Rarity })),
    particles: model.ParticleEmitters2.length + model.RibbonEmitters.length + model.ParticleEmitters.length + (model.ParticleEmitterPopcorns?.length ?? 0),
    legacyParticles: model.ParticleEmitters.length + (model.ParticleEmitterPopcorns?.length ?? 0) > 0,
    emitters: model.ParticleEmitters2.map((emitter) => ({ name: emitter.Name, supported: supportedNode(emitter), shows: Math.max(0, ...(emitter.Alpha ?? [])) > 0 && Math.max(0, ...(emitter.ParticleScaling ?? [])) > 0 && (emitter.LifeSpan ?? 0) > 0, visibility: trackFacts(emitter.Visibility), emission: trackFacts(emitter.EmissionRate), texture: texture(emitter.TextureID, emitter.ReplaceableId) })),
    ribbons: model.RibbonEmitters.map((emitter) => {
      const geometry = typeof emitter.HeightAbove === "number" && typeof emitter.HeightBelow === "number" && Number.isFinite(emitter.HeightAbove + emitter.HeightBelow);
      return { name: emitter.Name, geometry, extent: geometry && (emitter.HeightAbove as number) + (emitter.HeightBelow as number) > 0 && (emitter.LifeSpan ?? 0) > 0, supported: supportedNode(emitter), visibility: trackFacts(emitter.Visibility), emission: trackFacts(emitter.EmissionRate), alpha: trackFacts(emitter.Alpha), layers: layers(emitter.MaterialID) };
    }),
    geosets: model.Geosets.map((geoset, index) => {
      const supported = !((geoset.SkinWeights?.length ?? 0) > 0 || (geoset.Groups ?? []).some((group) => group.some((id) => !supportedNode(model.Nodes[id]))));
      let area = false, invalid = false;
      for (let face = 0; face + 2 < geoset.Faces.length; face += 3) {
        const vertices = [0, 1, 2].map((offset) => {
          const vertex = geoset.Faces[face + offset];
          return vertex === undefined ? [] : Array.from(geoset.Vertices.slice(vertex * 3, vertex * 3 + 3));
        });
        if (vertices.some((vertex) => vertex.length !== 3 || vertex.some((value) => !Number.isFinite(value)))) { invalid = true; continue; }
        const [a, b, c] = vertices;
        const ab = [0, 1, 2].map((axis) => (b?.[axis] ?? 0) - (a?.[axis] ?? 0));
        const ac = [0, 1, 2].map((axis) => (c?.[axis] ?? 0) - (a?.[axis] ?? 0));
        area ||= [0, 1, 2].some((axis) => (ab[(axis + 1) % 3] ?? 0) * (ac[(axis + 2) % 3] ?? 0) - (ab[(axis + 2) % 3] ?? 0) * (ac[(axis + 1) % 3] ?? 0) !== 0);
      }
      return { faces: geoset.Faces.length >= 3, supported, invalid, area, alpha: trackFacts(model.GeosetAnims.find((entry) => entry.GeosetId === index)?.Alpha), layers: layers(geoset.MaterialID) };
    }),
  };
}

/** Judges one use against its model's facts: a hidden sequence window, a frozen travelling particle effect or presentation that prevents drawing. */
export function effectVerdict(model: ModelFacts, use: Pick<EffectUse, "sequence" | "seconds" | "timeScale"> & Partial<Pick<EffectUse, "travels" | "playbackUnknown" | "scale" | "scaleEnd" | "alpha" | "lifetime" | "width" | "height">>): EffectVerdict {
  if ((use.alpha ?? 255) <= 0 || (use.lifetime ?? Infinity) <= 0 || use.scale === 0 && (use.scaleEnd ?? 0) === 0 || use.width === 0 || use.height === 0) return verdict("invisible", "presentation scale, alpha or lifetime prevents drawing");
  if (use.playbackUnknown !== undefined) return verdict("unknown", use.playbackUnknown);
  if (use.scaleEnd !== undefined && use.scaleEnd !== use.scale) return verdict("unknown", "per-frame scale transition coverage is unmodeled");
  if (use.travels && use.timeScale === 0 && model.particles > 0) return verdict("unknown", "travelling particle/ribbon effect is frozen; a visible geoset does not establish its moving spell art (#484)");
  const sequences = model.sequences;
  const wanted = use.sequence === undefined ? ["birth", "stand"] : [use.sequence];
  const found = wanted.map((name) => selectSequence(sequences, name)).filter((index) => index >= 0);
  const stand = selectSequence(sequences, "stand");
  const picked = found.length > 0 ? found : sequences.length > 0 ? [stand >= 0 ? stand : 0] : [];
  const windows = picked.length === 0 ? [{ sequence: [0, 0] as Window, window: [0, 0] as Window, name: "none" }] : picked.map((index) => {
    const { start, end, name } = sequences[index] ?? { start: 0, end: 0, name: "none" };
    const at = Math.min(end, start + use.seconds * 1000);
    return { sequence: [start, end] as Window, window: [at, use.timeScale > 0 ? Math.min(end, at + (use.lifetime ?? Infinity) * use.timeScale * 1000) : at] as Window, name };
  });
  const unknown: string[] = [];
  const draws = (tracks: readonly TrackFacts[], fallbacks: readonly number[], sequence: Window, window: Window, resolved: boolean, label: string) => {
    const positive = simultaneousPositive(tracks, sequence, window, fallbacks);
    if (positive === undefined) unknown.push(`${label}: global or nonlinear track is unverified`);
    else if (positive && !resolved) unknown.push(`${label}: texture or replaceable texture unresolved`);
    return positive === true && resolved;
  };
  for (const { sequence, window, name } of windows) {
    if (use.timeScale > 0) {
      for (const emitter of model.emitters) {
        if (!emitter.supported) { unknown.push(`emitter ${emitter.name}: node transforms are unverified`); continue; }
        if (emitter.shows && draws([emitter.visibility, emitter.emission], [1, 0], sequence, window, emitter.texture, `emitter ${emitter.name}`)) return verdict("visible", `MODEL-DATA: emitter ${emitter.name} emits in ${name}`);
      }
      for (const emitter of model.ribbons) {
        if (!emitter.geometry) { unknown.push(`ribbon ${emitter.name}: height geometry is unverified`); continue; }
        if (!emitter.extent) continue;
        if (!emitter.supported) { unknown.push(`ribbon ${emitter.name}: node transforms are unverified`); continue; }
        for (const layer of emitter.layers) if (draws([emitter.visibility, emitter.emission, emitter.alpha, layer.alpha], [1, 0, 1, 1], sequence, window, layer.texture, `ribbon ${emitter.name}`)) unknown.push(`ribbon ${emitter.name}: nondegenerate trail motion is unverified`);
      }
      if (model.legacyParticles) unknown.push("model-particle/Popcorn dependency playback is unverified");
    }
    for (const [index, geoset] of model.geosets.entries()) {
      if (!geoset.faces) continue;
      if (!geoset.supported) { unknown.push(`geoset ${index}: skinning or node transforms are unverified`); continue; }
      if (geoset.invalid) unknown.push(`geoset ${index}: invalid triangle vertices`);
      if (!geoset.area) continue;
      for (const layer of geoset.layers) if (draws([geoset.alpha, layer.alpha], [1, 1], sequence, window, layer.texture, `geoset ${index}`)) return verdict("visible", `MODEL-DATA: geoset ${index} draws in ${name}`);
    }
  }
  return unknown.length > 0 ? verdict("unknown", [...new Set(unknown)].join("; ")) : verdict("invisible", `nothing emits or draws in ${windows.map(({ name }) => name).join("/")}${use.timeScale > 0 ? "" : " at time scale 0"}`);
}

export const effectVisibility = (model: mdx.Model, use: Parameters<typeof effectVerdict>[1], textureResolves: (path: string) => boolean | undefined): EffectVerdict => effectVerdict(classicModelFacts(model, textureResolves), use);

const slotMove = (slot: string) => `${slot}-special`;

function cueUse(fighter: string, move: string, kind: EffectUse["kind"], cue: Cue): EffectUse {
  const popcorn = kind !== "contact accent" && POPCORN_CUE_MODELS[cue.model] === true;
  return { fighter, move, kind, model: cue.model, scale: cue.scale, scaleEnd: popcorn ? undefined : cue.scaleEnd, alpha: popcorn || kind === "contact accent" ? 255 : cue.alpha ?? 255, lifetime: popcorn ? 1 : undefined, anchor: cue.anchor, sequence: popcorn && cue.birth !== undefined ? "birth" : cue.sequence ?? (kind === "contact accent" ? ACCENT_SEQUENCE : undefined), seconds: popcorn && cue.birth !== undefined ? 0 : cue.seconds ?? (kind === "contact accent" ? ACCENT_SECONDS : 0), timeScale: popcorn ? 1 : cue.timeScale ?? (kind === "contact accent" ? 0 : 1), travels: false, anchored: "fighter", ...(popcorn ? { playbackUnknown: cue.birth?.lingerFrames === undefined ? "confirmed emitter births are hidden by predicted cue phase; active-window coverage is unverified (#365/#496)" : "confirmed emitter births retain a bounded phase handoff; native active-window coverage is unverified (#365/#496)" } : {}) };
}

export function projectileUse(character: Character, fighter: string, move: string, spec: SpecialProjectile): EffectUse | undefined {
  const model = spec.model;
  if (model === undefined) return undefined;
  const draw = PROJECTILE_DRAW_OFFSETS[model];
  const cue = PROJECTILE_DRAW_CUES[model];
  const travels = spec.velocityX !== 0 || spec.velocityZ !== 0;
  const birthNamed = BIRTH_MISSILES.some((name) => model.includes(name));
  const base = { fighter, move, kind: "projectile" as const, model, travels, anchored: "projectile" as const, scale: (cue?.scale ?? 1) * projectileModelScale(spec.radius, spec), lifetime: spec.life / 60, anchor: "projectile", width: draw?.width, height: draw?.height };
  if (character === Character.lichKing && spec.pool !== undefined) return { ...base, sequence: "stand", seconds: 0, timeScale: 1, playbackUnknown: "Defile per-frame age seeking and armed visibility is unmodeled" };
  if (character === Character.lichKing && model.includes("ImpaleHitTarget")) return { ...base, sequence: "birth", seconds: STATIONARY_SECONDS, timeScale: 0, alpha: RISEN_ALPHA };
  if (character === Character.lichKing && model.includes("AnimateDeadTarget")) return { ...base, sequence: "birth", seconds: 0, timeScale: 1, playbackUnknown: "Val'kyr tell per-frame lifetime seeking is unmodeled" };
  if (spec.modelAnimation !== undefined && cue?.birth === undefined) return { ...base, sequence: spec.modelAnimation.sequence, seconds: spec.modelAnimation.activeSeconds, timeScale: 0 };
  if (draw?.seconds !== undefined) return { ...base, sequence: draw.sequence, seconds: draw.seconds, timeScale: 0 };
  if (cue?.birth !== undefined) return { ...base, sequence: "birth", seconds: 0, timeScale: 1 };
  const sequence = draw?.sequence ?? (birthNamed ? "birth" : "stand");
  if (!travels) return STATIONARY_PARTICLE_MODELS.includes(model) ? { ...base, sequence, seconds: STATIONARY_SECONDS, timeScale: 1 } : { ...base, sequence, seconds: STATIONARY_SECONDS, timeScale: 0 };
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
    for (let kind = 0; kind < IMPACT_KIND_COUNT; kind++) uses.push({ fighter, move: `common impact ${kind}`, kind: "impact", model: impactModel(kind), sequence: impactAnimation(kind), seconds: impactStartSeconds(kind), timeScale: 1, travels: false, anchored: "fighter", scale: impactModelScale(kind) });
    const visit = (special: AuthoredSpecial | undefined, move: string): void => {
      if (special === undefined) return;
      for (const placement of specialPlacements(special)) uses.push(supplemental(fighter, `${move} placed object`, placement.model?.path ?? heroLook(character)?.placedModel?.path ?? "Units\\Orc\\SerpentWard\\SerpentWard.mdx", "placed-object animation/lifetime is unmodeled"));
      const summoned = special.commandGrab?.curse?.summon.model?.path;
      if (summoned !== undefined) uses.push(supplemental(fighter, `${move} curse summon`, summoned, "placed-object animation/lifetime is unmodeled"));
      visit(special.ex, `${move} EX`);
      for (const followUp of special.followUps ?? []) visit(followUp.special, `${move} follow-up`);
    };
    const specials = heroDefinition(character)?.specials;
    if (specials !== undefined) for (const slot of SPECIAL_SLOTS) {
      const kit = specials[slot];
      visit(kit.ground, `${slot} ground`); visit(kit.air, `${slot} air`); visit(kit.recall, `${slot} recall`); visit(kit.marked?.special, `${slot} marked`);
    }
    visit(FIGHTER_ULTIMATES[character], "ultimate");
    uses.push(...meterCueMoves(character).map(([move, cue]) => cueUse(fighter, move, "presentation effect", { ...cue, scale: meterCueFit(cue, character).scale })));
  }
  for (let clip = 0; clip < summonClipCount(SUMMON_BEAR); clip++) uses.push(supplemental(fighterSlug(Character.rifleman), `Bear summon clip ${clip}`, summonClip(SUMMON_BEAR, clip).modelPath, "summonPresentation seeking playback is unmodeled"));
  for (const [move, model] of [["Fel Rush aura", IMPACT_ROLL_MODEL], ["Immolate flames", STOCK_MODELS.immolationTarget], ["stun marker", STOCK_MODELS.manaBurnTarget], ["Wing Ascent trail", IMPACT_DUST_MODEL], ["drain flash", IMPACT_TECH_MODEL], ["silence status", STOCK_MODELS.silenceTarget], ["Eye Blast marks", STOCK_MODELS.greenDragonMissile]] as const) uses.push(supplemental(fighterSlug(Character.demonHunter), move, model, "specialEffects producer playback requires an observed frame trace"));
  uses.push(supplemental(fighterSlug(Character.pitLord), "Doom curse", STOCK_MODELS.curseTarget, "specialEffects producer playback requires an observed frame trace"));
  for (const [move, model] of [["raised skeleton", "Units\\Undead\\Skeleton\\Skeleton.mdx"], ["raised burst", "Abilities\\Spells\\Undead\\RaiseSkeletonWarrior\\RaiseSkeleton.mdx"], ["Defile boundary", IMPACT_DEFILE_MODEL], ["Defile frost", "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx"]] as const) uses.push(supplemental(fighterSlug(Character.lichKing), move, model, "projectilePresentation supplemental playback is unmodeled"));
  uses.push(supplemental(fighterSlug(Character.lich), "Death and Decay ground", IMPACT_DEFILE_MODEL, "projectilePresentation supplemental playback is unmodeled"));
  for (const model of CANDLE_FLAME_MODELS) for (const [level, levelScale] of CANDLE_FLAME_SCALES.entries()) for (const anchor of ["head", "loose"]) uses.push({ fighter: fighterSlug(Character.kobold), move: `candle ${anchor} level ${level}`, kind: "presentation effect", model, sequence: undefined, seconds: 0, timeScale: 1, travels: anchor === "loose", anchored: anchor === "loose" ? "projectile" : "fighter", anchor, scale: levelScale * characterModelScale(Character.kobold) });
  uses.push({ fighter: fighterSlug(Character.kobold), move: "candle snuffed", kind: "presentation effect", model: CANDLE_SMOKE.model, sequence: undefined, seconds: 0, timeScale: 1, travels: true, anchored: "projectile", anchor: "loose", scale: CANDLE_SMOKE.scale * characterModelScale(Character.kobold) });
  const seen = new Set<string>();
  return uses.filter((use) => {
    const key = JSON.stringify(use);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface EffectFinding extends EffectUse, EffectVerdict {}

/** One reference use the check must judge as reported: flagged for its diagnosed cause when Tom's playtest saw nothing, visible when a capture showed it drawing. */
export interface CalibrationCase { readonly expect: "flagged" | "visible"; readonly cause?: string; readonly evidence: string; readonly use: EffectUse }
const CRUSHING_WAVE: EffectUse = { fighter: "cairne-bloodhoof", move: "neutral-special Shockwave projectile", kind: "projectile", model: "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx", travels: true, anchored: "projectile", scale: Math.fround(0.3), lifetime: 38 / 60, anchor: "projectile", width: 0.75, height: 2, sequence: "stand", seconds: 0, timeScale: 1 };
export const EFFECT_CALIBRATION: readonly CalibrationCase[] = [
  { expect: "flagged", cause: "#365", evidence: "Tom saw no Breath of Fire flame in the 0.0.145 Classic playtest (c39ada1e5: 11 emitter births, none lingering)", use: cueUse("chen-stormstout", "neutral-special Breath of Fire active (0.0.145)", "special cue", { model: "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireMissile.mdx", anchor: "breath", scale: Math.fround(0.4), sequence: "birth", seconds: 0, birth: { eachFrame: true, strike: 0, voices: 11 } }) },
  { expect: "flagged", cause: "#484", evidence: "Tom saw nothing launch from Cairne's Shockwave in the 0.0.145 Classic playtest (e56c745be^: the travelling wave held at 0.2 s, time scale 0)", use: { ...CRUSHING_WAVE, move: "neutral-special Shockwave projectile (0.0.145)", seconds: Math.fround(0.2), timeScale: 0 } },
  { expect: "visible", evidence: "#484: after e56c745be the Classic strip draws the wave on 37 of 37 live frames", use: CRUSHING_WAVE },
  { expect: "visible", evidence: "native Classic 3.0.1.24371 capture effects-native-24371-20261022 blademaster-cues frame 262", use: cueUse("blademaster", "neutral-special Wind Cutter startup", "special cue", { model: "Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx", anchor: "body", scale: Math.fround(0.4), sequence: "stand", seconds: Math.fround(0.2) }) },
  { expect: "visible", evidence: "native Classic 3.0.1.24371 capture effects-native-24371-20261022 blademaster-cues frame 278", use: { fighter: "blademaster", move: "neutral-special Wind Cutter projectile", kind: "projectile", model: "Abilities\\Weapons\\WingedSerpentMissile\\WingedSerpentMissile.mdx", travels: true, anchored: "projectile", scale: 1, lifetime: 0.4, anchor: "projectile", sequence: "stand", seconds: 0, timeScale: 1 } },
  { expect: "visible", evidence: "native Classic 3.0.1.24371 capture effects-native-24371-20261022 blademaster-cues frame 362", use: cueUse("blademaster", "down-special Mirror Image startup", "special cue", { model: "Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageCaster.mdx", anchor: "body", scale: 1, sequence: "birth", seconds: Math.fround(0.2) }) },
  { expect: "visible", evidence: "native Classic 3.0.1.24371 capture effects-native-24371-20261022 blademaster-cues frames 452 and 457, blademaster-late-cues frame 682", use: cueUse("blademaster", "up-special Rising Whirlwind active", "special cue", { model: "Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx", anchor: "body", scale: Math.fround(0.6), sequence: "stand", seconds: Math.fround(0.2) }) },
];

/** Refuses a judge that passes a reported-invisible reference, flags it for another cause, or flags a captured-visible one. */
export function calibrationProblem(judged: readonly EffectFinding[]): string | undefined {
  const missed = EFFECT_CALIBRATION.flatMap((reference, index) => {
    const finding = judged[index];
    return finding !== undefined && (finding.status === "visible") === (reference.expect === "visible") && finding.reason.includes(reference.cause ?? "") ? [] : [`${reference.use.fighter}/${reference.use.move} should be ${reference.expect}${reference.cause === undefined ? "" : ` for its cause ${reference.cause}`} (${reference.evidence}) but is ${finding?.status ?? "unjudged"}: ${finding?.reason ?? ""}`];
  });
  return missed.length === 0 ? undefined : `Classic effect check is uncalibrated: ${missed.join("; ")}`;
}

export const CALIBRATION_SUMMARY = `Classic calibration holds: flags ${EFFECT_CALIBRATION.filter(({ expect }) => expect === "flagged").map(({ use }) => `${use.fighter}/${use.move}`).join(" and ")}; passes ${EFFECT_CALIBRATION.filter(({ expect }) => expect === "visible").length} known-visible uses`;

/** Reads each model and its textures once and extracts the judge's facts; null marks a model missing from the cache or unparseable. */
export async function readModelFacts(read: (path: string) => Promise<Uint8Array | undefined>, models: readonly string[], reads = new Map<string, readonly string[]>()): Promise<Map<string, ModelFacts | null>> {
  const facts = new Map<string, ModelFacts | null>();
  const textures = new Map<string, boolean>();
  for (const model of models) if (!facts.has(model)) {
    const bytes = await read(model);
    let parsed: mdx.Model | undefined;
    try { parsed = bytes === undefined || bytes.length === 0 ? undefined : parseModelMDX(bytes.slice().buffer); } catch { parsed = undefined; }
    const images = (parsed?.Textures ?? []).map((texture) => texture.Image).filter((image) => image !== "");
    reads.set(model, [model, ...images]);
    for (const image of images) if (!textures.has(image)) textures.set(image, ((await read(image))?.length ?? 0) > 0);
    facts.set(model, parsed === undefined ? null : classicModelFacts(parsed, (path) => textures.get(path) === true ? true : undefined));
  }
  return facts;
}

/** Judges one use: a missing Classic model, a travelling effect held at a fighter anchor, or its model facts. */
export function judgeUse(use: EffectUse, facts: ModelFacts | null): EffectFinding {
  if (facts === null) return { ...use, status: "unknown", reason: "model missing from the selected Classic cache or unparseable" };
  if (use.playbackUnknown === undefined && use.travels && use.anchored === "fighter") return { ...use, status: "invisible", reason: "travelling effect drawn at a fixed fighter anchor, not with its projectile" };
  return { ...use, ...effectVerdict(facts, use) };
}

export async function checkEffects(read: (path: string) => Promise<Uint8Array | undefined>, uses: readonly EffectUse[] = effectUses(), reads = new Map<string, readonly string[]>()): Promise<EffectFinding[]> {
  const facts = await readModelFacts(read, uses.map(({ model }) => model), reads);
  return uses.map((use) => judgeUse(use, facts.get(use.model) ?? null));
}

export const EFFECT_PLAYBACK_INPUTS = ["ts/scripts/wisp/effectVisibility.ts", "ts/scripts/cueModels.ts", "ts/scripts/wisp/cueModels.ts", "ts/scripts/prePush.ts", "ts/src/host/loop/view.ts", "ts/src/game/presentation/specialCues.ts", "ts/src/game/presentation/attackCues.ts", "ts/src/game/presentation/projectileArt.ts", "ts/src/game/presentation/projectilePose.ts", "ts/wisp.lock", "ts/bun.lock", "ts/package.json", "typescript-toolchain.lock", "ts/src/game/render/specialCueEffects.ts", "ts/src/game/render/projectilePresentation.ts", "ts/src/game/render/hitAreaEffects.ts", "ts/src/game/render/specialEffects.ts", "ts/src/game/render/combatEffects.ts", "ts/src/game/render/placedObjectEffects.ts", "ts/src/game/render/summonPresentation.ts", "build-inputs/"];
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
const unpinnedImport = (model: string) => /^war3mapImported[\\/]/i.test(model) && !/-[0-9a-f]{64}\.mdx$/i.test(model);
const importedModelsPin = (): string => { const file = join(import.meta.dir, "../../../build-inputs/imported-models"); return existsSync(file) ? readFileSync(file, "utf8").trim() : "unpinned"; };
export const effectUseDigest = (use: EffectUse) => createHash("sha256").update(JSON.stringify(use)).digest("hex");
export const modelFactsKey = (model: string) => unpinnedImport(model) ? `${model}@${importedModelsPin()}` : model;
export const EFFECT_RECORD_INPUTS = ["ts/scripts/wisp/effectVisibility.ts", "ts/src/game/presentation/projectilePose.ts", "ts/src/game/render/specialCueEffects.ts", "ts/src/game/render/projectilePresentation.ts", "ts/src/game/render/hitAreaEffects.ts", "ts/src/game/render/specialEffects.ts", "ts/src/game/render/combatEffects.ts", "ts/src/game/render/placedObjectEffects.ts", "ts/src/game/render/summonPresentation.ts", "ts/wisp.lock", "ts/bun.lock", "ts/package.json", "typescript-toolchain.lock", "build-inputs/imported-models"];
export function effectSourceDigest(root = join(import.meta.dir, "../../..")): string {
  const hash = createHash("sha256");
  for (const path of EFFECT_RECORD_INPUTS) if (existsSync(join(root, path))) hash.update(path).update(readFileSync(join(root, path)));
  return hash.digest("hex");
}

export class EffectCheckFailure extends Schema.TaggedError<EffectCheckFailure>()("EffectCheckFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}
// Facts read only whether a texture exists, and each cache stores a texture in its own decoded form.
const TEXTURE = /\.(blp|tga|dds|png|tif)$/i;

/** Reads every Classic effect model from the Warcraft III install's storage, extracting what no render has cached yet, so the facts depend on the build alone. */
export const readEffectReport = Effect.fnUntraced(function*(options: RenderAssetOptions = {}) {
  const build = yield* readStockBuild(options.storage ?? stockStorage()).pipe(Effect.mapError((failure) => new EffectCheckFailure({ problem: `Classic stock: ${failure.message}` })));
  const { Version: version, "Build Key": buildKey } = build.fields;
  if (version === undefined || !CLASSIC_BUILDS.includes(version) || buildKey === undefined || buildKey === "") return yield* new EffectCheckFailure({ problem: `Classic calibration needs a ${CLASSIC_BUILDS.join(" or ")} build, got ${version ?? "none"} in ${build.storage}` });
  const info = `${version}\t${buildKey}`;
  const store = headlessRender({ ...options, strict: true });
  const input = (path: string) => store.readAsset(path, "classic");
  const hashes = new Map<string, string>();
  const reads = new Map<string, readonly string[]>();
  const uses = effectUses();
  const facts = yield* Effect.tryPromise({
    try: () => readModelFacts(async (path) => { const bytes = await input(path); if (bytes !== undefined) hashes.set(path, TEXTURE.test(path) ? "present" : createHash("sha256").update(bytes).digest("hex")); return bytes; }, [...uses, ...EFFECT_CALIBRATION.map(({ use }) => use)].map(({ model }) => model), reads),
    catch: (cause) => new EffectCheckFailure({ problem: `Classic effect check: ${String(cause)}` }),
  });
  const findings = uses.map((use) => judgeUse(use, facts.get(use.model) ?? null));
  const calibration = EFFECT_CALIBRATION.map(({ use }) => judgeUse(use, facts.get(use.model) ?? null));
  const provenance = createHash("sha256").update(info).update(JSON.stringify([...hashes].sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
  const models = new Map([...reads].map(([model, paths]) => [model, createHash("sha256").update(JSON.stringify(paths.map((path) => [path, hashes.get(path) ?? ""]))).digest("hex")]));
  return { cacheInfo: createHash("sha256").update(info).digest("hex"), provenance, storage: build.storage, inputs: [...hashes], models, facts, findings, calibration };
});

if (import.meta.main) BunRuntime.runMain(Effect.gen(function*() {
  const at = process.argv.indexOf("--storage"), storage = at < 0 ? undefined : process.argv[at + 1];
  const report = yield* readEffectReport(storage === undefined ? {} : { storage });
  const flagged = report.findings.filter(({ status }) => status !== "visible");
  if (process.argv.includes("--json")) yield* Console.log(JSON.stringify(report, null, 2));
  else for (const finding of flagged) yield* Console.log(`${finding.fighter}\t${finding.move}\t${finding.status}\t${finding.model}\t${finding.reason}`);
  yield* Console.error(`${flagged.length} invisible/Unknown of ${report.findings.length} Classic effect uses (${new Set(report.findings.map(({ model }) => model)).size} models); MODEL-DATA visibility only`);
  const uncalibrated = calibrationProblem(report.calibration);
  if (uncalibrated !== undefined) return yield* new EffectCheckFailure({ problem: uncalibrated });
  yield* Console.error(CALIBRATION_SUMMARY);
  if (report.findings.some(({ status }) => status === "invisible") && process.argv.includes("--strict")) return yield* new EffectCheckFailure({ problem: "invisible Classic effects refuse the gate; Unknown uses remain report debt" });
}));
