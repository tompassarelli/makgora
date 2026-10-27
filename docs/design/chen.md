# Chen Stormstout

Chen is a close-range drunken brawler: a broad body, short hand checks, a
staff for commitments, and a flask that makes a fire approach dangerous.
His first draft uses **Ultimate Ryu's weight 103, run speed 1.6 and air speed
1.12** ([SmashWiki](https://www.ssbwiki.com/Ryu_%28SSBU%29#Stats)).
The engine converts run and air units through `melee`; body multipliers are
103/75, 1.6/2.2 and 1.12. His original silhouette is 1.18 wide and 1.04 tall.
Jump, gravity, dodge and ledge rules remain the roster's common rules.

## Aerials and movement (rework, 2026-10-28)

Tom's rework direction (2026-10-28) is drunken boxing with a Captain Falcon
influence: honest startup, hits that land hard, and fast ground movement so
he can carry a juggle once he starts one. Falcon's public attributes
(references/melee-frame-data/character-attributes.csv: dash 2.0, run 2.3)
and his public aerial frame data (references/melee-frame-data/fightcore.csv)
set the timing relations; every region, damage and angle is original.

- Movement: dash 11.4 and run 13.2 engine units (1.9 and 2.2 Melee units),
  just under Falcon's 2.0 and 2.3, which Warden already carries; walk, air
  speed and weight are unchanged.
- Forward air is the knee's structure: a radius-7 heel sweetspot exists only
  on the two clean frames, electric, 20%, launching at 35°; the leg on those
  frames and the whole kick from frame 16 to 30 are the 6% sourspot.
- Down air is the stomp's structure: the keg's base spikes straight down on
  frames 14–16; the rim, and the base on frames 17–18, deal 9% down and
  forward. A grounded target pops up instead (85° and 75°). It starts on
  frame 14, not Falcon's 16, because Chen's short hop is shorter: a short-hop
  down air pressed on the takeoff frame or any of the next five frames must
  hit a standing Shadow Hunter before he lands (the roster bar, 2026-10-28).
- Neutral air spins the staff twice: hit one (frames 7–9) is a fixed 30
  knockback carry that holds the target in hitstun into hit two (frames
  15–18), which launches at 40°.
- Up air scoops the staff from just below level in front (frame 6) through
  overhead (frames 9–10) to behind his back (frames 11–13); the first two
  frames are the clean hit (12%), the rest 9%. Both launch straight up with
  base 80 and 75 and growth 70, so the target rises into his next jump at
  low percent and outgrows the juggle by the time a forward air kills.
- Hitstun keeps the shared rule (0.4 frames per knockback unit); a 1.5x
  multiplier on his aerial hits was tried and dropped, because the chain below
  holds without it. Landing ends hitstun, so the combo is the up air's lift. Aerials auto-cancel on
  landing with Falcon's windows: neutral air before 4 or from 34, forward air
  before 7 or from 33, up air from 21, down air before 4 or from 35. Up air
  lands in 4 frames.
- Zero to death: from 0% against a mirror Chen holding no direction, a
  short-hop up air, two more short-hop up airs, a full-hop up air and a
  full-hop forward air sweetspot each land in hitstun and take the stock
  (68% before the knee). The string is found by search over jump timing and
  aerials and replayed in aerials.tests.ts; it checks no victim input, so DI
  escape is untested.

## Sources and decisions

[Wowpedia's Warcraft III Pandaren Brewmaster](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29)
provides Breath of Fire, Drunken Brawler and Storm, Earth and Fire. The keg
soaks a foe so the fire cone lands harder: a soaked foe is briefly slowed
through the shared chill rules (60% walk, run and air-drift speed, with no
immunity after) and stays soaked for a few seconds; Breath of Fire on a
soaked foe adds damage and a burn and dries the soak. The opponent keeps
attack, jump, shield and dodge control. Tom reshaped the specials on
2026-10-28: a League of Legends Gragas-style Body Slam on side special, a
fill-and-throw keg on down special, and a parasol float after Storm Rise in
the manner of Peach's up special in Ultimate. No outside code or animation is reused.

The Smash references establish decisions rather than copied hitboxes:
[Bowser's Fire Breath](https://www.ssbwiki.com/Fire_Breath) establishes a
close fire wall that can be jumped over;
[Ryu](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) and
[Ken](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) establish short checks,
planted kicks, uppercuts and footwork;
[Peach's Parasol](https://www.ssbwiki.com/Peach_Parasol) establishes a slow,
steerable float after a recovery, and
[Donkey Kong's Giant Punch](https://www.ssbwiki.com/Giant_Punch) a staged
charge released by a second press; unlike Donkey Kong (and Peon's Gold Sack),
the keg is never stored: a fill ends in a throw or is lost. His ultimate retains the full three-spirit fantasy, following the
roster's existing rule that ultimates are named designs and currently off.

Every number below is original, provisional tuning. Frames count the entry
as 1. `F/A/R/L` means first active frame, active frames, recovery frames and
final automatic landing lag. Aerials already include automatic lag reduction;
there is no extra timing input. Each ordinary strike hits once per target.

## Full kit

Every Warcraft reference in this table points to the Brewmaster source above;
Drunken Brawler is the source for original staff, hand and foot gestures.

| Input | Action and decision | F/A/R/L; damage | Warcraft source | Smash reference |
|---|---|---|---|---|
| Jab 1 / 2 / 3 | Palm, short staff butt, belly check; fresh presses continue | 4/2/11/0, 3.75%; 5/2/13/0, 3.75%; 7/3/18/0, 6.25% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu jab](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Forward tilt / angled up / down | Planted staff thrust at chest, shoulder or knee | 9/3/21/0; 11.25% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu forward tilt](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Up tilt | Close elbow lifts a jumper | 7/4/20/0; 8.75% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken up tilt](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Down tilt | Low heel sweep starts a juggle | 7/3/20/0; 7.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu down tilt](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Dash attack | Belly-first stumble; punish the long exit | 10/5/27/0; 12.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken dash attack](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Forward smash | Two-handed staff sweep, 118-unit reach | 19/4/34/0; 22.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu forward smash](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Up smash | Rising barrel shoulder | 15/4/31/0; 17% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken up smash](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Down smash | Low staff sweep front then back; one hit total | 15/6/32/0; 17.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu down smash](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Neutral air | Spinning staff: a carrying first hit links into a launching second | 7–9 and 15–18 / 22 / 8; 4% then 9% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Captain Falcon neutral air](https://www.ssbwiki.com/Captain_Falcon_%28SSBM%29#Aerial_attacks) |
| Forward air | Drunken flying kick: a tiny electric heel sweetspot on its two clean frames kills; the leg and the late kick shove | 14/17/8/10; heel 20% electric (14–15), leg and late 6% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Knee Smash](https://www.ssbwiki.com/Knee_Smash) |
| Back air | Heel behind the barrel | 8/3/23/14; 13.75% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken back air](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Up air | Staff scoop: from level in front, up over the hat to behind him | 6/8/20/4; 12% clean (6–7), 9% late | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Captain Falcon up air](https://www.ssbwiki.com/Captain_Falcon_%28SSBM%29#Aerial_attacks) |
| Down air | Keg slam: the keg's base spikes on its clean frames; the rim and the late slam knock away weakly; grounded targets pop up | 14/5/26/13; base 15% spike (14–16), rim and late 9% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Captain Falcon down air](https://www.ssbwiki.com/Captain_Falcon_%28SSBM%29#Aerial_attacks) |
| Grab / shield grab | Free hand reaches 64 units; misses recover | 7/2/24/0 | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu grab](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Pummel | Short knee, one fresh press | Shared pummel timing; 3% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken pummel](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Forward / back throw | Shoulder toss / turn-and-toss | Contact 12/16, total 33/39; 10/11.25% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu throws](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Up / down throw | Staff lift / barrel slam into tech chase | Contact 14/18, total 25/42; 8.75/7.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken throws](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Neutral special | Breath of Fire: finite long fanning cone, one hit, jump above its wide tip or whiff-punish; on a soaked foe it adds damage and a burn of 1% every 20 frames, by soak stage 1–4: +3/5/7/10% and 60/90/120/180 burn frames | Active 18–28, end 48; 12.5%, cost 10 | [Breath of Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Fire Breath](https://www.ssbwiki.com/Fire_Breath) |
| Side special | Body Slam: a drunken belly-charge forward that stops at the first body or shield and pops the foe up; a miss is punishable | Wind-up 1–9, charge and active 10–24 at 9 units a frame, end 50 (26 frames after a whiff); a hit ends it 14 frames after the hit, leaving Chen +12 at 0%, +24 at 50% and +36 at 100% on Rifleman; 11.25%, 80° launch, base 50, growth 60; air form once per airtime with 22 landing frames | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Gragas Body Slam](https://wiki.leagueoflegends.com/en-us/Gragas) |
| Up special | Storm Rise: rising electric staff spin with steering, then the parasol: a slow steerable float at 30% of his fall speed; holding down closes it into a normal fall; he may swing one aerial out of it, then falls helpless; no special, jump or air dodge out of it | Rise 8–29, end 40; 10%, electric | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken Shoryuken](https://www.ssbwiki.com/Shoryuken), [Peach Parasol](https://www.ssbwiki.com/Peach_Parasol) |
| Down special | Brew Keg: pour ale into the keg in three stages (a swelling keg), press special to lob it; a full keg throws itself; getting hit drops it, and nothing is stored | Fill holds frame 10 for up to 45 frames, a stage every 15; the throw spawns on its frame 6 and ends on 24 (18 landing frames in the air). By stage 0–3: 3.75/5/6.25/7.5%, soak 120/180/240/300 frames, slow 30/50/70/90 frames | [Drunken Haze](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Giant Punch](https://www.ssbwiki.com/Giant_Punch) |
| Ultimate | Storm, Earth and Fire: Earth taunts and absorbs a hit, Storm sends cyclones and Wind Walks, Fire bursts with Immolation; see "Ultimate" below | Spirits at 12, 20 and 28, end 48; ground only | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Swap](https://www.ssbwiki.com/Swap) |

## Risk, recovery and computer

Chen's normals are short: his 118-unit staff smash is a commitment, not a
neutral wall. Broad body and 1.6 run speed make projectile approaches costly.
The cone leaves Chen's mouth (Tom, 2026-10-28): four connected capsules whose
centreline starts at the front of his face, measured on the shipped model at
x58, z96 on the ground and z92 in the air on the active frames, and runs along
his facing to x260, sloping 26 units down so the far tip still sits low enough
to jump. Radii are 27, 40, 55 and 70; the final rounded tip reaches x330; EX keeps its 1.25× reach upgrade.
Active frames 18–28 (six more startup frames than the first cone) and end frame 48
keep its 20 exit frames; damage, cost and landing lag are unchanged. Each active frame births one stock Breath of Fire flame per
capsule, scaled by the square of its radius over 70 and shifted forward by 150
units per unit of scale (the stock model draws its fire that far behind its
origin), so the fire centres on each capsule and fans out from the mouth to the
tip; EX scales with the capsules.

Fire has 20 exit frames; the keg throw has 18 frames after release. Neither
gains extra shield damage. Ground and air fire and keg use the same strikes,
with 20 and 18 landing frames in the air. Storm Rise moves 2.1 reference
heights up and at most 1.0 sideways; the free form reaches 1.45 up and 0.7
sideways without a hit. Both consume the aerial jump; the parasol then trades
the helpless fall for a slow drift that edgeguards can read and punish, and
one aerial out of it ends helpless. Edgeguards can
cover its predictable late rise; leaving a ledge without jumping retains the
ordinary aerial jump.

Down tilt and up throw start juggles; down throw starts a tech chase. No
follow-up is promised as guaranteed. DI, shield, jump and tech choices remain
ordinary simulation inputs. Throws use the common hold, release, escape and
one-pummel rules.

The CPU favors running into short checks and jumping with kicks, lobs the
keg occasionally from range and follows a soaking hit with Breath of Fire,
runs in with Body Slam from mid range, checks with tilt/fire, shields, rolls
or jumps against an expected strike, and reserves Storm Rise for recovery. Stock loss and rematch clear the
shared meter, projectiles and special state.

Relative to today's roster: Rifleman outrange him; Illidan and
Warden outrun him; Blademaster has a longer weapon; Mountain King wins single
heavy commitments; Lich controls farther away; Forsaken Paladin holds longer defensive
space; Dreadlord has better air pursuit; Shadow Hunter establishes safer
ranged pressure; Pit Lord reaches farther with slower swings; Beastmaster
has independent bodies; Lich King controls zones and controls frost zones. Chen trades
those tools for fast short checks, staff finishers, a punishable body
charge and a keg-and-fire combo.

Presentation uses the installed Warcraft III Pandaren Brewmaster model,
icon, sounds and fire/cloud effects. Original staff, kick, stumble, paired
throw and reaction clips are authored over that private stock input. No
proprietary model or texture enters Git.

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Staff footwork and reads around heavy commitments.

```balance-profile
fighter: chen-stormstout
archetype: bait-and-punish
aerials: nair 10-40, fair 15-45, bair 15-45, uair 5-30, dair 0-25
air-share: 15-45
approach: 40-70
ranged: 0-20
specials: neutral 2-12, side 2-12, up 0-8, down 2-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: chen-stormstout
path: mixed
basic-moves: forward-tilt,down-tilt,neutral-air
```

Basic gameplan: Use grounded pokes and a neutral aerial. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Manage drink commitments and mix flame routes, close confirms and recovery. Use the full authored kit and gameplan at the same CPU skill.

## Signature strong/weak move (#389)

Forward air, split by position: the radius-7 heel sweetspot on frames 14-15 is the strong hit, 20% electric; the leg on those frames and the whole kick on frames 16-30 are the 6% weak hit. A drunken flying kick: land the heel to kill, let the leg or the lingering kick shove.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).

## Measured normal reach

Provenance: #539, 14 October 2026. Measured the current imported Classic body
`ChenStormstoutTimelineBody-40d4eea9edbcf081451c96086192a1943b68a867c5c7ee62707c1060f8a11fcf.mdx`
from pinned `original-clips-static-lights` family
`fc8c5f9985b3d9686a3b3d81005d72970c23ea78b717e6cfa69f9b71dffaa57a`,
with the product parser, model scale 1, timeline sequence 0, and each original
clip start plus `sampleAttack` pose time. Measurements agree exactly after
mirroring both facings. Staff measurements use the three distal solid-shaft
vertices 118, 119 and 121, directly weighted to Mesh33; the hanging rope and
flask are separate props. Limb measurements use the forward-most right-hand
vertex 353.

The original live regions remain covered. Added connected capsules keep the
original radii and effects. Jab 2 needs a different extension endpoint on each
of its two active frames to cover the moving tip without increasing its radius.
Each jab has both less reach and less active area than the forward tilt.
Grab keeps its original authored declaration and shared standing, dash and
pivot producers; staff geometry never extends its contact.

Positive gap means the measured tip lies outside all live regions; negative
gap is its inward clearance. Staff gaps below are the worst of all three tip
vertices over every active frame. Limb gaps use the forward-most tip.

| Move | Authored / live frames | Clip | Tip X/Z bounds | Previous worst gap | Extended worst gap | Added capsule endpoint(s), radius |
| --- | --- | --- | --- | ---: | ---: | --- |
| jab | 4–5 / 3–4 | 11 | 108.99–108.99 / 105.89–105.89 | 61.99 | -11.91 | 109/106, r12 |
| jab2 | 5–6 / 4–5 | 12 | 129.45–132.75 / 60.22–82.70 | 61.70 | -1.99 | 132/69 then 133/76, r11 |
| jab3 | 7–9 / 6–8 | 13 | 111.49–111.52 / 90.85–90.93 | 54.36 | -13.80 | 112/91, r14 |
| forwardTilt | 9–11 / 8–10 | 14 | 140.52–143.96 / 66.73–83.57 | 39.34 | -2.76 | 144/75, r12 |
| forwardTiltUp | 9–11 / 8–10 | 15 | 137.95–144.47 / 96.73–112.41 | 37.87 | -1.82 | 145/104, r12 |
| forwardTiltDown | 9–11 / 8–10 | 16 | 141.92–145.20 / 45.57–62.61 | 48.21 | -3.11 | 146/54, r12 |
| dashAttack | 10–14 / 9–13 | 19 | 108.78–108.80 / 105.67–105.88 | 44.27 | -23.84 | 109/106, r24 |

All authored extension coordinates are whole integers. Startup, recovery,
damage, knockback, shield behavior, hurt poses, clips and private input pins
are unchanged. Grab retains its original authored two-frame declaration and
the shared producer's three live frames with zero hit effects.

## Regions on the staff (#596)

The weapon trace (#508) follows the staff shaft, Mesh33 in the left hand;
Mesh10, which the rig named before, is the right sleeve. Staff moves keep
their frames, damage and knockback with regions moved onto the drawn shaft:
forward tilt drops the raised-hand capsule, up air lifts its region to the
staff above the hat (-8/138 to 36/172), down smash follows the sweep frame by
frame (front 36/63 to 115/48, under 11/41 to 70/-9 and -33/44 to -28/-31,
back -55/78 to -111/21), and Storm Rise adds a radius 12 capsule across the
overhead spin, -150/142 to 140/142, beside its body capsule. Palm, elbow,
right-hand checks, the barrel shoulder and kicks (jab, jab 3, up tilt, down
tilt, dash attack, up smash and the four kicking aerials) are limb strikes;
Breath of Fire and the spirits of the ultimate are spell strikes.

## Ultimate: Storm, Earth and Fire (2026-10-28)

Modelled on the Dreadlord's Summon Inferno: an ordinary authored special that
places objects which then act on their own while Chen keeps fighting. It is
ground-only, costs the whole bar and ends on frame 48. The three spirits use
the stock Classic Earth, Storm and Fire Pandaren Brewmaster models and their
stock birth, spell and death sequences, drawn a little smaller than Chen so they read as
summons, and each lasts 270 frames (4.5 s),
fading over its last 20.

- Earth, frame 12, 240 ahead: taunts. Every frame it draws each foe within
  240 toward itself by up to 3 units (walking out beats it); a launched,
  grabbed or intangible foe is not drawn. Durability 1, so the first hit
  breaks it and ends the taunt.
- Storm, frame 20, 130 behind: casts a Cyclone at ages 40, 130 and 220 that
  travels forward at 4 a frame for 70 frames, radius 50, and pops each grounded
  foe it reaches straight up for 3% at 90 degrees (base 80, growth 15),
  striking again every 12 frames whoever lands back in it.
  Struck, it Wind Walks: it vanishes for 45 frames, untouchable and silent,
  and reappears 160 farther from the striker on its own floor, never worn down.
- Fire, frame 28, 120 ahead (between Chen and Earth): Immolation bursts at ages
  45 and 165, radius 120 around it, 13% fire at 70 degrees (base 45, growth
  85). Durability 20.

The layout makes the spirits work together: Earth pulls foes into Fire's
burst, and Storm's Cyclone crosses both from behind Chen. Counterplay: hit
Earth first, walk out of the taunt, or outlast the spirits away from them.
Spirit state lives in the fighter's placed objects (slot 0 Earth, pack slots 1
and 2 Storm and Fire, with Wind Walk in their mode and mode frame), so it is
snapshotted and rolls back with the rest of the fighter.
