import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const ARCHIMONDE_GAMEPLAN: FighterGameplan = {
  range: { near: 130.0, far: 200.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 120.0, far: 190.0 },
    { move: GameplanSpecial.side, near: 150.0, far: 330.0 },
    { move: GameplanSpecial.neutral, near: 260.0, far: 700.0 },
    { move: AttackStyle.downTilt, near: 110.0, far: 180.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.side, GameplanSpecial.neutral], weight: 3 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.grab, GameplanSpecial.down], weight: 2 },
  ],
  defense: ["shield", "shield", "retreat", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab, AttackStyle.forwardSmash] },
    { starter: GameplanSpecial.down, followUps: [AttackStyle.forwardSmash, AttackStyle.upSmash] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.downTilt, AttackStyle.forwardTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 70.0 },
    { move: AttackStyle.backAir, fromPercent: 95.0 },
    { move: AttackStyle.upSmash, fromPercent: 90.0 },
    { move: GameplanThrow.back, fromPercent: 115.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "edge", "below"],
};
