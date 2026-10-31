import { f32 } from "wisp/src/sim/f32";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { HeroClip, HeroClipTable } from "../sim/heroes/hero";
import { characterClips } from "./fighterClips";
import * as dh from "./demonHunterAssetInfo";
import { IllidanLocomotion } from "./illidanMotion";
import { DRAWN_STRIDES } from "./drawnStrideInfo";
import { lookCharacter } from "../roster/kits";
import { min } from "../core/numbers";

const named = (character: Character, name: string): HeroClip | undefined => {
  const index = originalClipNamed(character, name);
  const source = index === undefined ? undefined : originalClip(character, index);
  return index === undefined || source === undefined ? undefined : { index, seconds: f32(source.endSeconds - source.startSeconds) };
};

const ORIGINAL_WALKS: Readonly<Record<number, (HeroClip | undefined)>> = {
  1: named(Character.rifleman, "walk"),
};
const ILLIDAN_GAIT: HeroClip = { index: dh.DEMON_HUNTER_WALK_FORWARD_INDEX, seconds: 1.0, stance: 372.0 };
const ILLIDAN_RUN: HeroClip = { index: dh.DEMON_HUNTER_RUN_FORWARD_INDEX, seconds: f32(0.6) };


export function groundLocomotionClip(character: Character, motion: IllidanLocomotion, table: Readonly<HeroClipTable> = characterClips(character)): HeroClip | undefined {
  if (character === Character.demonHunter) {
    if (motion === IllidanLocomotion.walk) return ILLIDAN_GAIT;
    if (motion === IllidanLocomotion.run) return ILLIDAN_RUN;
    if (motion === IllidanLocomotion.dash) return ILLIDAN_RUN;
    return undefined;
  }
  const walk = table.walk ?? ORIGINAL_WALKS[character];
  if (motion === IllidanLocomotion.walk) return walk;
  if (motion === IllidanLocomotion.run) return table.run ?? walk;
  if (motion === IllidanLocomotion.dash) return table.dash ?? table.run ?? walk;
  return undefined;
}


export const GROUND_LOCOMOTION_RATE_CAP = f32(5.0);

const RATE_CAP_OVERRIDES: Readonly<Record<number, number>> = { [Character.warden]: f32(6.25) };

export const groundLocomotionRateCap = (character: Character): number => RATE_CAP_OVERRIDES[character] ?? GROUND_LOCOMOTION_RATE_CAP;

export function uncappedGroundLocomotionRate(f: Readonly<Fighter>, motion: IllidanLocomotion, clip?: HeroClip): number {
  const gait = motion === IllidanLocomotion.walk ? "walk" : "run";
  const stride = DRAWN_STRIDES[lookCharacter(f.character)]?.[gait];
  if (stride === undefined) throw new Error(`missing drawn stride for ${f.character}/${gait}`);
  const speed = clip === undefined ? stride.speed : clip.stance ?? stride.speed;
  return f32(f32(Math.abs(f.motion.vx) * 60.0) / speed);
}

export function groundLocomotionRate(f: Readonly<Fighter>, motion: IllidanLocomotion, clip?: HeroClip): number {
  return min(uncappedGroundLocomotionRate(f, motion, clip), groundLocomotionRateCap(f.character));
}
