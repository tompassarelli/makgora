import { originalClip, originalClipCount, originalLightPath } from "../../generated/clips/fighterOriginalClipInfo";
import { costumeClipModel, costumesFor } from "../roster/costumes";
import { RENDERED_FIGHTERS } from "../roster/kits";
import { heroLook } from "../roster/looks";
import { fighterModel } from "./combatEffects";
import { WHITE_FIGHTER_MODELS } from "../../generated/assets/whiteFighterModels";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { fighterPortrait } from "../roster/looks";

function addNew(models: string[], model: string | undefined): void {
  if (model !== undefined && !models.includes(model)) models.push(model);
}

/** Every model one fighter draws: its body, its white flash copy, each clip's body in each costume, its light and the models its look adds. */
export function fighterModels(character: number): string[] {
  const models: string[] = [];
  addNew(models, fighterModel(character));
  addNew(models, originalLightPath(character));
  addNew(models, WHITE_FIGHTER_MODELS[character]);
  const costumes = costumesFor(character).length;
  for (let index = 0; index < originalClipCount(character); index++) {
    const clip = originalClip(character, index);
    if (clip === undefined) continue;
    addNew(models, clip.modelPath);
    for (let costume = 0; costume < costumes; costume++) addNew(models, costumeClipModel(character, costume, clip));
  }
  const look = heroLook(character);
  addNew(models, look?.placedModel?.path);
  addNew(models, look?.orbit?.model);
  addNew(models, look?.flight?.flames);
  addNew(models, look?.flight?.egg);
  addNew(models, look?.ultimateBurst?.model);
  return models;
}

/** The distinct models of every selectable fighter. */
export function preloadFighterModels(): string[] {
  const models: string[] = [];
  for (const character of RENDERED_FIGHTERS) for (const model of fighterModels(character)) addNew(models, model);
  return models;
}

const MATCH_PORTRAITS = ["Bust", "Stock", "Tile"] as const;

/** The images a match shows for one fighter in each slot and costume: the HUD bust and stock icon and the off-screen bubble's tile. */
export function fighterTextures(character: number): string[] {
  const textures: string[] = [];
  for (let costume = 0; costume < costumesFor(character).length; costume++) {
    for (const slot of PARTICIPANT_SLOTS) for (const kind of MATCH_PORTRAITS) addNew(textures, fighterPortrait(character, kind, slot, costume));
  }
  return textures;
}

/** The distinct match images of every selectable fighter. */
export function preloadFighterTextures(): string[] {
  const textures: string[] = [];
  for (const character of RENDERED_FIGHTERS) for (const texture of fighterTextures(character)) addNew(textures, texture);
  return textures;
}
