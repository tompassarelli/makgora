import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const BUTCHER_GAMEPLAN: FighterGameplan = {
  range: { near: 120.0, far: 200.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 110.0, far: 180.0 },
    { move: AttackStyle.grab, near: 100.0, far: 190.0 },
    { move: GameplanSpecial.neutral, near: 220.0, far: 470.0 },
    { move: GameplanSpecial.side, near: 120.0, far: 260.0 },
    { move: AttackStyle.downTilt, near: 100.0, far: 180.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.neutral], weight: 3 },
    { via: "run", moves: [AttackStyle.grab, AttackStyle.forwardTilt, GameplanSpecial.side, GameplanSpecial.down], weight: 2 },
  ],
  defense: ["shield", "shield", "retreat", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab, AttackStyle.forwardSmash] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.downTilt, AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 75.0 },
    { move: GameplanThrow.back, fromPercent: 110.0 },
    { move: AttackStyle.upSmash, fromPercent: 95.0 },
    { move: AttackStyle.backAir, fromPercent: 110.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "edge", "below"],
};
