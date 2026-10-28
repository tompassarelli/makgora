import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const UTHER_GAMEPLAN: FighterGameplan = {
  range: { near: 90.0, far: 170.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 70.0, far: 140.0 },
    { move: GameplanSpecial.neutral, near: 60.0, far: 120.0 },
    { move: GameplanSpecial.side, near: 60.0, far: 160.0 },
    { move: AttackStyle.downTilt, near: 50.0, far: 110.0 },
  ],
  approach: [
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.grab, AttackStyle.dashAttack], weight: 6 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir], weight: 4 },
  ],
  defense: ["shield", "spotDodge", "roll"],
  combos: [
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, GameplanSpecial.neutral] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.dashAttack, AttackStyle.forwardTilt] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 85.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
    { move: AttackStyle.backAir, fromPercent: 115.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["below", "edge"],
};
