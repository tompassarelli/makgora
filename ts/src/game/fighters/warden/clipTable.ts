import type { KitNormals } from "../../presentation/model/look";
import type { HeroClipTable } from "../../sim/heroes/hero";
import { WARDEN_SEQUENCES, wardenClips } from "./clips";

export function wardenClipTable(kit: KitNormals): HeroClipTable {
  const c = wardenClips(kit);
  return {
    ...c,
    smashCharge: c.forwardSmash,
    ledgeRoll: c.roll, rollForward: c.roll, rollBackward: c.roll, downDamage: c.knockdown,
    victimPummel: c.grabbed, victimThrowForward: c.damageAir, victimThrowBack: c.damageAir,
    victimThrowUp: c.damageAir, victimThrowDown: c.knockdown,
    neutralSpecial: c.shadowStrike, sideSpecial: c.pursuitLunge, upSpecial: c.blink, downSpecial: WARDEN_SEQUENCES.spell,
    neutralSpecialRefire: WARDEN_SEQUENCES.spellThrow, neutralSpecialRefireAir: WARDEN_SEQUENCES.spellThrow,
    neutralSpecialAir: c.shadowStrike, sideSpecialAir: c.pursuitLunge, upSpecialAir: c.blink, downSpecialAir: WARDEN_SEQUENCES.spell,
  };
}
