import { f32 } from "wisp/src/sim/f32";
import type { HeroClip } from "../../sim/heroes/hero";
import type { HeroLook } from "../../presentation/model/look";
import { BUTCHER_AUTHORED_CLIPS } from "./clips";

export const BUTCHER_MODEL_FILE = "units\\undead\\Abomination\\Abomination.mdl";
const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND = clip(0, f32(1.667));
const WALK = clip(1, 1.0);
const ATTACK_1 = clip(2, f32(1.667));
const STAND_2 = clip(3, 2.0);
const ATTACK_2 = clip(4, f32(1.667));
const DEATH = clip(5, f32(2.167));
const CHANNEL = clip(6, f32(1.667));
const STAND_3 = clip(7, f32(1.667));
const FLINCH: HeroClip = { index: 3, seconds: f32(0.4), aligned: true };
const HOOK_WIND_UP_RATE = 2.0;
const HOOK_THROWS = (thrown: HeroClip): readonly HeroClip[] => [thrown, thrown, thrown, thrown, STAND_3];

export const butcherLook: HeroLook = {
  model: BUTCHER_MODEL_FILE, objectId: 0x6d666275,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNAbomination.blp",
  clips: {
    idle: STAND, walk: WALK, dash: WALK, run: WALK, crouch: STAND_3, fall: STAND, landing: STAND_3,
    shield: STAND_3, airDodge: STAND_3, ko: DEATH, dizzy: STAND_2,
    jab: ATTACK_1, jab2: ATTACK_2, grab: ATTACK_2, forwardTilt: ATTACK_1, forwardTiltUp: ATTACK_1, forwardTiltDown: ATTACK_1,
    downTilt: ATTACK_2,
    getUpAttack: ATTACK_2,
    ledgeHang: STAND, ledgeClimb: WALK, ledgeRoll: WALK, ledgeAttack: ATTACK_1,
    knockdown: DEATH, getUp: STAND_3, downDamage: DEATH,
    rollForward: WALK, rollBackward: WALK, spotDodge: STAND_3,
    jump: STAND_3, doubleJump: STAND_3, fallSpecial: STAND,
    wallJump: STAND_3, wallTech: STAND_3,
    damageGround: STAND_2, damageAir: STAND_2, damageShield: STAND_3,
    grabHold: CHANNEL, grabbed: STAND_2,
    pummel: ATTACK_1, throwForward: ATTACK_2, throwBack: ATTACK_2, throwUp: ATTACK_2, throwDown: ATTACK_1,
    victimPummel: STAND_2, victimThrowForward: STAND_2, victimThrowBack: STAND_2, victimThrowUp: STAND_2, victimThrowDown: STAND_2,
    upSpecial: ATTACK_2, upSpecialAir: ATTACK_2, downSpecial: CHANNEL, downSpecialAir: CHANNEL,
    ...BUTCHER_AUTHORED_CLIPS,
    neutralSpecial: { ...BUTCHER_AUTHORED_CLIPS.neutralSpecial, windUpRate: HOOK_WIND_UP_RATE },
    neutralSpecialAir: { ...BUTCHER_AUTHORED_CLIPS.neutralSpecialAir, windUpRate: HOOK_WIND_UP_RATE },
  },
  followUpClips: { neutralSpecialFollowUp: HOOK_THROWS(BUTCHER_AUTHORED_CLIPS.neutralSpecialFollowUp), neutralSpecialFollowUpAir: HOOK_THROWS(BUTCHER_AUTHORED_CLIPS.neutralSpecialFollowUpAir) },
  damageClips: Array.from({ length: 9 }, () => FLINCH),
  fallback: STAND, defeat: "death",
};
