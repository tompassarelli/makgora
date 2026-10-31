import { f32 } from "wisp/src/sim/f32";
import { SpecialAction, SpecialCarry } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { HeroClip } from "../sim/heroes/hero";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { characterClips } from "./fighterClips";
import { FRAME_SECONDS } from "./frameClock";

export interface DuoSurfPose {
  key: string;
  clip: number;
  time: number;
}

const scratch: DuoSurfPose = { key: "", clip: 0, time: 0.0 };

function scrubbed(key: string, clip: HeroClip | undefined, time: number): Readonly<DuoSurfPose> | undefined {
  if (clip === undefined) return undefined;
  scratch.key = key;
  scratch.clip = clip.index;
  scratch.time = time;
  return scratch;
}

function dismountFrame(f: Readonly<Fighter>): number | undefined {
  for (const segment of runningHeroSpecial(f)?.motion ?? []) if (segment.dismount !== undefined) return segment.first;
  return undefined;
}

export function duoSurfPose(f: Readonly<Fighter>): Readonly<DuoSurfPose> | undefined {
  if (f.special.action !== SpecialAction.heroUp) return undefined;
  const clips = characterClips(f.character);
  if (f.special.carry === SpecialCarry.rider) return scrubbed("surf-board", clips.upSpecialBoard, 0.0);
  if (f.special.carry === SpecialCarry.carrier) return scrubbed("surf-ride", clips.upSpecialRide, 0.0);
  const first = dismountFrame(f);
  if (first === undefined || f.special.frame < first) return undefined;
  return scrubbed("surf-dismount", clips.upSpecialDismount, f32((f.special.frame - first) * FRAME_SECONDS));
}
