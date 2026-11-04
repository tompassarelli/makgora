import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug, heroDefinition } from "./kits";

export type ForgeStatus = "featured" | "forge";

export const FORGE_FIGHTERS: readonly string[] = [
  "uther",
  "lich",
  "jaina-proudmoore",
  "sylvanas-windrunner",
  "goblin-tinker",
  "grom-hellscream",
  "malfurion-stormrage",
  "medivh",
  "anub'arak",
  "lady-vashj",
  "tyrande",
  "akama",
  "goblin-alchemist",
  "onyxia",
  "cairne-bloodhoof",
  "beastmaster",
  "whitemane",
  "valeera",
];

export const FORGE_STAGES: readonly number[] = [];

const active: { fighters: readonly Character[]; stages: readonly number[] } = { fighters: [], stages: [] };

export function setForgeRoster(fighters: readonly string[], stages: readonly number[]): void {
  active.fighters = SELECTABLE_CHARACTERS.filter(character => fighters.includes(fighterSlug(character)));
  active.stages = stages.slice();
}

setForgeRoster(FORGE_FIGHTERS, FORGE_STAGES);

export const fighterStatus = (character: number): ForgeStatus => active.fighters.some(forge => forge === character) ? "forge" : "featured";
export const isFeatured = (character: number): boolean => fighterStatus(character) === "featured";
export const stageStatus = (stage: number): ForgeStatus => active.stages.some(forge => forge === stage) ? "forge" : "featured";
export const isFeaturedStage = (stage: number): boolean => stageStatus(stage) === "featured";

export const fighterShown = (character: number, forgeShown: boolean): boolean => forgeShown || isFeatured(character);
export const stageShown = (stage: number, forgeShown: boolean): boolean => forgeShown || isFeaturedStage(stage);

export const COMING_SOON = "Coming soon";
export const isComingSoon = (character: number): boolean => heroDefinition(character)?.comingSoon === true;

export function shownFighters(choices: readonly Character[], forgeShown = false): readonly Character[] {
  const shown = choices.filter(character => !isComingSoon(character) && (forgeShown || isFeatured(character)));
  return shown.length === 0 ? choices.slice(0, 1) : shown;
}
