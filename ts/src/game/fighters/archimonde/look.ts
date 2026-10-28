import { f32 } from "wisp/src/sim/f32";
import type { HeroClip } from "../../sim/heroes/hero";
import type { HeroLook } from "../../presentation/model/look";

export const ARCHIMONDE_MODEL_FILE = "units\\demon\\Warlock\\Warlock.mdl";
const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND = clip(0, 1.5);
const STAND_2 = clip(1, f32(2.934));
const WALK = clip(2, 1.0);
const SPELL_SLAM = clip(3, f32(3.133));
const DEATH = clip(4, f32(2.333));
const DISSIPATE = clip(5, f32(3.333));
const ATTACK_1 = clip(6, f32(0.967));
const ATTACK_2 = clip(7, f32(1.1));
const SPELL = clip(8, 1.0);
const FLINCH: HeroClip = { index: 1, seconds: f32(0.4), aligned: true };

export const archimondeLook: HeroLook = {
  model: ARCHIMONDE_MODEL_FILE, objectId: 0x6d666172,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNArchimonde.blp",
  clips: {
    idle: STAND, walk: WALK, dash: WALK, run: WALK, crouch: STAND_2, fall: STAND, landing: STAND_2,
    shield: STAND_2, airDodge: STAND_2, smashCharge: STAND_2, ko: DISSIPATE, dizzy: STAND_2,
    jab: ATTACK_1, jab2: ATTACK_2, grab: ATTACK_1, forwardTilt: ATTACK_1, forwardTiltUp: ATTACK_2, forwardTiltDown: ATTACK_1,
    upTilt: SPELL, downTilt: ATTACK_2, dashAttack: ATTACK_2,
    forwardSmash: SPELL_SLAM, upSmash: SPELL, downSmash: ATTACK_2,
    neutralAir: ATTACK_2, forwardAir: ATTACK_1, backAir: ATTACK_2, upAir: SPELL, downAir: SPELL_SLAM,
    getUpAttack: ATTACK_2,
    ledgeHang: STAND, ledgeClimb: WALK, ledgeRoll: WALK, ledgeAttack: ATTACK_1,
    knockdown: DEATH, getUp: STAND_2, downDamage: DEATH,
    rollForward: WALK, rollBackward: WALK, spotDodge: STAND_2,
    jump: STAND_2, doubleJump: STAND_2, fallSpecial: STAND,
    wallJump: STAND_2, wallTech: STAND_2,
    damageGround: STAND_2, damageAir: STAND_2, damageShield: STAND_2,
    grabHold: STAND, grabbed: STAND_2,
    pummel: ATTACK_1, throwForward: SPELL, throwBack: ATTACK_2, throwUp: SPELL, throwDown: SPELL_SLAM,
    victimPummel: STAND_2, victimThrowForward: STAND_2, victimThrowBack: STAND_2, victimThrowUp: STAND_2, victimThrowDown: STAND_2,
    neutralSpecial: SPELL, neutralSpecialAir: SPELL, sideSpecial: SPELL, sideSpecialAir: SPELL,
    upSpecial: SPELL, upSpecialAir: SPELL, downSpecial: SPELL_SLAM, downSpecialAir: SPELL_SLAM,
  },
  damageClips: Array.from({ length: 9 }, () => FLINCH),
  fallback: STAND, defeat: "death",
};
