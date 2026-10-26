



import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "./codes";
import { downSmashHit } from "./downMoveValues";
import type { FighterMoves } from "./heroMoves";
import { RIFLEMAN_GROUND, type GroundKit, groundHit, splitsMove } from "./heroes/groundNormals";
import { DEMON_HUNTER_HURTBOXES, shippedHurtboxes } from "./hurtboxes";

function originalMoves(character: Character, kit: GroundKit, throws: FighterMoves["throws"] = {}): FighterMoves {
  const moves: FighterMoves = {
    normals: kit.normals,
    throws,
    dashAttack: AttackStyle.dashAttack,
  };
  return { ...moves, hurtboxes: shippedHurtboxes(character, moves) };
}
export const RIFLEMAN_MOVES: FighterMoves = originalMoves(Character.rifleman, RIFLEMAN_GROUND, {
  [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 30, effect: { damage: 7.0, growth: 31.5, base: 84.0, launchX: f32(0.819152044), launchZ: f32(0.573576436), electric: false } },
});


const FEL_KICK = (behind: boolean) => downSmashHit(groundHit(13.0, 25, 95.0, 22.0, HitElement.fire, behind));

export const ILLIDAN_MOVES: FighterMoves = {
  normals: {
    [AttackStyle.downSmash]: splitsMove({
      firstActive: 6, active: 5, recovery: 35, chargeFrame: 1, hip: 12.0, reach: 92.0, height: 12.0, radius: 13.0,
      front: FEL_KICK(false), back: FEL_KICK(true),
    }),
  },
  throws: {},
  dashAttack: AttackStyle.demonHunterDashAttack,
  hurtboxes: DEMON_HUNTER_HURTBOXES,
};

export function originalFighterMoves(character: Character): FighterMoves | undefined {
  return character === Character.rifleman ? RIFLEMAN_MOVES : character === Character.demonHunter ? ILLIDAN_MOVES : undefined;
}
