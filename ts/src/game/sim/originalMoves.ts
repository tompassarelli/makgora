



import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction } from "./codes";
import type { FighterMoves } from "./heroMoves";
import { RIFLEMAN_GROUND, type GroundKit } from "./heroes/groundNormals";
import { shippedHurtboxes } from "./hurtboxes";

function originalMoves(character: Character, kit: GroundKit, throws: FighterMoves["throws"] = {}): FighterMoves {
  const moves: FighterMoves = {
    normals: kit.normals,
    throws,
    dashAttack: AttackStyle.dashAttack,
  };
  return { ...moves, hurtboxes: shippedHurtboxes(character, moves) };
}
export const RIFLEMAN_MOVES: FighterMoves = originalMoves(Character.rifleman, RIFLEMAN_GROUND, {
  [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 30, effect: { damage: 7.0, growth: 70.0, base: 45.0, launchX: 0.5, launchZ: f32(0.866025404), electric: false } },
});


export function originalFighterMoves(character: Character): FighterMoves | undefined {
  return character === Character.rifleman ? RIFLEMAN_MOVES : undefined;
}
