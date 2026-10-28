# Pit Lord

Pit Lord is the siege heavyweight: Rain of Fire closes a landing lane, his
cleaver catches the jump out, and his roar buys space when a fast opponent
gets inside. He is still the widest, heaviest, slowest fighter: weight 1.28,
ground speed 0.80, air speed 0.75, width 1.65 and height 1.35 relative to the
reference body. Those existing body values and his normal attacks remain.
His vertical physics, shared with Cairne, follow Melee's heavyweights: gravity
0.18 instead of Fox's 0.23, with full and double jump speeds lowered to keep
Fox's peak heights. His short hop lasts 24 airborne frames instead of 19, so
his f20 down air hits from it with 4 frames to spare (#611).
All special values below are original, provisional Smashcraft tuning.

## Sources and interpretation

[Warcraft III's Pit Lord](https://classic.battle.net/war3/neutral/pitlord.shtml)
provides Rain of Fire, Howl of Terror, Cleaving Attack and Doom. Its suggested
rain-then-cleave plan is the center of this fighter. Warcraft's damage
reduction becomes an immediate shove here: the opponent sees what the roar
did. Cleaving Attack remains his broad weapon strikes. Doom, his ultimate,
keeps Warcraft's point-and-click curse and its Doom Guard (made a targeted
curse on 2026-10-28 after playtesting found the old close grab too hard to
land). He locks the nearest foe within 600 units, its Doom glyph shows on
them from frame 1, and on frame 20 a fel bolt lands on them wherever they
are: no shield blocks it and nothing reflects it. Only intangibility on that
frame (a timed spot dodge, roll or air dodge) or being out of range escapes
it; knockback armor (100, like War Stomp) carries him through jabs until
then, while a smash breaks it. A hit deals 10% with a small pop up and dooms
the foe, who burns 1% a second (a fel curse over their head and a Doom mark
by their percent) until they lose a stock. Dooming them again changes nothing.
Three seconds after a doomed foe loses a stock, as they respawn, a fel portal
opens on the main deck nearest where they fell and a Doom Guard steps out to
fight for him for 8 seconds: 40 durability, a 26-frame wind-up into a heavy
cleave every 90 frames that throws a short fire wave. It stands 40 frames
before its first swing, so the returning foe is threatened, never hit while
respawn-invincible. One Doom Guard at a time. Killing the Pit Lord first lifts
his curses, cancels a pending Doom Guard and dismisses one already out.

[Valve's original Underlord introduction](https://www.dota2.com/darkrift?l=english)
provides Firestorm's repeated falling fire and Pit of Malice's control of a
chosen area. Rain borrows that area-control decision without a root: opponents
can move, jump, shield or attack the caster. Dark Rift informs the abyssal
recovery theme, but the fighter travels visibly through the whole leap.

[Bowser's official Smash move description](https://www.smashbros.com/wii/en_us/characters/bowser.html)
is the reference for a huge body whose strong commitment leaves a clear
punish, and for letting the opponent respond to a heavy's power move.
[Ridley](https://www.smashbros.com/en_US/fighter/65.html) is the silhouette
reference for separating a large demon's striking limb from its torso.
These are design relationships, not copied frame data, hitboxes or animation.

## Four specials

Frame numbers below count the entry tick as frame 1. H is the existing hero
reference height. All body hits use the shared contact, shield, hitlag and
launch rules. Air casts never stall their fall.

| Input | Player decision, result and screen cue | Commitment and counterplay |
| --- | --- | --- |
| Neutral — **Howl of Terror** | Inhale on f1–17 while a dark fel glow builds at the mouth and Warcraft's Howl of Terror roar sounds on f1, then the shockwave on f18. A fel-red shockwave ring expands on both sides over f18–22 to 1.6H, with a small screen shake and Warcraft's Howl of Terror roar; the drawn ring is the live hit circle on every frame. Each foe is hit once for 4 damage. A grounded foe is **Terrified**: no launch, it cowers in place under Warcraft's Howl of Terror target art for 30 frames plus 0.4 a percent of its post-hit damage, at most 90; any hit ends it. An airborne foe is pushed away from Pit Lord at 45 degrees and is never terrified. A terrified foe then resists terror for 300 frames and shows a resist flash instead, so it cannot chain. Sourced from Warcraft's Howl of Terror fear and Mewtwo's Disable. | 12 mana, ends f40. At 0% a close foe recovers about when Pit Lord does and escapes; at mid percent dash attack, forward smash or Rain of Fire connects. A shield is not terrified but takes 18 shield damage and a big shield push. Air landing lag 12. |
| Side — **Ruin Charge** | Lower the chest, plant the hind legs, then drive the horns and shoulder forward through a flame trail. 15 damage at 35 degrees. The armored push is an adaptation of Warcraft's charge-into-cleave plan with Bowser's commitment. | 22 mana, active/travel f19–26, ends f64. Ground travel 1.5H. One hit of at most 6 damage is absorbed on f19–24 only; a visible hard glow identifies that window. Stops at a body or shield. Air travel 0.8H, no armor, once per airtime, helpless afterward. |
| Up — **Abyssal Leap** | Compress all four legs, then rear up hoof-first with embers beneath the body. The rising hoof hits for 10 damage at 80 degrees. Warcraft's demon body and DotA's abyssal escape theme meet a deliberately exposed heavy recovery. | 15 mana; hoof f13–18, travel through f32. Full rise 3.5H, forward drift 0.5H and up to 1.15H of stick steering. Below 15 mana: a shorter free rise with no hit, meeting the 240-unit route floor on both axes. Paid and free routes use the [#252 recovery measure](../gameplay-design.md#recovery-and-edgeguarding), with the paid route in the heavy band. Spends the aerial jump and ends helpless. Both forms remain hittable during the rise and exposed descent. |
| Down — **Rain of Fire** | Raise the cleaver and free hand, then drag them downward. Three large flaming rocks fall in sequence into a lane ahead: near, middle, far. Each visibly falling rock can hit once for 5 damage at 70 degrees. This is Warcraft Rain of Fire and DotA Firestorm, using the heavy's obvious commitment from Smash. | 20 mana, meteors appear f25/31/37, cast ends f60. Centers 1.8H/2.2H/2.6H ahead, 2.8H above feet; fall 0.16H/frame, radius 0.22H, life 24. Three at once maximum; no new cast while they remain. Reflectable, shieldable. Rush underneath, jump beyond the lane or interrupt before later rocks appear. Air landing lag 24. |

The falling rocks themselves show the danger before contact. Rain has no
hidden burn, guaranteed three-hit string or damage suppression. Its 6-frame
spacing is pressure the defender can escape, not a promise of a combo. The
roar's ring, the cower and the target art show the whole effect. Charge's flame trail follows the
actual moving body, and the leap's hoof leads the actual hit region.

## Whole-kit decisions

Hold the cleaver's existing 120–190 unit spacing. Rain pressures opponents
outside that space; it is too slow when they are already close. Follow their
jump with up tilt or up air, or catch a grounded approach with forward tilt.
Charge punishes a predicted retreat, while Howl freezes a grounded opponent
who got inside long enough for a readable punish at mid percent. The existing down tilt, up tilt and up throw remain
launchers into reads and tech chases. No new guaranteed string is designed.

Compared with Rifleman he commits to a falling lane rather than
firing fast horizontal shots; compared with Illidan, Blademaster and Warden
he trades pursuit for space. Mountain King and Forsaken Paladin are compact brawlers;
Pit Lord exposes a much larger target. Lich and Shadow Hunter can sustain
ranged pressure; Pit Lord must finish with his body and cleaver. Dreadlord's
deception, Beastmaster's partner and Lich King's growing pool each persist
beyond their immediate action; Pit Lord's threat is a plainly visible rain
or swing with a definite end.

The CPU aims Rain at the opponent's expected position when the fire reaches
their height, accounting for the cast startup and their current movement.
It uses Howl when crowded, Charge to advance and Leap
to recover. Its seeded match coverage records all four separately. Down air
is the four-hoof downward spike, with its own downward pose from #218.
The issue carries the delivery and playtest checklist.

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). The siege heavyweight: Rain of Fire closes a landing lane, the cleaver kills early.

```balance-profile
fighter: pit-lord
archetype: heavy
aerials: nair 10-40, fair 10-40, bair 15-45, uair 5-30, dair 5-30
air-share: 10-40
approach: 45-75
ranged: 5-30
specials: neutral 2-12, side 2-12, up 0-8, down 2-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: pit-lord
path: decision
basic-moves: forward-tilt,side-special,neutral-air
```

Basic gameplan: Use cleave range and a direct rush. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Commit armor and fire zoning at the right moment and choose kill routes. Use the full authored kit and gameplan at the same CPU skill.

## Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 27-30, 25%; weak hit sourspot, frames 27-30, 19%. The cleaver's far edge: the demon lord's huge reach is the point.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).
