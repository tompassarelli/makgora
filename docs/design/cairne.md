# Cairne Bloodhoof: the mountain that moves

Cairne is the true super-heavyweight. His halberd controls a large patch of
ground, his weight lets him survive a poor exchange, and an earned burst of
Endurance Aura helps him reach his next read. His enormous body, slow whiffs
and exposed recovery give opponents clear ways to beat him. All move values,
hit regions and animation are original, provisional Smashcraft choices.

## References and body

The [Warcraft Tauren Chieftain](https://liquipedia.net/warcraft/Tauren_Chieftain)
supplies Shockwave, War Stomp, Endurance Aura and Reincarnation.
[Blizzard's original unit guide](https://classic.battle.net/war3/orc/units/taurenchieftain.shtml)
describes their original roles: a line attack, a surrounding stomp, movement
and attack support, and delayed revival. Those identities become readable
platform-fighter decisions rather than Warcraft's long disables.

[King K. Rool in Ultimate](https://www.ssbwiki.com/King_K._Rool_(SSBU)#Stats)
is the named body counterpart: weight **133**, run speed **1.485**, air speed
**0.945**. The implementation divides weight by the roster's reference 75,
run speed by the shared 2.2 baseline and uses the air speed directly as the hero's air
multiplier. Width **1.75×** and height **1.45×** are original body scales,
larger than Pit Lord's 1.65/1.35; shield scale is 1.45. Jumps, gravity and
shared defensive actions retain the roster's common rules.

[Bowser](https://www.ssbwiki.com/Bowser_(SSBU)) supplies the heavyweight
trade-off: decisive close strikes balanced by a large target and punishable
commitment. [Ike's Eruption](https://www.ssbwiki.com/Eruption) informs
Shockwave's planted ground strike and recovery; Cairne releases one finite
wave without charge or self-damage. [Donkey Kong's Hand Slap](https://www.ssbwiki.com/Hand_Slap)
informs War Stomp's low surrounding launch; it is one committed stomp rather
than a repeatable stun. No external code, hitbox tables or animation is reused.

## Full kit

Frames are one-based: f1 is entry. F/A/R are first active frame, number of
active frames and recovery frames. L is authored aerial landing lag; the
shared landing rule halves it. H is the 132-unit reference height. Halberd
shaft beyond Cairne's hands is disjoint; hands, shoulders, horns and hooves
carry hurt volumes. A positive contact window hits each opponent once.

Every Warcraft link below names the identity being adapted, and every Smash
link names a relationship, not copied frame data or geometry.

| Move | Original contract and decision | Warcraft source | Smash reference |
| --- | --- | --- | --- |
| Jab 1, Haft Check | 7/3/18; 5 damage; short haft check. | [Chieftain's halberd][wc] | [Bowser close jab][bowser] |
| Jab 2, Halberd Butt | 9/3/23; 8 damage; fresh press finishes the two-hit chain. | [Halberd][wc] | [K. Rool's finite jab sequence][krool] |
| Forward tilt, all angles | 14/4/29; 13 damage; halberd sweeps from high to low, reaches 170. | [Halberd][wc] | [Bowser's deliberate forward tilt][bowser] |
| Up tilt | 13/5/27; 12 damage; raised halberd launches at 85 degrees. | [Halberd][wc] | [K. Rool's overhead control][krool] |
| Down tilt | 11/3/25; 10 damage; low shaft lifts at 70 degrees. | [Halberd][wc] | [K. Rool's low ground coverage][krool] |
| Dash attack | 16/5/36; 11.25 damage; exposed shoulder drives forward 32 units. | [Endurance Aura][wc] | [K. Rool's committed body charge][krool] |
| Forward smash | 30/4/43; head 25, shaft 19 damage; 190 reach and long punish window. | [Halberd/War Stomp][wc] | [Bowser's hard read][bowser] |
| Up smash | 25/5/39; 23 damage; narrow overhead pillar, weak lateral coverage. | [Halberd][wc] | [K. Rool's vertical commitment][krool] |
| Down smash | 23/7/40; 19 damage; front then rear ground sweep. | [War Stomp][wc] | [Bowser's two-sided punish][bowser] |
| Neutral air | 12/7/29/L22; 13 damage; halberd circles front then back. | [Halberd][wc] | [Bowser's surrounding aerial][bowser] |
| Forward air | 20/4/36/L26; 19 damage; descending halberd wall, outward launch. | [Halberd][wc] | [Bowser's forward wall][bowser] |
| Back air | 15/4/30/L22; 16 damage; rearward halberd strike. | [Halberd][wc] | [K. Rool's committed rear attack][krool] |
| Up air | 12/4/28/L20; 13 damage; narrow horn rise; horns are hittable. | [Tauren body][wc] | [Bowser's overhead head strike][bowser] |
| Down air, Halberd Slam | 14/7/39/L28; both hands raise the halberd overhead through f11, then drive it straight down beneath him with the body folding after it. Clean f14–16: 18 damage, base 40, growth 100, 270-degree meteor in the air and 55-degree launch on the ground. Late f17–20: 12 damage, base 20, growth 80, 55-degree pop up and away. Cairne's short hop, measured headless, is 3 frames of jump squat and 19 airborne frames peaking 64 units up (a full hop is 33); a down air input on the first airborne frame reaches f14 on the 14th, so the clean slam is fully airborne with 5 airborne frames to spare, and the late hit runs into the landing. Melee Captain Falcon and Ganondorf hit on f16–20 for 16% and 22% at 270 degrees with base 40/50 and growth 100, interruptible from f38 with 24/35 landing lag, early enough to hit from their short hops; Cairne's shorter hop moves his slam to f14, splits the 7 active frames into a clean meteor and a weaker late hit, keeps the old 59-frame total and lands between them at L28 (#96, #206). | [War Stomp][wc] | [Captain Falcon][falcondair] and [Ganondorf][ganondair] down airs |
| Grab | 10/3/31; short free-hand reach; shared shield grab and escape. | [Tauren strength][wc] | [Bowser's close grab][bowser] |
| Pummel | Shared contact f60, end f68; 3 damage; at most one pummel, escapable by mashing. | [Halberd haft][wc] | [Heavyweight local pummel][bowser] |
| Forward throw | Contact f19, end f45; 11 damage at 35 degrees; stage control. | [Tauren strength][wc] | [Bowser's outward toss][bowser] |
| Back throw | Contact f23, end f54; 13 damage at 40 degrees backward; edge read. | [Tauren strength][wc] | [K. Rool's powerful back throw][krool] |
| Up throw | Contact f21, end f32; 10 damage near vertical; juggle starter. | [Halberd lift][wc] | [Heavyweight upward throw][bowser] |
| Down throw | Contact f24, end f51; 9 damage at 25 degrees; tech chase, no bury. | [War Stomp][wc] | [K. Rool's grounded throw read][krool] |
| Get-up and ledge attack | Shared recovery timings; halberd clears room in the strike direction. | [Halberd][wc] | [Heavyweight recovery attack][bowser] |

## Specials and ultimate

| Input | Original contract, reward and counterplay | Warcraft source | Smash reference |
| --- | --- | --- | --- |
| Neutral: **Shockwave** | 15 mana; wave f24, end f61. One reflectable wave, 7.5 damage, radius 20, speed 13/frame and life 38. It starts 72 units ahead at height 36. Jump above it or shield and close during recovery. Air form has 24 landing frames and no stall. | [Shockwave][wc] | [Eruption's planted ground attack][eruption] |
| Side: **Bloodhoof Gore** | Paws the ground through f11, then charges about 140 units over f12–25 with lowered horns. The horn capsule catches a grounded or shielding foe on f12–24, holds 20 frames and flings it for 13 damage at 40 degrees with kill strength; 22 recovery frames after a catch, 34 after a whiff. The horns are hittable from f5 to f28. Jump the 86-unit capsule top, spot dodge, roll or hit him during the paw. Air form is once per airtime, ends helpless and has 24 landing frames. EX adds 25% damage. | [Tauren charge][wc] | [Dreadlord-style command grab: Ganondorf's Flame Choke as a shield-beating read][ganon] |
| Up: **Spirit Lift** | 15 mana; hovers through f10, then rises 2.7H and steers up to 1.35H with the stick over f11–32; halberd f11–16 for 9 damage at 80 degrees. Free form rises 2H/steers 0.82H with no hit. One use per airtime, spends aerial jump, ends helpless. Sides and landing remain exposed. | [Ancestral spirit of Reincarnation][wc] | [Bowser's finite recovery commitment][bowser] |
| Down: **War Stomp** | Rears up wreathed in Endurance: armor absorbs one hit of 8 damage or less on f6–19, and a heavier hit, grab or throw interrupts it. Stomp f20–23, end f54: front and rear low regions reach 130 units each side and an inner region f20–21 covers bodies pressed against him, 9.75 damage launching at 80 degrees (85 inside). The stock War Stomp ring bursts at his hooves on f20, drawn at the regions' 130 reach; it never hits. Air form has 26 landing frames. EX scales armor by 1.5 and reach, ring included, by 1.2. | [War Stomp, Endurance Aura][wc] | [Hand Slap's low surrounding launcher][slap] |
| Ultimate: **Ancestral Reincarnation** | Designed for the roster's future ultimate mode: one grounded 60-frame ritual at 100+ damage heals 35 once per match; taking a hit interrupts and spends it. No invulnerability or stock revival. Like today's hero ultimates, named metadata only while the shared ultimate action is disabled. | [Reincarnation][wc] | [Bowser's survival traded against commitment][bowser] |

War Stomp, up tilt and up throw start follow-ups; Gore is a finisher with no follow-up. They use ordinary DI, SDI,
hitstun and tech rules, with no scripted second hit, bury or stun.
The defender can change the landing and Cairne must choose a chase. Stronger
hits retain longer recovery; no move adds shield damage beyond its damage.
All state uses the existing guard, projectile and special records,
including stock/rematch reset and replay copies.

## Place in the roster and presentation

Compared with Rifleman, Cairne gives up repeated ranged pressure
for one low wave and direct hits. Compared with Illidan, Blademaster and
Warden, he gives up burst mobility and evasive branches for survival. Compared
with Mountain King and Forsaken Paladin, he is larger, slower and has broader halberd reach.
Compared with Lich and Shadow Hunter, he has no placed control zone. Compared
with Dreadlord, his only capture is a grounded horn charge, with no sleep. Compared with Pit Lord, he is
heavier and taller, with a low straight wave and launcher rather than an arc
projectile and armored charge. Compared with Beastmaster, he fights with one
body. Compared with the Lich King, he has no frost-zone kit or persistent pool.

Use the base-game Tauren Chieftain model and command portrait, stock Warcraft
impact sounds, a spirit-blue Crushing Wave missile and a small stock ground
ring for War Stomp sized to its regions. The wave stays distinct from Mountain King's ground
waves. His halberd remains attached;
the gesture plants his feet, moves the whole shoulder and follows through.
Map or author the complete hero pose table, including both sides of throws,
recovery, and nine pain poses. His gameplan is the hard read: Shockwave makes
a foe jump or shield, a jump meets up tilt or up air, a shield meets Gore, and
pressure on him meets the armored stomp. The computer stands just inside
stomp range, sends a wave at distant ground approaches, runs in with the stomp
and stomps again on a tech, stomps through incoming light hits and after a down
throw, saves Gore for kills from 105%, and saves Spirit Lift for returning to
the ledge.

[wc]: https://liquipedia.net/warcraft/Tauren_Chieftain
[bowser]: https://www.ssbwiki.com/Bowser_(SSBU)
[krool]: https://www.ssbwiki.com/King_K._Rool_(SSBU)
[eruption]: https://www.ssbwiki.com/Eruption
[slap]: https://www.ssbwiki.com/Hand_Slap
[ganon]: https://www.ssbwiki.com/Flame_Choke
[falcondair]: https://www.ssbwiki.com/Captain_Falcon_(SSBM)/Down_aerial
[ganondair]: https://www.ssbwiki.com/Ganondorf_(SSBM)/Down_aerial

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). The true super-heavyweight; his halberd controls a large patch of ground.

```balance-profile
fighter: cairne-bloodhoof
archetype: heavy
aerials: nair 10-40, fair 10-40, bair 15-45, uair 5-30, dair 5-30
air-share: 5-35
approach: 45-75
ranged: 0-20
specials: neutral 2-12, side 2-12, up 0-8, down 2-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: cairne-bloodhoof
path: decision
basic-moves: forward-tilt,neutral-special,neutral-air
```

Basic gameplan: Use long axe pokes and a simple shockwave. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Choose armor, stomp, grabs and slow kill commitments around opponent recovery. Use the full authored kit and gameplan at the same CPU skill.

## Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 30-33, 25%; weak hit sourspot, frames 30-33, 19%. The halberd's head carries the earth's weight; the haft only shoves.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).
