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

const named = (character: Character, name: string): HeroClip | undefined => {
  const index = originalClipNamed(character, name);
  const source = index === undefined ? undefined : originalClip(character, index);
  return index === undefined || source === undefined ? undefined : { index, seconds: f32(source.endSeconds - source.startSeconds) };
};

const ORIGINAL_WALKS: Readonly<Record<number, (HeroClip | undefined)>> = {
  1: named(Character.rifleman, "walk"),
};
const STOCK_WALK = named(Character.demonHunter, "walk");
const ILLIDAN_GAIT: HeroClip | undefined = STOCK_WALK === undefined ? undefined : { ...STOCK_WALK, entry: f32(0.76), stance: 890.0 };
const ILLIDAN_DASH: HeroClip = { index: dh.DEMON_HUNTER_INITIAL_DASH_BURST_INDEX, seconds: dh.DEMON_HUNTER_INITIAL_DASH_BURST_SECONDS };


export function groundLocomotionClip(character: Character, motion: IllidanLocomotion, table: Readonly<HeroClipTable> = characterClips(character)): HeroClip | undefined {
  if (character === Character.demonHunter) {
    if (motion === IllidanLocomotion.walk || motion === IllidanLocomotion.run) return ILLIDAN_GAIT;
    if (motion === IllidanLocomotion.dash) return ILLIDAN_DASH;
    return undefined;
  }
  const walk = table.walk ?? ORIGINAL_WALKS[character];
  if (motion === IllidanLocomotion.walk) return walk;
  if (motion === IllidanLocomotion.run) return table.run ?? walk;
  if (motion === IllidanLocomotion.dash) return table.dash ?? table.run ?? walk;
  return undefined;
}


export function groundLocomotionRate(f: Readonly<Fighter>, motion: IllidanLocomotion, clip?: HeroClip): number {
  const gait = motion === IllidanLocomotion.walk ? "walk" : "run";
  const stride = DRAWN_STRIDES[lookCharacter(f.character)]?.[gait];
  if (stride === undefined) throw new Error(`missing drawn stride for ${f.character}/${gait}`);
  const speed = clip === undefined ? stride.speed : clip.stance ?? stride.alternates?.[clip.index] ?? stride.speed;
  return f32(f32(Math.abs(f.motion.vx) * 60.0) / speed);
}
