import { Character } from "../sim/codes";

/** The Warcraft III race whose console art frames a fighter's HUD portrait; docs/design/fighter-portraits.md records why each neutral sits where it does. */
export type Race = "Human" | "NightElf" | "Orc" | "Undead";

export const RACES: readonly Race[] = ["Human", "NightElf", "Orc", "Undead"];

const FIGHTER_RACES: { readonly [K in Character]: Race } = {
  [Character.rifleman]: "Human",
  [Character.demonHunter]: "NightElf",
  [Character.blademaster]: "Orc",
  [Character.mountainKing]: "Human",
  [Character.warden]: "NightElf",
  [Character.lich]: "Undead",
  [Character.dreadlord]: "Undead",
  [Character.shadowHunter]: "Orc",
  [Character.pitLord]: "Undead",
  [Character.beastmaster]: "Orc",
  [Character.lichKing]: "Undead",
  [Character.thrall]: "Orc",
  [Character.jaina]: "Human",
  [Character.sylvanas]: "Undead",
  [Character.cairne]: "Orc",
  [Character.chen]: "Orc",
  [Character.peon]: "Orc",
  [Character.tinker]: "Orc",
  [Character.kaelthas]: "Human",
  [Character.murloc]: "NightElf",
  [Character.grom]: "Orc",
  [Character.anubarak]: "Undead",
  [Character.malfurion]: "NightElf",
  [Character.medivh]: "Human",
  [Character.uther]: "Human",
  [Character.ladyVashj]: "NightElf",
  [Character.archimonde]: "Undead",
  [Character.tyrande]: "NightElf",
  [Character.butcher]: "Undead",
  [Character.akama]: "NightElf",
  [Character.firelord]: "Orc",
  [Character.alchemist]: "Orc",
  [Character.onyxia]: "Human",
  [Character.onyxiaDragon]: "Human",
};

export const fighterRace = (character: Character): Race => FIGHTER_RACES[character];
