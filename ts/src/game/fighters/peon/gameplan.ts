import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const PEON_GAMEPLAN: FighterGameplan = {
  range: { near: 0.0, far: 75.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 60.0, far: 120.0 },
    { move: AttackStyle.downTilt, near: 40.0, far: 95.0 },
    { move: AttackStyle.grab, near: 0.0, far: 75.0 },
    { move: GameplanSpecial.side, near: 115.0, far: 180.0 },
  ],
  approach: [
    { via: "run", moves: [AttackStyle.downTilt, AttackStyle.grab, AttackStyle.dashAttack], weight: 12 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir], weight: 2 },
  ],
  defense: ["stance", "stance", "stance", "retreat"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardAir] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir] },
    { starter: GameplanSpecial.side, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt] },
  ],
  kills: [
    { move: GameplanSpecial.down, fromPercent: 45.0 },
    { move: AttackStyle.forwardSmash, fromPercent: 90.0 },
    { move: AttackStyle.upSmash, fromPercent: 105.0 },
    { move: AttackStyle.forwardAir, fromPercent: 115.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["far", "edge"],
};
