# Grabs

#337 adopts one grab envelope across the roster, measured from Melee's
average standing grab. Distances use the existing physics scale of six
Smashcraft world units per Melee unit; frames remain at 60 Hz.

The 26 standing-grab rows in
`references/melee-frame-data/libmelee.jsonl` give a mean farthest forward
edge of 16.008426 MU, mean bottom 3.409252 MU, mean top 11.663002 MU,
and mean active duration 3.115385 frames. Each fighter contributes once:
reach is its greatest `x + size`, bottom its least `y - size`, top its
greatest `y + size`, across its recorded active spheres. This includes the
four long grabs (Link, Young Link, Samus and Yoshi). These are numerical
observations, not copied move definitions.

Rounding the scaled means gives standing reach 96, bottom 20, top 70,
height 50 and three active frames. Dash and pivot extensions are original
Smashcraft choices required by #337, respectively 1.25 and 1.5 times this
standing reach. Melee has no separate pivot-grab animation; its turn into
standing grab informs the direction change, not the extra reach.

| Grab | Forward reach | Bottom / top | Height | Active frames |
| --- | ---: | ---: | ---: | ---: |
| Standing and out of shield | 96 | 20 / 70 | 50 | 3 |
| Dash | 120 | 20 / 70 | 50 | 3 |
| Pivot (run turn, dash-back turnaround, either pivot frame) | 144 | 20 / 70 | 50 | 3 |

The regions touch authored body capsules, face forward and reject a target
whose feet exceed the listed reach. Startup and whiff duration retain each
fighter's authored timing; dash and pivot add three startup and eleven
total frames. The larger box does not extend throws or the early-ascent
catch window. A stock loss resets the grab variant; rollback stores it.

A pivot grab comes from three places: Turn-run (a run turned), the turnaround
frame of a dash back (the dash dance's first frame the other way), and either
of the two pivot frames that follow a dash back released to neutral
(smashcraft:docs/gameplay-design.md, Pivots). It faces the new direction and
keeps the ground speed it had, sliding under the grab's ordinary traction, so a
pivot grab out of a dash travels like a dash grab, the other way. A grab on the
frame after the two pivot frames is the standing grab from what the pivot left:
about a standstill. A standing grab from a standstill and a grab in a forward
dash are unchanged. Melee's pivot grab is the standing grab, with standing
boxes and animation, on the one dash-dance turnaround frame and never out of a
run ([SmashWiki Pivot grab](https://www.ssbwiki.com/Pivot_grab)); Smashcraft
keeps the 1.5 times reach #337 chose, the dash grab's timing and a two-frame
window (parity rows `pivot-grab` and `pivot-window`). Tom's playtest on
2026-11-01 found a grab on the pivot frame gave a still standing grab with no
reach bonus, because only Turn-run gave the pivot grab; he asked for the
Melee-style sliding pivot grab out of a dash with the pivot box, and for the
pivot to last two frames as an easier window. Tests:
smashcraft:ts/src/game/sim/pivotGrab.tests.ts.

A grab pressed while holding shield stays buffered through hitlag and
shield stun and starts on the first free frame, without shield release.
Its ordinary startup still applies, and it catches only if the attacker's
recovery and spacing permit it. A close blocked Rifleman jab is the
acceptance case. A grab pressed on any jump squat frame cancels the jump
and selects standing grab, even with the running direction held.

Sources: [libmelee recorded frame data](https://github.com/altf4/libmelee/blob/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv)
at `ef679270ff95f0d42339dcdf1608282a35023349`, LGPL-3.0 as recorded
in the corpus README; only recorded numerical facts are used, with no code
or assets copied. Our design targets for jump squat's grab
cancel and for shield grab are recorded in
[the Melee techniques study](melee/techniques.md#shield-drop-jump-cancelled-grab-and-up-smash).
