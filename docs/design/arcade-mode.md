# Arcade Mode

Arcade is Mak'gora's single-player mode: one fixed run of 8 stages for every
fighter, ending on that fighter's personal rival. It replaces Classic
(makgora:docs/design/classic-mode.md) and vaults Lore Battles. Umbrella
issue [#1130](https://github.com/tompassarelli/makgora/issues/1130); the
build boxes are its child issues, listed there in order.

Tom set this direction in the design session of 4 November 2026 and asked on
5 November 2026 for all of it to be built. Items below are marked
**Decided** (Tom's call), **Proposed** (suggested in that session, not yet
confirmed by Tom) or **Lead default** (chosen while planning, 5 November
2026, so building can start; each says why and can be changed by Tom without
reworking the engine, since all of them are data).

## Why single-player, and why now

- **Decided.** Single-player is the top priority, ahead of controller
  support (2026-11-04). Controller support does not fix multiplayer's cold
  start: a new player has no one to play with.
- **Decided.** Multiplayer should be a great addition, not a requirement. A
  player should be able to play alone and have a great time.
- The target player is the ladder junkie: single-player matters to this
  player when it has a competitive angle, as in Slay the Spire at its highest
  ascension or Zachtronics solutions compared against other players'.
- Story stays minimal: a setting and a premise, no lore exposition.

## Design principles

- One definitive mode: one run length and one structure. Offering a choice of
  lengths (Street Fighter 6's 5 or 12 stages) splits the leaderboard and
  avoids taking a position.
- Real skill tests over gimmicks: 1v1, doubles and endurance, never giant or
  metal modifier fights.
- The structure is fixed; the opponents vary.
- Theme: loyalty, pride, honour and settling a personal grudge. No shared
  final villain; the finale is personal.

## Premise

- **Decided (direction).** An alternate timeline in which the Horde became
  the dominant power. Every race has been conquered by the Horde or recruited
  into a war band, and everyone fights to rise and, at the top, become
  Warchief. One sentence covers the whole roster and the tier names.
- **Lead default.** The sentence, shown on the Arcade mode's rule help and
  under the first stage's title: "The Horde won the world, and now every race
  fights up through the war bands for the right to challenge the Warchief."
- Lore note: mak'gora is the orcish honour duel and has been used to
  challenge a sitting Warchief (Cairne challenged Garrosh in Cataclysm).

## Tiers

- **Decided.** Three tiers, the same across all single-player content, named
  for orc ranks for every race: Peon, Grunt and Warchief. They are the
  computer tiers that landed in 2a9b34ce4 (makgora:docs/design/cpu-profiles.md),
  so the player's tier sets every computer fighter's profile in the run.
  - Peon: new to fighting games and new to this fighter; not trivially easy;
    where most people should start.
  - Grunt: has played platform fighters recently but is new to this fighter.
  - Warchief: experienced with fighting games and this fighter, or a
    competitive player who wants to go straight there.
- **Decided.** Tiers are recommendations, never gates; a player may drop a
  tier at any time. Tom's own pattern (one easy run to learn a character, then
  straight to the hardest) is why there are three: Peon teaches, Warchief is
  the real test, Grunt serves everyone between.
- **Proposed.** One guidance line under each tier on the select screen.
  **Lead default** wording:
  - Peon: "New to fighting games, or to this fighter? Start here."
  - Grunt: "You've played platform fighters, but not this fighter."
  - Warchief: "You know fighting games and this fighter. No continues."
- **Proposed.** A tier select voice line in the chosen fighter's race flavour
  (a worker line for Peon, a soldier line for Grunt, a hero line for
  Warchief) while the tier names stay universal. **Lead default:** stock unit
  sounds the Warcraft III install already ships, referenced at run time like
  the stock models, never imported into the map; the per-race table lives with
  the sound table (makgora:docs/design/sound-table.md).
- **Lead default: continues.** Peon and Grunt allow unlimited continues: a
  lost stage is replayed at the same tier, each continue costs score and is
  shown on the results. Warchief and every ascension rank allow none: a loss
  ends the run, and the results show the stage reached. This is what makes "a
  Warchief clear" mean the same thing for everyone, and an 8 to 12 minute run
  is short enough to restart at once.
- **Proposed.** The computer sharpens slightly at each stage within a run.
  **Lead default:** each stage lowers every computer fighter's reaction time by
  a fixed number of frames, 0, 0, 1, 1, 2, 2 and 3 frames at stages 1 to 6 and
  8, added beside the existing input-delay lead (makgora:ts/src/game/core/computerLead.ts),
  which keeps its own meaning. The tier itself never changes inside a run.

## Ascension (Warchief ranks)

- **Decided (idea).** Above Warchief, Slay the Spire-style ranks: Warchief
  Rank 1, 2, 3 and on.
- **Proposed.** Each rank adds one specific, legible twist, never stat
  inflation, so knockback and durability stay predictable.
- **Lead default: the first three ranks.** Each rank keeps every earlier
  rank's twist.
  1. **Wounded.** You start every fight at 30% damage. One number, reads at
     a glance, and it reuses the configured match's starting damage.
  2. **Ledge traps.** Every computer fighter traps the ledge whenever you
     hang from it (the bot's existing ledge trap, makgora:ts/src/game/match/botLedgeTrap.ts,
     taken on every hang instead of by profile). This is the spec's "the
     computer reads ledge options".
  3. **Beat the clock.** Every fight's time limit is halved, and running out
     of time loses the fight. It rewards finishing, which the score already
     measures.
- A rank unlocks for a fighter when the rank below is cleared with that
  fighter; Rank 1 unlocks with a Warchief clear. Rank select sits beside the
  tier select and shows only when the fighter has unlocked one.
- Considered and set aside: High Warlord as the top tier name. **Proposed:**
  the WoW honour ranks (Scout to High Warlord) stay reserved for a future
  ranked PvP ladder, so the two systems never get confused.

## Run structure

**Decided.** One fixed run of 8 stages, ending with the rival; target 8 to 12
minutes, short enough to retry a failed Warchief run immediately.

| Stage | Kind | Your side | Their side | Lead default rules |
| --- | --- | --- | --- | --- |
| 1 | Hallway | You | One random fighter | You 2 stocks, them 1, 2 minutes |
| 2 | Hallway | You | One random fighter | As stage 1 |
| 3 | Elite: stamina test | You | An enemy duo, one after the other | Your 2 stocks across both fights, each opponent 1 stock, damage carries, 4 minutes for both |
| 4 | Hallway | You | One random fighter | As stage 1 |
| 5 | Hallway | You | One random fighter | As stage 1 |
| 6 | Elite: 2v2 | You and your fixed ally | A different enemy duo | Every fighter 2 stocks, the side with a fighter left wins, 4 minutes |
| 7 | Bonus stage | You | The training partner | 30 seconds, cannot be lost |
| 8 | Rival | You alone | Your rival | Both 2 stocks, 4 minutes, rival's line before the fight |

- The arc: alone against random fighters, an endurance test, your ally beside
  you for the big team fight, a breather, then your ally steps aside and you
  face your rival alone. The ally stands for loyalty, the rival for the grudge.
- **Lead default: stages.** Hallways and elites draw from the featured stage
  pool; the bonus stage is the Training stage; the rival fight is on the
  rival's home stage (makgora:docs/design/home-stages.md), since you go to
  them to settle it.
- **Lead default: draws.** Every random choice in a run (hallway opponents,
  which elite duos, stages) comes from one run seed taken from the match seed
  at the run's start, so every client in a Warcraft lobby and every replay
  draws the same run. Within a run nobody appears twice: hallway draws skip
  the player, the ally, the rival and both elite duos.
- The run measures its own length; the 8 to 12 minute target is checked from
  measured runs and tuned through the stock and clock numbers above, which are
  data.

### Hallway fights (1, 2, 4, 5)

- **Decided.** Open to anyone, friendly matchups included: Uther against
  Muradin is fine as low-stakes sparring, since everyone is fighting to climb.

### Elites (3 and 6)

- **Decided.** Elites are mini-bosses in the Slay the Spire sense and draw from
  a pool; only the rival is fixed. No modifier fights. Stamina test first
  (stage 3), 2v2 second (stage 6), because the team fight is harder.
- **Decided (direction).** Each fighter's pool holds its actual enemies;
  friends never appear as elites. **Proposed:** two or three enemy options per
  fighter.
- **Lead default.** A pool entry is an enemy duo, and one pool serves both
  elites: stage 3 fights a duo's two members back to back, stage 6 fights a
  different duo as a team. Duos are real lore pairs (two fighters of one
  faction, or a cross-faction pair the tables name with its source) so the
  elite feels like a team, not two random bots.

### Stage 3: stamina test

- **Proposed.** Two opponents back to back on a single stock pool; it tests
  consistency and damage avoidance.
- **Lead default.** You bring 2 stocks to both fights; each opponent has 1.
  Your stocks and damage carry from the first fight into the second, which
  starts straight after the first KO with the second opponent's name on
  screen and no results screen between. The stage is two configured matches in
  a row rather than a second fighter entering mid-match: it reuses the
  configured-match engine as it is, where a mid-match entrance would need a new
  roster and rollback path for one stage. A continue replays both fights.

### Stage 6: 2v2 with your ally

- **Decided.** 2v2, not 2v1: doubles is a real competitive format.
- **Decided (leaning).** Each fighter has one fixed, mainstay ally, for
  consistency and easier balancing (for example, Thrall fights beside Cairne).
- **Decided.** Allies come from an accepted ally map and must make sense in
  the lore (Jaina with Uther, never Jaina with a dreadlord).
- **Proposed.** The ally map is built from factions, with iconic pairs picked
  by hand and side-switchers such as Illidan and Arthas placed by hand.
- The ally is a computer fighter on your team at your tier. Team play reuses
  the team rules and the bots' team targeting
  (makgora:ts/src/game/match/botPlay.ts), which today the run turns off.

### Stage 7: bonus stage

- **Proposed.** A short skill challenge that gives a breather before the rival
  and feeds the score; the type was left open.
- **Lead default: combo trial.** 30 seconds on the Training stage against the
  training partner set to Jump with Random drift
  (makgora:docs/design/training-mode.md). The score counts damage dealt and the
  longest combo, read from Training's own combo counter, which counts only hits
  the partner could not act between. It cannot be lost.
- Why this one: it is the cheapest choice that tests real skill. Every piece
  already exists and is checked (the partner, its drift, the combo counter, the
  Training stage), and landing confirms and combos on a partner that tries to
  escape is the skill a fighter uses in every match. Target smash needs
  breakable targets and per-fighter layouts; a Home-Run sandbag needs a new
  object and a distance readout. Both are later candidates.

### Stage 8: rival

- **Decided.** The run ends with the fighter's rival, fought once, as the final
  match (as in Street Fighter 6's arcade and Pokémon's rival as Champion).
- **Decided.** Rivalries are one-way: each fighter points at its own grudge,
  even when it is not mutual.
- **Proposed.** One line of dialogue before the fight, no cutscene. The line is
  shown as Classic's intro was (speaker and line) for 5 seconds over the
  rival's stage.
- **Decided rivals:** Illidan → Arthas, Mal'Ganis → Arthas; **Decided
  (leaning):** Arthas → Mal'Ganis; **Interim:** Jaina → Arthas, and Garrosh
  later; **Proposed:** Uther → Arthas. Garrosh is not in the game yet; he is a
  strong candidate for a new fighter and would take several rival slots.
- **Lead default: no hidden extra fight.** Melee's Crazy Hand (a fight gated on
  speed and no deaths) would put a shared opponent after the personal finale,
  against the principle above, and would split what "a clear" means. Speed and
  damage taken already earn score.

### No ending card

Classic's per-route story line and ending lines go with Classic. A cleared run
ends on the results card (score, its parts, the grid mark earned and any skin
unlocked), keeping the story at one premise sentence and one rival line.

## Per-character tables

The tables cover every pickable fighter: the release roster without the
Coming soon stand-ins (Whitemane, Valeera). The source of truth will be
`ts/src/game/arcade/tables.ts` and its test, written by the tables box; this section is the
authored content it starts from. Fighters are named as players see them
(Samuro is the Blademaster, Mannoroth the Pit Lord, Rokhan the Shadow Hunter,
Gazlowe the Goblin Tinker, Stitches the Butcher, Arthas the Lich King,
Kel'Thuzad the Lich, Mal'Ganis the Dreadlord, Maiev the Warden, Rexxar the
Beastmaster, Muradin the Mountain King).

### Factions and the friend rule

**Proposed** (built from factions as the spec suggests), with side-switchers
placed by hand:

- Alliance: Muradin, Uther, Jaina.
- Horde: Samuro, Rokhan, Rexxar, Thrall, Cairne, Chen, Peon, Gazlowe, Grom,
  and Sylvanas (placed by hand: the Forsaken joined Thrall's Horde in World of
  Warcraft).
- Scourge: Kel'Thuzad, Arthas (placed by hand as the Lich King, not the
  prince), Anub'arak, Stitches.
- Burning Legion: Mal'Ganis, Mannoroth, Archimonde.
- Night Elves: Maiev, Malfurion, Tyrande.
- Illidari: Illidan, Kael'thas (placed by hand: he left the Alliance for
  Illidan in The Frozen Throne), Lady Vashj, Akama.
- Servants of the Old Gods: Ragnaros, Onyxia (Ragnaros joined Deathwing's
  Cataclysm; Onyxia is Deathwing's daughter).
- Mrgl & Grgl and Medivh stand alone; their friends are named by hand below.

Two fighters are **friends** when they share a faction, when one faction is
friendly to the other (Alliance and Night Elves: the night elves joined the
Alliance in World of Warcraft), or when the tables name them as a pair: Jaina
and Thrall (the Hyjal alliance and Theramore's peace), Mrgl & Grgl with Lady
Vashj and with Illidan (the naga's mur'gul served in Illidan's army in The
Frozen Throne), and Medivh with Jaina and with Thrall (the Prophet sent both
west in Reign of Chaos).

- An **ally** must be a friend. An **elite duo** must hold no friend of the
  player, not the rival and not the ally. The test refuses a table that breaks
  either rule.
- Every rival and pairing below that the spec does not set is **Proposed**,
  with its lore source.

### Forge fighters in a run

The menus feature only the fighters Tom endorsed; the rest are in the Forge,
and computer Random, the stage pool and Classic's opponents use featured
fighters only, whatever the Forge rule (Tom, 2026-11-04;
makgora:docs/gameplay-design.md, "The Forge"). Arcade keeps that rule, so
the tables are written lore-first and resolved at run time:

- An elite duo with a Forge member is skipped. Every fighter's pool holds at
  least two all-featured duos, so stage 3 and stage 6 always have one each.
  A lore duo waiting on the Forge is kept in the pool and starts being drawn
  the day its fighters are featured.
- An ally in the Forge is replaced by the featured stand-in the table names, a
  friend picked by hand.
- **Lead default: two narrow exceptions,** each because the alternative breaks
  a Decided rule. Ragnaros has no featured friend at all, so Onyxia plays as
  his ally from the Forge rather than giving him an ally from outside the ally
  map. A rival is the one fixed opponent and is never replaced: every featured
  fighter's rival is featured (the test checks it), and three Forge fighters'
  rivals are in the Forge (Kel'Thuzad → Jaina, Rexxar → Jaina, Tyrande →
  Sylvanas), which can only happen with the Forge on, since only then can the
  player pick them.
- Moving a fighter into or out of the Forge is still one line in
  makgora:ts/src/game/roster/forge.ts; the test then names any table that no
  longer resolves.

### Featured enemy duos

The all-featured duos the tables draw on; each pool below names them by code.

- **L1** Mal'Ganis and Mannoroth: two of the Burning Legion's commanders.
- **L2** Mal'Ganis and Archimonde: the dreadlords served Archimonde's
  invasion (Reign of Chaos).
- **L3** Mannoroth and Archimonde: the Legion's lieutenants since the War of
  the Ancients.
- **H1** Thrall and Samuro: Samuro of the Burning Blade fights for Thrall in
  "The Founding of Durotar" (The Frozen Throne).
- **H2** Rokhan and Chen: Rexxar's companions in "The Founding of Durotar".
- **S1** Arthas and Stitches: the Lich King and the Scourge's abominations.
- **I1** Illidan and Kael'thas: Illidan's army takes Outland and races Arthas
  to Icecrown (The Frozen Throne).
- **A1** Muradin and Maiev: Alliance champions (Onyxia's pool only, below).

### The tables

"Ally" names the lore ally, then "plays: X" when the lore ally is in the
Forge and X stands in. A pool lists its duos; lore duos with a Forge member
are in italics and wait for the Forge.

| Fighter | Ally | Elite pool | Rival | Rival's source | Line before the fight |
| --- | --- | --- | --- | --- | --- |
| Illidan | Kael'thas (Kael's blood elves join Illidan, TFT "Lord of Outland") | L1, L2, *Maiev and Malfurion (they hunt Illidan through Lordaeron, TFT)* | Arthas (**Decided**) | Their duel at Icecrown, TFT's last mission | "I came for the Frozen Throne, Arthas, and you are sitting on it." |
| Samuro | Thrall (he fights for Thrall's Durotar, TFT) | S1, L2, *Uther and Muradin (the Alliance of the Second War)* | Mannoroth | The Burning Blade drank Mannoroth's blood, which made the clan the Legion's blade | "Your blood made my clan a weapon, demon. Now the blade turns." |
| Muradin | Uther; plays: Maiev | H1, S1, L3 | Mal'Ganis | Muradin's expedition hunted Mal'Ganis in Northrend and lost Arthas to that hunt (RoC) | "I lost a prince chasing you across Northrend, dreadlord. You'll answer for him." |
| Maiev | Malfurion (the Sentinels and Watchers hunt Illidan together, TFT); plays: Muradin | L1, S1, *Lady Vashj and Kael'thas (Illidan's allies on her trail, TFT)* | Illidan | Ten thousand years as his jailer; she hunts him from the Broken Isles to Outland (TFT) | "Ten thousand years I kept you, Betrayer. A few more will not trouble me." |
| Kel'Thuzad | Arthas (Arthas raised him in the Sunwell, RoC) | I1, L1, *Uther and Muradin (the Silver Hand and Ironforge against the plague)* | Jaina (Forge) | The Kirin Tor cast him out; Jaina is Antonidas's apprentice and hunted him with Arthas (RoC) | "The Kirin Tor cast me out, apprentice. Your master's city fell to me. So will you." |
| Uther | Jaina (**Decided** as the spec's example of a sound pair); plays: Muradin | H1, L1, *Kel'Thuzad and Mal'Ganis (the cult and its dreadlord spread the plague, RoC)* | Arthas (**Proposed** in the spec) | Arthas killed Uther outside Andorhal | "I trained you, Arthas. I will not let that sword finish what you started." |
| Mal'Ganis | Archimonde (the dreadlords served his invasion, RoC) | I1, H1, *Uther and Muradin (they fought his Scourge in Lordaeron and Northrend, RoC)* | Arthas (**Decided**) | Arthas killed him in Northrend with Frostmourne | "You turned my own gift on me, prince. The nathrezim do not forget." |
| Rokhan | Chen (both join Rexxar, TFT) | S1, L1, *Uther and Muradin (the Alliance against the Horde's trolls, Second War)* | Kael'thas | The troll and high elf enmity of the Troll Wars; the Darkspear are jungle trolls, so the grudge is racial, not tribal | "Trolls remember Quel'Thalas, elf. Rokhan settle it today." |
| Mannoroth | Archimonde (the Legion's lieutenants) | H2, I1, *Malfurion and Tyrande (the War of the Ancients)* | Thrall | Thrall's Horde broke the blood pact, and Grom killed Mannoroth at its end (RoC) | "Your people drank my blood, Warchief. Every orc of yours still owes it." |
| Rexxar | Rokhan (TFT bonus campaign) | S1, L3, *Onyxia and Ragnaros (Rexxar slew the black dragon Searinox in Dustwallow Marsh, TFT bonus)* | Jaina (Forge) | Rexxar defends Durotar from Kul Tiras's fleet under Jaina's father and storms Theramore while she stands aside (TFT bonus) | "Your father's fleet came for Durotar. Theramore will answer for it." |
| Arthas | Anub'arak (TFT "Path of the Damned"); plays: Stitches | I1, H1, *Uther and Jaina (the friends he left at Stratholme, RoC)* | Mal'Ganis (**Decided, leaning**) | The dreadlord Arthas hunted to Northrend after Stratholme | "I crossed an ocean to end you, Mal'Ganis. Frostmourne is hungry." |
| Thrall | Cairne (**Decided, leaning**, the spec's example); plays: Samuro | S1, L2, *Uther and Muradin (the Alliance that ran the internment camps)* | Mannoroth (**Interim**: Garrosh later) | Mannoroth's blood chained the orcs to the Legion until Thrall's Horde broke it (RoC) | "Your blood chained my people, demon. The Horde is free, and I will prove it." |
| Jaina | Uther (**Decided** example pair); plays: Muradin | L1, L3, *Kel'Thuzad and Stitches (the plague of Lordaeron, RoC)* | Arthas (**Interim**: Garrosh later) | She left him at Stratholme and watched him fall (RoC) | "I still remember who you were, Arthas. That's why I have to stop you." |
| Sylvanas | Thrall (the Forsaken join his Horde, WoW) | L1, L2, *Kel'Thuzad and Anub'arak (the Scourge she broke from, TFT)* | Arthas | Arthas killed her at Quel'Thalas and raised her as a banshee (RoC) | "You made me this, Arthas. Now face what you made." |
| Cairne | Thrall (the tauren join the Horde, RoC) | L1, S1, *Muradin and Jaina (Ironforge's dig at Bael Modan in tauren land, WoW, and Theramore)* | Archimonde (**Interim**: Garrosh later, who killed him in mak'gora) | The tauren held Mount Hyjal against Archimonde (RoC) | "The Earth Mother's land will not feed your Legion, Defiler." |
| Chen | Rokhan (both join Rexxar, TFT) | S1, L3, *Onyxia and Ragnaros (Searinox, as for Rexxar)* | Muradin | No lore duel: a brewing rivalry between the Stormstout brewery and Ironforge's Thunderbrew | "Ironforge calls its ale the finest in the world. We settle it, then we share a barrel." |
| Peon | Gazlowe (goblins helped the Horde build Orgrimmar); plays: Samuro | S1, L1, *Malfurion and Tyrande (the Warsong lumber camps in Ashenvale, RoC)* | Thrall | Every peon works for the Warchief; this one wants the job | "Me done with work work. Me take your job, Warchief." |
| Gazlowe | Peon (as above) | S1, L3, *Malfurion and Tyrande (goblin logging in Ashenvale, WoW)* | Muradin | Goblin sappers and zeppelins against dwarven demolition squads and gnomish flying machines (Warcraft II) | "Dwarven engineering? Cute. Let me show you a real explosion." |
| Kael'thas | Lady Vashj (her naga free Kael, TFT "A Dark Covenant"); plays: Illidan | L1, L2, *Maiev and Malfurion (they fight Kael and Illidan in Lordaeron, TFT)* | Arthas | Arthas killed Kael's father and burned the Sunwell (RoC) | "You murdered my father and burned the Sunwell. Quel'Thalas sends its answer." |
| Mrgl & Grgl | Lady Vashj (the mur'gul serve the naga, TFT); plays: Illidan | H1, S1, *Maiev and Tyrande (the night elves on the Broken Isles, TFT)* | Rokhan | Darkspear trolls and murlocs share the Echo Isles and Durotar's coast (WoW) | "Mrrgl mrgl! Mrglglgl!" (The shore is ours, troll!) |
| Grom | Thrall (RoC) | L2, S1, *Malfurion and Tyrande (Ashenvale, RoC "Cry of the Warsong")* | Mannoroth | Grom killed Mannoroth and freed the orcs of his blood (RoC) | "You took our souls for your blood. Gorehowl takes them back." |
| Malfurion | Tyrande (RoC); plays: Maiev | L3, S1, *Grom and Peon (the Warsong lumber camps, RoC)* | Illidan | He imprisoned his brother for ten thousand years and fights him again in TFT | "I chained you once to save this world, brother. I will do it again." |
| Medivh | Jaina (the Prophet sends her west, RoC); plays: Thrall | L1, S1 | Archimonde | The Legion possessed Medivh; as the Prophet he united the races against Archimonde at Hyjal (RoC) | "I opened the door for your master once, Archimonde. Today I close it." |
| Anub'arak | Arthas (TFT "Path of the Damned") | H1, L1, *Kael'thas and Lady Vashj (Illidan's army at Icecrown, TFT)* | Illidan | He guards Arthas's road to Icecrown against Illidan's army (TFT) | "The Frozen Throne lies beneath my ice, Betrayer. You will not reach it." |
| Lady Vashj | Illidan (her naga answer him on the Broken Isles, TFT) | S1, L1, *Malfurion and Tyrande (the night elves who hunt her lord, TFT)* | Maiev | Maiev hunts Illidan through the naga's Broken Isles (TFT) | "You hunted my lord across the Broken Isles, jailor. The tide turns." |
| Archimonde | Mannoroth (the Legion's lieutenants) | H2, S1, *Jaina and Tyrande (the defenders of Hyjal, RoC)* | Thrall | Thrall's orcs broke the Legion's blood pact and held Hyjal against him (RoC) | "Your Horde broke its pact with the Legion, orc. I have come to collect." |
| Tyrande | Malfurion (RoC); plays: Maiev | L3, S1, *Grom and Peon (the Warsong lumber camps, RoC)* | Sylvanas (Forge) | Sylvanas burned Teldrassil (Battle for Azeroth) | "You burned Teldrassil and my people with it. Elune grants you no mercy." |
| Stitches | Kel'Thuzad (the Lich's abominations, Naxxramas); plays: Arthas | H1, H2, *Uther and Jaina (the Alliance that burned the plague out of Lordaeron, RoC)* | Muradin | Muradin leads the Alliance assault on Icecrown Citadel, whose Plagueworks stitch the Scourge's abominations (Wrath of the Lich King) | "Little dwarf. Big hammer. Stitches has hook for both." |
| Akama | Illidan (his Broken join Illidan in Outland, TFT) | L1, S1, *Grom and Samuro (orc clans that slaughtered the draenei under the blood curse, Warcraft lore)* | Archimonde | One of the two eredar lords who took Sargeras's bargain, which drove the draenei from Argus | "The eredar took Argus from my people, Defiler. The Broken have long memories." |
| Ragnaros | Onyxia (Deathwing's Cataclysm), from the Forge by the exception above | H1, H2, *Malfurion and Tyrande (the Cenarion assault on the Firelands, Cataclysm)* | Muradin | The Dark Iron emperor summoned Ragnaros in the War of the Three Hammers to break Ironforge's Bronzebeards, Muradin's clan | "The Bronzebeards still stand? Then the Dark Irons' work is unfinished." |
| Onyxia | Ragnaros (Deathwing's Cataclysm) | H2, A1, *Rexxar and Rokhan (Searinox, as for Rexxar)* | Thrall | The Horde slew her and hung her head in Orgrimmar at the Warchief's order (WoW) | "You hung my head over Orgrimmar's gate, Warchief. I have come for yours." |

Rival count: Arthas is the rival of 6 fighters (3 set by the spec), Thrall
of 4 (the Warchief everyone climbs toward), Muradin of 4. No rival is shared
by more than a fifth of the roster, so the finale stays personal.

## Score

**Proposed:** score from clear time, damage taken and the bonus stage.
**Lead default formula,** integers only (the Warcraft build runs Lua with
32-bit integers), shown term by term on the results card:

- 1,000 for each of the 7 fights cleared.
- Speed: 10 × (par − seconds) for each cleared fight, never below 0. Par is
  90 seconds for a hallway, 180 for the stamina test and the 2v2, 150 for the
  rival.
- Damage: 3,000 − 10 × total damage taken across the run (in %), never below 0.
- Bonus stage: 10 × damage dealt + 100 × the longest combo's hits.
- Continues: −2,000 each (Peon and Grunt only).
- Ties go to the shorter run time.

A run lands around 9,000 to 14,000; a perfect run cannot reach 2³¹.

## Completion grid and leaderboards

- One fixed run length gives one leaderboard per tier, and "Warchief clear"
  means the same thing for everyone.
- **Proposed.** A per-fighter completion grid (Brotato-style). **Lead
  default:** each fighter's card on character select, with Arcade chosen,
  shows three marks (Peon, Grunt, Warchief cleared) and the highest ascension
  rank cleared; the Arcade results card shows the fighter's best score at that
  tier and whether this run beat it.
- **Local first.** The grid, the best score per fighter and tier, the
  highest rank and the earned skins are kept on the player's machine. The
  Warcraft build keeps them in one preload file, `MakgoraArcade.pld`, through
  the same chunked file API as the tutorial's seen flag and the key bindings
  (Wisp's `readChunks` and `writeChunks`, up to 64 chunks of 200 characters;
  the grid for 31 fighters needs about 4). Warcraft's Preloader replays the
  first content it read from a path for the whole session, so the file's
  contents are cached in memory after the first read and every write updates
  the cache, as Lore Battles' clears did. Only the run owner's client writes,
  and the file never feeds simulation state. The native window keeps the same
  file in `~/.local/state/makgora/native-files` when it is a live window
  (makgora:docs/commands/play.md); a headless or capture window keeps nothing.
- **Proposed** and not built without Tom: a hall of fame for Warchief clears and
  any online leaderboard. They publish player results to a server, so they are
  decisions for Tom on #1130.

## Weekly seeded run

- **Proposed.** A weekly seeded Warchief run, like Slay the Spire's Daily
  Climb: everyone gets the same draws that week.
- **Lead default.** The weekly run's seed is a fixed function of the ISO year
  and week. It fixes every random draw of the run (hallway opponents, elite
  duos, stages); the fighter is the player's choice. The tier is Warchief.
  The native window reads the week from the local clock. Warcraft's map script
  has no wall clock, so the Warcraft build carries the week it was built in,
  stamped at build time, and its weekly run is that week's. The results card
  shows the week and the build id, so two players comparing scores can see they
  played the same draws on the same roster. The best weekly score per week is
  kept in the grid file.

## Rewards: skins, never unlocks

- **Decided.** The full roster is open from the first launch; no fighter is
  locked behind single-player. Single-player rewards are skins. A skin earned
  by a Warchief clear doubles as proof, visible to everyone in a lobby. Tom has
  opposed character unlocks since League of Legends.
- **Proposed.** Prestige variants that read instantly in the lore, such as a
  corrupted Illidan or a bloodied Thrall.
- **Lead default: the first reward.** Every fighter earns a "Warchief"
  costume with their first Warchief clear: a tint costume (a colour multiplied
  over the fighter's own model; makgora:docs/design/skins.md) with its
  select-card portraits rendered from the tinted body by our own portrait
  renderer (`ts/scripts/fighterPortraits.ts`), since Warcraft does not tint
  frames. That needs no new art and no outside assets.
- **Lead default: prestige variants.** A variant made by swapping a stock
  texture the Warcraft III install already ships, as Fel Grom swaps in the
  stock Chaos Grom skin, can be built under the same rules once a fighter's
  stock alternate texture is identified. A variant that needs a texture nobody
  has drawn (a bloodied Thrall) needs new art or outside assets, which is a
  decision for Tom on #1130.
- The costume system is hidden until ready (Tom, 2026-11-02;
  makgora:docs/design/skins.md). The skin reward box turns it on, together
  with its open item: the costume indicator as plain dots in the player's
  colour.
- A lobby only lets a player choose a costume they earned, and every client
  must agree on that, since costume cycling runs on every client. The earned
  set travels with the player's file over the existing player-file sync
  (makgora:ts/src/host/loop/playerFiles.ts), which already sends each player's
  key bindings to the lobby.

## Vaulted

- **Lore Battles** (makgora:ts/src/game/classic/loreBattles.ts) are vaulted as
  bloat; the rival at the end of each run carries the personal-grudge payoff.
  Their code, menus, developer commands and the `MakgoraLore.pld` clears file
  are removed with every caller.
- **Multiple bot personas:** parked in favour of one bot that plays every
  fighter well, scaled by tier. The named opponents stay for versus matches;
  Arcade plays every computer fighter as Wren, the default identity
  (makgora:ts/src/game/match/cpuProfiles.ts), at the run's tier.
- **A longer roguelike run with the goblin shop between fights:** a good later
  mode, not this scope.
- **Classic's lore bosses** (Lich King, Archimonde and Kil'jaeden as
  health-bar bosses, makgora:ts/src/game/classic/bosses.ts) go with Classic: the
  spec has no shared final villain and no modifier fights.

## Not built without Tom

These publish or cost, so they stay out of the build boxes and are listed on
#1130 as decisions for Tom: a Discord bot that posts notable clears, any online
leaderboard or hall-of-fame server, and any outside art assets for skins.

## Reference research

- Melee: about a dozen stages (random 1v1s, a team fight, multi-man, giant and
  metal fights, bonus stages, Master Hand); Crazy Hand joins on Normal or above
  under 15 minutes with no continues.
- Brawl: the same skeleton; Crazy Hand needs Hard within 9 minutes.
- Ultimate: 7 stages plus a bonus stage, per-fighter themed routes with unique
  final opponents and a dynamic intensity dial.
- Street Fighter (classic): a random 1v1 ladder, a rival near the end, then the
  boss; Alpha 3 places the rival third from last with an intro scene.
- Street Fighter 6: 5 or 12 stages; the rival is the final match; illustrated
  story bookends; online score ranking split by length; titles for conditions.
- Mortal Kombat Klassic Tower: an escalating ladder with a fixed finale.
- Tekken 5: a personal boss per fighter at stage 8, a shared final boss at
  stage 9.
- Slay the Spire: hallway fights, elites and act bosses from pools, a final
  act, ascension levels, and the Daily Climb with a shared seed.
- Pokémon Red and Blue: the rival is met several times and is the Champion.

Earlier research on which single-player modes players use is in
makgora:docs/design/single-player-modes.md.
