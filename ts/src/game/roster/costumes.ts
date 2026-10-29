export type { CostumeTint } from "../presentation/model/costume";
import { type Costume, DEFAULT_COSTUMES, DEFAULT_COSTUME, MAX_COSTUMES } from "../presentation/model/costume";
import { heroLook } from "./looks";
import { costumeBody } from "../../generated/costumes/costumeBodies";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";

// The tint lookups run every frame, so they index the authored list in place rather than
// copy it: a copy each call was 1.4 KB a frame on every census pair (#703).
const authoredCostumes = (character: number): readonly Costume[] => heroLook(character)?.costumes ?? DEFAULT_COSTUMES;

export function costumesFor(character: number): readonly Costume[] {
  const costumes = authoredCostumes(character);
  return costumes.length > MAX_COSTUMES ? costumes.slice(0, MAX_COSTUMES) : costumes;
}

export function costumeOf(character: number, index: number): Costume {
  return index >= 0 && index < MAX_COSTUMES ? authoredCostumes(character)[index] ?? DEFAULT_COSTUME : DEFAULT_COSTUME;
}

export function costumeIndex(character: number, index: number): number {
  return index >= 0 && index < MAX_COSTUMES && index < authoredCostumes(character).length ? index : 0;
}

export function costumeClipModel(character: number, costume: number, clip: Readonly<FighterOriginalClip>): string {
  return clip.timeline === true ? costumeBody(character, costume) ?? clip.modelPath : clip.modelPath;
}

export interface BodyVariant {
  readonly character: number;
  readonly costume: number;
}

export function bodyCostume(character: number, costume: number): number {
  return costumeBody(character, costume) === undefined ? 0 : costume;
}

export function bodyVariants(characters: readonly number[]): readonly BodyVariant[] {
  return characters.flatMap((character) => costumesFor(character).flatMap((_, costume) => (costume === 0 || costumeBody(character, costume) !== undefined ? [{ character, costume }] : [])));
}
