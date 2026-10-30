# Archimonde the Defiler

Archimonde is a superheavy zone-control punisher: the tallest fighter in the
roster, who marks the ground and waits for the foe to step into it. Tom asked
for him (2026-10-28); his spec is the Archimonde section of
smashcraft:docs/design/roster-next.md. All combat values are original,
provisional Smashcraft tuning; the Melee anchor is Ganondorf's shape (slow,
heavy, huge punishes, a recovery edge-guards punish), not his numbers.

## Body and model

- **Model.** The stock Warlock model (`units\demon\Warlock\Warlock.mdl`), no
  import. It has nine clips: two stands, walk, Spell Slam, death, dissipate,
  two attacks and a spell. Every pose maps onto one of them until his
  authored clips land.
- **Size.** Draw scale 1.45; weight 118, the heaviest in the roster. His hurt
  capsule is the tallest of the heavies (height 1.50 times the reference, width
  1.45 times), slow run (0.80), low air speed (0.82), traction 0.08. His shield sits at
  height 100 with radius 168.
- **Voice.** He has no stock unit soundset, so his ready and warcry lines are
  campaign dialogue (`N07Archimonde04` and `U08Archimonde20`), the way
  Medivh's are.

## Kit

Normals, grabs and throws follow roster-next's frames and damage. The forward
smash is his signature: the fel claws at the end of the slam deal 21% and
kill, while the forearm deals 14% and only shoves. The back air is his
strongest aerial (15%). The down air spikes on its clean hit. His back throw
is the kill throw, and his down throw sets a fixed knockback for tech chases.

Specials:

- **Finger of Death** (neutral). On frame 1 a ring marks the foe's
  position and heats toward the strike. On frame 32 a lightning column strikes it: 16% at 70°, growth
  102, active through frame 37. The whole action lasts 58 frames.- **Rain of Fire** (side). Two pillars, 170 and 310 units ahead, hit on
  frames 24 and 36; a burning ring marks each from frame 1 and becomes a flame column the size of its hit region on the hit frame. Each covers the full stage
  height at its x for 9%.- **Fel Ascent** (up). He rises 2.6 reference heights over frames 10–24 with
  some steering (drift 6). A fel column below him hits for 7% over frames 10–20. Once
  per airtime, it ends helpless, with 28 landing frames. This is among the roster's
  shortest heavy recoveries, by design.- **Bash** (down). Two hammer-fists into the floor, on frames 16–18 and
  24–26. A grounded foe within 90 units takes 6% and is stunned for 30 frames
  by the first, with no launch; the second takes 6% and launches them at 45°
  out of the stun. The stun is the shared stun status that ends on damage,
  like the Beastmaster hawk's, and leaves 240 frames of immunity, so a hold
  never chains. An airborne foe is launched at 45°. In the air the first fist
  spikes for 6% and the second launches for 6%. 12% in all, 46 frames total.
- **Rain of Chaos** (ultimate). Circles mark the foe's position and 220 units
  either side. Then three infernals crash there in sequence, on frames 42, 50
  and 58, for 8%, 8% and 10%. Nothing stays afterwards.

His home stage is Nordrassil (10), the Battle of Mount Hyjal. His Classic
route ends at Kil'jaeden; the Classic boss Archimonde is a separate boss kind.

## Play-style profile

Tom-tunable draft (2026-10-28; smashcraft:docs/design/balance.md,
"Play-style profiles"). He holds ground with the column and the pillars,
then punishes approaches with the claw smash and the back air.

```balance-profile
fighter: archimonde
archetype: bait-and-punish
aerials: nair 15-40, fair 10-35, bair 20-45, uair 5-30, dair 0-20
air-share: 10-35
approach: 25-55
ranged: 20-50
specials: neutral 5-20, side 5-20, up 0-8, down 3-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: archimonde
path: decision
basic-moves: forward-tilt,down-tilt,forward-smash,neutral-special
```

Basic gameplan: poke with the forward tilt, chase with the down tilt, cast
Finger of Death from range and slam into a whiffed approach. It uses one
approach and shield.

Expert gameplan: choose which ground to deny with the column and the pillars,
cover the foe's landing with the back air, and hold the foe in place with
Bash into the forward smash. It uses the full authored kit and gameplan at
the same CPU skill.

## Measured balance (2026-10-29)

The Balance workflow's field (Wren Expert, 400 matches a pair) over his 27
matchups only (`--matchups`), at main f994bc7, GitHub run
[40889015028](https://github.com/tompassarelli/smashcraft/actions/runs/40889015028),
puts him at **34% wins**, outside the 40-60% band. This is a repair
measurement, not the full-roster gate. Against the profile above (archetype
bait-and-punish):

- air share of normals 7% (band 10-35)
- aerials n/f/b/u/d 27/12/42/6/13% (all inside their bands)
- approach share of movement 82% (band 25-55: the bot walks in instead of
  waiting to punish)
- ranged share of damage 4% (band 20-50)
- specials n/s/u/d 7/24/8/4% of moves (side special over its 5-20 band)

His kills come from forward smash (50%), Finger of Death (11%) and dash
attack (10%). 43% of his stocks are lost more than 3 s after a hit. His worst matchups are Chen (3%), Pit Lord (4%),
Jaina (15%) and Cairne (17%); he beats Mountain King (76%) and Warden (72%).

## Balance pass (2026-10-30)

The first measurement's 34% led to three field runs over his 30 matchups
(`--matchups`, Wren Expert, 400 matches a pair, probe skipped). Holding him at
range with a shoot-only approach, retreat-leaning defense and `whenStale: hold`
made him worse (25% wins, GitHub run
[41069772700](https://github.com/tompassarelli/smashcraft/actions/runs/41069772700)),
so the gameplan stays as authored. A longer, steerable Fel Ascent (rise 1.8 to
2.6 reference heights, drift 2 to 6) reached 36% (run
[41080144005](https://github.com/tompassarelli/smashcraft/actions/runs/41080144005)):
41% of his stocks were lost more than 3 s after a hit. A smaller hurt body
(width 1.70 to 1.45, height 1.60 to 1.50 times the reference) with faster run
(0.70 to 0.80) and air speed (0.72 to 0.82) reached **45% wins** (run
[41082799550](https://github.com/tompassarelli/smashcraft/actions/runs/41082799550),
12240 matches), inside the 40-60% band. Shares at that run:

- archetype bait-and-punish
- air share of normals 6% (band 10-35)
- aerials n/f/b/u/d 30/12/39/3/16% (up air under its 5-30 band)
- approach share of movement 83% (band 25-55)
- ranged share of damage 4% (band 20-50)
- specials n/s/u/d 7/23/8/4% of moves (side over its 5-20 band, up at the
  band's 8% edge)

Still outside the 30-70% matchup band: Chen (5%), Pit Lord (12%), Anub'arak
(17%), Jaina (25%), Cairne (26%) and Shadow Hunter (27%) on the low side,
Warden (85%) and Sylvanas (85%) on the high side. His kills come from forward
smash (56%). Approach, ranged and air shares remain the next balance work.

## Native capture (2026-10-30)

All 58 reel rows (every move, the ultimate and the movement rows, both
facings) captured natively on a VM pair at bff11b1b90 with a 24-tick hold: 462
of 462 frames, none missed. The default 6-tick hold missed 146 frames after
four attempts, so Archimonde's reel needs `--hold-ticks 24`. Three fresh Opus
cold viewers read the sheets with opaque row IDs. Line 7 of finished-move.md
does not pass yet:

- **Rain of Fire** reads as a dash with a green smear and one light column at
  contact; the two ground pillars ahead of him are not read, and the right
  facing shows a column the left lacks.
- **Finger of Death** reads as a wind-up and a flash on the foe; the marked
  ring and the lightning column are not read, and the facings differ in frame 2.
- **Bash** reads as low sparks while the bodies overlap; the two fists into the
  floor are not read, and a green ground glow outlasts the hits.
- **Forward smash, jab, tilts and Fel Ascent** read as intended. **Down smash**
  passes through the dummy and shows its spark on empty floor in frames 5 and 6;
  **grab** reads as a whiff.
- Aerials and several specials stack the dummy inside his body, so the hit is
  unreadable; whiteout flashes hide the pose on back air and Finger of Death.
- The first frames of the forward smash and ultimate rows come from before the
  match clock restarts, and the walk shows almost no travel.

Sheets and viewer notes: `~/.local/state/smashcraft/evidence/sc-664`.

## Native re-capture (2026-10-31)

The first cold reads missed Rain of Fire and Finger of Death because the
showcase sampled them before their strikes (their first cue is the ring
marker, 23 and 31 frames before the strike) and stood the dummy inside his
body. The showcase now samples a special from its strike when the strike opens
8 or more frames after its first cue, stands a foe-targeted special's dummy 220
units away, and stands a wide fighter's dummy 50 units clear of the hurt
capsule for side-on hits that reach it. Five shared-queue captures at
c1ee7ff0 (Rain of Fire, Finger of Death, Bash, neutral air, forward air; both
facings) were read by one fresh Opus cold viewer with opaque ids:

- **Rain of Fire** reads: a fire column sent along the ground into the foe,
  same in both facings; the rings before the strike read as a hit marker.
- **Finger of Death** reads: lightning called down on a distant foe; the
  growing ring hides the foe and the white flash hides his pose.
- **Bash** reads weakly: a close two-hit burst at the foe's feet, with the foe
  overlapping his body and the wind-up differing between facings.
- **Neutral air** reads. **Forward air** does not: the starburst sits inside
  his own body and hides which limb strikes.

Still open for the native-check box: forward air and Bash staging, the other
aerials, down smash, grab and the whiteout flashes, and a full 58-row reel at
`--hold-ticks 24` read by three cold viewers.
