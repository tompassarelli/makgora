import { AttackStyle } from "../codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../gameplan";

export const CAIRNE_GAMEPLAN: FighterGameplan = {
  range: { near: 95.0, far: 155.0 },
  spacing: [{ move: AttackStyle.forwardTilt, near: 105.0, far: 180.0 },
    { move: GameplanSpecial.down, near: 0.0, far: 150.0 },
    { move: GameplanSpecial.neutral, near: 210.0, far: 450.0 }],
  approach: [{ via: "shoot", moves: [GameplanSpecial.neutral, AttackStyle.forwardTilt], weight: 1 },
    { via: "run", moves: [GameplanSpecial.down, AttackStyle.grab, AttackStyle.downTilt], weight: 3 }],
  defense: ["stance", "shield", "stance", "retreat"],
  combos: [{ starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
    { starter: GameplanSpecial.down, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [GameplanSpecial.down, AttackStyle.forwardTilt] }],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 70.0 }, { move: AttackStyle.upSmash, fromPercent: 90.0 },
    { move: AttackStyle.forwardAir, fromPercent: 95.0 }, { move: GameplanThrow.back, fromPercent: 100.0 },
    { move: GameplanSpecial.side, fromPercent: 105.0 }],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge", "air"],
};
