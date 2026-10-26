# Maiev: combo targets and identity guard

Tom set the direction on 2026-10-25: Maiev is modelled on Fox, with
explosive combos, edge guarding and tech chases, and she keeps her own identity. These are her
targets for the retune (#304-#308), written before it starts (#303). The link rows live in `tools/move-data/combo-objectives.json`
and `bun wisp combos --objectives` checks them against the committed link
table; misses are expected until the retune lands. Each row's window and class
comes from the Fox fixture's link table (`tools/move-data/links/fixturefox.md`)
at Fox's weight 75.

On 2026-10-26 Tom clarified that her reference is Fox alone: the Falco-style
vertical combo game belongs to Illidan (#457). Her falls, jumps, weight and air
speed went back to Fox's (#456), the up air string row that ended in a
Falco-style read was dropped because Fox's up air into up air has no link past
60%, and the down air spike edge guards, a Falco role, were dropped; her down
air keeps its spike as her own move, unchecked.

## Link targets

Against weight 75, clean hits. A class is the floor: true beats DI-dependent
beats read. The DIs listed must not escape.

| Opener | Percent | Follow-up | Floor | DIs that must not escape | Source | Today |
| --- | --- | --- | --- | --- | --- | --- |
| down tilt | 0-20 | down tilt | true | | starter row (#299) | holds |
| neutral air | 10-20 | grab | DI-dependent | in, none | Fox true at 10-20 | misses (#456): read, the grab lands 21 frames after the hit, 3 frames later than with Falco's falls, and jump, air dodge and tech away escape |
| neutral air | 0-30 | jab | DI-dependent | in | Fox DI-dependent 0-60 | misses (#456): read, the jab lands 17 frames after the hit, 3 frames later than with Falco's falls, and shield escapes |
| down air | 0-100 | down special (Fan of Knives) | true | | Fox down air into shine, true | holds |
| down air | 0-60 | grab | true | | Fox true | holds |
| up throw | 30-90 | up air | DI-dependent | in, none | Fox DI-dependent, out escapes | holds (#306) |
| up air | 10-60 | up air | DI-dependent | in, none | Fox DI-dependent 10-60 | misses (#456): read, tech away escapes the short-hop up air, which lands 27 frames after the hit on Fox's lower short hop |
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

## Grab and throws (#306)

Her grab, forward throw and back throw take Fox's frames from
`references/melee-frame-data/fightcore.csv`, and down throw his 43-frame
total; up throw keeps its own 20 frames. The knockback is ours, tuned until
each throw passes its declared role in `bun wisp combos --objectives`
(`docs/design/throw-roles.md`).

Up throw into up air read at 80-90% because a tumbling victim who DIs out
lands before a late up air and techs it; the stronger up throw moves that band
to 0%, where Fox's row is not checked.

| Move | Release / total | Melee Fox | Knockback | Role and measure |
| --- | --- | --- | --- | --- |
| grab | active 6-7 / 30 | 7-8 / 30 (Sheik 6) | | inside the spread |
| forward throw | 10 / 33 | 10 / 33 | 40°, base 70, growth 80 | positional: past the ledge from midway at 60% under every DI |
| back throw | 15 / 38 | 15 / 38 | 45° behind, base 72, growth 70 | positional: past the ledge from midway at 60% under every DI |
| up throw | 11 / 20, kept | 18 / 38 | 85°, base 70, growth 100 | combo starter at 0/30/60%; into up air DI-dependent at 10-150%, a read only at 0% |
| down throw | 14 / 43 | 23 / 43 | 70°, set knockback 90 | tech-chase starter: lands 17-23 frames after release at 0-90%, at most 3 frames apart per DI, all four tech options read |

Down throw is set knockback, as Sheik's throws are, so the landing frame does
not drift with percent and the tech chase reads the same at 0% and 90%.

## Edge-guard targets

The link table measures on the stage, so these are `edgeGuards` rows in
`tools/move-data/combo-objectives.json`, which `bun wisp combos --objectives`
simulates (#307). Each places a weight-75 Kobold offstage past the ledge, lands
the move from the nearest spot that reaches, and the victim, under each DI,
then double jumps and up specials home. A row holds when every DI loses the
stock at every percent of its window; reaching the ledge or the stage misses.

| Move | Victim past the ledge, height | Percent | Role |
| --- | --- | --- | --- |
| back air | 40, ledge level | 60-150 | her offstage kill aerial, Fox's back air role |
| back air | 60, 40 below | 50-150 | |

Air Fan of Knives has no row since #494 (26 Oct). Its Fox-shine hit (5%, set
knockback 80, horizontal) loses no stock under every DI from 20 to 120 past
the ledge at ledge level down to 120 below, at any percent: the victim still
holds its double jump and up special and reaches the ledge or the stage, as a
Melee shine spike only gimps a foe who has spent its jump. The #272 rows were
for the straight-down spike it replaced.

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
- Fan of Knives (down special, #272, #494): a frame-4 ring of knives with set
  knockback, a shine-like semi-spike in the air, that she can jump out of, so
  it sits near shine and must stay apart from it: it reflects nothing, it
  never downs, and it must not loop; down special into down special stays
  below true.

What she must not mirror: Fox's shine loop or waveshine, his laser, and his
Fire Fox recovery.
