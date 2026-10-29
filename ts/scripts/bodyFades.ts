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

const alphaAt = (alpha: number | mdx.AnimVector | undefined, millis: number): number => {
  if (alpha === undefined || typeof alpha === "number") return alpha ?? 1;
  const keys = alpha.Keys;
  const first = keys[0], last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return 1;
  if (millis <= first.Frame) return first.Vector[0] ?? 1;
  if (millis >= last.Frame) return last.Vector[0] ?? 1;
  const after = keys.findIndex((key) => key.Frame >= millis), before = keys[after - 1], next = keys[after];
  if (before === undefined || next === undefined) return 1;
  const step = alpha.LineType === 0 ? 0 : (millis - before.Frame) / (next.Frame - before.Frame);
  const from = before.Vector[0] ?? 1;
  return from + ((next.Vector[0] ?? 1) - from) * step;
};

/** Each geoset's drawn opacity at one instant: its animated opacity times its layers'. */
const opacities = (model: mdx.Model, millis: number): number[] =>
  model.Geosets.map((geoset, index) => {
    const anim = model.GeosetAnims.find((entry) => entry.GeosetId === index);
    const layers = model.Materials[geoset.MaterialID]?.Layers ?? [];
    return alphaAt(anim?.Alpha, millis) * Math.max(0, ...layers.map((layer) => alphaAt(layer.Alpha, millis)));
  });

/** The clips of one body model during which a geoset visible in the model's first clip drops below the opacity it has there. */
export function fadingClips(model: mdx.Model, windows: readonly (readonly [number, number])[]): number[] {
  const first = windows[0];
  if (first === undefined) return [];
  const reference = opacities(model, first[0]);
  const fading: number[] = [];
  windows.forEach(([start, end], clip) => {
    for (let millis = start; millis <= end + FRAME_MILLISECONDS; millis += FRAME_MILLISECONDS) {
      const now = opacities(model, Math.min(millis, end));
      if (now.some((value, geoset) => (reference[geoset] ?? 0) > 0 && value < (reference[geoset] ?? 0) * FULL)) { fading.push(clip); return; }
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
