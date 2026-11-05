import { expect, test } from "bun:test";
import record from "./fixtures/body-fades.json";
import { DOWN_ACTIONS } from "../scripts/bodyFades";
import { characterClips } from "../src/game/presentation/fighterClips";
import { Character } from "../src/game/sim/codes";

const KNOWN_FADING: string[] = [];

const fadingActions = (name: string): string[] => {
  const character = Character[name as keyof typeof Character];
  const fading = (record as Record<string, { fading: number[] }>)[name]?.fading ?? [];
  return DOWN_ACTIONS.filter((action) => fading.includes(characterClips(character)[action]?.index ?? -1));
};

test("the other fighters whose down actions fade their body are exactly the known list, so a new fade or a fix shows here by name [k2 property]", () => {
  const fading = Object.keys(record).filter((name) => name !== "archimonde" && fadingActions(name).length > 0);
  expect(fading).toEqual(KNOWN_FADING);
});
