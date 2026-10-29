# Thrall, the dismounted Warchief

Thrall is a heavy ground-control brawler. Doomhammer threatens the space just
outside a jab, lightning checks a retreat, and two spirit wolves make the
opponent jump into his hammer. Doomhammer Slam catches a grounded approach but
leaves time to jump or punish its recovery. Values below are original,
provisional Smashcraft values, not copied hitboxes or animation.

## Sources and body

[Wowpedia's Thrall](https://wowpedia.fandom.com/wiki/Thrall) and
[Doomhammer](https://wowpedia.fandom.com/wiki/Doomhammer) establish the warrior,
shaman and hammer. The [Far Seer](https://liquipedia.net/warcraft/Far_Seer)
supplies Chain Lightning, Feral Spirit, Far Sight and Earthquake (his ultimate); Blizzard's
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
and kicking leg. Doomhammer Slam's low region is a spell pulse from the hammer
striking the floor.

## Specials and ultimate

| Input | Warcraft source / Smash reference | Authored rule and counterplay |
| --- | --- | --- |
| Neutral: Chain Lightning | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Tinker's laser](https://liquipedia.net/warcraft/Tinker) | Warcraft's own white Chain Lightning arc, cast like the Tinker laser but slower and longer: the beam fires from the hammer on frames26–31 and reaches 520 units along the line to where the nearest foe stood when the cast began, never re-aimed (Tom, 17 Oct: so it covers a tech, a ledge or a slow foe), 9 damage electric, 40° launch, end58, cost10. Tom (17 Oct) found the old travelling bolt too strong (12.3 damage at 17 units a frame) and asked for an actual lightning effect. The long wind-up is the counterplay: jump or shield once the cast starts; a whiffed cast is punishable. Air landing lag18. |
| Side: Feral Spirit | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Duck Hunt's dog](https://www.ssbwiki.com/Duck_Hunt_(SSBU)) | Two spectral wolves leave at frames16 and24, run low for 28 frames, each 4 damage/55°, cost18, end44, cooldown90. The second wolf makes a delayed jump or shield decision; each can hit only once. Summons can be blocked or parried but do not reflect. Air wolves descend and air landing lag20 applies. |
| Up: Far Sight | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Duck Jump](https://www.ssbwiki.com/Duck_Jump) | Spirit sight points a safe way upward: after8 frames, rise2.25H with up to1.5H steering over24 frames, end40, cost12, no hitbox or armor. At low mana rise1.4H free. Both forms meet the shared recovery-distance band. Uses the aerial jump and ends helpless; the broad body can be intercepted. This movement is an original adaptation of a vision spell. |
| Down: Doomhammer Slam | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Donkey Kong's Hand Slap](https://www.ssbwiki.com/Hand_Slap) | A low spell pulse hits both sides at frames18–21, 11 damage/75°, end50, cost20, cooldown90. Ground only, 135-unit reach; jump clears it. No extra shield damage, armor or repeating hold. |
| Ultimate: Elemental Fury | [Far Seer's Earthquake](https://liquipedia.net/warcraft/Far_Seer) / [Pikachu's Volt Tackle](https://www.ssbwiki.com/Volt_Tackle) | Designed ultimate, matching today's hero template: a storm-assisted Earthquake that sends a broad final lightning wave. The current roster stores ultimate names/descriptions; its activation system is not yet implemented. |

The computer holds midrange with lightning and wolves, approaches with down
tilt or grab, uses Doomhammer Slam against grounded proximity, juggles with up tilt
and up air, and saves Far Sight for return to the ledge. Every special is
listed in the gameplan and counted by the existing eight-seed coverage.

## Presentation

Thrall stands on foot on [Warchief Thrall Dismounted by johnwar](https://www.hiveworkshop.com/threads/warchief-thrall-dismounted-re-classic.332006/)
(Hive Workshop), built on Ujimasa Hojo's Grom Hellscream, with the stock
`Units\Orc\Thrall\Thrall.blp` texture and his stock command icon (Tom asked
for the change on 28 October 2026). The map imports the model as
`war3mapImported\WarchiefThrallDismountedV2.mdx`; smashcraft:tools/animations/thrall-clips.ts
authors every Smashcraft clip on its full biped and keeps its 31 stock
sequences. Stock spirit wolves, Far Seer lightning and earthquake effects,
and shared Warcraft impact sounds stay.
Far Sight has no stock target model, so its rising spirit cue uses the
base-game Shaman's Purge glow around the body.
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
