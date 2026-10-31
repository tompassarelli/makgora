import type { Character } from "../src/game/sim/codes";
import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";
import { ALL_HEROES } from "../src/game/roster/kits";
import { heroLook } from "../src/game/roster/looks";


const importedModel = (path: string) => IMPORTED_MODEL_FILES.find(({ entry }) => entry.toLowerCase() === path.toLowerCase());

export function importedModelFile(path: string): string | undefined {
  return importedModel(path)?.file;
}



export const stockModelPath = (model: string) => `war3.w3mod:${model.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx")}`;


export function heroModelSource(model: string): string {
  const imported = importedModel(model);
  if (imported === undefined) return `hero-models/${stockModelPath(model).split("/").at(-1) ?? ""}`;
  return `${imported.reanimated === true ? "hero-models" : "imported-models"}/${imported.file}`;
}

export const fighters: ReadonlyMap<Character, { readonly name: string; readonly source: string; readonly stock?: string }> = new Map([
  [1, { name: "Rifleman", source: "animation-assets/RiflemanFighter.mdx" }],
  [2, { name: "Illidan", source: "illidan-animation/DemonHunterFighter.mdx" }],
  ...ALL_HEROES.toSorted((a, b) => a.character - b.character).map((hero) => [hero.character, {
    name: hero.name.replaceAll(/[^A-Za-z]/g, ""),
    source: heroModelSource(heroLook(hero.character)!.model),
    ...(importedModelFile(heroLook(hero.character)!.model) === undefined ? { stock: stockModelPath(heroLook(hero.character)!.model) } : {}),
  }] as const),
]);
