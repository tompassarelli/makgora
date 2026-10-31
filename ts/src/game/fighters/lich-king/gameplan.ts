import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const LICH_KING_GAMEPLAN: FighterGameplan = {
  range: { near: 110.0, far: 185.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 105.0, far: 190.0 },
    { move: AttackStyle.downTilt, near: 80.0, far: 150.0 },
    { move: GameplanSpecial.neutral, near: 200.0, far: 330.0 },
    { move: GameplanSpecial.side, near: 180.0, far: 420.0 },
    { move: GameplanSpecial.down, near: 420.0, far: 1400.0 },
  ],
  approach: [

    { via: "shoot", moves: [GameplanSpecial.neutral, AttackStyle.forwardTilt], weight: 2 },

    { via: "shoot", moves: [GameplanSpecial.down, AttackStyle.upTilt, AttackStyle.grab] },
    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.grab] },
  ],
  defense: ["shield", "retreat", "shield", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanSpecial.neutral, followUps: [AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt] },

    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, AttackStyle.dashAttack] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 75.0 },
    { move: AttackStyle.upSmash, fromPercent: 90.0 },
    { move: AttackStyle.backAir, fromPercent: 100.0 },

    { move: GameplanThrow.back, fromPercent: 120.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "air"],
};
