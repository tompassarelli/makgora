import { expect, test } from "bun:test";
import { originalClipNames } from "../src/generated/clips/fighterOriginalClipInfo";
import { characterClips } from "../src/game/presentation/fighterClips";
import { Character } from "../src/game/sim/codes";

const STRIKING = ["attack", "spell", "slam", "throw"];

test("every fighter's landing clip is a stand or landing sequence, never an attack or spell that reads as the aerial carrying on after touchdown [k2 property]", () => {
  const striking: string[] = [];
  for (const [fighter, character] of Object.entries(Character)) {
    const landing = characterClips(character).landing;
    if (landing === undefined) continue;
    for (const [name, index] of originalClipNames(character)) {
      if (index === landing.index && STRIKING.some((word) => name.includes(word))) striking.push(`${fighter}: ${name}`);
    }
  }
  expect(striking).toEqual([]);
});
