import { floorMod } from "wisp/src/sim/intMath";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { HeroClip } from "../sim/heroes/hero";
import { runningHeroSpecial } from "../sim/specials/engine";
import { characterClips } from "./fighterClips";

function refireClip(f: Readonly<Fighter>): HeroClip | undefined {
  if (f.special.action !== SpecialAction.heroNeutral || floorMod(f.special.refires, 2) === 0) return undefined;
  return characterClips(f.character)[f.motion.grounded ? "neutralSpecialRefire" : "neutralSpecialRefireAir"];
}

function refireLoopFrames(f: Readonly<Fighter>): number | undefined {
  const refire = runningHeroSpecial(f)?.refire;
  return refire === undefined || refireClip(f) === undefined ? undefined : refire.last + 1 - refire.first;
}

export const refireKey = (f: Readonly<Fighter>): string => f.special.refires > 0 ? `#${f.special.refires}` : "";

export const refiredClip = (f: Readonly<Fighter>, clip: HeroClip): HeroClip => refireClip(f) ?? clip;

export const refireClipFrames = (f: Readonly<Fighter>): number => refireLoopFrames(f) ?? f.special.duration;
