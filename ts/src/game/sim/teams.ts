import { type Slots } from "../input/participants";
import type { Roster } from "./roster";

export type Team = 0 | 1 | 2 | 3;
export const TEAM_NAMES: Slots<string> = ["Red", "Blue", "Teal", "Purple"];

export function sameTeam(world: Readonly<Roster>, first: number, second: number): boolean {
  return world.teamBattle && world.teamChoices[first] === world.teamChoices[second];
}

export function canHit(world: Readonly<Roster>, first: number, second: number): boolean {
  return first !== second && (!sameTeam(world, first, second) || world.friendlyFire);
}
