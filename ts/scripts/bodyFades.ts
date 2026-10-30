import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseMDX, type model as mdx } from "war3-model";
import { fighterSlug } from "../src/game/roster/kits";
import { Character } from "../src/game/sim/codes";
import { characterClips } from "../src/game/presentation/fighterClips";
import { originalClip, originalClipCount } from "../src/generated/clips/fighterOriginalClipInfo";

export const DOWN_ACTIONS = ["knockdown", "downDamage", "getUp", "getUpAttack", "rollForward", "rollBackward", "wallTech", "damageGround"] as const;
export type BodyFadeRecord = Record<string, { readonly body: string; readonly fading: readonly number[] }>;

const STORE = join(homedir(), ".local/share/smashcraft-build-inputs/store");
const FRAME_MILLISECONDS = 1000 / 60;
const FULL = 1 - 1e-3;

const vectorAt = (track: mdx.AnimVector, millis: number, rest: number): number[] => {
  const keys = track.Keys;
  const first = keys[0], last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return [rest];
  if (millis <= first.Frame) return Array.from(first.Vector);
  if (millis >= last.Frame) return Array.from(last.Vector);
  const after = keys.findIndex((key) => key.Frame >= millis), before = keys[after - 1], next = keys[after];
  if (before === undefined || next === undefined) return [rest];
  const step = track.LineType === 0 ? 0 : (millis - before.Frame) / (next.Frame - before.Frame);
  return Array.from(before.Vector, (from, axis) => from + ((next.Vector[axis] ?? rest) - from) * step);
};

const alphaAt = (alpha: number | mdx.AnimVector | undefined, millis: number): number =>
  alpha === undefined || typeof alpha === "number" ? alpha ?? 1 : vectorAt(alpha, millis, 1)[0] ?? 1;

/** Each bone's and helper's smallest scale axis at one instant. */
const scales = (nodes: readonly mdx.Node[], millis: number): number[] =>
  nodes.map((node) => node.Scaling === undefined ? 1 : Math.min(...vectorAt(node.Scaling, millis, 1)));

/** A node scaled below this share of its first-clip size hides the mesh under it as surely as a fade. */
const SHRUNK = 0.5;
/** A root node whose pivot is lowered this many units under the floor carries the mesh beneath it; a fighter lying down keeps its root at the floor. */
const SUNK = 25;

/** Each parentless bone's and helper's pivot height above the floor at one instant; child heights stay `undefined`. */
const heights = (nodes: readonly mdx.Node[], millis: number): (number | undefined)[] =>
  nodes.map((node) => node.Parent !== undefined && node.Parent !== null && node.Parent >= 0 ? undefined : (node.PivotPoint[2] ?? 0) + (node.Translation === undefined ? 0 : vectorAt(node.Translation, millis, 0)[2] ?? 0));
/** The share of the visible body's vertices under shrunk or sunk nodes that reads as the body vanishing; glow planes and props stay under it. */
const HIDDEN_SHARE = 0.1;

/** For each geoset, each vertex group's vertex count and the node indices (in `nodes`) it hangs under, through every ancestor. */
function vertexChains(model: mdx.Model, nodes: readonly mdx.Node[]): { readonly vertices: number; readonly chain: readonly number[] }[][] {
  const index = new Map(nodes.map((node, at) => [node.ObjectId, at]));
  const ancestors = (objectId: number): number[] => {
    const chain: number[] = [];
    for (let at = index.get(objectId); at !== undefined && !chain.includes(at); at = index.get(nodes[at]!.Parent ?? -1)) chain.push(at);
    return chain;
  };
  return model.Geosets.map((geoset) => geoset.Groups.map((group, matrix) => ({
    vertices: geoset.VertexGroup.reduce((count, used) => count + (used === matrix ? 1 : 0), 0),
    chain: [...new Set(group.flatMap(ancestors))],
  })));
}

/** Each geoset's drawn opacity at one instant: its animated opacity times its layers'. */
const opacities = (model: mdx.Model, millis: number): number[] =>
  model.Geosets.map((geoset, index) => {
    const anim = model.GeosetAnims.find((entry) => entry.GeosetId === index);
    const layers = model.Materials[geoset.MaterialID]?.Layers ?? [];
    return alphaAt(anim?.Alpha, millis) * Math.max(0, ...layers.map((layer) => alphaAt(layer.Alpha, millis)));
  });

/** The clips of one body model during which a geoset visible in the model's first clip drops below the opacity it has there, or a tenth of its visible vertices hang under a bone or helper shrunk below half the size it has there or a root lowered under the floor. */
export function fadingClips(model: mdx.Model, windows: readonly (readonly [number, number])[]): number[] {
  const first = windows[0];
  if (first === undefined) return [];
  const nodes = [...model.Bones, ...model.Helpers], groups = vertexChains(model, nodes);
  const reference = opacities(model, first[0]), size = scales(nodes, first[0]);
  const visible = groups.reduce((total, geoset, at) => total + ((reference[at] ?? 0) > 0 ? geoset.reduce((sum, group) => sum + group.vertices, 0) : 0), 0);
  const fades = (millis: number) => opacities(model, millis).some((value, geoset) => (reference[geoset] ?? 0) > 0 && value < (reference[geoset] ?? 0) * FULL);
  const hidden = (millis: number) => {
    const now = heights(nodes, millis);
    const hiding = scales(nodes, millis).map((value, node) => value < (size[node] ?? 1) * SHRUNK || (now[node] ?? 0) < -SUNK);
    if (!hiding.includes(true)) return false;
    const under = groups.reduce((total, geoset, at) => total + ((reference[at] ?? 0) > 0 ? geoset.reduce((sum, group) => sum + (group.chain.some((node) => hiding[node]) ? group.vertices : 0), 0) : 0), 0);
    return under > visible * HIDDEN_SHARE;
  };
  const fading: number[] = [];
  windows.forEach(([start, end], clip) => {
    for (let millis = start; millis <= end + FRAME_MILLISECONDS; millis += FRAME_MILLISECONDS) {
      const at = Math.min(millis, end);
      if (fades(at) || hidden(at)) { fading.push(clip); return; }
    }
  });
  return fading;
}

function measure(): BodyFadeRecord {
  const record: Record<string, { readonly body: string; readonly fading: readonly number[] }> = {};
  for (const [name, character] of Object.entries(Character)) {
    const count = originalClipCount(character);
    const first = originalClip(character, 0);
    if (count === 0 || first === undefined) continue;
    const pointer = join(resolve(import.meta.dir, "../.."), "build-inputs/original-clips-static-lights", fighterSlug(character));
    if (!existsSync(pointer)) continue;
    const directory = join(STORE, "original-clips-static-lights", readFileSync(pointer, "utf8").trim(), "imports/war3mapImported");
    const windows = Array.from({ length: count }, (_, index) => originalClip(character, index)).map((clip) => [(clip?.startSeconds ?? 0) * 1000, (clip?.endSeconds ?? 0) * 1000] as const);
    const file = first.modelPath.split("\\").pop() ?? "";
    if (!readdirSync(directory).includes(file)) continue;
    const model = parseMDX(readFileSync(join(directory, file)).buffer as ArrayBuffer);
    record[name] = { body: file, fading: fadingClips(model, windows) };
  }
  return record;
}

if (import.meta.main) {
  const measured = measure();
  const path = join(import.meta.dir, "../test/fixtures/body-fades.json");
  if (process.argv.includes("--record")) writeFileSync(path, `${JSON.stringify(measured, null, 1)}\n`);
  for (const [name, entry] of Object.entries(measured)) {
    const character = Character[name as keyof typeof Character];
    const table = characterClips(character);
    const used = DOWN_ACTIONS.flatMap((action) => entry.fading.includes(table[action]?.index ?? -1) ? [action] : []);
    console.log(`${name}\t${entry.fading.length} fading clips\t${used.length > 0 ? `DOWN ACTIONS FADE: ${used.join(",")}` : "down actions clean"}`);
  }
}
