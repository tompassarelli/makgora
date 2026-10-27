import { AttackStyle } from "../../sim/codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../../sim/gameplan";

export const KAELTHAS_GAMEPLAN: FighterGameplan = {
  range: { near: 120.0, far: 210.0 },
  spacing: [
    { move: GameplanSpecial.neutral, near: 200.0, far: 800.0 },
    { move: GameplanSpecial.down, near: 90.0, far: 260.0 },
    { move: GameplanSpecial.side, near: 60.0, far: 320.0 },
    { move: AttackStyle.forwardTilt, near: 75.0, far: 125.0 },
  ],
  approach: [{ via: "shoot", moves: [GameplanSpecial.down, GameplanSpecial.neutral, GameplanSpecial.side] }, { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir] }],
  defense: ["stance", "retreat", "shield", "roll", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: GameplanSpecial.side, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.downTilt, AttackStyle.upAir] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 95 }, { move: GameplanSpecial.neutral, fromPercent: 105 }, { move: AttackStyle.backAir, fromPercent: 110 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["close", "below", "edge"],
};
