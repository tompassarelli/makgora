import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "../../sim/codes";
import { characterClips } from "../fighterClips";
import { MOUNTAIN_KING_SEQUENCES } from "./mountainKingClips";

test("no Mountain King move plays one of his stone Avatar sequences [k2 property]", () => {
  const stone = new Set<number>(Object.entries(MOUNTAIN_KING_SEQUENCES).filter(([name]) => name.includes("Alternate")).map(([, sequence]) => sequence.index));
  for (const [pose, clip] of Object.entries(characterClips(Character.mountainKing))) {
    assertEquals(clip !== undefined && (stone.has(clip.index) || stone.has(clip.classicStartup?.index ?? -1)), false, `${pose} plays a stone Avatar sequence`);
  }
});
