import { f32 } from "wisp/src/sim/f32";
import type { Character, DuoRole } from "../sim/codes";
import { duoRole, type Fighter } from "../sim/fighter";
import { partnerLook } from "../roster/costumes";
import { characterModelScale } from "./modelScale";

/** The scale a body draws at: the character's model scale, times the partner look's scale when the body is a duo partner. */
export function bodyModelScale(character: Character, role: DuoRole): number {
  return f32(characterModelScale(character) * (partnerLook(character, role)?.scale ?? 1.0));
}

export function fighterModelScale(fighter: Readonly<Fighter>): number {
  return bodyModelScale(fighter.character, duoRole(fighter));
}
