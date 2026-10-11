// The HUD bust's in-frame verdict (smashcraft#363 item 6, wisp#125 lane 7): each
// fighter's declared portrait parts, the thresholds the lead fixed before any
// bust was scored, and the pass or fail of Wisp's inFrame rows against them.
import type { InFrame } from 'wisp/scripts/wisp/screenBounds';
import type { PixelRect } from 'wisp/scripts/wisp/screen';
import { BUST_BOX, boxLeft, boxTop, plateLeft } from '../src/game/ui/plateLayout';
import { PARTICIPANT_SLOTS } from '../src/game/input/participants';
import { unitsForPixels } from '../src/game/ui/portraitFrames';

/**
 * Fixed by the lead (wisp#125 lane 7, 11 Oct) before anything was scored, at the
 * 96 px HUD bust; not tuned to results. Owner ruling (10 Oct): where a fighter
 * can't fit both, the clear face wins and the table says why.
 */
export const IN_FRAME_THRESHOLDS = {
  /** Face visible: the face's pixel box is at least this tall... */
  faceHeightPx: 24,
  /** ...and this many face pixels show. */
  facePixels: 300,
  /** Nothing crosses the face: face pixels hidden by the weapon, at most this share of face pixels. */
  faceHiddenShare: 0.02,
  /** Rows between the frame's top and the head's top visible row (head not cut at the top). */
  crownMarginPx: 2,
  /** Weapon in frame: weapon pixels shown. */
  weaponPixels: 150,
  /** Weapon held: the gripping hand's box and the weapon's box overlap or lie within this gap. */
  heldGapPx: 4,
} as const;

/** The headless canvas the HUD is measured on (the map's render size; 256 reference px draw 96 px there). */
export const HUD_SCREEN = { width: 1280, height: 720 } as const;

/** Player slot's HUD bust frame in screen pixels, origin top left: the plate layout through Wisp's UI pixel rule. */
export function hudBustFrame(slot: number, count = PARTICIPANT_SLOTS.length): PixelRect {
  const scale = HUD_SCREEN.height / 0.6, left = boxLeft(plateLeft(slot, count), BUST_BOX), top = boxTop(BUST_BOX);
  return { x: HUD_SCREEN.width / 2 + (left - 0.4) * scale, y: (0.6 - top) * scale, width: unitsForPixels(BUST_BOX.width) * scale, height: unitsForPixels(BUST_BOX.height) * scale };
}

/** A fighter's portrait parts as Classic node names: the head (crown margin), the face, the weapon and the hand gripping it. */
export interface PortraitParts { readonly head: readonly string[]; readonly face: readonly string[]; readonly weapon: readonly string[]; readonly hand: readonly string[] }

/**
 * Classic node names per fighter, from each rig's Classic mapping
 * (smashcraft:tools/animations/hd-rigs): `head` its head joint, `weapon` its
 * weapon joints, `hand` the wrist on the weapon's side (`wrist.R` for `weapon`,
 * `wrist.L` for a left-hand-only weapon). Classic faces are skinned to the head
 * bone, so `face` is the head bone plus any jaw the rig names. Fighters whose
 * Classic rig names no weapon declare none.
 */
const part = (head: string, weapon: readonly string[], hand: readonly string[], face: readonly string[] = []): PortraitParts => ({ head: [head], face: [head, ...face], weapon, hand: weapon.length === 0 ? [] : hand });
export const PORTRAIT_PARTS: Readonly<Record<string, PortraitParts>> = {
  Rifleman: part('Bone_Head', ['Rifle01'], ['Bone_Hand_R']),
  Illidan: part('Bone_Head', ['blade_base', 'stand_blade_L'], ['Bone_Hand_R', 'Bone_Hand_L']),
  Blademaster: part('Bone_Head', ['Sword'], ['Bone_Hand_R']),
  MountainKing: part('Bone_Head', ['1Cylinder04', '1Cylinder03'], ['Bone_Hand_R', 'Bone_Hand_L']),
  Warden: part('Bone_Head', ['Object08'], ['Bone_Hand_R']),
  Lich: part('Bone_Head', [], []),
  ForsakenPaladin: part('bone_head', ['Wep01_R0_0_jnt'], ['arm_R0_end_jnt']),
  Dreadlord: part('Bone_Head', [], []),
  ShadowHunter: part('Bone_Head', ['Object11'], ['Bone_Hand_R']),
  PitLord: part('Bone_Head', ['Real BLADE'], ['Bone_Hand_R']),
  Beastmaster: part('Bone_Head', [], []),
  LichKing: part('Head', ['Weapon'], ['Rhand']),
  Thrall: part('Bone_Head', ['Hammer'], ['Bone Rider R Wrist']),
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
  Kobold: part('Bone_Head', ['PickAxe'], ['Bone_Hand_R']),
};

/** What one bust measures: inFrame over the declared parts, and the face pixels the weapon hides (inFrame with the face as its head). */
export interface BustMeasure { readonly parts: InFrame['parts']; readonly crownMargin: number | undefined; readonly faceHidden: number }

export type InFrameRule = 'face visible' | 'nothing crosses the face' | 'crown margin' | 'weapon in frame' | 'weapon held';
export const IN_FRAME_RULES: readonly InFrameRule[] = ['face visible', 'nothing crosses the face', 'crown margin', 'weapon in frame', 'weapon held'];
/** A rule's result; `n/a` for weapon rules on a fighter that declares no weapon. */
export type RuleResult = 'pass' | 'fail' | 'n/a';

type Box = NonNullable<InFrame['parts'][string]>['box'];
/** The gap between two pixel boxes, 0 when they overlap or touch; infinite when either is missing. */
export const boxGap = (a: Box, b: Box): number => {
  if (a === undefined || b === undefined) return Infinity;
  return Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));
};

/** Each rule's pass or fail for one bust; `armed` is whether the fighter declares a weapon. */
export function inFrameVerdict(measure: BustMeasure, armed: boolean): Readonly<Record<InFrameRule, RuleResult>> {
  const t = IN_FRAME_THRESHOLDS, face = measure.parts.face, weapon = measure.parts.weapon, hand = measure.parts.hand;
  const facePixels = face?.pixels ?? 0, faceBox = face?.box;
  const verdict = (ok: boolean): RuleResult => ok ? 'pass' : 'fail';
  return {
    'face visible': verdict(faceBox !== undefined && faceBox.bottom - faceBox.top >= t.faceHeightPx && facePixels >= t.facePixels),
    'nothing crosses the face': verdict(measure.faceHidden <= t.faceHiddenShare * facePixels),
    'crown margin': verdict(measure.crownMargin !== undefined && measure.crownMargin >= t.crownMarginPx),
    'weapon in frame': armed ? verdict((weapon?.pixels ?? 0) >= t.weaponPixels) : 'n/a',
    'weapon held': armed ? verdict(boxGap(hand?.box, weapon?.box) <= t.heldGapPx) : 'n/a',
  };
}

/** Why a rule failed, where the measures tell: pose, sequence, camera, or a missing attachment or geoset. */
export type FailureCause = 'pose' | 'sequence' | 'camera' | 'missing attachment or geoset';

/**
 * A failed rule's cause class when known. `missing` lists declared nodes the model
 * lacks; `weaponInRender` is the weapon's pixels over the whole render (undefined
 * when not measured), so a weapon drawn but cropped out is the camera's, and one
 * drawn nowhere is a missing attachment or geoset.
 */
export function failureCause(rule: InFrameRule, measure: BustMeasure, missing: readonly string[], weaponInRender: number | undefined): FailureCause | undefined {
  if (missing.length > 0) return 'missing attachment or geoset';
  switch (rule) {
    case 'crown margin': return 'camera';
    case 'nothing crosses the face': return 'pose';
    case 'weapon in frame': return weaponInRender === undefined ? undefined : weaponInRender === 0 ? 'missing attachment or geoset' : 'camera';
    case 'weapon held': return (measure.parts.hand?.pixels ?? 0) === 0 && (measure.parts.weapon?.pixels ?? 0) > 0 ? 'camera' : 'pose';
    case 'face visible': return (measure.parts.face?.pixels ?? 0) > 0 ? 'camera' : undefined;
  }
}
