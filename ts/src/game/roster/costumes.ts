export type { CostumeTint } from "../presentation/model/costume";
import { type Costume, DEFAULT_COSTUMES, DEFAULT_COSTUME, MAX_COSTUMES } from "../presentation/model/costume";
import { heroLook } from "./looks";

export function costumesFor(character: number): readonly Costume[] {
  return (heroLook(character)?.costumes ?? DEFAULT_COSTUMES).slice(0, MAX_COSTUMES);
}

export function costumeOf(character: number, index: number): Costume {
  return costumesFor(character)[index] ?? DEFAULT_COSTUME;
}

export function costumeIndex(character: number, index: number): number {
  return index >= 0 && index < costumesFor(character).length ? index : 0;
}
