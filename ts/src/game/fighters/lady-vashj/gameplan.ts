import { AttackStyle } from "../../sim/codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../../sim/gameplan";

export const LADY_VASHJ_GAMEPLAN: FighterGameplan = {
  range: { near: 220.0, far: 540.0 },
  spacing: [
    { move: GameplanSpecial.neutral, near: 200.0, far: 560.0 },
    { move: GameplanSpecial.side, near: 150.0, far: 320.0 },
    { move: AttackStyle.forwardTilt, near: 80.0, far: 130.0 },
    { move: AttackStyle.downTilt, near: 60.0, far: 120.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.neutral, GameplanSpecial.side], weight: 3 },
  ],
  defense: ["retreat", "retreat", "shield", "roll", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.downTilt, GameplanSpecial.neutral] },
    { starter: GameplanSpecial.neutral, followUps: [GameplanSpecial.side] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 100.0 }, { move: AttackStyle.backAir, fromPercent: 115.0 }, { move: AttackStyle.upSmash, fromPercent: 120.0 }],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "below", "edge"],
  whenStale: "hold",
};
