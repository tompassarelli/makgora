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
| neutral air | 10-20 | grab | DI-dependent | in, none | Fox true at 10-20 | holds (#580): true, the grab lands 18 frames after the hit |
| neutral air | 0-30 | jab | DI-dependent | in | Fox DI-dependent 0-60 | holds (#580): DI-dependent, the jab lands 14 frames after the hit and only DI out escapes |
| down air | 0-100 | down special (Fan of Knives) | true | | Fox down air into shine, true | holds |
| down air | 0-60 | grab | true | | Fox true | holds |
| up throw | 30-90 | up air | DI-dependent | in, none | Fox DI-dependent, out escapes | holds (#306) |
| up air | 10-60 | up air | DI-dependent | in, none | Fox DI-dependent 10-60 | holds (#580): DI-dependent, the short-hop up air lands 25 frames after the hit and DI out and down escape |
| side special (Shadow Dash) | 0-40 | up air | DI-dependent | | Fox Illusion pop-up into up air | to measure (Shadow Dash, 2026-10-28) |

Three rows dropped to the read they measured on 2026-10-27 (#493): back on
Fox's falls (#456) she lands from a short-hop neutral air or up air 3 frames
later than on Falco's. The retune (#580) restores their DI-dependent floors by
changing the two aerials and leaving her physics Fox's:

| Move | Value | Melee | Why |
| --- | --- | --- | --- |
| neutral air | flat 0°, base 37, growth 8, 6.1% | Fox 361, base 10, growth 100, 12% | under the Sakurai angle a grounded victim stays down only below 32 knockback, which caps hitstun at 12 frames; a flat angle keeps it sliding on the floor at 39-40 knockback with 15-16 frames, so grab and jab land before it acts (ledger rows `maiev-neutral-air-*`) |
| up air | landing lag 7 | Fox 9 L-cancelled; Melee spread 7-16 (Falcon, Marth, Mario, Peach 7) | the short-hop follow-up rises 2 frames sooner and meets a falling victim before tech away |

Up smash into grab at 30-50% (a read) was dropped the same day (#493): since
her up smash and up tilt moved onto her glaive above her head (#508), neither
reaches a grounded foe, so the link table has no up smash or up tilt rows.

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
simulates (#307). Each places a weight-75 Rifleman offstage past the ledge, lands
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

## Leg kicks (2026-10-28)

Tom asked on 2026-10-28, while playtesting, for her down tilt to read as an
unmistakable low leg sweep, since her legs had hidden under her cloak. It is
authored by `tools/animations/leg-sweep.py` (beats in
`tools/animations/leg-sweeps/warden.json`) and spliced by `rekey-clip.ts`;
its frame data, damage, angle and knockback are unchanged.

- Back air: Illidan's back air, shared Fox/Falco style (Tom, 2026-10-28: the
  separately authored kick looked wrong, and Melee gives Fox and Falco the same
  move). `tools/animations/retarget-clip.ts` copies his clip's rotations onto
  her matching bones (root, pelvis, chest, head, arms, legs) on the same move
  timeline, with his root translation scaled by her hip-to-ankle height (0.854
  of his), per `tools/animations/retargets/warden-back-air.json`; her skirt,
  cloak, sleeves and hood trail the body turn (one to two frames behind, one
  more per link down a chain), her skirt follows the kicking thigh halfway and
  her front flaps fold forward away from it, so the leg shows behind her on
  every active frame. She takes his frames, damage, angle and knockback: first
  active 4, active through 19, 37 frames, landing lag 8, auto-cancel before 4
  and from 28, 13% at growth 100 and base 10 launching 20 degrees back. One
  capsule, radius 12 (his 14 scaled to her leg), runs from her drawn knee at
  37 behind and 64.5 high to her heel at 80 behind and 80.5 high, which hold
  through the active frames; all of her drawn lower leg sits inside it. Her
  clip plays linearly over the move (strike moment 0.017 s, under the
  alignment floor), as his does. The balance baseline's back-air rows carry
  the new values for this reason.
- Down tilt: from her crouch she drops low with her torso held back over the
  trailing leg, sweeps the right leg straight out along the floor and carries
  it across before folding back up. Her front skirt flaps fold backward and up
  and her arm-hung cloak lifts off the floor, so the leg shows clear of the
  cloak. The two floor capsules are unchanged (reach 105), and 92% of her
  drawn lower leg sits inside them on both active frames.

## Identity guard

What she keeps, so she does not become Fox in a costume:

- poison stacks: her neutral special, Shadow Strike, is one slow dagger
  that stacks poison, not a laser; its value is the stacks and their burst,
  not chip damage or a stream, and no other move reads them. Since Tom's 2026-10-28 request it takes Fox's
  laser frames: the dagger leaves on frame 10 of 36 standing and in the air,
  she acts on frame 37, and landing in the air ends the cast with no landing
  lag (fightcore.csv and records.jsonl: first active 10, total 36, aerial
  landing 0), so a short-hop dagger is free and a short-hop double dagger
  fires its second blade on landing. Up to two daggers may be out, because the
  next cast can start on frame 37 while the dagger from frame 10 flies until
  frame 40, and a short-hop double has its first blade in flight on landing.
  The dagger's speed is unchanged. Per Tom's 2026-10-28 request it deals 2
  damage and is flinchless like Fox's laser: no knockback, hitstun, launch,
  hitlag or interruption of the victim's action, so a victim attacking,
  dashing or airborne keeps doing it, and a shield blocks it as before. Each
  hit adds a poison stack (cap 5) and refreshes a 120-frame timer; when it
  runs out the stacks burst for 1 damage each, flinchless, with a burst effect
  and sound, and clear. The EX multiplier applies to the direct hit only. A
  glow over the foe grows with the stacks. Fan of Knives keeps its own ticking
  poison. The stacks are the reason to throw it, not the stream.
- Blink: her up special teleports in eight directions to a punishable spot,
  not a charged fire dash.
- Shadow Dash (side special, Tom's 2026-10-28 rework): Fox's Illusion with
  her Blink art, a straight dash on frames 21-25 of 63 that special cuts
  short and whose slash pops the foe up at 80 degrees (growth 40 standing
  and 60 in the air, fightcore.csv's Illusion row). One recorded deviation
  makes the pop-up start combos: base 74 instead of Illusion's 68, so a foe
  tumbles from 0%. A hit, a shield and a whiff keep the same 63 frames: after
  a shield she acts 46 frames after contact, 10 frames after the foe's
  shieldstun ends (-36; -14 with the old end-lag skip), and at 0% the foe's
  33 frames of hitstun end 13 frames before she acts (probed headless on
  Rifleman, 2026-10-28). It never homes,
  never teleports behind anyone and never stuns: the stun and mark forms are
  gone. EX dashes 25% farther and changes nothing else. Like Fox's, it catches
  a ledge she faces during its travel and end lag, and its helpless fall
  catches one like any fall (playtest report, 2026-10-28).
- Fan of Knives (down special, #272, #494): a frame-4 ring of knives with set
  knockback, a shine-like semi-spike in the air, that she can jump out of, so
  it sits near shine and must stay apart from it: it reflects nothing, it
  stuns as long as shine (27 Oct) and so tumbles the lighter half of the
  roster as shine does, and it must not loop; down special into down special stays
  below true.
- Fan of Knives turnaround (#513, Tom's 26 Oct direction): she turns around
  in it the way Fox turns around in a held shine. Holding the stick away from
  her facing on the press frame starts it facing the other way; pressing the
  stick the other way on any later frame, on the ground or in the air, flips
  her for the rest of the move without restarting it, and the jump cancel
  comes out facing the new way. Only facing flips: the ring strikes both
  sides alike, and every frame and timing is unchanged.

What she must not mirror: Fox's shine loop or waveshine, his laser, and his
Fire Fox recovery.
