import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type model as mdx } from "wisp/vendor/war3-model.mjs";
import { parseModelMDX } from "wisp/scripts/wisp/models";
import { selectSequence } from "wisp/src/headless/animation";
import { Character } from "../../src/game/sim/codes";
import { HERO_ROSTER, fighterSlug, heroDefinition } from "../../src/game/sim/heroes/registry";
import { HERO_CUES, fighterBranchCues, type Cue } from "../../src/game/presentation/specialCues";
import { ATTACK_CUES } from "../../src/game/presentation/attackCues";
import { DISJOINT_CUES } from "../../src/game/presentation/disjointCues";
import { PROJECTILE_DRAW_CUES, PROJECTILE_DRAW_OFFSETS, SPECIAL_SLOTS, heroProjectileArt, ultimateProjectiles } from "../../src/game/presentation/projectileArt";
import { STATIONARY_PARTICLE_MODELS } from "../../src/game/render/projectilePresentation";
import type { SpecialProjectile } from "../../src/game/sim/heroSpecials";
import { headlessRender } from "./headlessRender";

/** How one move shows one model in Classic: the sequence and seek it plays, its time scale, and whether its anchor travels. */
export interface EffectUse {
  readonly fighter: string;
  readonly move: string;
  readonly kind: "special cue" | "attack cue" | "contact accent" | "projectile";
  readonly model: string;
  readonly sequence: string | undefined;
  readonly seconds: number;
  readonly timeScale: number;
  readonly travels: boolean;
  readonly anchored: "fighter" | "projectile";
}

export interface EffectVerdict {
  readonly visible: boolean;
  readonly reason: string;
}

type Track = mdx.AnimVector | number | undefined;
type Window = readonly [from: number, to: number];

const scalar = (vector: unknown): number => (vector as ArrayLike<number> | undefined)?.[0] ?? 0;

/** Every value a track takes inside a window of one sequence: the static value, the default with no keys there, or the keys it crosses plus its value at the window's start. */
export function trackValues(model: mdx.Model, track: Track, sequence: Window, window: Window, fallback: number): number[] {
  if (track === undefined) return [fallback];
  if (typeof track === "number") return [track];
  const id = track.GlobalSeqId ?? -1;
  const global = id === -1 || id === 0xffffffff || id === null ? undefined : model.GlobalSequences[id];
  const [start, end] = global === undefined ? sequence : [0, global];
  const keys = track.Keys.filter(({ Frame }) => Frame >= start && Frame <= end);
  if (keys.length === 0) return [fallback];
  if (global !== undefined) return keys.map(({ Vector }) => scalar(Vector));
  const [from, to] = window;
  const before = keys.filter(({ Frame }) => Frame <= from).at(-1) ?? keys[0];
  return [before, ...keys.filter(({ Frame }) => Frame > from && Frame <= to)].filter((key) => key !== undefined).map(({ Vector }) => scalar(Vector));
}

const anyAbove = (values: readonly number[]) => values.some((value) => value > 0);

/** Whether a Classic model draws anything while one use plays it: an emitter that emits (needs a running clock) or a geoset with a visible layer, each with a resolving texture. */
export function effectVisibility(model: mdx.Model, use: Pick<EffectUse, "sequence" | "seconds" | "timeScale">, textureResolves: (path: string) => boolean): EffectVerdict {
  const sequences = model.Sequences.map((sequence) => ({ name: sequence.Name, start: sequence.Interval[0] ?? 0, end: sequence.Interval[1] ?? 0, looping: !sequence.NonLooping, rarity: sequence.Rarity }));
  const requested = use.sequence;
  const wanted = requested === undefined ? ["birth", "stand"] : [requested];
  const found = wanted.map((name) => selectSequence(sequences, name)).filter((index) => index >= 0);
  const named = requested !== undefined && sequences.some(({ name }) => name.toLowerCase().includes(requested.toLowerCase()));
  const stand = selectSequence(sequences, "stand");
  // Mirrors wisp/src/headless/animation.ts animationSample: Stand, else the first sequence.
  const picked = found.length > 0 ? found : sequences.length > 0 && !named ? [stand >= 0 ? stand : 0] : [];
  if (sequences.length > 0 && picked.length === 0) return { visible: false, reason: `no ${wanted.join("/")} sequence (has ${sequences.map(({ name }) => name).join(", ")})` };
  const windows: { readonly sequence: Window; readonly window: Window; readonly name: string }[] = picked.length === 0
    ? [{ sequence: [0, 0], window: [0, 0], name: "none" }]
    : picked.map((index) => {
      const { start, end, name } = sequences[index] ?? { start: 0, end: 0, name: "" };
      const at = Math.min(end, start + use.seconds * 1000);
      return { sequence: [start, end] as const, window: [at, use.timeScale > 0 ? end : at] as const, name };
    });
  const texture = (id: number | undefined, replaceable: number | undefined) => {
    if (replaceable !== undefined && replaceable > 0) return true;
    const image = id === undefined ? undefined : model.Textures[id];
    if (image === undefined) return false;
    return (image.ReplaceableId ?? 0) > 0 || textureResolves(image.Image);
  };
  const reasons: string[] = [];
  for (const { sequence, window, name } of windows) {
    if (use.timeScale > 0) {
      for (const emitter of model.ParticleEmitters2) {
        const emits = anyAbove(trackValues(model, emitter.Visibility, sequence, window, 1)) && anyAbove(trackValues(model, emitter.EmissionRate, sequence, window, 0));
        const shows = Math.max(0, ...(emitter.Alpha ?? [])) > 0 && Math.max(0, ...(emitter.ParticleScaling ?? [])) > 0 && (emitter.LifeSpan ?? 0) > 0;
        if (emits && shows && texture(emitter.TextureID, emitter.ReplaceableId)) return { visible: true, reason: `emitter ${emitter.Name} emits in ${name}` };
        if (emits && shows) reasons.push(`emitter ${emitter.Name} texture unresolved`);
      }
      for (const emitter of model.RibbonEmitters) {
        const emits = anyAbove(trackValues(model, emitter.Visibility, sequence, window, 1)) && (emitter.EmissionRate ?? 0) > 0;
        if (emits && anyAbove(trackValues(model, emitter.Alpha, sequence, window, 1))) return { visible: true, reason: `ribbon ${emitter.Name} emits in ${name}` };
      }
      for (const emitter of model.ParticleEmitters) {
        if (anyAbove(trackValues(model, emitter.Visibility, sequence, window, 1)) && anyAbove(trackValues(model, emitter.EmissionRate, sequence, window, 0))) return { visible: true, reason: `model emitter ${emitter.Name} emits in ${name}` };
      }
      for (const emitter of model.ParticleEmitterPopcorns ?? []) {
        if (anyAbove(trackValues(model, emitter.Visibility, sequence, window, 1)) && anyAbove(trackValues(model, emitter.EmissionRate, sequence, window, 0))) return { visible: true, reason: `popcorn ${emitter.Name} emits in ${name}` };
      }
    } else if (model.ParticleEmitters2.length + model.RibbonEmitters.length + model.ParticleEmitters.length > 0) reasons.push("emitters frozen at time scale 0");
    for (const [index, geoset] of model.Geosets.entries()) {
      if (geoset.Faces.length < 3) continue;
      const anim = model.GeosetAnims.find((entry) => entry.GeosetId === index);
      if (!anyAbove(trackValues(model, anim?.Alpha, sequence, window, 1))) continue;
      const material = model.Materials[geoset.MaterialID];
      for (const layer of material?.Layers ?? []) {
        if (!anyAbove(trackValues(model, layer.Alpha, sequence, window, 1))) continue;
        const id = typeof layer.TextureID === "number" ? layer.TextureID : undefined;
        if (texture(id, undefined)) return { visible: true, reason: `geoset ${index} draws in ${name}` };
        reasons.push(`geoset ${index} texture unresolved`);
      }
    }
  }
  return { visible: false, reason: reasons.length > 0 ? [...new Set(reasons)].join("; ") : `nothing emits or draws in ${windows.map(({ name }) => name).join("/")}${use.timeScale > 0 ? "" : " at time scale 0"}` };
}

const slotMove = (slot: string) => `${slot}-special`;

function cueUse(fighter: string, move: string, kind: EffectUse["kind"], cue: Cue): EffectUse {
  return { fighter, move, kind, model: cue.model, sequence: cue.sequence, seconds: cue.seconds ?? 0, timeScale: cue.timeScale ?? 1, travels: false, anchored: "fighter" };
}

function projectileUse(character: Character, fighter: string, move: string, spec: SpecialProjectile): EffectUse | undefined {
  const model = spec.model;
  if (model === undefined) return undefined;
  const draw = PROJECTILE_DRAW_OFFSETS[model];
  const cue = PROJECTILE_DRAW_CUES[model];
  const travels = spec.velocityX !== 0 || spec.velocityZ !== 0;
  const birthNamed = ["FreezingBreathMissile", "WaterElementalMissile", "FrostWyrmMissile"].some((name) => model.includes(name));
  const base = { fighter, move, kind: "projectile" as const, model, travels, anchored: "projectile" as const };
  if (character === Character.lichKing && (model.includes("ImpaleHitTarget") || spec.pool !== undefined)) return { ...base, sequence: "birth", seconds: 0.3, timeScale: 0 };
  if (draw?.seconds !== undefined) return { ...base, sequence: draw.sequence, seconds: draw.seconds, timeScale: 0 };
  if (cue?.birth !== undefined) return { ...base, sequence: "birth", seconds: 0, timeScale: 1 };
  const sequence = draw?.sequence ?? (birthNamed ? "birth" : "stand");
  if (!travels) return STATIONARY_PARTICLE_MODELS.includes(model) ? { ...base, sequence, seconds: 0.3, timeScale: 1 } : { ...base, sequence, seconds: 0.3, timeScale: 0 };
  return { ...base, sequence, seconds: 0, timeScale: 1 };
}

/** Every effect any fighter's move shows in Classic. */
export function effectUses(): EffectUse[] {
  const uses: EffectUse[] = [];
  for (const { character } of HERO_ROSTER) {
    const fighter = fighterSlug(character);
    const cues = HERO_CUES[character];
    for (const slot of SPECIAL_SLOTS) {
      const move = cues?.[slot];
      if (move === undefined) continue;
      for (const [phase, cue] of [["startup", move.startup], ["active", move.active]] as const) {
        if (cue.drawn === true) {
          const specials = heroDefinition(character)?.specials;
          const travelling = specials !== undefined && specials[slot] !== undefined && heroProjectileArt(specials).some((art) => art.slot === slot && (art.spec.velocityX !== 0 || art.spec.velocityZ !== 0) && art.spec.model === cue.model);
          if (!travelling && /missile/i.test(cue.model)) uses.push({ fighter, move: `${slotMove(slot)} ${move.spell} ${phase}`, kind: "special cue", model: cue.model, sequence: undefined, seconds: 0, timeScale: 1, travels: true, anchored: "fighter" });
          continue;
        }
        uses.push(cueUse(fighter, `${slotMove(slot)} ${move.spell} ${phase}`, "special cue", cue));
      }
    }
    for (const branch of fighterBranchCues(character)) for (const [phase, cue] of [["startup", branch.startup], ["active", branch.active]] as const) {
      if (cue.drawn !== true) uses.push(cueUse(fighter, `${branch.spell} ${phase}`, "special cue", cue));
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
    if (model === undefined) return { ...use, visible: false, reason: "model does not resolve in Classic data" };
    if (use.travels && use.anchored === "fighter") return { ...use, visible: false, reason: "travelling effect drawn at a fixed fighter anchor, not with its projectile" };
    return { ...use, ...effectVisibility(model, use, (path) => textures.get(path) === true) };
  });
}

const STOCK_CACHE = join(homedir(), ".local/share/smashcraft-render-assets/stock");

/** Reads Classic stock files from the render-asset cache that map builds fill, newest build first; never opens the game install. */
export function stockCacheReader(root = STOCK_CACHE): (path: string) => Promise<Uint8Array | undefined> {
  const builds = readdirSync(root).map((name) => join(root, name)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return async (path) => {
    const key = path.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx");
    const names = /\.(blp|tga|dds|png)$/.test(key) ? [".dds", ".png", ".blp", ".tga"].map((ext) => key.replace(/\.[^.]+$/, ext)) : [key];
    for (const build of builds) for (const name of names) {
      const file = join(build, name);
      if (existsSync(file)) return new Uint8Array(await Bun.file(file).arrayBuffer());
    }
    return undefined;
  };
}

/** Reads stock files from the cache and the map's own imports through the headless renderer. */
export function classicReader(stock = stockCacheReader()): (path: string) => Promise<Uint8Array | undefined> {
  let render: ReturnType<typeof headlessRender> | undefined;
  return async (path) => (await stock(path)) ?? (/^war3mapImported[\\/]/i.test(path) ? (render ??= headlessRender()).readAsset(path, "classic") : undefined);
}

if (import.meta.main) {
  const findings = await checkEffects(classicReader());
  const invisible = findings.filter(({ visible }) => !visible);
  if (process.argv.includes("--json")) console.log(JSON.stringify(invisible, null, 2));
  else for (const finding of invisible) console.log(`${finding.fighter}\t${finding.move}\t${finding.kind}\t${finding.model}\t${finding.reason}`);
  console.error(`${invisible.length} invisible of ${findings.length} Classic effect uses (${new Set(findings.map(({ model }) => model)).size} models)`);
  process.exitCode = invisible.length > 0 && process.argv.includes("--strict") ? 1 : 0;
}
