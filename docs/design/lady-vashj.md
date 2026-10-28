# Lady Vashj: the Serpent Queen

Lady Vashj wins attrition rather than spacing. Her Mana Shield pays half
of each hit from her ultimate meter, so she outlasts pressure while cold
arrows and a bouncing water serpent wear the foe down. Up close she is slow
and wide, and a foe who drains her meter finds an easy target. She replaces Kobold in code
28 (Tom asked, 2026-10-28; plan in [roster-next.md](roster-next.md#lady-vashj-replaces-kobold)).

Numbers are provisional Smashcraft tuning. Frames count entry as frame 1 with
inclusive active windows. H is the shared 132-unit design height.

## Research and body

[Blizzard's Sea Witch](https://classic.battle.net/war3/naga/units/seawitch.shtml)
and [Liquipedia's Naga Sea Witch](https://liquipedia.net/warcraft/Naga_Sea_Witch)
give Forked Lightning, Frost Arrows, Mana Shield and Tornado. Forked Lightning
becomes her up smash, Frost Arrows her Multi-Shot's chill, Mana Shield her
down special; Tornado is dropped for Gaze of Azshara.

The physical counterpart is [Melee Samus](https://www.ssbwiki.com/Samus_(SSBM)):
a zoner that sits back with projectiles, survives long and is slow out of
pressure (Melee weight 110). Hero body multipliers are 104/75 weight, run 0.70
(bottom quarter of the roster), air 0.75 (the shared floor), width 0.95 and
height 1.15 (about 152 units). She is the roster's first legless body: her
tail joins the hurt volume on every tail move.

## Normals and throws

| Action | First/active/total; landing | Damage, launch and reach |
| --- | --- | --- |
| Jab 1 / 2 | 5/2/16, 6/3/24 | 4/5; 30°/35°; bow limb to 94/100 |
| Forward tilt, level/up/down | 10/4/24 | 10; 35°/55°/25°; tail lash to 132, tail hittable |
| Up tilt | 8/4/22 | 8; 85°; head snakes to 176 |
| Down tilt | 8/3/20 | 7; 80°; low tail sweep to 126, starts tech chases |
| Dash attack | 12/5/28 | 11; 45°; serpent slide to 104 |
| Forward smash | 21/3/36 | 18 at the tip, inner hit weaker; 35°; water spear to 150 |
| Up smash | 19/5/34 | 16 each; 90°; two forked arcs to 214 |
| Down smash | 17/5/34 | 14; 25°; tail coil front, then back |
| Neutral air | 9/6/24; 14 | 9; 45°; coiled body turn |
| Forward air | 12/3/26; 15 | 11; 40°; bow-limb slash |
| Back air | 11/4/26; 15 | 13; 35° backward; tail kick, her kill aerial |
| Up air | 8/4/22; 13 | 9; 90°; water crescent |
| Down air | 16/4/30; 20 | 12; spike on the clean hit, 70° on the ground; no stall |
| Grab | 8/2/31 | tail coil to 0.65 of her height (99) |
| Pummel / throws | shared contact | 2; forward 8 (35°), back 9 (40° backward), up 7 (90°, starts a juggle), down 6 (70°, set knockback 80) |

## Specials and ultimate

| Input | Contract and counterplay |
| --- | --- |
| Neutral: **Multi-Shot** | Three cold arrows (`NagaColdArrowMissile`) at 0° and ±12° on frame 18 of 40, 3% each, speed 20, life 30. The centre arrow chills (the shared chill, 60 frames; the plan's −10% acceleration is the shared 40% speed slow instead). Shields stop them and they reflect. One volley in flight; the volley counts as two of the three hero-projectile slots, so the serpent can fly beside it. |
| Side: **Tidal Serpent** | A water serpent (`SerpentWardMissile`) on frame 16 of 52, speed 12, 27 frames (about 320 units). A body hit deals 6%, drains 108 frames (1.5%) of the struck foe's ultimate meter, hands nothing back to her, and bounces to the nearest other foe within 300 units, up to three bounces at 80% damage each. With no other foe it turns back to her, and catching it gives nothing. Shields stop it without a drain; it does not reflect. Summons and wards are not bounce targets yet. |
| Up: **Tidal Surge** | A water column lifts her 2.0H over frames 10-33 with 0.3H of drift, hitting 7% at 80° on frames 12-18. Once per airtime, ends helpless; helpless fall leaves no aerial jump. |
| Down: **Mana Shield** | A toggle that switches on frame 6 of 12. While it is on, each hit except throws and pummels takes half its damage from her percent and pays the other half from her ultimate meter at 72 frames per 1% (one orb's half meter absorbs 50%); knockback uses her real, lower percent. When the meter runs dry the shield breaks into a 20-frame stagger; with an empty meter it breaks on the first hit. Toggle, meter and stagger are rollback state. |
| Ultimate: **Gaze of Azshara** | 20 frames of telegraph (`CurseTarget` over her head), then frames 21-60 check a cone 600 ahead that widens to 300 tall. A foe in the cone facing her, not intangible and not already frozen, is slowed by 40% for 40 frames, then petrified for 60 frames under a grey tint using the shared frozen status. A petrified foe takes hits without thawing or launching, and at most 26% in total. Turning away is the counterplay. |

## Roster role and presentation

Sylvanas, Jaina, Lich, Malfurion and Rifleman win by spacing. Vashj wins
by attrition: her arrows chill, orb meter funds her shield, her serpent drains the foe's meter, and
she stays out of reach while the shield holds. Grabs bypass the shield, and a
foe who strings hits until it breaks gets a free punish.

The stock Classic model needs no import. Her canonical rig maps torso, head
and arms; the tail is an authored layer on every clip
(tools/animations/lady-vashj-clips.ts). Home stage: Tomb of Sargeras.

## Play-style profile

Tom-tunable draft (2026-10-28; balance.md, "Play-style profiles").

```balance-profile
fighter: lady-vashj
archetype: zoner
aerials: nair 10-35, fair 10-35, bair 15-45, uair 5-30, dair 0-25
air-share: 15-45
approach: 20-50
ranged: 30-70
specials: neutral 8-30, side 5-25, up 0-8, down 0-10
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: lady-vashj
path: mixed
basic-moves: neutral-special,forward-tilt,back-air
```

Basic gameplan: Shoot volleys from range and lash with the tail when a foe closes. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Spend orb meter for safety with Mana Shield, drain the foe's meter with the serpent, and petrify a foe who rushes in facing her. Use the full authored kit and gameplan at the same CPU skill.

## Signature strong/weak move (#389)

Forward smash, split by position: the wave breaks at the water spear's tip
(18%); the shaft only pushes, so she kills at full reach.

## Measured balance (2026-10-28)

The first balance field (wren expert, 400 matches a pair, probe of the landed
kit, GitHub run 40760239779) puts her at **15% wins**, outside the 40-60% band.
Against the profile above:

- archetype zoner; air share of normals 19% (band 15-45)
- aerials n/f/b/u/d 25/23/32/7/13% (all inside their bands)
- approach share of movement 73% (band 20-50: the bot walks in instead of zoning)
- ranged share of damage 7% (band 30-70)
- specials n/s/u/d 21/14/11/0% of moves (up special over its 0-8 band; Mana Shield never used)

Half of her stock losses (52%) come with no hit landed. Her kills come from
forward smash (41%) and back air (26%). The next pass makes the gameplan keep
range, makes arrows and the serpent carry ranged damage, and gets the bot to
use Mana Shield.
