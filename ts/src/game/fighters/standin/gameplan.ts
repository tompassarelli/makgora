import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../../sim/gameplan";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";

const h = (n: number) => f32(HERO_REFERENCE_HEIGHT * f32(n));

export const STANDIN_GAMEPLAN: FighterGameplan = {
  range: { near: h(f32(1.2)), far: h(f32(2.4)) },
  spacing: [
    { move: GameplanSpecial.neutral, near: 160.0, far: 420.0 },
    { move: GameplanSpecial.side, near: 90.0, far: 220.0 },
    { move: AttackStyle.forwardTilt, near: h(f32(0.6)), far: h(f32(1.0)) },
    { move: AttackStyle.downTilt, near: h(f32(0.5)), far: h(f32(0.9)) },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.neutral], weight: 2 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.grab, GameplanSpecial.side], weight: 2 },
  ],
  defense: ["shield", "retreat", "roll", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.side] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 95 }, { move: AttackStyle.upSmash, fromPercent: 105 }, { move: AttackStyle.backAir, fromPercent: 115 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["below", "edge"],
};
