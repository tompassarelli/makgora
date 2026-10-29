import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { rosterGrid } from "../menu/selectionGrid";
import { fighterSlug, PLAYABLE_CHARACTERS } from "../roster/kits";
import { RANDOM_FIGHTER } from "../lobby/lobbyState";
import { GRID_FIGHTERS, RANDOM_FIGHTER_TILE, ROSTER_TILES, characterOfTile, tileOfCharacter } from "./selectionFrames";

const FACTION_ORDER = [
  "uther", "jaina-proudmoore", "mountain-king", "rifleman", "medivh", "kael'thas-sunstrider", "thrall", "grom-hellscream",
  "cairne-bloodhoof", "beastmaster", "blademaster", "shadow-hunter", "peon", "lich-king", "lich", "sylvanas-windrunner",
  "dreadlord", "butcher", "malfurion-stormrage", "tyrande", "illidan", "warden", "archimonde", "pit-lord",
  "lady-vashj", "akama", "chen-stormstout", "firelord", "goblin-tinker", "goblin-alchemist", "murloc",
];

test("The character select grid lists Human, Orc, Undead, Night Elf, Burning Legion and Neutral fighters in reading order across a full 8 x 4 block with Random last [k3 measure docs/design/roster.md]", () => {
  assertEquals(GRID_FIGHTERS.length, FACTION_ORDER.length);
  for (let tile = 0; tile < FACTION_ORDER.length; tile++) assertEquals(fighterSlug(characterOfTile(tile)), FACTION_ORDER[tile]);
  assertEquals(characterOfTile(RANDOM_FIGHTER_TILE), RANDOM_FIGHTER);
  assertEquals(ROSTER_TILES, 32);
  const grid = rosterGrid(ROSTER_TILES);
  assertEquals(grid.columns, 8);
  assertEquals(grid.rows, 4);
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
