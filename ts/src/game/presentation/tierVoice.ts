import { at } from "wisp/src/runtime/lookup";
import { CPU_TIERS } from "../match/cpuProfiles";
import { type Race, RACES, fighterRace } from "../roster/races";
import type { Character } from "../sim/codes";

const unit = (race: string, folder: string, line: string): string => `Units\\${race}\\${folder}\\${line}1.flac`;

/** Per race, the stock Ready line of a worker (Peon), a soldier (Grunt) and a hero (Warchief); docs/design/sound-table.md, "Arcade tier voice". */
const TIER_VOICES: Readonly<Record<Race, readonly [string, string, string]>> = {
  Human: [unit("Human", "Peasant", "PeasantReady"), unit("Human", "Footman", "FootmanReady"), unit("Human", "HeroMountainKing", "HeroMountainKingReady")],
  NightElf: [unit("NightElf", "Wisp", "WispReady"), unit("NightElf", "Archer", "ArcherReady"), unit("NightElf", "HeroDemonHunter", "HeroDemonHunterReady")],
  Orc: [unit("Orc", "Peon", "PeonReady"), unit("Orc", "Grunt", "GruntReady"), unit("Orc", "HeroBladeMaster", "HeroBladeMasterReady")],
  Undead: [unit("Undead", "Acolyte", "AcolyteReady"), unit("Undead", "Ghoul", "GhoulReady"), unit("Undead", "HeroLich", "HeroLichReady")],
};

export const tierVoice = (fighter: Character, tier: number): string => at(TIER_VOICES[fighterRace(fighter)], Math.max(0, Math.min(CPU_TIERS.length - 1, tier)));

export const tierVoicePaths = (): string[] => RACES.flatMap(race => [...TIER_VOICES[race]]);
