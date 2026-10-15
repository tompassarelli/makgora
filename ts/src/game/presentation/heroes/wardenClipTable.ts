import type { KitNormals } from "../model/look";
import type { HeroClipTable } from "../../sim/heroes/hero";
import { wardenClips } from "./wardenClips";
import { WARDEN_FAN_CLIPS } from "../wardenFanClipInfo";

export function wardenClipTable(kit: KitNormals): HeroClipTable {
  const c = wardenClips(kit);
  return {
    ...c,
    smashCharge: c.forwardSmash,
    ledgeRoll: c.roll, rollForward: c.roll, rollBackward: c.roll, downDamage: c.knockdown,
    victimPummel: c.grabbed, victimThrowForward: c.damageAir, victimThrowBack: c.damageAir,
    victimThrowUp: c.damageAir, victimThrowDown: c.knockdown,
    neutralSpecial: c.shadowStrike, sideSpecial: c.pursuitLunge, upSpecial: c.blink, downSpecial: WARDEN_FAN_CLIPS.ground,
    neutralSpecialAir: c.shadowStrike, sideSpecialAir: c.pursuitLunge, upSpecialAir: c.blink, downSpecialAir: WARDEN_FAN_CLIPS.air,
  };
}
