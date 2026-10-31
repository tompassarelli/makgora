# Beastmaster: fight with the pack

Beastmaster builds a small formation, then fights beside it. Bear threatens the
ground, Quilbeast creates a firing position, and Hawk threatens the air. The
opponent can rush Beastmaster during a call, jump over the ground animals,
shield their attacks, or hit the animals to remove that part of the formation.
All three may exist together and each has its own position and durability.

The existing axe normals, movement, weight and down-throw chase remain his
close-range kit. This distinguishes him from Shadow Hunter's stationary ward, and the roster's projectile or rushdown fighters:
he chooses which independent position to attack from. Losing the formation
costs time and mana. Animals never block hits intended for Beastmaster.

## Controls and decisions

Values below are original provisional Smashcraft values, in simulation frames;
the call frame is one-based. H is the existing hero reference height.
With the shared recovery band, his authored normal, throw and pack damage is
90% of the preceding kit; timing, geometry and knockback growth are unchanged.

| Input | Action and reward | Commitment and response |
| --- | --- | --- |
| Neutral: Wild Axes | Two axes leave on frames 16 and 20 at different heights. Each travels about 3H in a straight line and disappears at the end of its travel (changed 2026-10-31: Tom asked for axes that no longer return). Free, 4.5 damage each. | Ends frame 35; 20 landing frames in air. Two axes maximum. Shield, jump between their heights, or approach beneath them. Each axe disappears on contact. |
| Side: Summon Bear | Without Bear, call it on frame 29 for 20 mana. Bear stands 1.1H tall with a 0.4H body, follows 0.8H behind on its own deck and survives 480 frames or 30 damage. | Ends frame 49, ground only. Punish the call or attack the Bear. |
| Side with Bear: Stampede | Order Bear's 12-frame roaring warning, then an 8-frame 2.6H charge that runs past Beastmaster and mauls up to about 2.4H ahead of him, then 26 recovery frames; the 13.2-damage maul launches outward at 40 degrees with kill-class knockback. Three thunder lizards run ahead from Beastmaster on frames 2, 5 and 8, each 3.6 damage, crossing about 6H of stage; at mid range their flinches land first and hold the target for the maul, so the maul's launch is the last hit. Ground pressure at mid range and an edgeguard against low recoveries. | Costs 12 mana, ends frame 32, cannot repeat while Bear charges or is stunned. Jump over the line, shield, strike Bear during warning, or hit Beastmaster to cancel the command. |
| Down: Summon Quilbeast | Call a 0.8H-tall Quilbeast (0.32H body) on frame 18 for 12 mana; it holds its ground position and fires one 2.7-damage quill after settling, then at 90-frame intervals. It survives 600 frames or 18 damage. Quills poke at horizontal approaches while Beastmaster advances. | Ends frame 32, ground only. The low animal can be struck; its straight shots can be jumped, shielded or reflected. No automatic targeting. |
| Down with Quilbeast: Quill Volley | Turn Quilbeast toward the input facing and fire three quills after a 10-frame warning, 8 frames apart, from 0.45H up its body. Quilbeast shoots from its own position, setting up a crossfire with the returning axes or covering a Bear chase. | Costs 6 mana, ends frame 24; the animal cannot volley again until its 48-frame command completes. Automatic shots pause during commands and stun. Hitting the animal stuns it; hitting Beastmaster cancels the remaining volley. |
| Up on ground: Summon Hawk / Hawk Dive | Call Hawk on frame 12 for 10 mana, ending frame 26. It follows 0.6H ahead and 1.2H above Beastmaster. Press again to send it diagonally down and forward after 8 warning frames, 2H across and 1.4H down to the ground. One 6.6-damage strike pops the target lightly and stuns it for 40 frames wherever it lands, a window for a smash or an axe; the stun cannot recur on that target for 300 frames. | Dive costs 6 mana, ends frame 24; 8 active frames and 28 recovery frames. Shielding the dive prevents the stun. Hawk has 12 durability and 600 life. Its descent is fixed on command, so sidestep or strike it; it does not home. |
| Up in air: Hawk Lift | Hawk appears beside him if absent and carries him up with held-side steering for 15 mana. The [#252 drifting recovery band](../gameplay-design.md#recovery-and-edgeguarding) sets the paid route at 380–520 units up and 600–900 across; below the mana cost, the shorter free route reaches at least 240 units on either axis. Hawk remains a separately moving companion afterward. | Frames 10–32 lift, once per airtime, consumes aerial jump and ends helpless. No attack while carrying; vulnerable from the side and above. |

Quilbeast stays where called, Bear follows on its original deck, and Hawk can
cross a ledge in flight. Animals stop attacking during Beastmaster's hitstun or
grab. Their health, positions, attack phases, hit records and lifetime restore
with replay and clear on a lost stock or rematch. No invulnerability, armor or
body blocking comes from owning an animal. Commands do not repair animals.

## What to combine

In neutral, Wild Axes makes the opponent choose a route while Beastmaster
establishes Quilbeast. Bear punishes a grounded approach; Hawk discourages a
predictable jump. Down tilt and the existing low down throw start a chase;
Bear can cover a tech direction. Hawk's dive stuns
its target for a grounded smash or axe follow-up. These are attempted
follow-ups, not a guaranteed string or a grab loop. At the edge, Quilbeast
covers the horizontal route and Hawk dives below the lip; Stampede covers a
grounded return. Offstage, Beastmaster gives up attacking to use Hawk Lift.

The stock Warcraft animations supply each animal's stand, movement and attack;
the fighter's forward cast signals a command, and his axe swing signals Wild
Axes. Bear rears during its warning, lunges with its attack pose, then finishes the
swipe. Quilbeast braces and recoils separately for each quill. Hawk pitches
down through its dive and visibly travels from above to below the target.
These poses play at each animal's actual position, with full windup and
follow-through instead of cutting the animation to the short contact window. Hawk Lift draws the same Hawk, never an extra cosmetic
copy. Stock Warcraft models remain private inputs.

## Sources and borrowing

- [Warcraft III Beastmaster](https://classic.battle.net/war3/neutral/beastmaster.shtml):
  the named Bear, Quilbeast and Hawk can coexist; Stampede supplies the thunder
  lizards. This kit keeps the Bear's melee role, Quilbeast's ranged role and
  Hawk's flying role. The timings and platform-fighter behavior above are new.
- [DotA Beastmaster](https://www.dota2.com/hero/beastmaster) and Valve's
  [7.07 hero rework](https://www.dota2.com/duelingfates): Wild Axes and Call of
  the Wild provide the hero identity. No DotA damage amplification is added.
- [Rosalina & Luma](https://www.smashbros.com/wiiu-3ds/us/characters/rosetta.html):
  Bear borrows pressure from a separate position and the cost of losing a partner.
- [Duck Hunt](https://www.smashbros.com/en_US/fighter/59.html): Quilbeast borrows
  a delayed ranged threat that lets the fighter approach behind it.
- [Olimar](https://www.smashbros.com/wiiu-3ds/us/characters/pikmin.html): the
  pack borrows visibly different companion jobs and replaceable small bodies.
- [Ice Climbers](https://www.smashbros.com/en_US/fighter/15.html): the formation
  borrows coordinating two locations; Beastmaster's hitstun cancels animal
  attacks so the pack does not create an automatic escape from being punished.

References checked 8 October 2026. These are gameplay ideas, not copied code,
models, animation, exact frame data or hitboxes.

## Bear readability: Tom's 8 October playtest

A player should describe Bear as: **“It follows me, then I command a roaring
charge that knocks enemies away.”** The command is a 12-frame warning, an
8-frame 2.6H charge and 26 recovery frames (14 October, Tom's second report that
Bear did nothing: the old 1.2H lunge from behind Beastmaster barely reached past him).

Every command starts with a large rear-up silhouette and a roar at Bear's own
position. The windup shows a stock Battle Roar crest over its head. One forward
swipe follows; the animation holds its contact pose through the four attack
frames, then visibly settles during recovery. The presentation never changes
Bear's hurt region, damage, travel or timings.

A compact marker above Bear names its state: **FOLLOWING** in pale blue,
**CHARGING** in gold, **ATTACKING** in red and **RESTING** in grey. Stun also
shows RESTING. The marker disappears with Bear. On a confirmed bite, a distinct
heavy claw impact sound and a short impact burst play at its jaws; a miss
plays neither. Each command roars once and each connected bite sounds once.
Quilbeast's three firing recoils and Hawk's descending attack remain separate
from this Bear signal.

The headless contract checks the four state windows, one roar per command and
one impact per connected bite; the existing pack script still exercises the
whole kit. The automated script checks that the roar crest is visible during the windup;
all special and companion gameplay contracts remain in Bun and emitted Lua.

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Separate ground and air threats from the pack, followed by axe normals.

```balance-profile
fighter: beastmaster
archetype: setplay
aerials: nair 10-40, fair 10-40, bair 15-45, uair 5-30, dair 0-25
air-share: 15-45
approach: 35-65
ranged: 15-50
specials: neutral 3-15, side 3-15, up 0-8, down 2-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: beastmaster
path: decision
basic-moves: forward-tilt,down-tilt,neutral-special
```

Basic gameplan: Poke with axes and use a simple axe throw. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Position summons, choose pressure routes and cover the opponent escape. Use the full authored kit and gameplan at the same CPU skill.

## Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 21-24, 21%; weak hit sourspot, frames 21-24, 14.7%. The axe head bites; the haft only shoves.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).
