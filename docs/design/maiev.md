# Maiev: combo targets and identity guard

Tom set the direction on 2026-10-25: Maiev is modelled on Fox with some Falco,
with explosive combos, edge guarding and tech chases, and she keeps her own
identity. These are her targets for the retune (#304-#308), written before it
starts (#303). The link rows live in `tools/move-data/combo-objectives.json`
and `bun wisp combos --objectives` checks them against the committed link
table; misses are expected until the retune lands. Each row's window and class
comes from the Fox fixture's link table (`tools/move-data/links/fixturefox.md`)
at Fox's weight 75, moved toward Falco where she should be more vertical.

## Link targets

Against weight 75, clean hits. A class is the floor: true beats DI-dependent
beats read. The DIs listed must not escape.

| Opener | Percent | Follow-up | Floor | DIs that must not escape | Source | Today |
| --- | --- | --- | --- | --- | --- | --- |
| down tilt | 0-20 | down tilt | true | | starter row (#299) | holds |
| neutral air | 10-20 | grab | DI-dependent | in, none | Fox true at 10-20 | read |
| neutral air | 0-30 | jab | DI-dependent | in | Fox DI-dependent 0-60 | read |
| down air | 0-100 | down special (Fan of Knives) | true | | Fox down air into shine, true | holds |
| down air | 0-60 | grab | true | | Fox true | holds |
| up throw | 30-90 | up air | DI-dependent | in, none | Fox DI-dependent, out escapes | read at 80-90 |
| up air | 10-60 | up air | DI-dependent | in, none | Fox DI-dependent 10-60 | read |
| up air | 70-100 | up air | read | | Falco: the string ends in a read | holds |
| side special (Shadow Pursuit) | 0-150 | grab | true | | her stun (#273) | holds |
| side special (Shadow Pursuit) | 0-150 | forward smash | true | | her stun (#273) | holds |
| up smash | 30-50 | grab | read | | Fox read; a tech-chase read | holds |

Two starter rows changed. Up smash into grab at 30-50% was DI-dependent; since
the victim techs its landing as in Melee (#297) tech in place, away and toward
all escape, which is also Fox's class, so it is now a tech-chase read. Neutral
air into grab at 100-150% is dropped: Fox's link is none there, and the
low-percent row replaces it.

Down tilt into down tilt is true at every percent today, where Fox's is a read
or DI-dependent. The objectives set floors only; the agency rule
(`docs/gameplay-design.md`, at most 2 true links in a row) caps it in the
retune.

## Edge-guard targets

The link table measures on the stage, so these are `edgeGuards` rows in
`tools/move-data/combo-objectives.json`, which `bun wisp combos --objectives`
simulates (#307). Each places a weight-75 Kobold offstage past the ledge, lands
the move from the nearest spot that reaches, and the victim, under each DI,
then double jumps and up specials home. A row holds when every DI loses the
stock at every percent of its window; reaching the ledge or the stage misses.

| Move | Victim past the ledge, height | Percent | Role |
| --- | --- | --- | --- |
| back air | 40, ledge level | 60-150 | her offstage kill aerial, Fox's and Falco's back air role |
| back air | 60, 40 below | 50-150 | |
| down air | 40, ledge level | 60-150 | a spike offstage, Falco's down air role: its last knife hit spikes airborne foes and keeps its link hit on grounded ones |
| down air | 80, 80 below | 50-150 | |
| air Fan of Knives (#272) | 40, ledge level | 40-150 | the earliest spike, the tool no spacie has |
| air Fan of Knives | 80, 80 below | 30-150 | |

## Identity guard

What she keeps, so she does not become Fox in a costume:

- marks and poison: her neutral special, Shadow Strike, is one slow dagger
  that marks and poisons (one on screen), not a laser; its value is the mark
  and the poison, not chip damage or a stream.
- Blink: her up special teleports in eight directions to a punishable spot,
  not a charged fire dash.
- Shadow Pursuit stun (side special, #273): a set stun that opens grab, smash
  or Fan of Knives, with a second stun inside two seconds only knocking away;
  it has no Melee analogue and stays a recorded deviation.
- Fan of Knives (down special, #272): a frame-4 knife burst with set
  knockback that she can jump out of, so it sits near shine and must stay
  apart from it: it reflects nothing, it never downs, and it must not loop;
  down special into down special stays below true.

What she must not mirror: Fox's shine loop or waveshine, his laser, and his
Fire Fox recovery.
