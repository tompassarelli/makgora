






import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const BLADEMASTER_GAMEPLAN: FighterGameplan = {

  range: { near: 120.0, far: 190.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 110.0, far: 170.0 },
    { move: AttackStyle.downTilt, near: 80.0, far: 165.0 },
    { move: AttackStyle.forwardSmash, near: 150.0, far: 210.0 },
    { move: GameplanSpecial.neutral, near: 60.0, far: 340.0 },
  ],
  approach: [

    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.forwardTilt, AttackStyle.downTilt], weight: 3 },
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.backAir], weight: 1 },
  ],
  defense: ["shield", "stance", "retreat", "roll", "spotDodge"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.dashAttack, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upSmash] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanSpecial.down, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 80.0 },
    { move: AttackStyle.backAir, fromPercent: 90.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
    { move: GameplanSpecial.neutral, fromPercent: 110.0 },
  ],

  recovery: { aim: "ledge", upSpecial: "last", sideSpecial: true },
  avoid: ["edge", "far", "below"],
};
