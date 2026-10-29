import { f32 } from "wisp/src/sim/f32";
import type { HeroClip } from "../../sim/heroes/hero";
import type { HeroLook } from "../../presentation/model/look";

export interface StandinClips {
  readonly stand: HeroClip;
  readonly ready: HeroClip;
  readonly walk: HeroClip;
  readonly attack: HeroClip;
  readonly attack2: HeroClip;
  readonly spell: HeroClip;
  readonly death: HeroClip;
  readonly dissipate: HeroClip;
}

export interface StandinLook {
  readonly model: string;
  readonly objectId: number;
  readonly portrait: string;
  readonly clips: StandinClips;
}

export function standinLook({ model, objectId, portrait, clips }: StandinLook): HeroLook {
  const { stand, ready, walk, attack, attack2, spell, death, dissipate } = clips;
  const flinch: HeroClip = { index: ready.index, seconds: f32(0.4), aligned: true };
  return {
    model, objectId, portrait,
    clips: {
      idle: stand, walk, dash: walk, run: walk, crouch: ready, fall: stand, landing: ready,
      shield: ready, airDodge: ready, smashCharge: ready, ko: dissipate, dizzy: ready,
      jab: attack, jab2: attack2, grab: attack, forwardTilt: attack, forwardTiltUp: attack2, forwardTiltDown: attack,
      upTilt: spell, downTilt: attack2, dashAttack: attack2,
      forwardSmash: attack2, upSmash: spell, downSmash: attack,
      neutralAir: attack2, forwardAir: attack, backAir: attack2, upAir: spell, downAir: attack,
      getUpAttack: attack2,
      ledgeHang: stand, ledgeClimb: walk, ledgeRoll: walk, ledgeAttack: attack,
      knockdown: death, getUp: ready, downDamage: death,
      rollForward: walk, rollBackward: walk, spotDodge: ready,
      jump: ready, doubleJump: ready, fallSpecial: stand,
      wallJump: ready, wallTech: ready,
      damageGround: ready, damageAir: ready, damageShield: ready,
      grabHold: stand, grabbed: ready,
      pummel: attack, throwForward: attack2, throwBack: attack, throwUp: spell, throwDown: attack2,
      victimPummel: ready, victimThrowForward: ready, victimThrowBack: ready, victimThrowUp: ready, victimThrowDown: ready,
      neutralSpecial: spell, neutralSpecialAir: spell, sideSpecial: attack, sideSpecialAir: attack,
      upSpecial: spell, upSpecialAir: spell, downSpecial: spell, downSpecialAir: spell,
    },
    damageClips: Array.from({ length: 9 }, () => flinch),
    fallback: stand, defeat: "death",
  };
}
