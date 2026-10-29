# Ultimates

Tom, 9 October 2026 (#382): every Warcraft III hero has an ultimate, so every
Smashcraft fighter gets one. It is a real move bought with the full ultimate meter,
never a cutscene. A match rule turns ultimates off. All frame, damage and
launch values below are original, provisional Smashcraft tuning.

## Why supers work and Final Smashes failed

- **Street Fighter III / IV:** the super bar fills from your own attacks and
  from damage taken. Enhanced specials and supers draw on the same bar, so every
  stock of meter is a spend-now-or-save choice. A super is an ordinary move
  with frame data: blockable, punishable, and its startup is known.
- **Street Fighter 6:** splits Drive (enhanced specials, parries, rushes) from the Super Art
  bar. Smashcraft keeps only the Super Art half: one ultimate meter, and the spend-or-save choice.
- **Smash Ultimate Final Smash meter:** fills over time, its cinematic hits
  cannot be answered, and it hands out comebacks; tournaments switch it off.
  Smash Balls are random. Rivals of Aether has no supers at all.

Smashcraft takes the Street Fighter half and refuses the Smash half.

## Rules

| Rule | Value |
| --- | --- |
| Cost | The whole ultimate meter (7200 frames), kept through a KO (docs/design/mana.md). |
| Gain | Ultimate orbs only: one every 30 s of play at centre stage, each worth half a meter (3600 frames), so two make an ultimate; nothing from the clock or from damage (docs/design/mana.md, replaced 2026-10-29). |
| Input | Attack + Special together (hold Attack, press Special; controller A + X), any direction, from any state a special could start. Below a full ultimate meter, or with ultimates off, the ordinary special starts instead. |
| Flash | At most 4 frames of white fighter flash and the ready sound. No camera cut, no freeze of the opponent. |
| Readiness (#192, #253, #255) | The meter shows as a rim of light round the fighter's own silhouette, a ki-aura feel Tom chose over separate effects for the charge and the full bar (2026-10-25): a second white copy of the fighter's model, held on its pose every frame, grown 9% round the body's middle and set 14 units behind it, so only its edge shows. A full ultimate meter with the ultimate on wears a warm gold rim, breathing slowly (alpha 110 to 210 over 2 s) with no restart until the meter is spent; with the meter not full there is none (smashcraft:ts/src/game/presentation/meterGlow.ts). Each fighter owns one rim model, made once and hidden when unused. Casting the ultimate plays a Doom fire tower at its feet for 16 frames and the ultimate sound, ahead of or with the move's own first effect (docs/design/sound.md). The tower is sized to the hurt body (the larger of its height and width against a unit body), so it wraps every fighter size on every stage. Presentation only: sounds follow confirmed frames; the tower starts on the first presented or confirmed frame that holds the cast (at once for the caster; online, as soon as the opponent confirms the received cast, even while a rollback is still repairing the presented frame), plays its full length from there whatever the move's frame by then, stops if a rollback removes a cast no confirmed frame held, and never restarts for the same cast. |
| Telegraph | Every ultimate shows its area, line or target before its first active frame. Startup is at least 16 frames. |
| Counterplay | Each can be shielded or dodged on its startup frames, or escaped by movement, and leaves the user punishable on a whiff. |
| Payoff | Strong, never a guaranteed stock: none kills from 0%. Below 100%, an ultimate and its true follow-ups stay within #83's 30% (gameplay-design.md, "Combo structure"). |
| Air | An airborne press starts every ultimate but the floor-bound ones below; the caster holds in place until the move's first threat, then falls normally: no helpless state, air jump kept. The Dark Portal, Light's Judgment and Inferno draw their marks on the highest floor beneath the mark's spot at or below the caster, and strike there; over the void the mark stays at the caster's height. A ground or air Inferno cast whose mark would fall past the edge, by a caster standing on or above a floor, draws it on the farthest ledge ahead instead, 50 inside it (the Infernal's radius), so the meteor, crash and Infernal land at the edge (#271). Stampede, Earthquake, Tower Rush, Mrglglgl Stampede and Locust Swarm run along the floor from the caster's feet, so they refuse in the air (#98). Two have their own air versions: Chen hangs through his last strike, so his spirits strike where they were drawn around him; Tinker's robot drops to the floor beneath him and walks there. Robo-Goblin Overdrive needs a floor beneath the caster and refuses over the void. |
| Off rule | "Ultimates off" removes the input; the match rule is part of replay state. |
| Effects | Each ultimate's models count as one effect group under #380's budget: gone within 12 frames after its last active frame. Tower Rush's towers are active until they crumble, and their 30-frame Death animation is the exception Tom asked for. |

### Source order

1. **Tier 1:** a reimagined version of the hero's Warcraft III ultimate,
   adapted to a fighting-game move (not a literal port).
2. **Tier 2:** if that cannot work, a famous ability of the character as a
   World of Warcraft raid boss or in an iconic encounter.
3. **Unit:** fighters that are not Warcraft III heroes (Rifleman, Peon,
   Murloc) take the most obvious lore idea.

### Variety

Beams (Rifleman, Jaina), transformations (Illidan, Mountain King), rushes
(Blademaster, Grom), self-centred areas (Chen, Uther), a channel guarded by wards (Shadow Hunter), placed or targeted areas (Dreadlord,
Lich King, Medivh), sweeps and summons (Murloc, Lich, Beastmaster, Warden,
Thrall, Peon, Tinker, Malfurion, Kael'thas), a status projectile (Sylvanas), a return to centre
(Cairne), a targeted curse (Pit Lord) and a command throw (Grom's catch). Ground sweeps are
answered by jumping or shielding; Frost Wyrm also crosses at body height.

Frost Wyrm and Tower Rush midrange connection is measured at a literal
300-unit gap against standing targets and seeded Wren Expert approaches,
separately. Each mode requires damage in at least 70% of trials, across both
facings and all stages. Doom (Pit Lord) measured 2026-10-28 with seeds 17, 83 and
241: standing 60/60 and Wren Expert 60/60 across all ten stages. Shield, jump and roll remain deliberate answers to
Frost Wyrm's startup; a held shield or breaking the towers answers Tower Rush.

## Damage target (2026-10-28)

Tom set the strength target on 28 October 2026: an ultimate deals about
25-30% in total. Measured against a standing Warden that neither shields nor
moves, placed 60, 120, 200, 300 or 420 units ahead (the best of the five),
over the first 900 frames or until the stock is lost. Only damage changed;
angles, base and growth stay, so a retuned ultimate also launches harder.

| Fighter | Before | After | Change |
|---|---:|---:|---|
| Rifleman | 24 | 24 | In band |
| Illidan | 12 | 26 | Shockwave 12 to 26 |
| Blademaster | 24 | 24 | In band |
| Mountain King | 8.3 | 26 | Stomp 8.25 to 26 |
| Warden | 20 | 26 | Glaives 5 to 6.5 each |
| Lich | 16 | 26 | Wyrm 16 to 26 |
| Uther | 26 | 26 | Resurrection 14 + 12 (28 Oct 2026) |
| Dreadlord | 44 | 30 | Infernal slam 9 to 3, immolation 1.5 to 0.5; meteor unchanged |
| Shadow Hunter | 27 | 27 | In band |
| Pit Lord | 24 | 24 | In band over 900 frames; Doom keeps burning until a stock is lost, as designed that morning |
| Beastmaster | 18 | 26 | Each animal 9 to 13 (a standing foe meets two; a jumping one can meet the hawk too) |
| Lich King | 15 | 26 | Risen dead 15 to 26 |
| Thrall | 15 | 26 | Tremor 15 to 26 |
| Jaina | 25 | 25 | In band |
| Sylvanas | 14 | 26 | Contact 14 to 26 |
| Cairne | 12 | 26 | Ankh burst 12 to 26 |
| Chen | 29 | 29 | In band |
| Peon | 30 | 30 | In band |
| Tinker | 21 | 26 | Blast 18 to 23 |
| Kael'thas | 26 | 26 | In band |
| Murloc | 16 | 26 | Swarm hits 2 to 4, last murloc 10 to 22 |
| Grom | 11.5 | 26 | Chops 11.5 to 26 total |
| Malfurion | 20 | 26 | Wisp wall 20 to 26 |
| Medivh | 15 | 26 | Eruption 12 to 23 |
| Lady Vashj | 0 | 26 | Hits on the petrified foe, capped at 26 |

## Per fighter

Frames count from the input frame (frame 1 is the first frame after it).
"Total" is the whole commitment; launch is angle, base and growth.

| Fighter | Air | Ultimate · source (tier) | Telegraph | Attack | Counterplay | Why it fits | Stock assets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rifleman | air | **Aimed Shot** · WoW Hunter's Aimed Shot on a dwarven long rifle (unit) | Kneels and shoulders the rifle, f1–35; a red aiming line shows height and direction across the stage | f36 one piercing bullet at chest height, 60 a frame, radius 26, the full stage; 24%, 30°, base 40, growth 95. Total 70 | Jump or roll over the line, shield it (heavy shield damage); he cannot turn and is locked until f70 | The patient marksman's payoff for a stage of spacing | Rifleman kneel/attack clips, rifle muzzle and BoltImpact |
| Illidan | air | **Metamorphosis** · Warcraft III Demon Hunter ultimate (tier 1) | Wings flare and fel fire climbs him, f1–30; hittable throughout | f31 fel shockwave, radius 160 both sides, 26%, 70°, base 45, growth 80; then 8 s of demon form: the speed item's 1.3× movement. Total 50 | Hit him during the 30-frame change, shield the burst, keep away for 8 s; no added damage | His defining moment; distinct from his Eye Beam | Illidan model with the Metamorphosis effect, fel flames, green tint |
| Blademaster | air | **Bladestorm** · Warcraft III Blademaster ultimate (tier 1) | Plants his feet as wind gathers, f1–14 | f17–74 a steerable spin (drift 5 a frame on the floor), radius 110: six 2.5% hits 9 frames apart, then f75 a 9% finish at 45°, base 50, growth 95. Total 104, dizzy at the end. Through f17–74 he can full hop, short hop and use his air jump without ending it; off the floor he falls and drifts as in any jump, the hits, finish and dizzy still come, and landing does not end it. Cast in the air he floats through f17–74 instead of falling (the hover of f1–16 carries on): nothing held, he stays at his height; down held, he sinks at 4.2 a frame; jump held or pressed, he rises at 4.2 a frame (a quarter of his 16.8 terminal fall speed); left and right drift as in any jump, the jump buttons spend no air jump, and after f74 he falls normally with his air jump kept and no helpless fall. A landing mid-spin turns it into the grounded spin, jump window included | Spell-immune through f1–78: foes' specials and ultimates pass through him, so answer with normals, smashes or a grab; shield holds (light chip), outrun it; a foe 140 above the floor clears the grounded spin but not his full hop, and 450 up clears the full hop but not his air jump, so jumping over it only works while he stays down; punish the 30-frame dizzy | The duel's whirlwind, a real cost to commit | Blademaster spin clip, small tornado |
| Mountain King | air | **Avatar** · Warcraft III Mountain King ultimate (tier 1) | Raises the hammer, stone crackles over him, f1–32 | f33 a landing stomp, radius 180 both sides, 26%, 75°; then 10 s of stone: the heavy item's 1.5× weight and 1.3× fall speed | Hit him in the change, grab him (no armour), stay away for 10 s | The stout dwarf turned to stone | Avatar spell effect, Thunderclap ring |
| Warden | air | **Vengeance** · Warcraft III Warden ultimate, Avatar of Vengeance (tier 1) | Raises her blade; the Avatar rises behind her, f1–24 | The Avatar stands for 90 frames (30 durability) and throws four spectral glaives straight ahead at f24/39/54/69, 18 a frame, 6.5% each, 40°. She is free at f40 | Break the Avatar, jump or shield the glaives; punish her through f40 | The jailer's ghostly enforcer | Avatar of Vengeance / Spirit of Vengeance units, glaive missile |
| Lich | air | **Frost Wyrm** · Sapphiron, Kel'Thuzad's frost wyrm in Naxxramas (tier 2: Death and Decay, his WC3 ultimate, is already his side special) | Lifts his arms; a wyrm cry and a frost line at body height, f1–30 | f31 a frost wyrm sweeps across from behind him, 28 a frame at body height (centre 95, radius 45); 26%, 60°, chills | Jump or shield it, or interrupt the startup; he is locked until f60 | The undead sky over Naxxramas; a single chilling sweep alongside Murloc's low swarm | Frost Wyrm missile (the wyrm unit needs a model-facts row), FreezingBreath |
| Uther | air | **Resurrection** · Warcraft III Paladin ultimate (tier 2: Resurrection raises allies, so here the light raises him and throws the living up; distinct from Cairne's Reincarnation, which triggers on death) | Hammer planted, golden light gathers round him (Resurrect Caster), f1–24 | f25 rings of light (Resurrect Target) rise at ±80 and ±150; f26–28 they launch everyone within 170 on either side, 14%, 85°; f34–36 a second rise, 12%, 90° (26% total). Still to build: he heals 10% | Shield or roll away during the gathering; punish him through f64 | The Lightbringer's last stand | ResurrectCaster, ResurrectTarget |
| Dreadlord | air | **Summon Inferno** · Warcraft III Dreadlord ultimate (tier 1) | Points; a burning mark 260 ahead, f1–20 (from the air, on the floor below; past the edge, 50 inside the ledge) | A burning meteor falls onto the mark from f28; f40 it crashes there and strikes, radius 100: 14%, 80°. An Infernal (30 durability, 300 frames) rises there for 24 frames, then walks slowly at the nearest foe and slams within 120: 16-frame wind-up, 3% at 45°, 66-frame cycle; its immolation burns 0.5% within 75 every 30 frames | Leave the mark, shield the crash; break the Infernal (a hit mid-slam staggers it 24 frames) or stay out of its reach; punish him through f56 | The classic summon of a demon lord | Mark of Chaos, Demolisher fire missile, Firelord explosion, Infernal, red immolation |
| Shadow Hunter | air | **Big Bad Voodoo** · Warcraft III Shadow Hunter ultimate (tier 1), faithful (#483) | Dances (Stand Channel) on a voodoo aura from f2; two Serpent Wards rise at ±140 on f16 | Each ward fires outward from its own side: 5% bolts at f22/37/52, then a 12% launcher at f67 (45°, base 60, growth 90); at most 27% from one side. He is hittable throughout; nothing breaks the wards while he dances. Total 105 | Hit the dancer: it ends the dance and sinks both wards; or shield the bolts; punish from f91 | BBV protects everyone but the Shadow Hunter | Serpent Ward, Serpent Ward missile; Command Aura stands in for VoodooAura until its model facts are confirmed |
| Pit Lord | air | **Doom** · Warcraft III Pit Lord ultimate (tier 1), a point-and-click curse (2026-10-28: the old f19 command grab was too hard to land) | Raises a claw and locks the nearest foe within 600 units; the Doom glyph shows on them f1–19 and follows them; knockback armor 100 on f1–20 (War Stomp's kind: jabs are absorbed, a smash breaks it) | f20 a fel bolt lands on the locked foe wherever they are: no shield blocks it and nothing reflects it; 10%, 85°, base 40, growth 30, a small pop up; Doom burns 1% a second until a stock is lost; 1 s after that loss, as they respawn, a Doom Guard (8 s, 40 durability, 14% cleave plus a 6% fire wave every 90 frames) steps out of a fel portal on the main deck nearest where they fell. Total 60 | Read the glyph and be intangible on f20 (a timed spot dodge, roll or air dodge) or be over 600 away when it lands; smash him through the armor; a dodged or out-of-range cast still ends at f60; kill him before the curse kills you, break or outlast the Doom Guard | The doom-bringer's curse, named and inescapable unless read | Doom target and DoomDeath effects, Doom Guard sound |
| Beastmaster | ground only | **Stampede** · Warcraft III Beastmaster ultimate (tier 1) | Raises his axes and roars; dust behind him, f1–24 | His pack charges past: Quilbeast low (f25), Bear mid (f40), Hawk high (f55), 22 a frame across the stage, 13% each | Each at a different height: jump the Quilbeast, shield the Bear, stay low under the Hawk; shield all three | His own three pets, as a stampede | Quilbeast, bear and hawk units, Stampede missile dust |
| Lich King | air | **Animate Dead** · Warcraft III Death Knight (Arthas) ultimate (tier 1) | Frostmourne raised; runes glow under the nearest foe, f1–24 | f32 the dead claw up from the marked spot, radius 90: 26%, 85° | Step off the mark, shield; punish him through f56 | Arthas raising the fallen beneath you | AnimateDead target, skeleton hands |
| Thrall | ground only | **Earthquake** · Warcraft III Far Seer ultimate (tier 1) | Raises the Doomhammer; cracks run both ways, f1–26 | f27 two ground tremors run outward both ways, 16 a frame for 50 frames, grounded foes only; 26%, 70° | Jump, stand on a platform, shield; punish him through f60 | The shaman shaking the world | Earthquake target and caster effects |
| Jaina | air | **Glacial Ray** · Jaina in the Battle of Dazar'alor (tier 2: Mass Teleport cannot be a strike) | Staff charges; a frost line at 45° above her, f1–24 | f25, f33, f41, f49 four frost bolts sweep from 45° up to the floor ahead, 600 long each: three 5% glances, then 10% at 30° | Get behind or under the early bolts, shield; punish f55–80 | Her admiral-era fury in one sweep | BreathOfFrost, frost bolt, Blizzard target |
| Sylvanas | air | **Banshee Form** · WoW Sylvanas's banshee form and Warcraft III Possession (tier 1) | A dark Dark Summoning vortex, her own in place of the shared golden ultimate burst, and the Possession shadow wrap her as she fades to a faint shadow, f1–18, lifting 1 a frame through f17 to hover 17 above the deck, then level on f18; hittable, and a hit cancels it | f19–98 intangible and ethereal, the Banshee ghost drawn over her faint body, she glides low at 9 a frame at the foe nearest at activation, turning at most 8° a frame, through platforms; on the deck she never rises above 17 against a standing foe, her course bends up after a foe who jumps (from 480 away, a Mountain King who full-jumps in place on f41 is met in the air at f70, about 113 up, and she ends about 75 past him), and when a foe gets past her she swings up and back round after them (from 480 away, a Mountain King who runs at her from f11 and rolls through her on f29 is met on her way back at f75, after a loop up to 128, in both facings); a reversal always turns her upward in either facing; contact 26%, 45°, base 45, growth 72, then she flies on through the foe at 20 a frame for 14 frames, outrunning his knockback to lead him by about 42 within 14 frames of contact and ending about 97 units beyond a standing foe from 300 or 480 away at 0% (contact f46 and f66), and turns solid with 20 frames of endlag; a miss turns solid at f98 with 30. She leaves nothing behind (the shadow trail was dropped on 2026-10-25). At most 26% from one use | Hit her during f1–18: a hit on f18 cancels it, one on f19 meets intangibility. Shield it: contact costs a Blademaster shield about 10 of its 60 and 8 frames of shield stun. Roll through her late: from 480 away on the deck (contact f66), a roll toward her begun f53–63 passes through and she cannot turn back before f98; one begun f52 is hit, and an earlier roll is met on her way back. Run away: on the deck from 480, a held run away begun up to 1 frame before contact escapes for every fighter (Jaina must start by f54 of her f67 contact); cast while falling from 150 above, every fighter but Jaina escapes with a run begun up to 1 frame before contact, and Jaina by f28 of f47. Running under her no longer escapes: she turns down onto a runner. | The Banshee Queen's wraith form: she takes the shape, then passes through you | Possession caster and target, Dark Summoning target, Banshee unit |
| Cairne | air | **Reincarnation** · Warcraft III Tauren Chieftain ultimate (tier 1, reimagined: it triggers on death in WC3) | A golden ankh (an original camera-facing model from tools/effects/ankh.ts, since the stock Reincarnation stone reads as a grave marker in Classic) appears at centre stage on the deck, f1–24 (24 frames from ankh to burst); from f28 a Mass Teleport swirl marks where he stands, so his leaving reads as a teleport | f25–27 light (a Holy Bolt flash, the Resurrect column and an original camera-facing golden starburst that expands to the hit's width) bursts from the ankh, reaching 190 to each side, his forward smash's reach, and 100 up (Tom, 17 Oct: a knock-up a forward smash wide either side of where he returns): 26%, 85°, base 55, growth 60; the burst plays alone for 9 frames (Cairne arriving on the burst frame read as his arrival flash, 2026-10-25), then at f34 he teleports to the ankh, intangible for 6 frames. Total 58 | Shield or leave the ankh; punish his arrival recovery through f58 | The old chief who will not stay down, returning to the ancestors' mark | original ankh and ankh burst, Resurrect target, Holy Bolt flash, Mass Teleport caster |
| Chen | air: he hangs through f49, so each spirit strikes where it was drawn around him | **Storm, Earth and Fire** · Warcraft III Brewmaster ultimate (tier 1) | He splits; three spirits appear, f1–20 | Earth stomps both sides (f21, radius 120, 8%), Storm strikes 220 ahead (f33, 7%), Fire breathes behind him (f45, 9%) | Each spirit hits once in its own place and time: read the order, shield, or roll through | His three-way split as one combination | Storm, Earth and Fire Pandaren effects, Breath of Fire |
| Peon | ground only | **Tower Rush** · the orc tower rush, Tom's request (unit) | He hacks at the ground, f1–15; the first Orc Watch Tower starts building at f16 | Five stock Watch Towers rise in quick succession, one every 8 frames (f16–48), at 110, 250, −130, 390 and 530 ahead, held on the main deck. Each builds for 20 frames (its Birth animation), then fires a Guard Tower arrow at the nearest foe at ages 20, 60, 100 and 140: 26 a frame, homing on height, 1.5%, 40°, base 30, growth 15; at most 30% from all twenty. At 150 frames each crumbles (Death animation, 30 frames) and is gone by about 4 s. When the last tower is built he says the stock "Work complete!" (PeonJobDone). Total 70 | Break a tower (10 durability: one smash, or a few jabs or projectiles), which crumbles at once and never fires again; shield the arrows (a held shield takes all twenty); hit him while he builds, which stops the towers not yet started; punish him through f70 | Work work, then a tower rush across the stage | Orc Watch Tower, Guard Tower missile, PeonJobDone voice |
| Goblin Tinker | air over a floor: the robot drops to the floor beneath him and walks there | **Robo-Goblin Overdrive** · Warcraft III Tinker ultimate (tier 1, reimagined: Robo-Goblin is his down special) | He hops out; the robot waddles forward beeping, f1–20 | The robot walks 6 a frame for 60 frames, then explodes, radius 150: 23%, 55°; touching it explodes it early | Walk away, shield the blast, or punish Tinker through f50 | Goblin engineering that is almost a weapon | Robo-Goblin unit, goblin land mine explosion |
| Kael'thas | air | **Summon Phoenix** · Warcraft III Blood Mage ultimate (tier 1, #360) | Flame Strike embers gather at his shoulder, f1–19 | f20 a phoenix appears 40 behind and 110 above him and follows him for 180 frames; its burning aura (radius 70) deals 4.3%, 70° at ages 30, 60, 90, 120, 150 and 178; it is a special, so it is fire and hits banished fighters. Cast ends f36 | Break it (12 durability), keep away from its aura; punish him through f36 | The Blood Mage's own phoenix | Phoenix unit, Immolation, Flame Strike embers |
| Murloc | ground only | **Mrglglgl Stampede** · Tom's decision (unit) | Blows a conch, "MRGLGLGLGL!", water splashes where the swarm enters, f1–20 | f20 four murlocs pour across from behind him at ground level, 30 a frame: three carry grounded foes with 4% hits every 6 frames, the last launches (22%, 40°) | Jump or be airborne, shield (heavy damage); off-stage is safe; Murloc is committed until the wave ends | Legible, funny, characterful | Murloc variants at small scale, splashes |
| Grom | air | **Blood of Mannoroth** · Grom drinking the demon blood in Warcraft III's campaign (tier 2: he has no hero ultimate) | Eyes blaze red; a roar, f1–16 | f17–40 a charge, 22 a frame; the first foe reached is caught (beats shield): three Gorehowl chops, 26% total, flung at 40°. From the air the charge runs level at his height: it catches a foe whose feet are up to about 100 below his, and Grom and the caught foe hang there through the 30-frame hold before he falls | Jump over, roll through, or hit him first; a whiff skids to f70 | Reckless commitment, all or nothing | Bloodlust effects, red tint |
| Malfurion | air | **Wisps of Hyjal** · Malfurion's wisps detonating at Mount Hyjal, Warcraft III's finale (tier 2: Tranquility only heals) | Wisps gather around him, f1–28 | f29 a slow wall of wisps drifts forward 7 a frame for 120 frames: 26%, 50° on contact | Shield, jump over, get behind; punish him through f50 | The archdruid's quiet, inevitable answer | Wisp units, Tranquility |
| Medivh | air | **The Dark Portal** · Medivh opening the Dark Portal (tier 2: no hero ultimate) | A green portal opens 240 ahead, f1–24 | f25–60 it draws nearby foes in (1% every 6 frames, radius 220); f64 it erupts, radius 130: 23%, 60° | Walk out against the pull, shield, escape before f64 | The prophet's doom-laden punchline | Dark Portal target effect |
| Lady Vashj | air | **Gaze of Azshara** · Lady Vashj, the naga queen once Azshara's handmaiden (tier 2: her Warcraft III ultimate, Tornado, is dropped) | Eyes and head snakes glow, f1–20 | f21–60 a cone 600 ahead, widening to 300 tall, catches a foe facing her: 40% slow for 40 frames, then petrified 60 frames under a grey tint; it takes hits without thawing or flying, at most 26% | Turn away, dodge or stay out of the cone; punish her through f72 | The serpent queen's stare | Curse target effect, grey tint |
| Archimonde | air | **Rain of Chaos** · Archimonde calling infernals down on Mount Hyjal (tier 2: Finger of Death is his neutral special) | Raises his arms; chaos circles mark the foe's position and 220 units either side, f1–40 | Three infernals crash on the marks in sequence: f42 and f50 for 8% each, f58 for 10%, all fire; nothing stays afterwards. Total 72 | Leave the circles, shield the crashes; punish him through f72 | The Defiler's rain of demons over the World Tree | Mark of Chaos target, Infernal birth |
| the Butcher | ground only | **Dismember** · the hero-arena butcher's channelled carving (tier 2: the Abomination has no hero ultimate) | Raises the cleaver, f1–20 | f21–28 a lunge of 14 a frame that catches the first foe it reaches; a raised shield stops it and intangibility slips it. A caught foe is pinned 90 frames with no mash escape, takes 4% every 15 frames (24% in all) while he heals the same, then is shoved off. Whiff total 78 | Shield or dodge the lunge; punish the whiff through f78 | The Scourge butcher at his block | Stock Abomination clips |
| Tyrande | air | **Starfall** · the Priestess of the Moon's tier-1 ultimate | Stands and raises the bow under a starfall aura; each of four lanes 80-440 units ahead glows 12 frames before its star falls | Stars fall on all four lanes three times, f34, f64 and f94 (each lane 3 frames after the last): 8.5%, 8.5% (held in place) and 9% (launch), 26% for a foe who stays in one lane, arcane. Channel total 116 | Leave the lanes, shield the stars, or hit her: the channel and every star still to fall end | The High Priestess calling Elune's stars on the Legion | Starfall caster and target, Moon Well caster art |

## Implementation contract

- One ultimate per fighter, authored as hero special data
  (smashcraft:ts/src/game/sim/ultimates.ts) and run by the hero special engine
  as special action 17, so it is deterministic and in snapshots through the
  special state. Telegraphs are drawn-only projectiles; transformations reuse
  the speed and heavy item buffs.
- smashcraft:ts/src/game/sim/ultimates.tests.ts plays each ultimate as a
  recorded scenario in both facings: it lands undefended without a KO from
  0%, its defence (shield, spot dodge, staying grounded) takes
  no damage, its first threat is at least frame 16 and its user stays
  committed at least 16 frames past it. Six `ultimate-*` parity tapes replay
  ultimates with rollbacks in Bun and both Lua32 modes.
- The Dark Portal, Light's Judgment, Inferno and Reincarnation strike at
  their drawn mark (`regionOrigin`), so a cast from the air lands where it
  telegraphed after the caster falls. An air cast drops the Portal, Judgment
  and Inferno marks (`dropsToFloor`) to the highest floor under the mark at
  or below the caster (`floorBelow`), keeping the caster's height over the
  void; a ground cast draws them at the caster's feet. Inferno's mark pulls\n  back over the void (`ledgeInset`) to 50 inside the farthest ledge ahead of\n  a caster on or over a floor. Inferno's meteor and
  crash and Judgment's f34 flash are drawn at the move's first mark
  (`atMark`), so each move telegraphs, falls and strikes at one spot. A
  floor mark drawn on a moving deck rides it, carrying the marks drawn at it
  and the strikes anchored there, so on Ahn'Qiraj's rising lift Judgment's
  f52 and f64 pulses hit a foe standing on the lift in the circle (#113); a
  mark drawn beside the deck stays where it was drawn. An ultimate's drawn
  marks age on the move's clock, holding while hitlag pauses its owner, so
  Chen's spirits stand until they strike. Decoded replay moments rebind the ultimate
  to its authored data, so a restored mark is still found by the strikes
  and marks that use it. Every effect of the Portal,
  Judgment, the Inferno crash and Storm, Earth and Fire is gone within 12 frames of
  the move's last active frame; the summoned Infernal stays until it breaks, its
  300 frames end or its owner loses the stock.
- An airborne caster holds until the move's first threat, or until
  `airHoldFrames` where the move sets it (Chen). Tinker's robot is
  `dropsToFloor` too; past a ledge a `needsFloorBelow`
  move's projectile takes the floor under its caster, as a standing cast's
  does. A `Relocation.floorBelow` motion sets an airborne caster down on the
  floor beneath him, grounded on that surface at once. A `needsFloorBelow`
  ultimate refuses in the air where there is no floor beneath.
- A `spellImmune` window (Bladestorm, f1–78) makes opponents' specials and ultimates pass through the caster: `collectDamageContact` drops any contact `contactIsSpell` calls a spell, and the target choosers (special regions, projectiles, bear, trap, companion bites, command grabs) skip him, so a projectile is not spent and a status is not applied.
- A `jumpWindow` (Bladestorm, f17–74) lets the caster jump and air jump
  mid-move; past the air hold he falls and drifts as in any jump while it
  runs, and a landing keeps it going (#503).
- An `airFloat` with the `airStall` window (Bladestorm, f17–74) makes an
  ultimate cast in the air float instead: the engine marks the cast in
  `special.variant` (`ULTIMATE_AIR_CAST`), sets his vertical speed each frame
  to `rise` while jump is held or pressed minus `sink` while down is held
  (both held cancel to a hover), skips gravity and the jump window, and the
  mark clears on landing so the grounded rules apply from then on.
- Computer fighters press it at a full ultimate meter when the target is inside the
  move's authored reach (ULTIMATE_REACH), as often as their kit options;
  Rookie never does, Lich presses it at a target in the air within 600, a
  raised shield stops the press, and Cairne presses it at a level foe
  anywhere within 1200, the main deck's width, because his ankh lands at
  centre stage whatever the foe's distance from him. In the air
  they press it only over the main deck and never a ground-only one, because
  the caster cannot act again until it ends; a `needsFloorBelow` one is aimed
  from the floor beneath them, not from their height, and skipped where
  there is none.
- "Ultimates off" is MatchState.ultimatesOff (fighter-selection rules,
  `-dev ultimates on|off`); it clears the input before specials start.
