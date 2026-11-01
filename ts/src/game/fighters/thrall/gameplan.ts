import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const THRALL_GAMEPLAN: FighterGameplan = {
  range: { near: 45.0, far: 100.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 30.0, far: 90.0 },
    { move: AttackStyle.downTilt, near: 30.0, far: 120.0 },
    { move: GameplanSpecial.side, near: 120.0, far: 340.0 },
    { move: GameplanSpecial.down, near: 130.0, far: 320.0 },
    { move: GameplanSpecial.neutral, near: 180.0, far: 480.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.down, GameplanSpecial.neutral], weight: 2 },
    { via: "run", moves: [GameplanSpecial.down, GameplanSpecial.side, AttackStyle.grab, AttackStyle.downTilt, AttackStyle.dashAttack], weight: 2 },
  ],
  defense: ["shield", "spotDodge", "retreat"],
  combos: [
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: GameplanThrow.down, followUps: [GameplanSpecial.down, AttackStyle.dashAttack, AttackStyle.upTilt] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 80.0 }, { move: AttackStyle.backAir, fromPercent: 90.0 }, { move: AttackStyle.upSmash, fromPercent: 90.0 }, { move: GameplanThrow.back, fromPercent: 110.0 }],
  recovery: { aim: "ledge", upSpecial: "last", sideSpecial: true }, avoid: ["edge", "air"],
};
