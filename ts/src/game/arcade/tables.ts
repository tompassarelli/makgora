import { Character } from "../sim/codes";

export interface EliteDuo {
  readonly members: readonly [Character, Character];
  readonly source: string;
}

export interface ArcadeTable {
  readonly fighter: Character;
  readonly ally: Character;
  readonly allySource?: string;
  readonly elites: readonly EliteDuo[];
  readonly rival: Character;
  readonly rivalSource: string;
  readonly line: string;
}

const C = Character;
const duo = (a: Character, b: Character, source: string): EliteDuo => ({ members: [a, b], source });

/** The enemy duos the pools draw on (docs/design/arcade-mode.md, "Featured enemy duos"). */
export const FEATURED_DUOS = {
  L1: duo(C.dreadlord, C.pitLord, "two of the Burning Legion's commanders"),
  L2: duo(C.dreadlord, C.archimonde, "the dreadlords served Archimonde's invasion (Reign of Chaos)"),
  L3: duo(C.pitLord, C.archimonde, "the Legion's lieutenants since the War of the Ancients"),
  H1: duo(C.thrall, C.blademaster, "Samuro of the Burning Blade fights for Thrall in The Founding of Durotar (The Frozen Throne)"),
  H2: duo(C.shadowHunter, C.chen, "Rexxar's companions in The Founding of Durotar"),
  S1: duo(C.lichKing, C.butcher, "the Lich King and the Scourge's abominations"),
  I1: duo(C.demonHunter, C.kaelthas, "Illidan's army takes Outland and races Arthas to Icecrown (The Frozen Throne)"),
} as const;

const D = FEATURED_DUOS;

/** One row per featured fighter, in roster order; a fighter promoted from the Forge gets its row then. */
export const ARCADE_TABLES: readonly ArcadeTable[] = [
  {
    fighter: C.demonHunter,
    ally: C.kaelthas, allySource: "Kael's blood elves join Illidan, The Frozen Throne, Lord of Outland",
    elites: [D.L1, D.L2],
    rival: C.lichKing, rivalSource: "Their duel at Icecrown, The Frozen Throne's last mission",
    line: "I came for the Frozen Throne, Arthas, and you are sitting on it.",
  },
  {
    fighter: C.blademaster,
    ally: C.thrall, allySource: "he fights for Thrall's Durotar, The Frozen Throne",
    elites: [D.S1, D.L2],
    rival: C.pitLord, rivalSource: "The Burning Blade drank Mannoroth's blood, which made the clan the Legion's blade",
    line: "Your blood made my clan a weapon, demon. Now the blade turns.",
  },
  {
    fighter: C.mountainKing,
    ally: C.warden,
    elites: [D.H1, D.S1, D.L3],
    rival: C.dreadlord, rivalSource: "Muradin's expedition hunted Mal'Ganis in Northrend and lost Arthas to that hunt (Reign of Chaos)",
    line: "I lost a prince chasing you across Northrend, dreadlord. You'll answer for him.",
  },
  {
    fighter: C.warden,
    ally: C.mountainKing,
    elites: [D.L1, D.S1],
    rival: C.demonHunter, rivalSource: "Ten thousand years as his jailer; she hunts him from the Broken Isles to Outland (The Frozen Throne)",
    line: "Ten thousand years I kept you, Betrayer. A few more will not trouble me.",
  },
  {
    fighter: C.dreadlord,
    ally: C.archimonde, allySource: "the dreadlords served his invasion, Reign of Chaos",
    elites: [D.I1, D.H1],
    rival: C.lichKing, rivalSource: "Arthas killed him in Northrend with Frostmourne",
    line: "You turned my own gift on me, prince. The nathrezim do not forget.",
  },
  {
    fighter: C.shadowHunter,
    ally: C.chen, allySource: "both join Rexxar, The Frozen Throne",
    elites: [D.S1, D.L1],
    rival: C.kaelthas, rivalSource: "The troll and high elf enmity of the Troll Wars; the Darkspear are jungle trolls, so the grudge is racial, not tribal",
    line: "Trolls remember Quel'Thalas, elf. Rokhan settle it today.",
  },
  {
    fighter: C.pitLord,
    ally: C.archimonde, allySource: "the Legion's lieutenants",
    elites: [D.H2, D.I1],
    rival: C.thrall, rivalSource: "Thrall's Horde broke the blood pact, and Grom killed Mannoroth at its end (Reign of Chaos)",
    line: "Your people drank my blood, Warchief. Every orc of yours still owes it.",
  },
  {
    fighter: C.lichKing,
    ally: C.butcher,
    elites: [D.I1, D.H1],
    rival: C.dreadlord, rivalSource: "The dreadlord Arthas hunted to Northrend after Stratholme",
    line: "I crossed an ocean to end you, Mal'Ganis. Frostmourne is hungry.",
  },
  {
    fighter: C.thrall,
    ally: C.blademaster, allySource: "Samuro fights for Thrall's Durotar, The Frozen Throne",
    elites: [D.S1, D.L2],
    rival: C.pitLord, rivalSource: "Mannoroth's blood chained the orcs to the Legion until Thrall's Horde broke it (Reign of Chaos); interim, Garrosh later",
    line: "Your blood chained my people, demon. The Horde is free, and I will prove it.",
  },
  {
    fighter: C.chen,
    ally: C.shadowHunter, allySource: "both join Rexxar, The Frozen Throne",
    elites: [D.S1, D.L3],
    rival: C.mountainKing, rivalSource: "No lore duel: a brewing rivalry between the Stormstout brewery and Ironforge's Thunderbrew",
    line: "Ironforge calls its ale the finest in the world. We settle it, then we share a barrel.",
  },
  {
    fighter: C.peon,
    ally: C.blademaster,
    elites: [D.S1, D.L1],
    rival: C.thrall, rivalSource: "Every peon works for the Warchief; this one wants the job",
    line: "Me done with work work. Me take your job, Warchief.",
  },
  {
    fighter: C.kaelthas,
    ally: C.demonHunter, allySource: "Kael's blood elves join Illidan, The Frozen Throne, Lord of Outland",
    elites: [D.L1, D.L2],
    rival: C.lichKing, rivalSource: "Arthas killed Kael's father and burned the Sunwell (Reign of Chaos)",
    line: "You murdered my father and burned the Sunwell. Quel'Thalas sends its answer.",
  },
  {
    fighter: C.murloc,
    ally: C.demonHunter, allySource: "the naga's mur'gul served in Illidan's army, The Frozen Throne",
    elites: [D.H1, D.S1],
    rival: C.shadowHunter, rivalSource: "Darkspear trolls and murlocs share the Echo Isles and Durotar's coast (World of Warcraft)",
    line: "Mrrgl mrgl! Mrglglgl! (The shore is ours, troll!)",
  },
  {
    fighter: C.archimonde,
    ally: C.pitLord, allySource: "the Legion's lieutenants",
    elites: [D.H2, D.S1],
    rival: C.thrall, rivalSource: "Thrall's orcs broke the Legion's blood pact and held Hyjal against him (Reign of Chaos)",
    line: "Your Horde broke its pact with the Legion, orc. I have come to collect.",
  },
  {
    fighter: C.butcher,
    ally: C.lichKing,
    elites: [D.H1, D.H2],
    rival: C.mountainKing, rivalSource: "Muradin leads the Alliance assault on Icecrown Citadel, whose Plagueworks stitch the Scourge's abominations (Wrath of the Lich King)",
    line: "Little dwarf. Big hammer. Stitches has hook for both.",
  },
  {
    fighter: C.firelord,
    ally: C.onyxia, allySource: "Deathwing's Cataclysm; the one Forge fighter Arcade uses, since no featured fighter is Ragnaros's friend",
    elites: [D.H1, D.H2],
    rival: C.mountainKing, rivalSource: "The Dark Iron emperor summoned Ragnaros in the War of the Three Hammers to break Ironforge's Bronzebeards, Muradin's clan",
    line: "The Bronzebeards still stand? Then the Dark Irons' work is unfinished.",
  },
];

export function arcadeTable(fighter: number): ArcadeTable | undefined {
  return ARCADE_TABLES.find(table => table.fighter === fighter);
}

export const ARCADE_CHARACTERS: readonly Character[] = ARCADE_TABLES.map(table => table.fighter);
