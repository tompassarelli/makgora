# Peon

Peon is a stubborn worker who fights around his burrow: slow feet, short axe
tools and a fragile worksite. All combat values below are original,
provisional Smashcraft tuning.

## Cargo carry

Tom asked for Peon's grab to follow Donkey Kong's Melee cargo flow
(2026-10-28): the grab is an ordinary hold, the forward throw lifts the caught
fighter into a carry, and the carry has four cargo throws of its own
([cargo throw](https://www.ssbwiki.com/Cargo_Throw)). The cargo throws take
Donkey Kong's public Melee cargo damage, angles, base and growth
(references/melee-frame-data/fightcore.csv, damage times Peon's 1.024 throw
scale); frames, speeds and the carry's limits are ours.

- **Grab and hold.** Peon's standing grab is unchanged (startup 8, active 2,
  total 25) and holds as every grab does: attack pummels, and the back, up and
  down throws launch straight out of the hold.
- **Hoist.** His forward throw from the hold (or out of a pummel) is the
  hoist: for 12 frames he lifts the fighter from in front of him onto his
  shoulder. It says his stock "Work, work." acknowledgement
  (`Units\Orc\Peon\PeonYes3.flac`, checked against the installed game by
  `tools/presentation/stock-sounds.ts`) once, at Peon.
- **Carry.** Peon walks with the fighter on his shoulder (8 units behind his
  facing, 70 up) at 0.6 of his walk speed, and drifts at 0.6 of his air speed.
  He can jump from the ground at 0.7 of his jump speed, full or short hop, but
  has no aerial jump. He cannot dash, run, shield, dodge, crouch, catch a
  ledge, pummel, attack or use a special, so walking off the stage carries
  both fighters down. He draws his grab hold clip standing and his walk
  walking: the stock lumber walk and stand draw his timeline body lying flat.
- **Cargo throws.** From the carry, the C-stick throws that way (up, down or
  sideways); attack throws forward, back with the stick held back, and up or
  down with the stick held there. The fighter swings from the shoulder to the
  landing side before release. A cargo throw pressed in the air comes out on
  landing.

| Throw | From | Contact | Total | Damage | Angle | Base | Growth |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Forward | hold | hoist into the carry | 12 | — | — | — | — |
| Back | hold | 16 | 40 | 8.2 | 40 (behind) | 66 | 31.5 |
| Up | hold | 12 | 22 | 6.1 | 85 | 50 | 54.2 |
| Down | hold | 17 | 42 | 5.1 | 70 | set 90 | 100 |
| Cargo forward | carry | 13 | 34 | 8.2 | 55 | 80 | 50 |
| Cargo back | carry | 16 | 40 | 8.2 | 55 (behind) | 80 | 50 |
| Cargo up | carry | 12 | 22 | 7.2 | 90 | 90 | 30 |
| Cargo down | carry | 17 | 42 | 6.1 | 40 | 65 | 26 |

- **Escape.** The held fighter mashes out on the grab hold timer through the
  hold and the hoist, as every grab does. Landing on Peon's back resets that
  timer (Tom asked for this, 2026-10-28) to 180 frames plus 3 per percent of
  the fighter's damage at that moment, capped at 480 frames (8 s) from 100%
  up, so 3 s at 0%, 5.5 s at 50% and 8 s at 100% and above. The reset
  replaces whatever hold time was left, long or short, and starts the escape
  meter full. Each mash input then shortens the carry timer by the same 8
  frames it takes off an ordinary grab hold, and a timer that runs out drops
  the fighter as a grab release, the way a grab hold running out does.

| Victim damage | Carry timer |
| ---: | ---: |
| 0% | 180 (3 s) |
| 50% | 330 (5.5 s) |
| 100% and up | 480 (8 s) |

- **Interrupt.** A hit that puts Peon in hitstun drops the carried fighter.
- **Rollback.** The carry adds no state: it is the grab action (hoist, carry)
  and frame, the held fighter's timer and both fighters' positions, all in the
  snapshot already. The timer is set from the replayed damage on entry, so a
  rollback across the landing replays to the same value.
- **CPU.** A computer Peon forward-throws every grab into the carry, walks it
  toward the nearer ledge and cargo-throws off it within 90 units of the edge,
  or after 60 carry frames short of it.

## Log Heave

Tom asked for a longer log that lies on the floor and visibly gets picked up,
and for an air form (2026-10-28). The log is 156 units long; it lies flat ahead
of him, he grips its near end, lifts it and heaves it over onto his shoulder.
The hit capsules run along the drawn log from his hands, so the tipper reaches
about 125–185 units out. The air form is the same heave and hit regions, once
per airtime, with no stall: he keeps falling with his momentum, and landing
mid-move ends it with 15 frames of landing lag. Frame data and values are in
smashcraft:docs/design/peasant.md.
