# Lady Vashj: the Serpent Queen

Lady Vashj wins attrition rather than spacing. Her Mana Shield pays half
of each hit from her ultimate meter, so she outlasts pressure while cold
arrows and a bouncing water serpent wear the foe down. Up close she is slow
and wide, and a foe who drains her meter finds an easy target. She replaces Kobold in code
28 (Tom asked, 2026-10-28; plan in [roster-next.md](roster-next.md#lady-vashj-replaces-kobold)).

Numbers are provisional Smashcraft tuning. Frames count entry as frame 1 with
inclusive active windows. H is the shared 132-unit design height.
Every damage value below is authored; her live hits deal 1.2 times it with
0.92 times its knockback growth (the balance pass of 2026-10-29, below).

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
| Neutral: **Multi-Shot** | Three cold arrows (`NagaColdArrowMissile`) at 0° and ±12° on frame 18 of 40, 4% each, speed 20, life 30. The centre arrow chills (the shared chill, 60 frames; the plan's −10% acceleration is the shared 40% speed slow instead). Shields stop them and they reflect. One volley in flight; the volley counts as two of the three hero-projectile slots, so the serpent can fly beside it. |
| Side: **Tidal Serpent** | A water serpent (`SerpentWardMissile`) on frame 16 of 52, speed 12, 27 frames (about 320 units). A body hit deals 8%, drains 108 frames (1.5%) of the struck foe's ultimate meter, hands nothing back to her, and bounces to the nearest other foe within 300 units, up to three bounces at 80% damage each. With no other foe it turns back to her, and catching it gives nothing. Shields stop it without a drain; it does not reflect. Summons and wards are not bounce targets yet. |
| Up: **Tidal Surge** | A water column lifts her 2.6H over frames 10-33 with 1.5H of drift, hitting 7% at 80° on frames 12-18. Once per airtime, ends helpless; helpless fall leaves no aerial jump. |
| Down: **Mana Shield** | A toggle that switches on frame 6 of 12. While it is on, each hit except throws and pummels takes half its damage from her percent and pays the other half from her ultimate meter at 72 frames per 1% (one orb's half meter absorbs 50%); knockback uses her real, lower percent. When the meter runs dry the shield breaks into a 20-frame stagger; with an empty meter it breaks on the first hit. Toggle, meter and stagger are rollback state. She casts it in her stock Spell pose; the stock Mana Shield bubble shows for as long as it is on, and a break bursts it with Dispel Magic (on, off and break each have their own stock sound). |
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

## Balance pass (2026-10-29)

Each run below is the Balance workflow's field (Wren Expert, 400 matches a
pair) over her 25 matchups only (`--matchups`), so it is a repair comparison,
not the full-roster gate. Shares are of her own play; approach in the farm
rows still counts recovering, the later rows count it only over the stage.

| Run | Change | Wins | Approach | Ranged | Specials n/s/u/d |
| --- | --- | ---: | ---: | ---: | --- |
| [40805783142](https://github.com/tompassarelli/smashcraft/actions/runs/40805783142) | main at f44e1e2, before the pass | 17% | 73% | 7% | 21/14/11/0% |
| [40807089726](https://github.com/tompassarelli/smashcraft/actions/runs/40807089726) | gameplan keeps range, ranged share fixed | 17% | 67% | 39% | 22/12/10/0% |
| [40809474573](https://github.com/tompassarelli/smashcraft/actions/runs/40809474573) | V1: Tidal Surge 2.6H rise, 1.5H drift | 28% | 65% | 39% | 22/12/11/0% |
| [40809535231](https://github.com/tompassarelli/smashcraft/actions/runs/40809535231) | V1, every hit ×1.15 damage, ×0.94 growth | 38% | 66% | 39% | 22/12/11/0% |
| [40809536985](https://github.com/tompassarelli/smashcraft/actions/runs/40809536985) | V1, arrows 4%, serpent 8% | 35% | 66% | 46% | 22/13/11/0% |
| local, 48 a pair | V1, arrows 4%, serpent 8%, every hit ×1.2 damage, ×0.92 growth | 54% | 57% | 46% | 22/13/11/0% |
| local, 48 a pair, `--orbs` | the same, ultimate orbs on | 62% | 57% | 48% | 23/13/10/2% |
| [40818616523](https://github.com/tompassarelli/smashcraft/actions/runs/40818616523) | the landed pass, 086b48e | 50% | 57% | 46% | 22/13/11/0% |

On the landed run (archetype zoner): air share of normals 7% (band 15-45),
aerials n/f/b/u/d 22/20/37/12/8% (all inside their bands), approach 57%
(band 20-50), ranged 46% (band 30-70), and
specials n/s/u/d 22/13/11/0% (up special over its 0-8 band; Mana Shield needs
orbs). Her kills come from forward smash (47%), dash attack (14%) and back air
(11%).

What changed:

- **Gameplan.** She shoots from 220-540 units instead of 140-320, drops the
  run-in and jump-in approaches (the only plans that closed on the foe), picks retreat
  more often on defense, and avoids being under a foe and the ledge. When
  every special in reach was used recently she holds her spacing (`whenStale:
  "hold"`) instead of walking in, the shared rule that closed the gap for her.
- **Mana Shield.** Her computer raises it from 200 units or more once its meter
  holds a quarter (enough to absorb 25%), and drops it below 5% so it never
  breaks into the stagger on an empty meter. The field plays with orbs off, so
  it stays at 0% there; with `--orbs` it is 2% of her moves, and her wins
  rise to 62%, because orbs also charge Gaze and fund the shield.
- **Recovery.** Tidal Surge rose 2.0H with 0.3H of drift, the roster's weakest
  return (Sylvanas 2.6H/2.6H, Thrall 3.1H/1.5H); 56% of her stocks were lost
  more than 3 s after a hit, mostly offstage. It now rises 2.6H with 1.5H of
  drift, and that share fell to 32%.
- **Kit numbers.** Multi-Shot's arrows deal 4% (from 3%) and Tidal Serpent 8%
  (from 6%), and every hit she lands deals 1.2 times its authored damage with
  0.92 times its growth, the roster retune's method (balance.md, #414).
- **Measurement.** The ranged share now counts a projectile hit that lands
  while its special is still playing (Multi-Shot's arrows land inside its 40
  frames, so they used to count as body hits), and approach counts only while a
  fighter is over the main stage, so recovering is not approaching
  (balance.md, "Play style").

Approach stays above her 20-50 band: on the stage she still moves toward the
foe about 55-60% of the time, from the shared computer's air drift and its rule
of walking under a foe on a platform.
