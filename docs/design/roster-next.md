# Next roster change: Uther, Lady Vashj, Archimonde, Tyrande, Stitches, dismounted Thrall

Tom's request (28 October 2026), with two additions the same day: Uther
replaces Forsaken Paladin, Lady Vashj replaces Kobold, Archimonde, Tyrande and
an Abomination butcher join, and Thrall moves to a dismounted community model
and is reanimated. Lady Vashj's kit follows a hero-arena gorgon archer's
ability ideas, and the butcher's follows the hero-arena butcher's. Both take
ideas only: no Dota 2 model, sound, text or ability name appears in the map,
the repository or the release page, and every move is named and described in
Warcraft terms.

This is a plan. Every number below is an original, provisional Smashcraft
value to tune, not copied frame data. Melee anchors are cited for role and
trade-off relations only, from public frame data, under the `game-ip` rule.

The roster goes from 26 to 29 fighters. Tom asked for the additions in his
own words, so when the first new fighter lands, AGENTS.md's "holds at 26" line
and roster.md's opening paragraph change to 29 in that same change.

Issues:
[Uther (#662)](https://github.com/tompassarelli/smashcraft/issues/662),
[Lady Vashj (#663)](https://github.com/tompassarelli/smashcraft/issues/663),
[Archimonde (#664)](https://github.com/tompassarelli/smashcraft/issues/664),
[Tyrande (#665)](https://github.com/tompassarelli/smashcraft/issues/665),
[Stitches (#666)](https://github.com/tompassarelli/smashcraft/issues/666),
[dismounted Thrall (#667)](https://github.com/tompassarelli/smashcraft/issues/667).

## Models and source terms

Stock paths were checked on 28 October 2026 by extracting each file from the
Classic `war3.w3mod` storage with the CASC extractor
(smashcraft:tools/animations/casc-extract.cpp). No Warcraft client was started.
Sequence and bone lists come from each file's `SEQS` and `BONE` chunks.

| Fighter | Model | Rig | Stock sequences |
| --- | --- | --- | --- |
| Uther | `units\human\Uther\Uther.mdl` (portrait `Uther_portrait`) | Classic Paladin biped, 34 bones; `Hammer` bone; the same skeleton names as `HeroPaladin`, not Forsaken Paladin's 121-joint rig | Stand ×3, Stand Ready, Attack ×2, Spell, Stand Channel, Stand Victory, Walk, Death |
| Lady Vashj | `units\naga\LadyVashj\LadyVashj.mdl` (portrait `LadyVashj_portrait`); byte-identical to `HeroNagaSeaWitch` | Naga: five tail bones and no legs, four arms, `Bow`, `Arrow`, two head snakes | Stand, Walk, Stand Ready, Attack, Spell, Death, and swim variants of each |
| Archimonde | `units\demon\Warlock\Warlock.mdl` (portrait `Warlock_portrait`), the model Classic mode's Archimonde boss already draws at 2.6× | Biped with a four-bone tail and cape, 47 bones | Stand ×2, Walk, Attack ×2, Spell, Spell Slam, Death |
| Stitches | `units\undead\Abomination\Abomination.mdl` (portrait `Abomination_portrait`) | 36 bones. Only `Leg_L`, `Leg_R`, `Head` and the two `Chain` bones are named; the arms, cleaver and hook sit on `Mesh*` and `Object*` nodes that need mapping by hand | Stand ×3, Walk, Attack ×2, Stand Channel, Death, Decay |
| Tyrande | Hive: `TyrandeDismountedV2.mdx` (below), johnwar's Re-Classic dismounted body, replacing Retera's first model (#712). Stock Tyrande is the mounted `HeroMoonPriestess`; there is no stock `units\nightelf\Tyrande` model | Read on download (Re-Classic intake below): night-elf biped, 62 nodes; `Bone_Root`, `Bone_Pelvis`, `Bone_Chest`, `Bone_Head`, both arm chains, `Bone_Hand_L`, both leg chains and feet. No `Bone_Hand_R`: the bow is `Cylinder02` under `Bone_Hand_L`, with `Arrow` and `Arrow01` nodes | Stand - 1, Stand - 2, Stand - 3, Stand - 5, Death, Attack - 1, Attack - 2, Spell, Walk, Dissipate, Stand Hit, Stand Victory, Stand Ready, and four Portrait sequences |
| Thrall | Hive: `WarchiefThrallDismountedV2.mdx` (below), replacing the mounted `units\orc\Thrall\Thrall.mdl` | Built on a Grom Hellscream base, and confirmed a full biped on download (H1 intake below): 73 nodes and 45 bones, with `Bone_Root`, `Pelvis`, `Chest`, `Head`, both arm chains with hands, both leg chains with feet, `Bone_Sword` and `axe`, plus portrait face nodes, attachment refs (`Weapon Ref`, `Hand Right Ref` and the rest) and two collision spheres | Stand - 1..3, Stand Alternate - 1..3, Stand Ready, Stand Ready Alternate, Walk, Attack - 1..3, Attack Alternate - 1..4, Attack Slam Alternate, Spell, Spell Second, Spell Slam, Spell Throw, Stand Channel, Spell Channel, Death, Dissipate, and six Portrait sequences. No Stand Victory or Stand Hit |

Command icons resolve as `.dds` in Classic storage: `BTNHeroPaladin`
(Uther), `BTNNagaSeaWitch` (Vashj), `BTNArchimonde`, `BTNPriestessOfTheMoon`
(Tyrande), `BTNAbomination` (Stitches) and `BTNThrall` all exist. There is
no `BTNUther`, `BTNLadyVashj` or `BTNTyrande`.

The spell effects named in the kits below were found in the same storage:
`HolyBoltSpecialArt`, `DivineShieldTarget`, `DevotionAura`,
`ResurrectCaster` and `ResurrectTarget`, `NagaColdArrowMissile`,
`ManaShieldCaster` (human), `SerpentWardMissile`, `CrushingWaveDamage`,
`TornadoElemental`, `RainOfFireTarget`, `InfernalBirth`, `DoomDeath`,
`SearingArrowMissile`, `StarfallTarget` and `StarfallCaster`, `TrueshotAura`,
`MoonPriestessMissile`, `MoonWellCasterArt`, `BlinkCaster`,
`PlagueCloudCaster`, `AbominationExplosion`, `MeatwagonMissile`,
`FrostNovaTarget` and `CurseTarget`. `Abilities\Spells\Other\Stoned` does not
exist, so petrification is drawn as a grey vertex tint, the way Tinker's gold
transmutation is drawn as a material.

### Hive model terms

Tom asked for both Hive models in his own words, which approves their use.
The live pages sit behind Cloudflare, so the terms below were read on
28 October 2026 from the Wayback Machine's copies of the two pages: the Thrall
page as captured on 22 August 2025 and the Tyrande page as captured on
12 February 2026. Neither page forbids use in a public map. Neither page needs
a decision from Tom.

- **Warchief Thrall Dismounted (Re-Classic)**, https://www.hiveworkshop.com/threads/warchief-thrall-dismounted-re-classic.332006/
  - Author: johnwar. Approved and marked recommended by the moderator HERON ("Works in-game. Approved!"). Created 14 April 2021, updated 4 July 2022.
  - Credits on the page: "Used Ujimasa Hojo's Grom Hellscream and Derivatives as the base model", and Tauer for the animations in the separate "Tauer's Thrall Animations" version, which we do not use.
  - Conditions: the page states no usage terms, no edit ban and no credit requirement, and johnwar's own models-discussion thread (334708) lists credits but no terms. We follow Hive's custom and credit every named author.
  - File: `WarchiefThrallDismountedV2.mdx`, the "Warchief Thrall" added in update 5, 2,006 polygons, with its weapon attachment adjusted in update 6. The bundle also holds `ThrallDismountedV2.mdx`, an alternate body, the Tauer-animation version, Nazgrel and two Doomhammer missiles, all unused.
  - Credit line: "Warchief Thrall Dismounted by johnwar (Hive Workshop), built on Ujimasa Hojo's Grom Hellscream."
- **Tyrande Whisperwind (Re-Classic Pack)**, https://www.hiveworkshop.com/threads/tyrande-whisperwind-re-classic-pack.348819/
  - Replaces Retera's 287-polygon Tyrande Dismounted SD, which Tyrande first shipped on, after Tom judged it too low in quality (2026-10-29, #712).
  - Author: johnwar. Approved and marked recommended by the moderator ILH ("Changes made. Works in-game. Approved!"). Created 29 April 2023, updated 21 June 2025.
  - Credits on the page: "Archer, Dark Ranger, Sylvanas Windrunner, and Derivatives by Ujimasa Hojo" and "Tyrande Whisperwind (Version#Heavy Mount) by kangyun"; in reply #24 johnwar posts kangyun's permission after a moderator asks for it.
  - Conditions: the page states no usage terms, no edit ban and no credit requirement. We follow Hive's custom and credit every named author.
  - File: `TyrandeDismountedV2.mdx`, 5,181 polygons. The pack also holds `TyrandeDismountedAV2.mdx` (the same body with a team-colour cape), the mounted `TyrandeV2.mdx` and `TyrandeAV2.mdx`, two portraits and two arrow missiles, all unused.
  - Credit line: "Tyrande Whisperwind (Re-Classic) by johnwar (Hive Workshop), built on Ujimasa Hojo's Archer, Dark Ranger and Sylvanas models and kangyun's Tyrande, used with kangyun's permission."

#### Onyxia's two models (read 31 October 2026)

Tom chose both pages for Onyxia (2026-10-31). The live pages were read
through a plain Chrome on gex45's private desktop past Hive's Cloudflare
check; the Onyxia page matches the Wayback Machine's 25 June 2025 copy.

- **Onyxia**, https://www.hiveworkshop.com/threads/onyxia.348925/
  - Author: Symphoneum. Filed under Reforged HD Models; tagged Open Source;
    state Pending (not yet reviewed by staff). Created 6 May 2023, updated
    11 June 2023 ("Added a Lore Accurate version").
  - Source, in the author's words: "This model was made using WC3R assets
    from Sapphiron, Therifas, the Red Dragon, the Green Dragon, the Black
    Dragon, and the Snapdragon. Textures were reworked using GIMP." Warcraft
    III Reforged assets, no World of Warcraft files.
  - Conditions: "Please credit Symphoneum if you use this model in a
    project." No edit ban.
  - Files: the Lore Accurate `Onyxia.mdx` (21,208 polygons) and
    `Onyxia_portrait.mdx` (17,578 polygons), with ten DDS textures
    (diffuse, ORM and normal maps); flying animations only.
  - Credit line: "Onyxia by Symphoneum (Hive Workshop), built from Warcraft
    III Reforged models."
- **Lady Katrana Prestor (WOW Classic Version)**, https://www.hiveworkshop.com/threads/lady-katrana-prestor-wow-classic-version.375457/
  - Not used. The page is filed under "Ported Models", its author line is
    "ZugothNDeadly, Blizzard Entertainment", and its title names the World
    of Warcraft Classic version: a model ported from World of Warcraft's
    files, which smashcraft's clean-room rule forbids. State Pending,
    created 16 October 2026, `LadyKatranaPrestor.mdx`, 1,344 polygons.
  - Candidates read the same day for gate 145: Footman16's
    [Katrana Prestor](https://www.hiveworkshop.com/threads/katrana-prestor.362851/)
    (approved and recommended; an edit of AndrewOverload519's Female Human
    Mage and kangyun's Whitemane staff with both permissions posted; "if you
    decide to use this resource please give credits"; its one texture is
    "based on her texture from WoW as well as some freehand", and its icons
    are crops of Hearthstone art), and DSDK's
    [Lady Katrana Prestor](https://www.hiveworkshop.com/threads/lady-katrana-prestor.354279/)
    (awaiting update: the reviewer asked for proof of permission from Sxar,
    and a reply notes a WoW hair texture, `Hair01_00.blp`).

#### Prestor's model, decided (31 October 2026)

Tom chose Footman16's Katrana Prestor for Onyxia's human form after hearing that
its texture is "based on her texture from WoW as well as some freehand" (decision
relayed 31 October 2026, closing gate 145). He judged it not a World of Warcraft
port. Imported as the `imported-models` entries `KatranaPrestorHero.mdx` and
`KatranaPrestor.blp` (Version 800, 843 triangles, 16 geosets, team-colour and
team-glow layers, sequences Stand - 1, Stand - 2, Attack -1, Spell, Death,
Dissipate, Walk; zip sha256 `0cc3fd77ab0f924028e3d75026d1570bfc0e228913f4a4aade19aebf72d23b27`).
Credits: Footman16, AndrewOverload519 (Female Human Mage) and kangyun (staff).
The page's own terms line is "So if you decide to use this resource please give
credits." The icons and the portrait model are not imported.

### H1 intake (29 October 2026)

Both models were downloaded through a plain headful Chrome on gex45's private
desktop, because Hive's Cloudflare check rejected the automation-driven Chrome
even with a delivered click. They were published together as the
`imported-models` family, hash
`4b8aadf58e647b9c4d3c3e0591d2dad229f3dadebc861adbeed16aff3251a10a`, which adds
two files to the previous pin and changes none of its other files. The
lanes still register them in `IMPORTED_MODEL_FILES` and fetch the family to
other hosts with `bun wisp inputs fetch gex45`.

- `WarchiefThrallDismountedV2.mdx`, 199,216 bytes, sha256 `50255045638034e21314f85ce94d41d552c1a7f6ca3f6a74ba9a664d640f83b9`; textures `Units\Orc\Thrall\Thrall.blp` plus replaceable team colour and glow, and `Textures\RibbonBlur1.blp`; 19 geosets.
- Retera's Tyrande model, since replaced (below).
- The unused files in the Thrall bundle were not published.

### Tyrande Re-Classic intake (29 October 2026, #712)

The pack was downloaded the same way, through a plain headful Chrome on gex45's
private desktop past Hive's Cloudflare check. `TyrandeDismountedV2.mdx` from
johnwar's zip is 269,601 bytes, sha256
`e09008929cdf3dee57d81d5a5f9ed152c7a783b5a1611462dfffcfae9b04e4a3`. The
published copy, sha256
`c6efa436597655f8b54ee2db6b860471c16a6ab8abc2587c553ee150d9bde19c`, sets the
static alpha of four geoset animations that also carry an alpha track (0.4,
0.94, 0.4 and 0.95 on geosets 5, 8, 11 and 21) to 1.0, the value the pinned
`war3-model` codec writes, so the source round-trips losslessly as the clip
generators require. It replaces Retera's file in the `imported-models` family.

- Nodes: the same biped names as Retera's model (`Bone_Root`, `Bone_Pelvis`, `Bone_Chest`, `Bone_Head`, both arm chains, `Bone_Hand_L`, both leg chains and feet), the bow `Cylinder02` with its string and glow planes under `Bone_Hand_L`, no `Bone_Hand_R`, `Arrow` and `Arrow01`, attachment refs and one collision shape; 62 nodes.
- Sequences: Stand - 1, Stand - 2, Stand - 3, Stand - 5, Death, Attack - 1, Attack - 2, Spell, Walk, Dissipate, Stand Hit, Stand Victory, Stand Ready, then Portrait - 1, Portrait - 2, Portrait Talk - 1 and Portrait Talk - 2.
- Textures, each found in the Classic storage (build 24371) with the repo's CASC extractor: `PriestessOfTheMoon`, `Shandris`, `UndeadArthas`, `blue_glow2`, `HeroLich`, `CrystalSheild` (two paths), `AnyHandleCopperMetal`, `White_64_Foam1` and `Sentinel`, plus replaceable team colour and glow; 26 geosets.
- A headless check reads both from the store with the repo's `war3-model` parser and lists each file's sequences, nodes and textures (`parseMDX`, `Sequences` and `Nodes`).

Both credits go into roster.md's Credits section, README's Credits and the
Credits section of docs/hive-post.md in the same change that imports each model. The
models live in the private build-input store under `repo-safety`, never in
Git. They are published with `bun wisp inputs add FAMILY DIR` and registered
in ts/scripts/wisp/mapInputs.ts.

Download path: Hive needs a browser to pass Cloudflare, and the
`automation-chrome` private desktop waits on the capacity guard while Tom is
playing. So the download is its own small first task (H1 below). It runs when
the guard admits it and never on Tom's desktop.

## Shared rules for every new fighter

- Character codes are append-only and checksum-canonical (sim/codes.ts): Uther 27, Lady Vashj 28, Archimonde 29, Tyrande 30, Stitches 31. Codes 7 and 26 are deleted with their fighters and never reused. Every all-fighter loop iterates `Object.values(Character)`, and `STRIKE_SLOTS` sizes by the largest code, so a gap is safe.
- Each fighter is a `ts/src/game/fighters/<slug>/` directory (clips, gameplan, kit, look, moves, specials, strikeMoments), a rig file in tools/animations/rigs/, a `<slug>-clips.ts` clip producer, a home stage, a Classic route, a design doc `docs/design/<slug>.md` with its `balance-profile` and `ceiling-plan` blocks, and an ultimate row in ultimates.md. Per-fighter data stays in the fighter's own files (AGENTS.md).
- Motion is authored on the canonical humanoid rig (#366). Shared movement, defence, damage, ledge and grab-victim clips then reach every biped through its rig map. The work per fighter is its attack and special clips plus anything its body cannot share.
- Every move meets [the finished-move bar](finished-move.md): a visible effect, a body-driven motion, mirror symmetry, despawn, weapon in hand, stock idle and a cold-viewer read. Hit regions follow the drawn weapon under #508's `weapon-trace.ts`.
- Balance: each fighter's first farm probe (`bun wisp farm balance --wait`) records its archetype shares in its design doc against balance.md's 40-60% band. No move may exceed 40% of damage except a named signature.
- Native proof: an agent on a VM pair selects the fighter and plays every move under native capture (character-creation's done rule). Each capture round stays under five minutes until 0.1.0 ships.

## Uther the Lightbringer (replaces Forsaken Paladin)

**Personality:** heroic and stern, a paternal knight who lectures while he
hammers. Where Forsaken Paladin was a cursed sword holding holy ground, Uther
is the Silver Hand itself: unhurried, armoured and certain.

**Role:** all-rounder, the roster's first. He has a tool for every situation
and none of them is the best in its class: a short holy burst, an armoured
advance, an intangible bubble and a sound recovery. **Melee anchor:** Mario
for the kit's shape (one of everything, solid combos from up tilt and up
throw, a defensive special that answers a read), with a heavier, slower body
nearer Ganondorf's weight class (Melee weights: Mario 100, Ganondorf 109).
Provisional body: weight 106, run 80% of Mario's relation, one aerial jump.
Strengths: neutral flexibility and durability. Weaknesses: no long-range
pressure, and slow air drift that makes his recovery readable.

**Normals** (startup / active / recovery; damage; provisional):
- Jab 1, 2: hammer-haft check, then a gauntlet backhand (4/2/14; 3%, then 6/2/18; 5%).
- Forward tilt (three angles): a short hammer hook (8/3/20; 11%).
- Up tilt: an overhead hammer arc that starts juggles (7/5/20; 8%, 85°).
- Down tilt: a low hammer-head sweep that starts tech chases (7/3/18; 9%, 70°).
- Dash attack: a shoulder charge behind the hammer (10/5/26; 11%).
- Forward smash: the signature, a two-handed overhead hammer blow, strong at the head and weak at the haft (18/3/36; 18% / 12%).
- Up smash: a hammer upswing with a halo of light (15/5/32; 16%).
- Down smash: a hammer ring sweeping front then back (14/4/32; 14%).
- Neutral air: a hammer spin (7/6/22; 10%).
- Forward air: an overhead hammer chop that meteors only at its head on frames 16-17 (14/3/26; 13%).
- Back air: a reverse haft thrust (9/3/22; 12%).
- Up air: a hammer sweep over his head (8/4/22; 10%).
- Down air: a two-handed hammer plunge (16/4/30; 14%, spike on the clean hit).
- Get-up and ledge attacks: the shared rules with hammer sweeps.

**Grabs:** the shared standing, dash and shield-grab envelope with a
gauntlet clinch and one hammer-pommel pummel. Forward throw shoves the
victim off with a holy push (8%). Back throw is a hip toss (10%), his kill
throw. Up throw lifts them on a column of light and starts juggles (7%,
90°). Down throw slams them to the floor for a tech chase (6%).

**Specials** (every special is free):
- Neutral, **Holy Light:** a golden column bursts at a spot one body-width ahead on frame 16 (`HolyBoltSpecialArt`), 10% at 80°. A hit heals Uther 2%, capped at 6% per stock. 44 frames total, punishable on a whiff.
- Side, **Devotion Aura:** a golden ring (`DevotionAura`) as he steps forward with armour against hits up to 8% on frames 6-22, ending in a hammer bash (11%). Shield stops it; grabs and strong hits beat the armour.
- Up, **Hammer of the Righteous:** a rising two-handed hammer arc that climbs 2.4 body heights with light steering and hits 8% on frames 8-14. It spends the aerial jump and ends helpless.
- Down, **Divine Shield:** a golden bubble (`DivineShieldTarget`) makes him intangible to strikes and projectiles on frames 4-26. Grabs beat it, he cannot act inside it, and 24 frames of recovery follow. It is a read, not a reflector, since Tyrande owns the reflector.
- Ultimate, **Resurrection:** after a 24-frame telegraph, rings of golden light (`ResurrectTarget`) rise across 1.6 stage-body-widths on both sides, launching foes upward (26% total within ultimates.md's damage target), and Uther heals 10%. This is a tier-2 reading: Warcraft's Resurrection raises allies, so here the light raises him and throws the living up. It is distinct from Cairne's Reincarnation, which triggers on death. Shield or dodge the telegraph.

**Assets and animation:** the stock Uther model needs no import. Its rig maps
onto the canonical humanoid rig as Medivh's and Grom's do (pelvis, chest,
head, both arms, both legs, `Hammer` as weapon). Its stock sequences cover
only idle, walk, two attacks, a spell, channel and victory, so every attack
and special clip is authored; Mountain King's hammer arcs are the closest
shared starting motion. Forsaken Paladin's holy effects and ultimate code
(Light's Judgment) are the reference for Holy Light and Resurrection. Home
stage: Stratholme (6), because Uther refuses the Culling at the city's gates.
Classic route: Lordaeron's fall, ending at the Lich King.

**Size: 22-30 worker-hours,** including Forsaken Paladin's removal (3-4 h) in
the same change.

## Lady Vashj (replaces Kobold)

**Personality:** imperious and cold, a serpent queen who treats every
opponent as beneath notice and lets them exhaust themselves against her.

**Role:** zoner with meter as armour, slow on the ground and in the air.
Unlike Sylvanas, Jaina, Lich, Malfurion or Rifleman, she wins attrition rather
than spacing: her Mana Shield pays half of each hit from her ultimate meter, so she
outlasts pressure while her volleys and serpent wear the foe down. Up close
she is weak, and a foe who drains her meter finds a slow, wide target.
**Melee anchor:** Samus, the zoner that sits back with projectiles,
survives long, recovers far and is slow to get out of pressure (Melee weight
110). Provisional body: weight 104, slowest ground speed in the bottom
quarter of the roster, air speed at the shared floor. Her tail is part of her
hurt volume whenever it is extended.

**Normals** (provisional):
- Jab: a bow-limb check (5/2/16; 4%).
- Forward tilt (three angles): a tail lash, long and with a vulnerable tail (10/4/24; 10%).
- Up tilt: a head-snake strike over her (8/4/22; 8%, 85°).
- Down tilt: a low tail sweep that starts tech chases (8/3/20; 7%).
- Dash attack: a serpent slide (12/5/28; 11%).
- Forward smash: a water spear thrust (`CrushingWaveDamage` at its tip) (21/3/36; 18%).
- Up smash: the forked lightning crown, two arcs forking above her. This keeps Forked Lightning from Tom's first list (19/5/34; 16%).
- Down smash: a tail coil front then back (17/5/34; 14%).
- Neutral air: a coiled body turn (9/6/24; 9%).
- Forward air: a bow-limb slash (12/3/26; 11%), not an arrow.
- Back air: a tail kick, her kill aerial (11/4/26; 13%).
- Up air: a water crescent (8/4/22; 9%).
- Down air: a tail spear (16/4/30; 12%, spike on the clean hit), with no stall.

**Grabs:** a tail coil reaching 0.65 body heights, and a squeezing pummel.
Forward throw: the tail uncoils forward (8%). Back throw: a tail pivot toss
(9%). Up throw: a geyser toss that starts a juggle (7%). Down throw: a low
coil release for a tech chase (6%).

**Specials:**
- Neutral, **Multi-Shot:** three cold arrows (`NagaColdArrowMissile`) at 0° and ±12° on frame 18, 3% each. The centre arrow chills (ground acceleration −10% for 60 frames, reusing Lich's chill). Shields stop them, the arrows can be reflected, and only one volley may be in flight. 40 frames total. This keeps Frost Arrows from Tom's first list.
- Side, **Tidal Serpent:** a water serpent (`SerpentWardMissile` body) that travels 320 units. On a hit it deals 6%, drains 1.5% (108 frames) of the struck foe's ultimate meter, hands nothing back to Vashj, and bounces to the nearest other target within 300 units (another foe, a summon or a ward). It makes up to three bounces and loses 20% damage on each. In a duel, its last bounce turns back towards Vashj, and catching it gives nothing. Jump it or shield it; a whiff is a long recovery.
- Up, **Tidal Surge:** a water column (`CrushingWaveDamage`) lifts her 2.0 body heights with 0.3 of drift, hitting 7% on frames 12-18. It spends the aerial jump and ends helpless.
- Down, **Mana Shield** (`ManaShieldCaster`), a toggle: switching it on or off takes 12 frames. While it is on, each hit takes half its damage from her percent and pays the other half from her ultimate meter (1% of damage costs 72 frames, so one orb's half meter absorbs 50%), and knockback is computed from her real, lower percent. When the meter runs dry the shield breaks into a 20-frame stagger; with an empty meter it breaks on the first hit. Counterplay: grabs and throws bypass it, and a foe who strings hits until it breaks gets a free punish. Toggle state, meter and break timer are rollback state.
- Ultimate, **Gaze of Azshara:** her eyes and head snakes glow for 20 frames of telegraph, then a cone 600 units ahead and 300 tall checks every foe's facing on frames 21-60. A foe facing her is slowed by 40% for 40 frames, then petrified for 60 frames under a grey tint, using the shared frozen status (`status.frozenFrames`). A petrified foe takes hits but is not launched until it ends, and a 26% cap holds the payoff within ultimates.md's target. A foe facing away, dodging or outside the cone is untouched, so turning around is the counterplay. Assets: `CurseTarget` for the slow, plus the grey tint.

Tom's first list also named Tornado. Gaze of Azshara takes the ultimate
slot under the 28 October change, and Tornado is dropped.

**Assets and animation:** the stock model needs no import. This is the
roster's first legless body, so the canonical rig maps only her torso, head
and arms (as Anub'arak's rig leaves its legs unmapped). Her tail needs its own
authored layer for every clip: idle sway, slither walk, run and dash, jump
squat and landings, crouch, shield, rolls and dodges, ledge hang and climb,
knockdown and get-up, and the nine damage poses. Hit regions on the tail
follow the five tail bones. This is the largest animation job in the plan.
Home stage: Tomb of Sargeras (7), where her naga hold the Broken Isles in
TFT. Classic route: the Broken Isles and Illidan's bargain, ending at
Kil'jaeden.

**Size: 34-46 worker-hours,** including Kobold's removal and the candle
subsystem (4-5 h) in the same change.

## Archimonde the Defiler

**Personality:** menacing contempt. The tallest fighter in the roster, who
never chases: he marks the ground and waits for the foe to step into it.

**Role:** a superheavy zone-control punisher. He denies space with telegraphed
pillars and kills with huge disjointed claw strikes, but he has the worst
recovery and the largest hurt volume in the roster. That separates him from
Pit Lord, a siege heavy whose Rain of Fire closes a landing lane, and from
Thrall and Cairne. **Melee anchor:** Ganondorf, slow and heavy with
enormous punishes and a recovery that edge-guards punish (Melee weight 109).
Provisional body: weight 118, the tallest capsule, slow run, low air speed.

**Normals** (provisional):
- Jab 1, 2: a back-handed claw, then a fist (5/2/16; 4%, then 6/2/20; 6%).
- Forward tilt (three angles): a fel-clawed swipe with disjointed reach (9/3/22; 12%).
- Up tilt: a rising palm with fel fire (9/4/24; 10%).
- Down tilt: a tail sweep that starts tech chases (8/3/22; 9%).
- Dash attack: a shoulder drive (12/5/30; 12%).
- Forward smash: the signature, a two-armed fel slam whose weak hit is the forearm (22/3/40; 21% / 14%).
- Up smash: a fel eruption from both palms (19/5/36; 17%).
- Down smash: a ground claw rake on both sides (17/5/36; 15%).
- Neutral air: a cape whirl (9/6/26; 9%).
- Forward air: a downward claw arc (14/3/28; 13%).
- Back air: a tail lash, his strongest aerial (12/3/28; 15%).
- Up air: an overhead clap (9/4/24; 11%).
- Down air: a stomp with a meteor on the clean hit (16/4/30; 14%).

**Grabs:** a long-reaching claw grab, with recovery five frames longer than
the shared value. The pummel is a crushing grip. Forward throw: a fel blast
off the palm (9%). Back throw: a toss over the shoulder (11%), his kill
throw. Up throw: a hurl skyward (8%). Down throw: he crushes them into the
floor for a tech chase (7%).

**Specials:**
- Neutral, **Finger of Death:** on frame 1 he locks the foe's x and draws a ring there that heats from dark orange to white over the wind-up, with a violet glyph at its centre and a fel glow at his hand. On frame 32 a purple lightning column, 44 wide and 620 tall like its hit region, strikes it (the boss's Finger of Death, made fair): 16% at 70° with high growth, a ranged kill threat. Step off the ring; the whole action lasts 58 frames, punishable from close. This matches the Classic-mode boss (35/6/45), so players already know the counter.
- Side, **Rain of Fire:** two fire pillars are marked ahead, near and far, by a burning ring on the floor from the cast's first frame, and fall on frames 24 and 36 as a flame column (`FlameStrike`) stretched to the hit region's 88-wide, 1300-tall capsule. Each covers the full stage height at its x, 9%. These pillars deny air approaches, where Pit Lord's three rocks close a ground lane.
- Up, **Fel Ascent:** he rises on a column of fel fire (`DoomDeath`) 1.8 body heights with little steering. The column hits below him (7%, frames 10-20). It spends the aerial jump and ends helpless. This is the roster's shortest heavy recovery, his designed weakness.
- Down, **Bash:** a hammer-fist driven into the ground. He hits twice, on frames 16-18 and 24-26. The first hit holds a grounded foe within 90 units in the shared stun status for 30 frames (6%); the second launches them out of the hold at 45° (6%), and damage ends the stun and starts its 240-frame immunity, so the hold cannot chain. In the air the first fist is a downward meteor (6%) and the second launches (6%). 12% in all, 46 frames total. Shield it or jump it.
- Ultimate, **Rain of Chaos:** circles mark the foe's x and ±220 units for 40 frames, then three infernals (`InfernalBirth`) crash in sequence (26% total for a foe caught by all three). Unlike Dreadlord's Summon Inferno, nothing stays afterwards: the meteors crash and vanish. Dark Portal stays Medivh's.

**Assets and animation:** the stock model needs no import. A biped with tail
and cape: legs, arms, chest and head map onto the canonical rig, while the
tail and cape need their own secondary motion. His size makes body fit and
draw scale the first job (modelScale.ts, drawn-size.test.ts). Classic mode
keeps its boss Archimonde at 2.6×, a separate boss kind that does not
conflict, and the playable fighter's route ends at Kil'jaeden. Home stage:
Nordrassil (10), the Battle of Mount Hyjal.

**Size: 26-34 worker-hours.**

## Tyrande Whisperwind

**Personality:** fierce and devout. A priestess-general who darts in, looses
arrows at point-blank range and is gone before the reply.

**Role:** an aerial rushdown archer. Her arrows set up offence rather than
zone: fast, short-lived, low-hitstun shots that make the foe hold shield
while she closes. That separates her from the bow zoners, Sylvanas and now
Vashj. **Melee anchor:** Falco, a fast faller whose lasers push into
offence and who carries a reflector (Melee weight 80). Provisional body:
weight 84, fast fall, quick run, light body that dies early.

**Normals** (provisional):
- Jab 1, 2: a bow-limb strike, then a glaive cut (3/2/12; 3%, then 4/2/14; 4%).
- Forward tilt (three angles): a moonglaive slash (6/3/18; 9%).
- Up tilt: an overhead bow arc (5/4/16; 7%).
- Down tilt: a low spin kick that starts tech chases (6/3/16; 8%).
- Dash attack: a flying knee (7/5/22; 9%).
- Forward smash: a moonlight-charged glaive thrust (14/3/32; 16%).
- Up smash: a bow swept overhead (12/4/30; 14%).
- Down smash: a split kick front and back (11/4/30; 13%).
- Neutral air: a spinning kick (4/8/18; 10% / 6%).
- Forward air: a multi-hit glaive flurry (6/12/22; 4 × 2.5%).
- Back air: a back kick (5/4/18; 13%).
- Up air: a bow flip (6/4/18; 10%).
- Down air: a stomp that spikes on the clean hit (8/4/24; 12%).

**Grabs:** quick and short-ranged, with a knee pummel. Forward throw: a kick
away (6%). Back throw: a spin toss (9%). Up throw: an arrow fired up into
them (5% + 3%). Down throw: a floor plant for a tech chase (5%).

**Specials:**
- Neutral, **Searing Arrows:** a fast flaming arrow (`SearingArrowMissile`), 3% with low hitstun and a 22-frame life, also fired in the air without stalling. Shield and reflectors answer it.
- Side, **Trueshot Aura:** a 14-frame moonlit stance (`TrueshotAura`) that empowers her next three Searing Arrows within 300 frames: each pierces one target and deals 6%. The stance is the cost, and a foe who reads it gets a free hit.
- Up, **Moonlight Leap:** a star-trailed leap (`MoonWellCasterArt`) of 2.2 body heights with wide steering and a light hit (5%). It spends the aerial jump and ends helpless.
- Down, **Elune's Grace:** the roster's reflector. A silver shimmer reflects projectiles on frames 4-12, and its frame-4 hit (2%) pushes a close foe. It can be jump-cancelled from frame 4, as Fox's and Falco's reflectors can, but a 24-frame cooldown keeps it from being chained. Illidan's Immolate is a jump-cancellable hit, not a reflector.
- Ultimate, **Starfall:** after a 20-frame channel, stars (`StarfallTarget`) fall on evenly spaced lanes across her side of the stage for 90 frames, 26% total for a foe who stays in. Each lane is marked before it falls. This is the Priestess of the Moon's tier-1 ultimate.

**Assets and animation:** the Hive model's 287 polygons use stock textures.
On download we read its bones and sequences. If its bones are biped-named, it
maps onto the canonical rig like any stock biped; if they are unnamed, the
mapping is by hand as for Stitches (+3-4 h). It has no portrait, so its
HUD and select bust come from the fighter-portrait pipeline
(ts/scripts/fighterPortraits.ts) rendering the model itself, and its command
icon is `BTNPriestessOfTheMoon`. Home stage: Nordrassil (10), Hyjal's
defence. Classic route: the Night Elf campaign, ending at Archimonde.

**Size: 26-36 worker-hours,** including the download and input publish (H1).

## Stitches

**Name (decided 29 October 2026):** Stitches everywhere, with the code
slug `butcher`. The alternative was "Pudge", the DotA hero's name, which
Valve's Dota trademarks cover. Tom's gate took the recommended default, so
no Valve name appears in the map or on the Hive page, and the hook, the rot
cloud and the stock Abomination body still make him recognisable.

**Personality:** gleeful and grotesque. A stitched abomination that laughs as
he reels the foe in, and smells it.

**Role:** a heavy grappler built around a reel-in command grab. Peon and
Dreadlord grapple at close range; Stitches grapples at range, so every
hook he misses is a long, punishable whiff, and he is the easiest fighter in
the roster to combo. **Melee anchor:** Donkey Kong, a heavy grappler with a
huge body and strong throws who is combo food (Melee weight 114).
Provisional body: weight 120, slow run, the roster's widest capsule.

**Normals** (provisional):
- Jab 1, 2: a cleaver poke, then a belly bump (5/2/16; 4%, then 7/3/20; 7%).
- Forward tilt (three angles): a cleaver chop (9/3/22; 12%).
- Up tilt: an overhead hook swing (9/4/24; 10%).
- Down tilt: a low chain sweep that starts tech chases (8/3/22; 9%).
- Dash attack: a belly flop (12/5/32; 12%).
- Forward smash: the signature, a two-handed cleaver chop, strong at the blade and weak at the handle (20/3/38; 20% / 13%).
- Up smash: the hook flung upward on its chain (17/5/34; 16%).
- Down smash: a ground cleave on both sides (16/5/34; 15%).
- Neutral air: a gut spin (9/6/26; 10%).
- Forward air: a cleaver arc (14/3/28; 13%).
- Back air: a back bump (10/4/24; 13%).
- Up air: the hook swung overhead (9/4/24; 10%).
- Down air: a seat drop that meteors on the clean hit (16/4/32; 14%).

**Grabs:** the hook and chain grab, with the longest standing reach. The
pummel is a gnaw (3%). Forward throw: he hurls them off the hook (9%). Back
throw: he swings them on the chain behind him (12%), his kill throw. Up
throw: a hook toss (8%). Down throw: he sits on them (7%), for a tech chase.
He also carries a grabbed foe: walking with the victim held, as DK's cargo
does, ends in a forward or back throw. The shared rule against
input-insensitive loops applies, so the carry keeps the shared mash escape
and a 60-frame cap.

**Specials:**
- Neutral, **Meat Hook:** on frame 14 he flings the hook (`MeatwagonMissile` head, with a chain-lightning line along the chain bones) 420 units straight ahead over 16 frames. A hit latches and reels the foe to him in 14 frames into his grab hold, where any throw follows. The hook is a projectile command grab: shields stop it, it can be reflected, and a whiff leaves 40 frames of recovery. The latch, reel and grab states are rollback state.
- Side, **Stitches' Charge:** a belly-led rush with armour on frames 8-20 against hits up to 5% plus 1% per Flesh Heap stack, ending in a bump (11%). Shield stops it.
- Up, **Hook Swing:** the hook flies diagonally upward. If it touches a ledge in its first 20 frames, it tethers and reels him to the ledge into ledge hang. Otherwise it is a short rise with a hit (6%) that ends helpless. The ledge tether is new in the engine: a sim/ledge.ts state, rollback-snapshotted, with bot recovery support in match/botRecovery.ts.
- Down, **Rot**, a toggle with a 10-frame switch: a poison cloud (`PlagueCloudCaster`) around him hurts foes within 90 units 1% every 10 frames and slows their ground speed by 15%, and it costs him 1% every 20 frames. The toggle's on state is rollback state. Counterplay: keep out of the cloud, since he bleeds while it runs. On 2026-10-31 Tom asked for it to leave a lingering trail: patches dropped while he moves on the ground burn and slow foes for 150 frames (butcher.md).
- Passive, **Flesh Heap:** each KO he scores and each throw he lands adds a stack, up to 5. Each stack adds 3% weight and armour to Stitches' Charge. He loses every stack on losing a stock. The stack count is rollback state and shows as a growing stack of gore on his HUD plate.
- Ultimate, **Dismember:** after a 20-frame cleaver raise, a lunge grabs a foe in front of him. Unlike an ordinary grab, it can be shielded and dodged on its startup frames, as ultimates.md requires. On a catch he channels for 90 frames, dealing 4% every 15 frames (24%) and healing himself the same amount, with the foe pinned and no mash escape. A whiff leaves him open for 50 frames.

**Assets and animation:** the stock Abomination needs no import. Its arms,
cleaver and hook sit on unnamed nodes, so the first job is identifying which
`Mesh*` and `Object*` node drives each limb and recording the map in
tools/animations/rigs/butcher.ts (+3-4 h over a named rig). Its stock
attacks are slow, heavy swings worth reading as references. Home stage:
Naxxramas (4), the Scourge's abomination workshop. Classic route: the
Scourge of Lordaeron, ending at the Lich King.

**Size: 34-46 worker-hours.** Five new mechanics drive the size: the
projectile command grab, the ledge tether, the Rot toggle, Flesh Heap stacks
and the channelled ultimate.

## Thrall: the dismounted Warchief

Thrall keeps his kit, his frame data and his role (heavy ground-control
brawler, King Dedede body anchor, weight 127). He changes from a rider on a
wolf to a standing orc with Doomhammer, and every clip is reauthored on the
new body.

**What changes:**
- **Rig.** Today's rig (tools/animations/rigs/thrall.ts) maps only the rider's waist, chest, head and arms; the wolf carries everything below. The new model is built on a Grom Hellscream base, so it should map onto the full canonical humanoid rig, legs included, as Grom's does. The shared movement, defence, damage, ledge and grab-victim clips then reach him through the rig with no Thrall-specific work.
- **Clip retargeting.** The 60-plus Thrall clips in tools/animations/thrall-clips.ts were authored for a seated rider. The upper-body hammer arcs (shoulder, elbow, wrist and `Hammer` keys) carry onto the same canonical joints as a starting point. Legs, pelvis travel and weight shift are new for every attack. The wolf's legs, tail and head disappear from every clip.
- **Moves that keep frame data and gesture:** jab 1 and 2, forward tilt (three angles), up tilt, forward smash (strong and weak split), up smash, neutral, forward and up air, the grab, pummel and four throws, all four specials (the Feral Spirit wolves are summoned spirits, not his mount) and Earthquake.
- **Moves that keep frame data with a new gesture,** because the wolf drew them:
  - Down tilt: the wolf's paw swipe becomes a low Doomhammer sweep at the same 6/3/19, 9.75%.
  - Dash attack: the wolf's shoulder becomes Thrall's own running shoulder charge at 11/4/25, 13.75%, with the 65-unit travel kept.
  - Down smash: the wolf's front and back swipes become a hammer swept front then back at 14/6/30, 16.25%.
  - Back air: the hind-leg kick becomes Thrall's own back kick on frames 8-10 (6%, set knockback) and the reverse hammer hook stays on frames 17-19.
  - Down air: the wolf's paw press becomes a Doomhammer driven straight down at 14/4/28, keeping the meteor.
- **Hit regions.** All of them are re-authored to follow the new hammer and limbs: a standing Thrall's hammer sits lower and closer than the rider's, whose measured bounds were x33-54 / z49-96 for jab. #508's weapon trace (`bun tools/animations/weapon-trace.ts --fighter thrall`) must pass again, as it did for #592. The paw regions become limb or hammer regions, with matching hurt volumes on the kicking leg.
- **Body.** The mounted silhouette was 1.25× the reference width and 1.15× its height. The hurt capsule is refit to the standing model's drawn bounds (drawn-size.test.ts), and dash attack's shoulder and head capsule is refit to the new body.
- **Docs.** thrall.md's Presentation section names the Hive model and its credits, and the Far Seer-on-wolf text goes.

**Size: 16-24 worker-hours,** after H1 publishes the model.

## Removing Forsaken Paladin and Kobold

Each removal lands in the same change as its replacement (Forsaken Paladin
with Uther, Kobold with Lady Vashj). The roster therefore never drops below
its current size, and no change lands a half-removed fighter. A sweep of the
tree on 28 October 2026 found 259 files naming either fighter or the candle.
`rg -li 'forsaken.?paladin|forsakenPaladin|kobold|candle' ts tools docs records structure.toml`
must return only historical design docs and the plan itself when the removal
is done.

| Area | What names them | How to remove it |
| --- | --- | --- |
| Fighter sources | ts/src/game/fighters/forsaken-paladin/ (9 files, sword and weapon geometry), ts/src/game/fighters/kobold/ (12 files, the candle) | Delete both directories. |
| Identity | sim/codes.ts `forsakenPaladin: 7`, `kobold: 26`, `CandleState`; sim/identityTraits.ts; sim/heroes/heroBodies.ts; roster/kits.ts and looks.ts | Delete the rows. Codes 7 and 26 are never reused. |
| Candle subsystem (Kobold only) | sim/itemBuffs.ts `CANDLE_BARE_SPEED`, `candleBareSpeed` in sim/groundMovement.ts, sim/fighterRest.ts, sim/contacts.ts, sim/stocks.ts, sim/state/fighterSchema.ts (24 candle rows), match/botCandle.ts, render/candlePresentation.ts, presentation/candleLook.ts, tools/effects/candle.ts and its generated candleAssetInfo.ts | Delete the candle files and the schema rows, then regenerate fighterState and fighterDifference through ts/codegen. Ground speed drops the candle factor. |
| Sim and engine | sim/specials/engine.ts, sim/ultimates.ts (Light's Judgment, You No Take Candle!), sim/strongHitTable.ts, sim/specialMomentum.tests.ts, match/orbs.tests.ts, match/step.ts | Remove each fighter's rows and cases. Light's Judgment becomes the reference for Uther's Resurrection. |
| Bots | match/botMoves.ts, match/botPerception.ts, match/botCandle.ts, match/edgeGuardScenarios.ts | Remove the fighter cases; the new fighters' gameplans take their place. |
| Selection and menus | ui/selectionFrames.ts, host/loop/ui.ts, menu/homeStages.ts, classic/routes.ts, classic/loreBattles.ts, session/fighterSetup.ts, session/trailerShots.ts | Replace each with the new fighter's row, in the same slot when the select grid keeps its order. |
| Presentation | fighterClips, fighterPose, fighterViewBounds, heroStrikeMomentInfo, hurtVoice, matchAudio, modelScale, moveSounds, moveTiers, specialCues, disjointCues, drawnStrideInfo, render/projectilePresentation | Remove the rows. |
| Generated | ts/src/generated/clips/{forsaken-paladin,kobold}.ts, fighter-art/, white-models/, white-facts/, whiteFighterModels.ts, whiteModelFacts.ts, fighterArtData.ts, fighterOriginalClipInfo.ts, stockSoundInfo.ts, state/ | Regenerate each through its producer (`smashcraft-tools build-animation-assets`, the codegen). Generated files are never hand-edited. |
| Animation tools | tools/animations/forsaken-paladin-clips.ts, forsaken-paladin-weapon-clips.ts, stock-forsaken-model.ts, kobold-clips.ts, rigs/{forsakenpaladin,kobold}.ts and rigs/index.ts, plus rows in grab-clips, jump-clips, murloc-clips, pain-captures, pain-pads, recovery-clips and victory-clips | Delete the per-fighter files and remove the rows. |
| Host scripts | ts/scripts/wisp/koboldDirectionChecks.ts, acceptanceTapes, acceptChecks, commands/{anim,combos,view}.ts, cueBudget, drawnMotionInfo, drawnReachInfo, effectVisibility, showcaseChecks, specialStripChecks, teamResultsCheck, cue-models.tsv, aerialDownSpecials, cameraFeel, fighterPortraits, portraitParts, throwParity, throwRoleObjectives, and 6 model-facts JSON files | Delete the Kobold check and the model facts; remove the rows elsewhere. |
| Balance census | ts/scripts/balanceBaseline.json (both fighters), ts/test/fixtures/census/census-pairs.txt (both pairs), tools/move-data/ (advantage state, combo potential and objectives, fighter strengths, radius exceptions, throw parity, anim-score judge) | Regenerate with the new fighter in the same change: the farm baseline through `bun wisp farm balance --wait`, the census pairs through their census run, and the move-data reports through Autoland's report regeneration. |
| Tests and fixtures | ts/test/cost-baseline.tsv, ts/test/fixtures/{stock-sound-labels.txt,victory-anatomy.json}, ts/test/corpus/2026-10-08…/session.json, records/lua-cost/ (3 test-cost records), ts/map-size-baseline.tsv (Forsaken Paladin 3.1 MB, Kobold 0.8 MB of imports) | Regenerate each through its producer (`MAP_SIZE_UPDATE=1` for the map size). Drop the corpus session if it replays a removed fighter. |
| Capture pads | 77 pads under ts/test/native/pads/ (151, 163, 171, 180, 181, 207, 448, c1, the CPU-roster pad, cues pads, issue-189 and issue-191 pads, trailer promos), plus captures/hive-screens/{blackrock,stratholme}.pad | Delete the removed fighter's own pads. Re-record the shared ones (issue-189's Medivh vs Kobold, issue-191's Jaina into Forsaken Paladin, the trailer and Hive-screen pads) with the replacement fighter in the same slot, so the scenario survives. |
| Structure and docs | structure.toml (4 rows), docs/design/forsaken-paladin.md, roster.md's Kobold section and frozen note, 30 other design docs, docs/heroes.md, player-guide.md, hive-post.md, physics.md, move-data.md and the rest of the docs the sweep lists | Delete forsaken-paladin.md and roster.md's Kobold section. Replace the roster tables' rows with the new fighter's. Leave dated historical records (kit reviews, playtest notes) as they are. |

Freeze: south's agents/frozen-topics.toml lists Kobold and Forsaken Paladin
("likely being replaced"). Only Tom's word removes a topic. The entries should
come out when Uther (for Forsaken Paladin) and Lady Vashj (for Kobold) land,
and each of those issues carries a box asking for it. The guard matches issue
titles only, so the new issues keep both names out of their titles.

## Order, parallelism and the critical path

Tasks:
- **H1, Hive inputs (1-2 h):** download both Hive models through the private browser once the capacity guard admits it, read their bones and sequences, and publish them with `bun wisp inputs add`. Thrall and Tyrande cannot start their clips before it.
- **Six fighter lanes:** Uther with Forsaken Paladin's removal, Lady Vashj with Kobold's removal, Archimonde, Tyrande, Stitches and Thrall. They are independent of each other. All of them append rows to the same registries (sim/codes.ts, rigs/index.ts, roster/kits.ts and looks.ts, homeStages.ts) and regenerate shared files, so each lane rebases onto main before landing, and Autoland regenerates the generated files (#613).
- **I1, roster integration (3-5 h, after the last lane):** one farm balance pass across all 29 fighters, the census and map-size baselines, the 26-to-29 text in AGENTS.md and roster.md, the Hive page's roster and credits, and one native round over the six changed fighters, each run under five minutes.

Animation needs the private build inputs and native checks need the VM pool,
so every fighter lane runs as a local worker on accounts a, b and c, not in
the cloud lane. Three lanes run at a time, in two waves. The longest lanes go
first, so the second wave is shorter:

- Account a: Lady Vashj (34-46) then Thrall (16-24): 50-70 h.
- Account b: Stitches (34-46) then Uther (22-30): 56-76 h.
- Account c: Archimonde (26-34) then Tyrande (26-36): 52-70 h.

H1 runs as a side task inside the first wave, so Thrall and Tyrande find their
models ready.

**Total size: 158-216 worker-hours** (about 187 at the midpoints) across the
six fighters, plus 4-7 h for H1 and I1.

**Critical path:** Stitches (34-46 h), then Uther
(22-30 h) on the same account, then roster integration (3-5 h): about
60-80 worker-hours end to end. With one lane per account in each wave, the
other two accounts finish inside that span. Uther moves to the front of
account b if Forsaken Paladin must leave the select screen sooner.

Why these sizes: each recent fighter's first playable pass took one agent
one to three hours (Kobold's kit and sim landed between 1:47 and
2:55 on 9 October, per its commits). Every fighter then took 11-24 commits
of its own animation work over the next three weeks to reach the
finished-move bar under native capture (by commit count against
`tools/animations/<fighter>-clips.ts`). The ranges above cost that whole
path, not the first playable.
