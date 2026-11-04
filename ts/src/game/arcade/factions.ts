import { Character } from "../sim/codes";

export const Faction = {
  alliance: 0,
  horde: 1,
  scourge: 2,
  burningLegion: 3,
  nightElves: 4,
  illidari: 5,
  oldGods: 6,
} as const;
export type Faction = (typeof Faction)[keyof typeof Faction];

const C = Character;

/** Every pickable fighter's faction; Mrgl & Grgl and Medivh stand alone and are friends only through the named pairs. */
const FACTION_MEMBERS: Readonly<Record<Faction, readonly Character[]>> = {
  [Faction.alliance]: [C.mountainKing, C.uther, C.jaina],
  [Faction.horde]: [C.blademaster, C.shadowHunter, C.beastmaster, C.thrall, C.cairne, C.chen, C.peon, C.tinker, C.grom, C.sylvanas],
  [Faction.scourge]: [C.lich, C.lichKing, C.anubarak, C.butcher],
  [Faction.burningLegion]: [C.dreadlord, C.pitLord, C.archimonde],
  [Faction.nightElves]: [C.warden, C.malfurion, C.tyrande],
  [Faction.illidari]: [C.demonHunter, C.kaelthas, C.ladyVashj, C.akama],
  [Faction.oldGods]: [C.firelord, C.onyxia],
};

const FACTIONS: readonly Faction[] = [Faction.alliance, Faction.horde, Faction.scourge, Faction.burningLegion, Faction.nightElves, Faction.illidari, Faction.oldGods];

/** The night elves joined the Alliance in World of Warcraft. */
export const FRIENDLY_FACTIONS: readonly (readonly [Faction, Faction])[] = [[Faction.alliance, Faction.nightElves]];

/** Pairs of friends across factions, each with its lore source. */
export const NAMED_PAIRS: readonly (readonly [Character, Character, string])[] = [
  [C.jaina, C.thrall, "the Hyjal alliance and Theramore's peace"],
  [C.murloc, C.ladyVashj, "the mur'gul serve the naga (The Frozen Throne)"],
  [C.murloc, C.demonHunter, "the naga's mur'gul served in Illidan's army (The Frozen Throne)"],
  [C.medivh, C.jaina, "the Prophet sent both west (Reign of Chaos)"],
  [C.medivh, C.thrall, "the Prophet sent both west (Reign of Chaos)"],
];

export function factionOf(fighter: Character): Faction | undefined {
  for (const faction of FACTIONS) if (FACTION_MEMBERS[faction].includes(fighter)) return faction;
  return undefined;
}

function friendlyFactions(a: Faction, b: Faction): boolean {
  return a === b || FRIENDLY_FACTIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Two fighters are friends when they share a faction, their factions are friendly, or the tables name them as a pair; a fighter is its own friend. */
export function friends(a: Character, b: Character): boolean {
  if (a === b) return true;
  const factionA = factionOf(a);
  const factionB = factionOf(b);
  if (factionA !== undefined && factionB !== undefined && friendlyFactions(factionA, factionB)) return true;
  return NAMED_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}
