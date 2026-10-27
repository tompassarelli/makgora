# Chen Stormstout

Chen is a close-range drunken brawler: a broad body, short hand checks, a
staff for commitments, and a flask that makes a fire approach dangerous.
His first draft uses **Ultimate Ryu's weight 103, run speed 1.6 and air speed
1.12** ([SmashWiki](https://www.ssbwiki.com/Ryu_%28SSBU%29#Stats)).
The engine converts run and air units through `melee`; body multipliers are
103/75, 1.6/2.2 and 1.12. His original silhouette is 1.18 wide and 1.04 tall.
Jump, gravity, dodge and ledge rules remain the roster's common rules.

## Sources and decisions

[Wowpedia's Warcraft III Pandaren Brewmaster](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29)
provides Breath of Fire, Drunken Haze, Drunken Brawler and Storm, Earth and
Fire. Haze slows the approach into the fire cone. It keeps Warcraft's
movement slow through the shared chill rules: 75 frames at 60% walk, run and
air-drift speed, followed by 120 frames of immunity. The opponent keeps attack,
jump, shield and dodge control. No outside code or animation is reused.

The Smash references establish decisions rather than copied hitboxes:
[Bowser's Fire Breath](https://www.ssbwiki.com/Fire_Breath) establishes a
close fire wall that can be jumped over;
[Ryu](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) and
[Ken](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) establish short checks,
planted kicks, uppercuts and footwork;
[Swap](https://www.ssbwiki.com/Swap) establishes giving up one option to take
another. Chen's Threefold Stance begins as Earth and can become a Fire palm
or Storm step with a fresh press. These are brief forms within one action, not three extra
fighters. His ultimate retains the full three-spirit fantasy, following the
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
| Neutral air | Open knee and belly cover both sides | 7/5/22/14; 10% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu neutral air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Forward air | Extended front kick | 11/4/27/17; 15% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu forward air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Back air | Heel behind the barrel | 8/3/23/14; 13.75% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken back air](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Up air | Staff lifted above the hat | 7/4/22/14; 10% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu up air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Down air | Downward boot; grounded targets bounce upward | 14/4/30/21; 15% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu down air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Grab / shield grab | Free hand reaches 64 units; misses recover | 7/2/24/0 | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu grab](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Pummel | Short knee, one fresh press | Shared pummel timing; 3% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken pummel](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Forward / back throw | Shoulder toss / turn-and-toss | Contact 12/16, total 33/39; 10/11.25% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu throws](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Up / down throw | Staff lift / barrel slam into tech chase | Contact 14/18, total 25/42; 8.75/7.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken throws](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Neutral special | Breath of Fire: finite long fanning cone, one hit, jump above its wide tip or whiff-punish | Active 18–28, end 48; 12.5%, cost 10 | [Breath of Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Fire Breath](https://www.ssbwiki.com/Fire_Breath) |
| Side special | Drunken Haze: arcing flask, 3.75% and 75 frames at 60% movement speed; shield stops it | Spawn 14, end 38; cost 12 | [Drunken Haze](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu Hadoken spacing](https://www.ssbwiki.com/Hadoken) |
| Up special | Storm Rise: rising staff spin with steering, then helpless fall | Rise 8–29, end 40; 10%, cost 15 | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken Shoryuken](https://www.ssbwiki.com/Shoryuken) |
| Down special | Earth stance absorbs one light hit; fresh Attack becomes Fire palm, fresh Special becomes Storm step | Armor 5–16, end 33; cost 10. Fire active 8–11, end 32, 13.75%. Storm travels 5–12, end 28, 8.75% | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Swap](https://www.ssbwiki.com/Swap) |
| Ultimate | Storm, Earth and Fire: three spirits divide defense, movement and striking roles; currently off like roster ultimates | Design only while ultimates are disabled | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Swap](https://www.ssbwiki.com/Swap) |

## Risk, recovery and computer

Chen's normals are short: his 118-unit staff smash is a commitment, not a
neutral wall. Broad body and 1.6 run speed make projectile approaches costly.
Tom's release cone uses four connected horizontal capsules, with centerline x36–256
and radii 27, 40, 55 and 70. Centerline reach grows from 88 to 220 units (2.5×).
The final rounded tip reaches x326; EX keeps its 1.25× reach upgrade.
Active frames 18–28 (six more startup frames than the first cone) and end frame 48
keep its 20 exit frames; damage, cost and landing lag are unchanged. Each active frame births one stock Breath of Fire flame per
capsule, scaled by the square of its radius over 70 and shifted forward by 150
units per unit of scale (the stock model draws its fire that far behind its
origin), so the fire centres on each capsule and fans out from the mouth to the
tip; EX scales with the capsules.

Fire has 20 exit frames; Haze has 24 frames after release. Neither gains
extra shield damage. Ground and air fire/haze use the same strikes, with
20 landing frames in the air. Storm Rise moves 2.1 reference heights up and
at most 1.0 sideways; the free form reaches 1.45 up and 0.7 sideways without
a hit. Both consume the aerial jump and finish helpless. Edgeguards can
cover its predictable late rise; leaving a ledge without jumping retains the
ordinary aerial jump.

Down tilt and up throw start juggles; down throw starts a tech chase. No
follow-up is promised as guaranteed. DI, shield, jump and tech choices remain
ordinary simulation inputs. Throws use the common hold, release, escape and
one-pummel rules.

The CPU favors running into short checks and jumping with kicks, uses Haze
occasionally while approaching, checks with tilt/fire, uses
Earth against an expected strike, branches its stance when a strike reaches,
and reserves Storm Rise for recovery. Stock loss and rematch clear the
shared meter, projectiles and special state.

Relative to today's roster: Rifleman outrange him; Illidan and
Warden outrun him; Blademaster has a longer weapon; Mountain King wins single
heavy commitments; Lich controls farther away; Forsaken Paladin holds longer defensive
space; Dreadlord has better air pursuit; Shadow Hunter establishes safer
ranged pressure; Pit Lord reaches farther with slower swings; Beastmaster
has independent bodies; Lich King controls zones and controls frost zones. Chen trades
those tools for fast short checks, staff finishers and a branching defensive
stance.

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

Neutral air, split by timing: strong hit clean, frames 7-8, 10%; weak hit late, frames 9-11, 7%. A drunken flying kick: hit early to punish, let it linger to cover a landing.
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
