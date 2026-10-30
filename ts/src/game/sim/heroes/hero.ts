


import type { Character } from "../codes";
import type { FighterGameplan } from "../gameplan";
import type { FighterMoves, PartnerBody } from "../heroMoves";
import type { FighterSpecials } from "../specials/schema";


export interface NamedMove {
  readonly name: string;
  readonly description: string;
}


export interface HeroClip {
  readonly index: number;
  readonly seconds: number;
  readonly classicStartup?: { readonly index: number; readonly seconds: number; readonly startSeconds?: number | undefined } | undefined;

  readonly contact?: number | undefined;

  readonly entry?: number | undefined;

  readonly stance?: number | undefined;

  readonly held?: number | undefined;

  readonly windUpRate?: number | undefined;





  readonly aligned?: boolean | undefined;






  readonly until?: number | undefined;
}





export type HeroStatePose = "dash" | "run" | "crouch" | "fall" | "landing" | "shield" | "airDodge" | "smashCharge" | "ko" | "dizzy";





export type HeroFollowUpPose =
  | "neutralSpecialFollowUp" | "sideSpecialFollowUp" | "upSpecialFollowUp" | "downSpecialFollowUp"
  | "neutralSpecialRefire" | "neutralSpecialRefireAir"
  | "neutralSpecialFollowUpAir" | "sideSpecialFollowUpAir" | "upSpecialFollowUpAir" | "downSpecialFollowUpAir";


export type JabChainPose = "jab2" | "jab3";







export type HeroPose =
  | "idle" | "walk"
  | "turn" | "stop" | "jumpSquat"
  | "tech" | "techForward" | "techBackward" | "getUpRollForward" | "getUpRollBackward"
  | HeroStatePose
  | "jab" | JabChainPose | "grab" | "forwardTilt" | "upTilt" | "downTilt" | "forwardTiltUp" | "forwardTiltDown"
  | "forwardSmash" | "upSmash" | "downSmash" | "dashAttack"
  | "neutralAir" | "forwardAir" | "backAir" | "upAir" | "downAir" | "getUpAttack"
  | "ledgeHang" | "ledgeClimb" | "ledgeRoll" | "ledgeAttack"
  | "knockdown" | "getUp" | "downDamage" | "rollForward" | "rollBackward" | "spotDodge"
  | "jump" | "shortHop" | "fullHop" | "doubleJump" | "fallSpecial" | "specialFloat"

  | "wallJump" | "wallTech"
  | "damageGround" | "damageAir" | "damageTumble" | "damageShield"
  | "grabHold" | "grabbed"
  | "pummel" | "throwForward" | "throwBack" | "throwUp" | "throwDown"
  | "victimPummel" | "victimThrowForward" | "victimThrowBack" | "victimThrowUp" | "victimThrowDown"
  | "neutralSpecial" | "sideSpecial" | "upSpecial" | "downSpecial"
  | "neutralSpecialAir" | "sideSpecialAir" | "upSpecialAir" | "downSpecialAir" | "ultimate"
  | HeroFollowUpPose;


export type HeroClipTable = { readonly [pose in HeroPose]?: HeroClip | undefined };

export interface CommandGrabClips {
  readonly travel: HeroClip;
  readonly hold: HeroClip;
  readonly recovery: HeroClip;
}

export interface HeroDefinition {
  readonly character: Character;

  readonly name: string;
  readonly displayName?: string | undefined;
  readonly purpose: string;
  readonly weakness: string;




  readonly complete: boolean;
  readonly moves: FighterMoves;
  readonly specials?: FighterSpecials | undefined;

  readonly jab: NamedMove;

  readonly gameplan?: FighterGameplan | undefined;

  readonly partner?: PartnerBody | undefined;

  readonly damageScale?: ((role: number, partnerLive: boolean) => number) | undefined;
}

