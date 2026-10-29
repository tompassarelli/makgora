import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Portrait } from 'wisp/scripts/wisp/screenBounds';
import { RENDERED_FIGHTERS } from '../src/game/roster/kits';
import { originalClip } from '../src/generated/clips/fighterOriginalClipInfo';

/** Classic node names per fighter for Wisp's in-frame verdict: the head (crown margin), its face, the weapon and the hand gripping it. */
export interface PortraitParts { readonly head: readonly string[]; readonly face: readonly string[]; readonly weapon: readonly string[]; readonly hand: readonly string[] }

const part = (head: string, weapon: readonly string[], hand: readonly string[], face: readonly string[] = []): PortraitParts => ({ head: [head], face: [head, ...face], weapon, hand: weapon.length === 0 ? [] : hand });
export const PORTRAIT_PARTS: Readonly<Record<string, PortraitParts>> = {
  Rifleman: part('Bone_Head', ['Rifle01'], ['Bone_Hand_R']),
  Illidan: part('Bone_Head', ['blade_base', 'stand_blade_L'], ['Bone_Hand_R', 'Bone_Hand_L']),
  Blademaster: part('Bone_Head', ['Sword'], ['Bone_Hand_R']),
  MountainKing: part('Bone_Head', ['1Cylinder04', '1Cylinder03'], ['Bone_Hand_R', 'Bone_Hand_L']),
  Warden: part('Bone_Head', ['Object08'], ['Bone_Hand_R']),
  Lich: part('Bone_Head', [], []),
  Uther: part('Bone_Head', ['Hammer'], ['HandR']),
  Dreadlord: part('Bone_Head', [], []),
  ShadowHunter: part('Bone_Head', ['Object11'], ['Bone_Hand_R']),
  PitLord: part('Bone_Head', ['Real BLADE'], ['Bone_Hand_R']),
  Beastmaster: part('Bone_Head', [], []),
  LichKing: part('Head', ['Weapon'], ['Rhand']),
  Thrall: part('Bone_Head', ['axe'], ['Bone_Hand_R']),
  JainaProudmoore: part('Bone_Head', ['Bone_Staff'], ['Bone_Hand_RArchDruid']),
  SylvanasWindrunner: part('Bone_Head', ['Cylinder02'], ['Bone_Hand_L']),
  CairneBloodhoof: part('Bone_Head', ['Axe'], ['Bone_HandR']),
  ChenStormstout: part('Bone_Head', ['Mesh10', 'Box02'], ['Bone_Hand_R', 'Bone_Hand_L']),
  Peon: part('Bone_Head', ['axehandle'], ['Bone_Hand_L']),
  GoblinTinker: part('Bone_Head01', [], []),
  "Kael'thasSunstrider": part('Bone_Head', [], []),
  Murloc: part('Bone_Head', ['Blade'], ['Bone_Hand_R']),
  GromHellscream: part('Bone_Head', ['Bone_Sword'], ['Bone_Hand_R']),
  "Anub'arak": part('Bone_Head', [], [], ['Bone_Jaw']),
  MalfurionStormrage: part('Bone_Head', [], []),
  Medivh: part('Bone_Head', ['Staff'], ['Bone_Hand_R']),
  LadyVashj: part('Bone_Head', ['Bow'], ['Bone_Hand2_Left']),
  Archimonde: part('Bone_Head', [], []),
  Butcher: part('Bone_Head', [], []),
  Tyrande: part('Bone_Head', ['Cylinder02'], ['Bone_Hand_L']),
};

/** The fighter's declared parts kept to the nodes its drawn Classic body has, and the declared nodes it lacks. */
export function resolvedParts(name: string, nodes: ReadonlySet<string>): { readonly parts: Readonly<Record<string, readonly string[]>>; readonly missing: readonly string[] } {
  const declared = PORTRAIT_PARTS[name];
  if (declared === undefined) return { parts: {}, missing: [`${name}: no declared parts`] };
  const parts = Object.fromEntries(Object.entries(declared).map(([key, names]: [string, readonly string[]]) => [key, names.filter((node) => nodes.has(node))]));
  return { parts, missing: Object.values(declared).flat().filter((node) => !nodes.has(node)) };
}

/** A Bust texture's Classic receipt, as fighterPortraits writes it to fighter-renders/receipts/. */
export interface PortraitReceipt extends Portrait { readonly path: string }

export const RECEIPTS = 'receipts';

const TIMELINE_BODY = /^war3mapImported\\(.+)TimelineBody-[0-9a-f]+\.mdx$/i;

const currentBodies = (): ReadonlyMap<string, string> => new Map(RENDERED_FIGHTERS.flatMap((character) => {
  const model = originalClip(character, 0)?.modelPath, name = model === undefined ? undefined : TIMELINE_BODY.exec(model)?.[1];
  return model === undefined || name === undefined ? [] : [[name, model] as const];
}));

const withCurrentBodies = (portrait: Portrait, bodies: ReadonlyMap<string, string>): Portrait => {
  const effects = portrait.scene.effects.map((effect) => {
    const name = TIMELINE_BODY.exec(effect.model)?.[1];
    const model = name === undefined ? undefined : bodies.get(name);
    return model === undefined ? effect : { ...effect, model };
  });
  return { ...portrait, scene: { ...portrait.scene, effects } };
};

/** Every stored Bust receipt by its map texture path, for Wisp's `render.portraits`. */
export function storedPortraits(renders: string): Readonly<Record<string, Portrait>> {
  const directory = join(renders, RECEIPTS);
  if (!existsSync(directory)) return {};
  const bodies = currentBodies();
  return Object.fromEntries(readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => {
    const { path, ...portrait } = JSON.parse(readFileSync(join(directory, file), 'utf8')) as PortraitReceipt;
    return [path, withCurrentBodies(portrait, bodies)];
  }));
}
