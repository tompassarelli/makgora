import { SpecialAction } from "../sim/codes";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import { eyeBeamShotFrameWhen } from "../sim/eyeBeam";
import {
  DEMONHUNTER_IMMOLATE_ACTIVE,
  DEMONHUNTER_IMMOLATE_STARTUP,
  DEMONHUNTER_WING_STARTUP,
  FEL_RUSH_FIRST,
  FEL_RUSH_LAST,
  RIFLEMAN_BEAR_CAST_FRAMES,
  RIFLEMAN_RECOVERY_STARTUP_FRAMES,
} from "../sim/specials";
import { ACTIVE_CUE_FRAMES, type CueWindows } from "./cueWindows";

function originalActiveFrame(action: number, grounded: boolean): number {
  switch (action) {
    case SpecialAction.riflemanBlaster: return grounded ? RIFLEMAN_BLASTER_GROUND_SHOT_FRAME : RIFLEMAN_BLASTER_AIR_SHOT_FRAME;
    case SpecialAction.riflemanBear: return RIFLEMAN_BEAR_CAST_FRAMES;
    case SpecialAction.riflemanRecovery: return RIFLEMAN_RECOVERY_STARTUP_FRAMES;
    case SpecialAction.riflemanTrap: return 2;
    case SpecialAction.demonHunterEyeBeam: return eyeBeamShotFrameWhen(grounded);
    case SpecialAction.demonHunterFelRush: return FEL_RUSH_FIRST;
    case SpecialAction.demonHunterWingAscent: return DEMONHUNTER_WING_STARTUP;
    case SpecialAction.demonHunterImmolate: return DEMONHUNTER_IMMOLATE_STARTUP;
    default: return 1;
  }
}


const ORIGINAL_WINDOWS: Record<number, CueWindows> = {};

export function originalCueWindows(action: number, grounded: boolean): CueWindows {
  const key = action * 2 + (grounded ? 1 : 0);
  const known = ORIGINAL_WINDOWS[key];
  if (known !== undefined) return known;
  const first = originalActiveFrame(action, grounded);
  const authoredLast = action === SpecialAction.demonHunterFelRush ? FEL_RUSH_LAST
    : action === SpecialAction.demonHunterImmolate ? DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE - 1 : first;
  const windows: CueWindows = { startup: { first: 1, last: Math.max(1, first - 1) }, active: { first, last: Math.max(authoredLast, first + ACTIVE_CUE_FRAMES - 1) } };
  ORIGINAL_WINDOWS[key] = windows;
  return windows;
}
