import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { PLAYABLE_CHARACTERS, fighterName, fighterSlug } from "../roster/kits";
import { FORGE_FIGHTERS, FORGE_STAGES, isComingSoon, isFeatured, setForgeRoster } from "../roster/forge";
import { friends } from "./factions";
import { ARCADE_TABLES, FEATURED_DUOS, arcadeTable, type ArcadeTable } from "./tables";

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

/** Every lore rule a table breaks, each naming the fighter. */
function loreProblems(entry: ArcadeTable): string[] {
  const problems: string[] = [];
  const name = fighterName(entry.fighter);
  if (!friends(entry.fighter, entry.ally) || entry.ally === entry.fighter) problems.push(`${name}: ${fighterName(entry.ally)} is not a friend to fight beside`);
  if (entry.rival === entry.fighter) problems.push(`${name}: is its own rival`);
  for (const duo of entry.elites) for (const member of duo.members) {
    const against = (why: string): void => void problems.push(`${name}: elite duo holds ${fighterName(member)}, ${why}`);
    if (friends(entry.fighter, member)) against("a friend");
    if (member === entry.rival) against("the rival");
    if (member === entry.ally) against("the ally");
  }
  return problems;
}

const withDuo = (entry: ArcadeTable, members: readonly [Character, Character]): ArcadeTable => ({ ...entry, elites: [...entry.elites, { members, source: "mutant" }] });

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

test("no Forge fighter is an ally, rival or elite in any table but Onyxia beside Ragnaros, and every pool holds two or more duos [k3 measure docs/design/arcade-mode.md]", () => {
  assertEquals(forgeProblems(ARCADE_TABLES).join(", "), "");
  assertFalse(isFeatured(C.onyxia));
  assertEquals(table(C.firelord).ally, C.onyxia);
  assertEquals(ARCADE_TABLES.filter(entry => !isFeatured(entry.ally)).map(entry => fighterName(entry.fighter)).join(", "), "Ragnaros");
  assertTrue(forgeProblems([withDuo(table(C.firelord), [C.onyxia, C.thrall])]).includes("Ragnaros: elite Onyxia is in the Forge"));
  assertTrue(forgeProblems([{ ...table(C.thrall), ally: C.onyxia }]).includes("Thrall: ally Onyxia is in the Forge"));
  assertTrue(forgeProblems([{ ...table(C.thrall), rival: C.jaina }]).includes("Thrall: rival Jaina is in the Forge"));
  assertTrue(forgeProblems([{ ...table(C.thrall), elites: [FEATURED_DUOS.S1] }]).includes("Thrall: fewer than 2 elite duos"));
});

test("every shipped table obeys the lore rules: its ally is a friend, and no elite duo holds a friend, the rival or the ally [k3 measure docs/design/arcade-mode.md]", () => {
  const problems: string[] = [];
  for (const entry of ARCADE_TABLES) for (const problem of loreProblems(entry)) problems.push(problem);
  assertEquals(problems.join(", "), "");
});

test("a mutated copy of a table is refused: a friend, the rival or the ally in an elite duo, and a Dreadlord as Jaina's ally [k3 measure docs/design/arcade-mode.md]", () => {
  const refused = (entry: ArcadeTable, why: string): boolean => loreProblems(entry).some(problem => problem.includes(why));
  const jaina: ArcadeTable = { ...table(C.thrall), fighter: C.jaina, ally: C.uther, rival: C.lichKing, elites: [FEATURED_DUOS.L1, FEATURED_DUOS.L3] };
  assertEquals(loreProblems(jaina).join(", "), "");
  assertTrue(refused({ ...jaina, ally: C.dreadlord }, "Mal'Ganis is not a friend"));
  const muradin = table(C.mountainKing);
  assertTrue(refused(withDuo(muradin, [C.uther, C.dreadlord]), "Uther, a friend"));
  assertTrue(refused(withDuo(muradin, [C.thrall, C.tyrande]), "Tyrande, a friend"));
  assertTrue(refused(withDuo(muradin, [C.pitLord, C.dreadlord]), "Mal'Ganis, the rival"));
  assertTrue(refused(withDuo(muradin, [C.mountainKing, C.pitLord]), "Muradin, a friend"));
  const illidan = table(C.demonHunter);
  assertTrue(refused(withDuo(illidan, [C.kaelthas, C.pitLord]), "Kael'thas, the ally"));
  assertTrue(refused(withDuo(illidan, [C.lichKing, C.pitLord]), "Arthas, the rival"));
  assertTrue(refused(withDuo(illidan, [C.murloc, C.pitLord]), "a friend"));
  assertFalse(refused(withDuo(illidan, [C.thrall, C.pitLord]), "a friend"));
  assertTrue(refused(withDuo(table(C.murloc), [C.murloc, C.pitLord]), "Mrgl & Grgl, a friend"));
});

test("friends are fellow members of a faction, the Alliance and Night Elves, and the named cross-faction pairs, and nobody else [k3 measure docs/design/arcade-mode.md]", () => {
  assertTrue(friends(C.uther, C.jaina));
  assertTrue(friends(C.mountainKing, C.tyrande));
  assertTrue(friends(C.kaelthas, C.demonHunter));
  assertTrue(friends(C.jaina, C.thrall));
  assertTrue(friends(C.thrall, C.jaina));
  assertTrue(friends(C.medivh, C.thrall));
  assertTrue(friends(C.murloc, C.ladyVashj));
  assertTrue(friends(C.murloc, C.demonHunter));
  assertFalse(friends(C.jaina, C.dreadlord));
  assertFalse(friends(C.lichKing, C.mountainKing));
  assertFalse(friends(C.medivh, C.murloc));
  assertFalse(friends(C.murloc, C.kaelthas));
  assertFalse(friends(C.warden, C.demonHunter));
  assertFalse(friends(C.medivh, C.uther));
  assertFalse(friends(C.onyxia, C.thrall));
});
