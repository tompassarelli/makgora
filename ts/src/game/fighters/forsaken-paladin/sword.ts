import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import { f32 } from "wisp/src/sim/f32";

export const FORSAKEN_PALADIN_DAMAGE_MULTIPLIER = f32(0.8);

export function forsakenPaladinSwordAttack(character: Character, style: AttackStyle | undefined): boolean {
  return character === Character.forsakenPaladin && style !== undefined
    && style !== AttackStyle.jab && style !== AttackStyle.jab2 && style !== AttackStyle.jab3
    && style !== AttackStyle.backAir && style !== AttackStyle.grab;
}


export function forsakenPaladinSwordContact(fighter: Readonly<Fighter>, damage: number, direct: boolean): boolean {
  if (!direct || damage < 8.0 || fighter.character !== Character.forsakenPaladin) return false;
  return forsakenPaladinSwordAttack(fighter.character, fighter.attack.style)
    || fighter.special.action === SpecialAction.heroNeutral
    || fighter.special.action === SpecialAction.heroSide
    || fighter.special.action === SpecialAction.heroUp;
}
