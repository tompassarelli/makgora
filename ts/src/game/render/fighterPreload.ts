import { originalClip, originalClipCount, originalLightPath } from "../../generated/clips/fighterOriginalClipInfo";
import { costumeClipModel, costumesFor } from "../roster/costumes";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { heroLook } from "../roster/looks";
import { fighterModel } from "./combatEffects";

function addNew(models: string[], model: string | undefined): void {
  if (model !== undefined && !models.includes(model)) models.push(model);
}

/** Every model one fighter draws: its body, each clip's body in each costume, its light and the models its look adds. */
export function fighterModels(character: number): string[] {
  const models: string[] = [];
  addNew(models, fighterModel(character));
  addNew(models, originalLightPath(character));
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
  for (const character of SELECTABLE_CHARACTERS) for (const model of fighterModels(character)) addNew(models, model);
  return models;
}
