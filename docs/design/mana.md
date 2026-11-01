# The ultimate meter

Tom replaced special costs with one super meter on 8 October 2026 (#335). On
29 October 2026 Tom removed EX and the match-clock fill to simplify the game.
On 2 November 2026 Tom set the centre-stage orb aside for now and asked for every
fighter to have an ultimate once a minute by default, so the meter fills from the
match clock again and orbs are an opt-in rule.
Every special is free and starts the same way with or without Strong (Strong
still makes smashes). The ultimate ([ultimates.md](ultimates.md)) is the
one thing the meter buys.

Each fighter carries one meter, `fighter.meter.ultimate`. It is a frame counter,
part of replay and rollback state, and is kept through a KO and respawn. The
rules live in smashcraft:ts/src/game/sim/meter.ts; the match step adds the clock fill
and, with orbs on, schedules the orbs and runs the pickup (smashcraft:ts/src/game/match/orbs.ts), whose rules and
record live in smashcraft:ts/src/game/sim/orbs.ts and sim/orbState.ts.

By default the match clock is the only source: a fighter's meter gains 2 frames
every frame of play (after the start hold), so it is full 60 seconds after the
match starts and 60 seconds after each spend. Nothing comes from damage, taken
or dealt (gain from taking damage rewarded the player who guessed wrong, and
gain from dealing it was win-more). With the Orbs rule on, the clock fill stops
and the orb at centre stage is the one source instead, so the player who wins
the centre earns the ultimate, as Dota 2's power runes reward the team that
reaches the river ([gameplay design](../gameplay-design.md#centre-stage-orbs)).
The orb code and its tests are kept.

| Rule | Value |
|---|---|
| Ultimate meter | 7200 frames, shown as a percent. A match starts empty. |
| Gain | Orbs off (the default): 2 frames per frame of play (`ULTIMATE_CLOCK_GAIN`, integer, so 3600 frames to full on Bun and Lua32), for every fighter in the match, KO'd or not; none in Training. Orbs on: ultimate orbs only, each half a meter (3600 frames), so two orbs make an ultimate, and no clock gain. Never from damage dealt or taken, idle, movement, shielding, shield damage or parry. |
| Stock loss | The meter keeps its value through the KO and respawn. |
| Regular special | Free; always chooses its full ground or air form. Existing cooldowns, airtime limits and entity limits still apply. |
| Ultimate | Needs a full meter and spends all of it. Input is Attack + Special together; below a full meter, or with ultimates off, the ordinary special starts instead, with no refusal or partial spend. |
| Orb | One orb appears above centre stage every 30 seconds of play (0:30, 1:00, 1:30 ...), with a 3-second warning before each. A fighter respawning when it is due makes it wait until the respawn ends. Taken into a full meter, it is wasted. Orbs are off by default; with them off, and in Training and Classic and lore runs, none is scheduled. |

## Pickup

A fighter collects the orb by touching it: its body (the hurt capsule) or the
active hitbox of a normal attack (jab, tilts, smashes, aerials, dash attack)
overlapping the orb. It must be in a regular state: standing, walking, running,
jumping, falling, shielding or in a normal attack.

It is not collected while the fighter is in a special, an ultimate or an air
dodge (the wavedash landing slide included), nor while rolling, tumbling, in
hitstun or hitlag, KO'd or respawn-invincible; in those states the orb passes
through. Projectiles never collect it.

When several fighters touch it on the same frame, the one whose body centre is
horizontally nearest the orb takes it; on an exact tie the lowest player slot
takes it. The step is deterministic and identical on every client (Bun and
Lua32).

Examples: one orb is worth half the meter, so the fighter who takes both the
0:30 and 1:00 orbs holds a full ultimate at 1:00, and a fighter who takes only
one waits for the 1:30 orb or for the foe to feed them. A fighter who air
dodges through the orb gets nothing from it, and a fighter in the middle of a
special does not either; a jab or an aerial that reaches the orb takes it.

## Ready signal

The fighter's rim of light shows what is ready (`presentation/meterGlow.ts`). A
full ultimate meter, with ultimates on, wears a warm gold rim breathing slowly.
The white 12-frame fighter flash and Warcraft's stock
`Sound\Interface\ItemReceived.flac` mark the ultimate meter becoming ready, once
on the confirmed frame. Replay and prediction never play the sound.

The HUD shows the meter as a long thin gold bar in the recessed slot under the
damage number (`presentation/meterBar.ts`, `ui/meterBar.ts`, boxes in
`ui/plateLayout.ts`): it fills left to right as the meter fills and, when full
with ultimates on, pulses between gold and orange. The bar is on the inner side
of the plate, mirrored for the right-hand plates, and clear of the name, player
tag and stocks. The existing purple flash over the bar marks a drain. The HUD is
the only meter display; fighters carry no duplicate overhead bar or pips. The
single orb shown in the match is the gold and orange ultimate orb.

These cues reuse the game's white fighter flash and stock sounds; they add no
imported art or audio. match/orbs.tests.ts and presentation/meterRim.tests.ts
pin the orb and glow rules in Bun and Lua32.

## Drains

Authored damage drains act on the ultimate meter; their authored numbers are
read as a percent of an ultimate meter, 72 frames per percent. Illidan's and
fire hits drain the struck foe's meter (`manaDrain`); no move steals meter, and
nothing an attacker does adds to their own. Two kits spend or drain the meter
beyond the ultimate:

- Lady Vashj's Mana Shield pays half of each hit from her ultimate meter at 72
  frames per 1% (one orb's half meter absorbs 50%) and breaks into its 20-frame
  stagger when the meter runs dry; with an empty meter it breaks on the first
  hit ([lady-vashj.md](lady-vashj.md)).
- Her Tidal Serpent drains 108 frames (1.5%) of the struck foe's ultimate meter
  and hands nothing back to her.

Lich's Dark Ritual gains no meter. No status reads the meter. Hero-specific
spell refunds remain authored move effects; they never make an ordinary special
cost meter.

## Open questions (to test)

- Holding the orb while a player respawns until their invincibility ends:
  whether the wait reads as fair or as a stall.
- Pickup height with the shortest and tallest fighters in play: whether both
  reach the orb as easily as a standing hurt capsule suggests.
- Whether a normal attack that reaches the orb makes the centre too easy to take
  from a fighter standing under it.
- Whether one ultimate a minute is too frequent or too slow, and whether orbs
  should return as an extra source on top of the clock.
- Whether the gold glow reads at a glance.
- Ultimates aim at about 25-30% damage; the current values are being tabulated
  separately.

## Ultimates

[ultimates.md](ultimates.md) owns the ultimate moves. They spend the whole
ultimate meter.
