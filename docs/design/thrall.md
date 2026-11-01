# Thrall, the dismounted Warchief

Thrall is a heavy ground-control brawler. Doomhammer threatens the space just
outside a jab, lightning checks a retreat, and his Feral Spirit wolves run at
the foe along the floor: a slow spirit wolf he walks in behind against a
shield, a pair of timber wolves only a full jump clears, or one fast dire
wolf that punishes. Ghost Wolf turns him into a spirit wolf for a dash and a
pounce, his sideways recovery. Values below are original,
provisional Smashcraft values, not copied hitboxes or animation.

## Sources and body

[Wowpedia's Thrall](https://wowpedia.fandom.com/wiki/Thrall) and
[Doomhammer](https://wowpedia.fandom.com/wiki/Doomhammer) establish the warrior,
shaman and hammer. The [Far Seer](https://liquipedia.net/warcraft/Far_Seer)
supplies Chain Lightning, Feral Spirit and Earthquake (his ultimate), and its earth and lightning shape Rising Thunder; Blizzard's
[Far Seer unit page](https://classic.battle.net/war3/orc/units/farseer.shtml)
is the original ability reference. Only these ability identities and numerical
facts are reused; no outside implementation, prose or animation is copied.

The body counterpart is [Ultimate King Dedede](https://www.ssbwiki.com/King_Dedede_(SSBU)):
weight 127, run speed 1.496, air speed 0.735. Smashcraft applies weight
127/75 and run 1.496/2.2 to its reference table, and raises air speed to the
shared 0.75 floor, with the same world-unit conversion as other fighters.
He stands on foot, on johnwar's Warchief Thrall model (see Presentation), and
his hurt capsule is refit to its drawn body: 1.12 times the reference width and
1.10 times its height, the proportions of Grom, whose base the model shares. He retains the
shared one aerial jump, gravity and dodge windows. Unlike Dedede, he has no
extra jumps or armored recovery.

Compared with the present roster, Thrall trades Rifleman's sustained
shooting and Illidan's rush speed for mass; has less sword reach than
Blademaster, Warden and Lich King; uses a travelling wolf attack rather than
Beastmaster's controllable animals; lacks Forsaken Paladin's guard, Dreadlord's healing,
Lich's chill, Shadow Hunter's disable, Pit Lord's cleave and Mountain King's
armored charge. His short air drift makes offstage decisions expensive.

## Hammer kit

Every hammer move draws on [Doomhammer](https://wowpedia.fandom.com/wiki/Doomhammer).
The [Dedede move list](https://www.ssbwiki.com/King_Dedede_(SSBU)#Moveset)
is the relation reference: short jab versus long hammer swing, committed
smash versus safer tilt, and differently directed aerials. Numbers and strike
paths are original. Frames count entry as 1; `first / active / recovery`
describes the three phases. Landing figures are the automatic final lag.

| Input | Gesture and decision | Frames | Damage; direction | Landing |
| --- | --- | --- | --- | --- |
| Jab, jab 2 | Hammer butt then short hook; close escape, not a ranged poke | 4/2/14; 7/3/18 | 5; 45°, then 6; 40° | — |
| Forward tilt, angled up/down | Waist-height hammer hook; aim over or under a shield | 8/3/21 | 13.25; 35°/55°/20° | — |
| Up tilt | Doomhammer swept up over his head; starts a juggle | 8/4/20 | 8; 85° | — |
| Down tilt | Crouched low Doomhammer sweep along the floor; tech-chase starter | 6/3/19 | 9.75; 70° | — |
| Dash attack | Running shoulder charge with the hammer trailing behind; his exposed body travels 65 units | 9/10/23 | 13.75; 55° | — |
| Forward smash | Planted Doomhammer hook; strongest close punish | 20/3/34 | 18; 40° | — |
| Up smash | Hammer crown sweep; catches a landing | 17/4/29 | 15; 85° | — |
| Down smash | Crouched hammer sweep in front, then behind; covers a roll with commitment | 14/6/30 | 16.25; 25° outward | — |
| Neutral air | Compact hammer/body turn; stops a close approach | 8/5/20 | 8; 50° | 14 |
| Forward air | Hammer across the front; spacing and edge guard | 13/3/25 | 12; 45° | 18 |
| Back air | His own back kick, then a reverse hammer hook behind him (#95); the kick's set knockback keeps the foe in hitstun for the hammer, which is the rear finisher | 8/12/24: kick 8–10, hammer 17–19; 43 total | Kick 6; 45° backward, set knockback (base 30, no growth); hammer 12; 35° backward | 17 |
| Up air | Hammer held high; follows up tilt or up throw | 8/4/20 | 9; 85° | 13 |
| Down air | Doomhammer driven straight down below his feet; meteor only in air | 14/4/28 | 13; down, grounded 55° | 20 |
| Grab / pummel | Free-hand reach and one hammer-butt check | 8/2/24 | 0 / shared 3 | — |
| Forward throw | Shove into hammer | contact14/end34 | 8; 35° | — |
| Back throw | Turn and toss over his shoulder | contact18/end40 | 10; 40° backward | — |
| Up throw | Lift with lightning spark | contact15/end28 | 7; 90° | — |
| Down throw | Pin then release with a ground shove | contact19/end42 | 6; 25° | — |

The throws use Dedede's four directional roles as the Smash reference and
Thrall's gladiator training as the Warcraft reference. Up throw starts a
juggle; down throw starts a tech chase. Neither promises a guaranteed chain.
The shared grab escape, throw immunity and hitstun inputs remain active.
The single shared pummel deals 3 damage at frame 60 and ends at frame 68.
Get-up and ledge attacks use the same hammer sweep vocabulary and shared
action rules. Only weapon reach is disjoint; shoulder and limb attacks expose
matching hurt volumes. Smashes use the shared charge (physics.md, "Smash charge").

Every hammer move is keyed from one swing table,
`THRALL_HAMMER_SWINGS` in smashcraft:ts/src/game/fighters/thrall/moves.ts: each
active frame names the shoulder pivot, the hand's distance from it and the
hammer's angle, and both the hit region and the clip's hammer head come from
that one row, so the drawn head lands within 12 units of its region on every
active frame (the clip generator refuses more). Smashes and forward and down
air slide the haft 26 units through his fist for reach. Low attacks swing from a
crouched shoulder near the floor. The dash attack's shoulder region runs from
(16,74) to (40,94), radius 26, and the back air kick's from (-24,64) to
(-62,58), radius 18; both carry matching hurt volumes on the leading shoulder
and kicking leg.

## Specials and ultimate

| Input | Warcraft source / Smash reference | Authored rule and counterplay |
| --- | --- | --- |
| Neutral: Chain Lightning | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Tinker's laser](https://liquipedia.net/warcraft/Tinker) | Warcraft's own white Chain Lightning arc, cast like the Tinker laser but slower and longer: the beam fires from the hammer on frames26–31 and reaches 520 units along the line to where the nearest foe stood when the cast began, never re-aimed (Tom, 17 Oct: so it covers a tech, a ledge or a slow foe), 9 damage electric, 40° launch, end58, cost10. Tom (17 Oct) found the old travelling bolt too strong (12.3 damage at 17 units a frame) and asked for an actual lightning effect. The long wind-up is the counterplay: jump or shield once the cast starts; a whiffed cast is punishable. Air landing lag18. |
| Side: Ghost Wolf | [Far Seer's Feral Spirit](https://liquipedia.net/warcraft/Far_Seer) and the shaman's Ghost Wolf form / [Fox Illusion](https://www.ssbwiki.com/Fox_Illusion) | He turns into a spirit wolf for a dash then a pounce. Shift frames1–7 in his own body; dash frames8–25 at 15 units a frame (270 units, level, no hit); pounce frames26–35 at 11 a frame, rising 8 a frame for 5 frames then level (110 units); his own body again from frame36, end46, cooldown60. The pounce hits on frames26–33: 8 damage/45°, growth70, base30, a capsule from (24,36) to (78,50), radius20. While a wolf his hurt volume is the wolf's low body, a capsule from (−44,38) to (40,42), radius26, so he ducks under high pokes. In the air it is his sideways recovery: once per airtime, it holds his height through the dash and ends helpless. On the ground it is a committed dash-in that ends standing, not helpless. Either way, landing before it ends costs landing lag22. With a jump it recovers from 400 units out and 150 below the ledge, where a jump alone does not; his measured envelope with it is 918 reach and 820 height (vertical band: at least 840 and 700). |
| Up: Rising Thunder | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) earth and lightning / [Ryu's Shoryuken](https://www.ssbwiki.com/Shoryuken) and [Fox's Shine](https://www.ssbwiki.com/Reflector_(Fox)) | Tom's design (1 Nov 2026, paraphrased): an electric-hammer rising uppercut that replaces Far Sight. He crouches (frames 1–4), slams his left palm down under him and an earth eruption launches him (frames 5–6: 3 damage, 90°, set knockback 80, so a grounded foe leaves the floor into the hammer), then rises 4.0H over frames 7–23 with up to 1.5H steering while his right arm sweeps the Doomhammer from straight ahead to straight overhead; his left hand stays down at his side. Five rising hits along that arc and his body (frames 7, 10, 13, 16, 19, three frames each, 1.5 damage, 85°, set knockback 30, carry) hold the foe at his rising speed; they use the electric element without electric hitlag, because the extra victim hitlag frame let the foe fall a frame behind the rise on every hit. The apex (frames 24–26, held in place) is a lightning burst around the raised hammer, 58-unit radius: 8 damage, electric, 85°, fixed set knockback 60, the same launch at every percent (Tom, 1 Nov: Shine-style, so the follow-up is guaranteed). All seven connect on a standing foe for 18.5. **On hit** he is not helpless: two frames after the apex hold he hops 12 units a frame and is free at frame 45 of the cast (hitlag included) with 24 frames of advantage on Rifleman and Mountain King and 20 on Thrall, at 0% and 150% alike, so down air, forward air and a fast-fall into up air each strike inside the foe's hitstun. **On a whiff** he falls helpless and lands with a special-fall landing lag of 30 frames, set on this move (Tom, 1 Nov), and landing during the cast also costs 30; that cost pays for the reward on hit. Measured route: rise 527, reach 346, inside the vertical recovery band (400–560, 320–600). No loop: it is once per airtime, so Up B, aerial, Up B cannot repeat in the air; after he lands from an aerial follow-up the foe has had at least 4 free frames before a second cast becomes active (down, forward and up air at 0, 40 and 80%), and the aerials scale with percent. Uses the aerial jump. |
| Down: Feral Spirit | [Far Seer's Feral Spirit](https://liquipedia.net/warcraft/Far_Seer) / [Duck Hunt's can](https://www.ssbwiki.com/Duck_Hunt_(SSBU)) and [Ragnaros's Lava Raze](roster.md) motion input | One down special, three wolves picked by the stick's motion over the 10 frames up to the press (the reader Lava Raze uses): plain down calls the Spirit Wolf, down and forward the Timber Wolves, a quarter-circle forward (down, down and forward, forward) the Dire Wolf; the quarter-circle picks Feral Spirit even though the press reads forward, and a plain forward press is Ghost Wolf. Every wolf runs at the foe on the floor (see Feral Spirit wolves below). **Spirit Wolf:** one big, slow ghost wolf, radius30, 7.25 units a frame (his walk is 6.53, so he walks in behind it and never passes it), 150-frame life, appears frame18, end44, cooldown150. On a body or shield it stops and bites, 5 damage/50°, growth40, base34, 9 shield damage a bite, then bites again 14 frames later if still in contact, up to three bites: his best shield-pressure tool. **Timber Wolves:** two wolves, radius12, 9.5 a frame, 60-frame life, the second appears 12 frames after the first (frames16 and28, 114 units behind), end46, cooldown90; each bites once, 5 damage/55°, growth60, base30. A short hop clears one but lands into the second; only a full hop clears the pair. **Dire Wolf:** one fast wolf, radius16, 14 a frame, 34-frame life, appears frame12, end36, cooldown75; one bite, 9 damage at 25°, growth62, base40, a low launch that knocks a grounded foe down for a tech chase. Summons can be shielded or parried and do not reflect. Air landing lag20 on every form. Mana is a trait tag only (not charged): spirit 20, timber 18, dire 14. |
| Ultimate: Elemental Fury | [Far Seer's Earthquake](https://liquipedia.net/warcraft/Far_Seer) / [Pikachu's Volt Tackle](https://www.ssbwiki.com/Volt_Tackle) | Designed ultimate, matching today's hero template: a storm-assisted Earthquake that sends a broad final lightning wave. The current roster stores ultimate names/descriptions; its activation system is not yet implemented. |

The computer holds midrange with lightning and Feral Spirit, approaches with
down tilt, grab or a Ghost Wolf dash-in, juggles with up tilt and up air, and
returns to the ledge with Rising Thunder or Ghost Wolf. It casts every wolf with the
real stick motion through the shared bot motion-cast helper
(smashcraft:ts/src/game/match/botMotionCast.ts), which picks the form from the
wolves' own data: the dire wolf, the earliest to arrive, against a foe in
hitstun, end lag, landing lag or a knockdown; the spirit wolf, the most shield
damage, against a raised shield; the timber pair, the most wolves, beyond his
farthest down-special spacing; otherwise the spirit wolf. Every special is
listed in the gameplan and counted by the existing eight-seed coverage.

### Feral Spirit wolves

Tom asked on 2026-11-01 for the wolves as one down special with three forms
picked by motion, differing in what the wolf does rather than how far it goes:
a big slow ghostly white spirit wolf to walk behind against a shield, a
staggered timber pair that needs a full hop, and one fast black dire wolf to
punish. Every wolf runs at the foe on the floor with a real run cycle; none
floats or glides. The numbers above are ours.

- **Floor.** A wolf's feet stand on the floor it runs on and follow it. With
  no floor under its feet it falls at 1 unit a frame per frame, up to 14, and
  lands on any floor it falls onto, a pass-through platform included, then runs
  on.
- **Ledges (our rule).** A wolf runs straight off a ledge and falls; it lands
  on a floor below or falls out of the stage until its life ends. One rule
  covers platforms, ledges and air casts, so a wolf never stops in mid-air, and
  it leaves an honest edge-guard: a wolf run off the ledge can catch a foe
  recovering low under it.
- **Air casts.** Tom set this on 2026-11-01: cast in the air, each wolf
  appears ahead of Thrall at his height, pounces up and forward at 4 units a
  frame, falls under the same gravity, and on landing runs on along the floor
  like a ground cast. This holds for all three forms.
- **Bites.** A wolf that reaches a body or a shield stops and bites; the
  one-bite wolves end 12 frames after their bite, the spirit wolf keeps biting
  every 14 frames up to three bites, then runs on if the foe has left.

Ghost Wolf replaced the side special on 2026-11-01 at Tom's direction (a
sideways recovery in the stock spirit wolf's form, a dash then a pounce,
animated to the same bar as the wolves), retiring Doomhammer Slam, and the
old two-wolf Feral Spirit moved into the down special above.

## Presentation

Thrall stands on foot on [Warchief Thrall Dismounted by johnwar](https://www.hiveworkshop.com/threads/warchief-thrall-dismounted-re-classic.332006/)
(Hive Workshop), built on Ujimasa Hojo's Grom Hellscream, with the stock
`Units\Orc\Thrall\Thrall.blp` texture and his stock command icon (Tom asked
for the change on 28 October 2026). The map imports the model as
`war3mapImported\WarchiefThrallDismountedV2.mdx`; smashcraft:tools/animations/thrall-clips.ts
authors every Smashcraft clip on its full biped and keeps its 31 stock
sequences. Far Seer lightning and earthquake effects and shared Warcraft impact sounds
stay. The wolves are stock Warcraft III models only: the Spirit Wolf is the
stock Feral Spirit wolf (`units\orc\SpiritWolf\SpiritWolf.mdx`) drawn
translucent and tinted toward white; the Timber Wolves are the stock brown
Timber Wolf (`units\creeps\TimberWolf\TimberWolf.mdx`); the Dire Wolf is
the stock black Dire Wolf (`units\creeps\DireWolf\DireWolf.mdx`). Each plays
its stock Walk sequence at its ground speed over the sequence's own 260 units a
second, so its feet do not slide, and its stock Attack - 1 while it bites.
Ghost Wolf draws the stock spirit wolf in its own blue in Thrall's place from
the dash through the pounce: the stock Feral Spirit summon burst as he shifts,
its Walk at the dash's 15 units a frame, its Attack Slam across the pounce,
and the stock Feral Spirit dissipate burst as he returns.
Rising Thunder layers stock Classic effects: a Purge glow gathers under him in the crouch, War Stomp's earth eruption bursts under his palm at the launch, a Far Seer lightning orb rides the hammer head along its swing with the shared lightning trail behind his rise, and at the apex a Monsoon bolt strikes the raised Doomhammer inside a Thunder Clap ring.
Author deliberate preparation/contact/recovery poses, both facing directions,
the shared recovery actions, paired grabs and nine pain poses. All extracted
and authored Warcraft model data remains in the private build-input store.

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). A heavy ground-control brawler around Doomhammer's reach.

```balance-profile
fighter: thrall
archetype: heavy
aerials: nair 10-40, fair 10-40, bair 15-45, uair 5-30, dair 5-30
air-share: 10-40
approach: 45-75
ranged: 0-20
specials: neutral 2-12, side 2-12, up 0-8, down 2-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: thrall
path: decision
basic-moves: forward-tilt,neutral-special,neutral-air
```

Basic gameplan: Poke with the hammer and throw lightning. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Vary lightning, wolves and ground control and time charged commitments. Use the full authored kit and gameplan at the same CPU skill.

## Signature strong/weak move (#389)

Forward smash, split by timing: strong hit clean, frames 20-20, 18%; weak hit late, frames 21-22, 12.6%. The Doomhammer lands its full weight only on impact; the follow-through is a weak shove.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).
