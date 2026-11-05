import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { PLAYABLE_CHARACTERS, fighterName, fighterSlug } from "../roster/kits";
import { FORGE_FIGHTERS, FORGE_STAGES, isComingSoon, isFeatured, setForgeRoster } from "../roster/forge";
import { ARCADE_TABLES, arcadeTable, type ArcadeTable } from "./tables";

const C = Character;
const MINIMUM_ELITE_DUOS = 2;

const featuredFighters = (): Character[] => PLAYABLE_CHARACTERS.filter(character => !isComingSoon(character) && isFeatured(character));

function table(fighter: Character): ArcadeTable {
  const found = arcadeTable(fighter);
  if (found === undefined) throw new Error(`no table for ${fighterName(fighter)}`);
  return found;
}

function withForge(fighters: readonly string[], body: () => void): void {
  setForgeRoster(fighters, FORGE_STAGES);
  try {
    body();
  } finally {
    setForgeRoster(FORGE_FIGHTERS, FORGE_STAGES);
  }
}

/** The one Forge fighter Arcade uses: Onyxia is Ragnaros's fixed ally. */
const isForgeException = (entry: ArcadeTable, role: string, member: Character): boolean => role === "ally" && entry.fighter === C.firelord && member === C.onyxia;

/** Every way the tables fail to be exactly the featured roster, each naming the fighter. */
function coverageProblems(tables: readonly ArcadeTable[]): string[] {
  const problems: string[] = [];
  const featured = featuredFighters();
  for (const character of featured) {
    const rows = tables.filter(entry => entry.fighter === character).length;
    if (rows === 0) problems.push(`${fighterName(character)} has no table`);
    if (rows > 1) problems.push(`${fighterName(character)} has ${rows} tables`);
  }
  for (const entry of tables) if (!featured.includes(entry.fighter)) problems.push(`${fighterName(entry.fighter)} has a table but is not a featured fighter`);
  return problems;
}

/** Every Forge fighter a table names as ally, rival or elite, bar Onyxia beside Ragnaros. */
function forgeProblems(tables: readonly ArcadeTable[]): string[] {
  const problems: string[] = [];
  for (const entry of tables) {
    const named: [string, Character][] = [["ally", entry.ally], ["rival", entry.rival]];
    for (const duo of entry.elites) for (const member of duo.members) named.push(["elite", member]);
    for (const [role, member] of named) if (!isFeatured(member) && !isForgeException(entry, role, member)) problems.push(`${fighterName(entry.fighter)}: ${role} ${fighterName(member)} is in the Forge`);
    if (entry.elites.length < MINIMUM_ELITE_DUOS) problems.push(`${fighterName(entry.fighter)}: fewer than ${MINIMUM_ELITE_DUOS} elite duos`);
  }
  return problems;
}

test("the tables are exactly the featured roster, one row each: a fighter without a row is named, and so is a Forge fighter with one, and promoting or demoting one fails them until its row and mentions are fixed [k3 measure docs/design/arcade-mode.md]", () => {
  assertEquals(coverageProblems(ARCADE_TABLES).join(", "), "");
  assertEquals(ARCADE_TABLES.length, featuredFighters().length);
  assertEquals(coverageProblems(ARCADE_TABLES.filter(entry => entry.fighter !== C.thrall)).join(", "), "Thrall has no table");
  assertEquals(coverageProblems([...ARCADE_TABLES, table(C.thrall)]).join(", "), "Thrall has 2 tables");
  assertEquals(coverageProblems([...ARCADE_TABLES, { ...table(C.thrall), fighter: C.uther }]).join(", "), "Uther has a table but is not a featured fighter");
  assertEquals(coverageProblems([...ARCADE_TABLES, { ...table(C.thrall), fighter: C.whitemane }]).join(", "), "Sally Whitemane has a table but is not a featured fighter");
  withForge(FORGE_FIGHTERS.filter(slug => slug !== fighterSlug(C.uther)), () => {
    assertEquals(coverageProblems(ARCADE_TABLES).join(", "), "Uther has no table");
  });
  withForge([...FORGE_FIGHTERS, fighterSlug(C.thrall)], () => {
    const missing = coverageProblems(ARCADE_TABLES);
    assertEquals(missing.join(", "), "Thrall has a table but is not a featured fighter");
    const mentions = forgeProblems(ARCADE_TABLES);
    assertTrue(mentions.includes("Samuro: ally Thrall is in the Forge"));
    assertTrue(mentions.includes("Mannoroth: rival Thrall is in the Forge"));
    assertTrue(mentions.includes("Mal'Ganis: elite Thrall is in the Forge"));
  });
});
