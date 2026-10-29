import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const TYRANDE_GAMEPLAN: FighterGameplan = {
  range: { near: 70.0, far: 150.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 60.0, far: 110.0 },
    { move: AttackStyle.downTilt, near: 50.0, far: 105.0 },
    { move: GameplanSpecial.neutral, near: 150.0, far: 520.0 },
    { move: AttackStyle.forwardAir, near: 40.0, far: 100.0 },
    { move: GameplanSpecial.down, near: 0.0, far: 70.0 },
  ],
  approach: [
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir, AttackStyle.backAir], weight: 3 },
    { via: "shoot", moves: [GameplanSpecial.neutral], weight: 2 },
    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.grab, AttackStyle.downTilt], weight: 2 },
  ],
  defense: ["shield", "jump", "roll"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardAir, AttackStyle.grab, AttackStyle.upTilt] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: AttackStyle.forwardAir, followUps: [AttackStyle.jab, AttackStyle.grab, AttackStyle.downTilt] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardAir, AttackStyle.dashAttack] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 95.0 },
    { move: AttackStyle.backAir, fromPercent: 115.0 },
    { move: AttackStyle.upSmash, fromPercent: 105.0 },
    { move: AttackStyle.upAir, fromPercent: 125.0 },
    { move: GameplanThrow.back, fromPercent: 140.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge"],
};
