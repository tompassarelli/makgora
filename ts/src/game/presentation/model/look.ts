import { f32 } from "wisp/src/sim/f32";
import type { AttackStyle } from "../../sim/codes";
import type { Costume, CostumeSkin } from "./costume";
import type { CommandGrabClips, HeroClip, HeroClipTable, HeroFollowUpPose, HeroPose } from "../../sim/heroes/hero";

export interface HeroLook {

  readonly model: string;

  readonly objectId: number;

  readonly portrait: string;

  readonly placedModel?: { readonly path: string; readonly height: number; readonly alpha: number; readonly finished?: true } | undefined;

  readonly clips: HeroClipTable;

  readonly followUpClips?: { readonly [pose in HeroFollowUpPose]?: readonly HeroClip[] } | undefined;

  readonly damageClips?: readonly HeroClip[] | undefined;
  readonly fallback: HeroClip;

  readonly defeat?: string | undefined;

  readonly commandGrab?: CommandGrabClips | undefined;

  readonly ultimateBurst?: UltimateBurstLook | undefined;

  readonly cueReadNormals?: readonly AttackStyle[] | undefined;

  readonly orbit?: OrbitLook | undefined;

  readonly flight?: FlightLook | undefined;

  readonly carry?: CarryLook | undefined;

  readonly costumes?: readonly Costume[] | undefined;

  readonly partner?: PartnerLook | undefined;
}

export interface PartnerLook {
  readonly skin: CostumeSkin;
  readonly scale: number;
}

export interface CarryLook {
  readonly stand: HeroPose;
  readonly walk: HeroPose;
}

export interface OrbitLook {
  readonly model: string;
  readonly count: number;
  readonly radius: number;
  readonly z: number;
  readonly periodFrames: number;
  readonly scale: number;
}

export interface FlightLook {
  readonly flames: string;
  readonly flamesScale: number;
  readonly flamesZ: number;
  readonly egg: string;
  readonly eggScale: number;
}

export interface UltimateBurstLook {
  readonly model: string;
  readonly scale: number;
  readonly lift: number;
  readonly sequence?: string | undefined;
}

export const STOCK_FALLBACK_CLIP: HeroClip = { index: 0, seconds: 1.0 };

export interface KitNormals {
  readonly normals: { readonly [style: number]: { readonly startupFrames: number; readonly totalFrames: number } | undefined };
}

export function jabSlice(clip: { readonly index: number }, until: number): HeroClip {
  return { index: clip.index, seconds: until, aligned: true, until };
}

export function strikeClip(clip: { readonly index: number }, strike: number, kit: KitNormals, style: AttackStyle, frame?: number): HeroClip {
  const move = kit.normals[style];
  const before = frame === undefined ? move?.startupFrames ?? 1 : frame - 1;
  return { index: clip.index, seconds: f32(f32(strike * (move?.totalFrames ?? 1)) / Math.max(1, before)), aligned: true };
}
