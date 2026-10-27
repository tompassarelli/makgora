import * as dh from "./demonHunterAssetInfo";
import { Character, HeroStatusKind } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { HeroClip, HeroClipTable } from "../sim/heroes/hero";

export const COWER_HOLD_FRAMES = 24;

export interface DisabledPose {
  key: string;
  index: number | undefined;
  seconds: number;
  holdFrames: number;
}

const disabled: DisabledPose = { key: "", index: undefined, seconds: 0.0, holdFrames: 0 };

function hold(key: string, clip: Readonly<HeroClip> | undefined, holdFrames: number): DisabledPose {
  disabled.key = key;
  disabled.index = clip?.index;
  disabled.seconds = clip?.seconds ?? 0.0;
  disabled.holdFrames = clip === undefined ? 0 : holdFrames;
  return disabled;
}

const ILLIDAN_COWER: HeroClip = { index: dh.DEMON_HUNTER_CROUCH_INDEX, seconds: dh.DEMON_HUNTER_CROUCH_SECONDS };
const ILLIDAN_STUN: HeroClip = { index: dh.DEMON_HUNTER_SHIELD_BREAK_INDEX, seconds: 0.0 };

export function disabledPose(f: Readonly<Fighter>, table: Readonly<HeroClipTable>): Readonly<DisabledPose> | undefined {
  if (f.launch.hitlag > 0 || f.launch.hitstun > 0) return undefined;
  const illidan = f.character === Character.demonHunter;
  if (f.status.condition === HeroStatusKind.fear) return hold("cowering", illidan ? ILLIDAN_COWER : table.crouch, COWER_HOLD_FRAMES);
  if (f.status.condition === HeroStatusKind.stun) return hold("stunned", illidan ? ILLIDAN_STUN : table.dizzy, 0);
  return undefined;
}
