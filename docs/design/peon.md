# Peon

Peon is a stubborn worker who fights around his burrow: slow feet, short axe
tools and a fragile worksite. All combat values below are original,
provisional Smashcraft tuning.

## Cargo carry

Tom asked for Peon's grab to become a cargo carry in the manner of Donkey
Kong's [cargo throw](https://www.ssbwiki.com/Cargo_Throw) (2026-10-28). The
reference sets only the role (walk the caught fighter somewhere, then throw);
frames, speeds and launches are ours.

- **Grab.** Peon's standing grab is unchanged (startup 8, active 2, total 25).
  A catch says his stock "Work, work." acknowledgement
  (`Units\Orc\Peon\PeonYes3.flac`, checked against the installed game by
  `tools/presentation/stock-sounds.ts`) once, at Peon.
- **Hoist.** For 12 frames Peon lifts the caught fighter from in front of him
  onto his shoulder. He cannot act; the hold timer runs.
- **Carry.** Peon walks with the fighter on his shoulder (8 units behind his
  facing, 70 up) at 0.6 of his walk speed, turning freely and stopping at a
  deck's edge. He cannot dash, run, jump, shield, dodge, attack or use a
  special. The pose is his stock lumber walk and stand with the log hidden.
- **Throws.** From the carry, the C-stick sideways throws that way; attack
  throws forward, or back with the stick held back. The fighter swings from
  the shoulder to the landing side before release.

| Throw | Contact | Total | Damage | Angle | Base | Growth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Forward | 13 | 34 | 7.2 | 35 | 61 | 46.5 |
| Back | 16 | 40 | 8.2 | 40 (behind) | 66 | 31.5 |

- **Escape.** The carried fighter mashes out on the shared grab hold timer,
  through hoist and carry alike. A carry that runs out drops them as a grab
  release.
- **Interrupt.** A hit that puts Peon in hitstun drops the carried fighter.
- **Rollback.** The carry adds no state: it is the grab action (hoist, carry)
  and frame, the held fighter's timer and both fighters' positions, all in the
  snapshot already.
- **CPU.** A computer Peon throws as soon as the carry starts, back when its
  gameplan picks a back throw and forward otherwise.

Next: a jump while carrying, up and down cargo throws, a CPU that walks the
carry toward the ledge, and a fighter-sized carry pose.
