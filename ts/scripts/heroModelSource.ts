import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";
import { HERO_ROSTER } from "../src/game/sim/heroes/registry";
import { heroLook } from "../src/game/roster/looks";


export function importedModelFile(path: string): string | undefined {
  const wanted = path.toLowerCase();
  return IMPORTED_MODEL_FILES.find(({ entry }) => entry.toLowerCase() === wanted)?.file;
}



export const stockModelPath = (model: string) => `war3.w3mod:${model.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx")}`;


export function heroModelSource(model: string): string {
  const imported = importedModelFile(model);
  return imported !== undefined ? `imported-models/${imported}` : `hero-models/${stockModelPath(model).split("/").at(-1) ?? ""}`;
}

export const fighters: ReadonlyMap<number, { readonly name: string; readonly source: string; readonly stock?: string }> = new Map([
  [1, { name: "Rifleman", source: "animation-assets/RiflemanFighter.mdx" }],
  [2, { name: "Illidan", source: "illidan-animation/DemonHunterFighter.mdx" }],
  ...HERO_ROSTER.toSorted((a, b) => a.character - b.character).map((hero) => [hero.character, {
    name: hero.name.replaceAll(/[^A-Za-z]/g, ""),
    source: heroModelSource(heroLook(hero.character)!.model),
    ...(importedModelFile(heroLook(hero.character)!.model) === undefined ? { stock: stockModelPath(heroLook(hero.character)!.model) } : {}),
  }] as const),
]);
