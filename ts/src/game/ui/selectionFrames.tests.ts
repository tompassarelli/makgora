import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { rosterGrid } from "../menu/selectionGrid";
import { fighterSlug, PLAYABLE_CHARACTERS } from "../roster/kits";
import { RANDOM_FIGHTER } from "../lobby/lobbyState";
import { GRID_FIGHTERS, RANDOM_FIGHTER_TILE, ROSTER_TILES, characterOfTile, tileOfCharacter } from "./selectionFrames";

const FACTION_ORDER = [
  "uther", "jaina-proudmoore", "mountain-king", "medivh", "kael'thas-sunstrider", "thrall", "grom-hellscream", "cairne-bloodhoof",
  "beastmaster", "blademaster", "shadow-hunter", "peon", "lich-king", "lich", "sylvanas-windrunner", "dreadlord",
  "anub'arak", "butcher", "malfurion-stormrage", "tyrande", "illidan", "warden",
  "lady-vashj", "akama", "chen-stormstout", "firelord", "goblin-tinker", "goblin-alchemist", "murloc", "pit-lord", "onyxia", "archimonde",
];

const playableSlugs = (): string[] => PLAYABLE_CHARACTERS.map(character => fighterSlug(character));
const expectedOrder = (): string[] => FACTION_ORDER.filter(slug => playableSlugs().includes(slug));

test("The character select grid lists Human, Orc, Undead, Night Elf and Neutral fighters in reading order, then Mannoroth, Onyxia and Archimonde, eight to a row, with Random last [k3 measure docs/design/roster.md]", () => {
  const expected = expectedOrder();
  assertEquals(GRID_FIGHTERS.length, expected.length);
  for (let tile = 0; tile < expected.length; tile++) assertEquals(fighterSlug(characterOfTile(tile)), expected[tile]);
  assertEquals(characterOfTile(RANDOM_FIGHTER_TILE), RANDOM_FIGHTER);
  assertEquals(ROSTER_TILES, expected.length + 1);
  const grid = rosterGrid(ROSTER_TILES);
  assertEquals(grid.columns, 8);
  assertEquals(grid.rows, Math.ceil(ROSTER_TILES / 8));
});

test("Every playable fighter owns exactly one select grid tile, and each tile maps back to its own fighter [k2 property]", () => {
  assertEquals(GRID_FIGHTERS.length, PLAYABLE_CHARACTERS.length);
  for (const character of PLAYABLE_CHARACTERS) {
    let tiles = 0;
    for (const listed of GRID_FIGHTERS) if (listed === character) tiles++;
    assertEquals(tiles, 1, fighterSlug(character));
  }
  for (let tile = 0; tile < ROSTER_TILES; tile++) assertEquals(tileOfCharacter(characterOfTile(tile)), tile);
  assertTrue(tileOfCharacter(RANDOM_FIGHTER) === RANDOM_FIGHTER_TILE);
});
