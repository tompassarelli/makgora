import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { rosterGrid } from "../menu/selectionGrid";
import { fighterKey, fighterSlug, PLAYABLE_CHARACTERS } from "../roster/kits";
import { Character } from "../sim/codes";
import { hudTitle } from "./duoTitle";
import { RANDOM_FIGHTER } from "../lobby/lobbyState";
import { FRIZ_QUADRATA_WIDTHS, textWidth } from "wisp/src/ui/chatLog";
import { GRID_FIGHTERS, RANDOM_FIGHTER_TILE, ROSTER_TILES, characterOfTile, nameText, tileLabel, tileNameEms, tileOfCharacter } from "./selectionFrames";

const FACTION_ORDER = [
  "thrall", "grom-hellscream", "cairne-bloodhoof", "beastmaster", "blademaster", "shadow-hunter", "peon",
  "uther", "jaina-proudmoore", "mountain-king", "medivh", "kael'thas-sunstrider", "lich-king", "lich", "sylvanas-windrunner", "dreadlord",
  "anub'arak", "butcher", "malfurion-stormrage", "tyrande", "illidan", "warden",
  "lady-vashj", "akama", "chen-stormstout", "firelord", "goblin-tinker", "goblin-alchemist", "murloc", "pit-lord", "onyxia", "archimonde",
];

const playableSlugs = (): string[] => PLAYABLE_CHARACTERS.map(character => fighterSlug(character));
const expectedOrder = (): string[] => FACTION_ORDER.filter(slug => playableSlugs().includes(slug));

test("The character select grid lists Orc, Human, Undead, Night Elf and Neutral fighters in reading order, then Mannoroth, Onyxia and Archimonde, eight to a row, with Random last [k3 measure docs/design/roster.md]", () => {
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

test("A select card, a roster tile and the match HUD plate show Ragnaros and Gazlowe, never the internal Firelord and Goblin Tinker keys [k1 scenario]", () => {
  assertEquals(nameText(Character.firelord), "Ragnaros (WIP)");
  assertEquals(hudTitle(Character.firelord, false), "RAGNAROS (WIP)");
  assertEquals(tileLabel(tileOfCharacter(Character.firelord)), "Ragnaros (WIP)");
  assertEquals(nameText(Character.tinker), "Gazlowe");
  assertEquals(hudTitle(Character.tinker, false), "GAZLOWE");
  assertEquals(tileLabel(tileOfCharacter(Character.tinker)), "Gazlowe");
  assertEquals(fighterKey(Character.firelord), "Firelord");
  assertEquals(fighterKey(Character.tinker), "Goblin Tinker");
});

test("The match HUD plate shows every fighter's name exactly as its select card does, in capitals [k2 property]", () => {
  for (const character of PLAYABLE_CHARACTERS) assertEquals(hudTitle(character, false), nameText(character).toUpperCase(), fighterSlug(character));
});

const FIRST_NAMES: readonly (readonly [Character, string])[] = [
  [Character.tyrande, "Tyrande"], [Character.archimonde, "Archimonde"], [Character.mountainKing, "Muradin"], [Character.warden, "Maiev"], [Character.chen, "Chen"],
  [Character.jaina, "Jaina"], [Character.cairne, "Cairne"], [Character.grom, "Grom"], [Character.kaelthas, "Kael'thas"], [Character.malfurion, "Malfurion"],
  [Character.sylvanas, "Sylvanas"], [Character.ladyVashj, "Lady Vashj"],
];

test("Every fighter with a surname or epithet reads as its first name on the select card, the roster tile and the match HUD plate; Lady Vashj keeps her title on the card and plate [k1 scenario]", () => {
  for (const [character, name] of FIRST_NAMES) {
    assertEquals(nameText(character), name);
    assertEquals(hudTitle(character, false), name.toUpperCase());
    if (character !== Character.ladyVashj) assertEquals(tileLabel(tileOfCharacter(character)), name);
  }
});

test("Mrgl & Grgl reads with spaces on the select card, the match HUD plate and the roster tile, whose one line fits it [k1 scenario]", () => {
  assertEquals(nameText(Character.murloc), "Mrgl & Grgl");
  assertEquals(hudTitle(Character.murloc, false), "MRGL & GRGL");
  assertEquals(hudTitle(Character.murloc, true), "Mrgl & Grgl");
  const room = tileNameEms(rosterGrid(ROSTER_TILES));
  const tile = tileLabel(tileOfCharacter(Character.murloc));
  assertEquals(tile, "Mrgl & Grgl");
  assertTrue(textWidth(tile, FRIZ_QUADRATA_WIDTHS) <= room);
});
