# Animation scorecard

From `ts/`, `bun wisp anim score` samples the shipped Classic timeline bodies,
writes `build/anim-score/classic.tsv` (a report, not tracked), and prints the worst 40 moves
and a summary for every fighter. `--fighter F` limits a run to a fighter slug;
`--assets PRIVATE_DIR` uses another packaged asset view. A limited run replaces that fighter's rows.

Each row measures the mesh at the exact animation time chosen by production
pose selection while the simulation plays the move. Distances are fractions
of the ready body's height; silhouette masks use the far gameplay camera's
pixel scale. Ready is the pose production pose selection shows on the frame
after the move ends (a special ends when its lock does, the first frame the
fighter can act), so line 2 measures the transition the game draws.

1. **Body drive:** find the mesh vertex nearest the strike's far end at
   contact. A limb carrying that point is found by its hand/foot attachment;
   its shoulder/hip travel divided by tip travel measures body share. Also
   measure how far the filled silhouette's centre shifts toward the strike.
   A limb strike (a kick or claw rake, listed per fighter in `LIMB_STRIKES` in
   `ts/scripts/wisp/animScoreSample.ts`, whose struck point rides a leg or a
   claw arm) is scored on limb drive instead of body share: the foot's or
   claw's travel toward the strike from windup to contact, as a fraction of
   body height. The class's
   mass shift still applies, and the cold reader (line 5) stays the bar.
2. **Return:** mean drawn-vertex error from ready on the final move frame,
   largest single-frame change from end lag through two following frames,
   and tip travel past contact along its incoming direction. Zero overshoot
   fails even if the move ends exactly at ready.
3. **Timing:** the deepest pullback lies before first active; the extension
   peak is within one frame before contact or the class's late allowance;
   recovery keeps moving for the class's minimum share of end lag. Startup
   of three frames or less can omit measurable pullback. Active windows come
   from production collision regions or projectile spawns. The table also
   lists the linked Melee reference's start and total from the checked-in
   frame-data records; those columns do not change our gameplay timing.
4. **Contrast:** rasterize the drawn triangles, then take one minus the
   larger IoU of windup/contact and contact/mid-recovery. More is clearer.
5. **Judgement:** a fresh agent reads six gameplay-size key poses beside a
   Melee reference, scoring readability, weight, anticipation, follow-through
   and character independently. Three fresh judges score each clip, and
   line 5 passes when the per-line median of the first three judgements of
   that clip is at least 4/5 on every line. A move with fewer than three
   judgements of its current clip has no passing line 5, and judgements past
   the third do not count, so re-judging cannot roll a pass. Decided
   2026-10-24 by the proxy under Tom's standing direction (north gate 34),
   because one judge's score varied by about one point per line on the same
   clip; the 4/5 bar and the gameplay-size framing stay.

`anim score` also writes `build/anim-score/classic-crouch.tsv`: each fighter's crouch pose-contrast
line (#376). It holds down for 40 frames (the 24-frame crouch clip, then its held
last frame) after 30 standing frames, then compares the drawn crouch with the
drawn stand: the height ratio of the two bodies and one minus their silhouette
IoU at gameplay scale, both printed to three decimals. A crouch passes at a
height ratio of at most 0.85 and a contrast of at least 0.25 (the aerial
readability contrast); these initial values are Tom's to tune. The `clip`
column names the sequence the pose draws for the crouch: `no clip` marks a
fighter whose pose falls back to its stand, and `pass*`/`FAIL*` mark one that
draws another clip (such as Spell Slam) as its crouch. Neither counts as a
passing crouch.

It writes `build/anim-score/LOOK-ledge.tsv` too: each fighter caught on the
right ledge of stage 0 and held for 60 frames, sampled every sixth frame, in
model space where the ledge corner sits 24 units forward and 90 up
(`LEDGE_HANG_OUTSET`, `LEDGE_HANG_DEPTH`). Each column is the worst sampled
frame: `grip`, the nearest drawn point to the corner over the standing
height (at most 0.12: a hand, claw or weapon is at the ledge); `below`, the
share of drawn points no higher than the corner (at least 0.89, 90% of
Rifleman's 0.994: the body hangs under it); `clear`, the share outside the stage wall (at least 0.9);
and `fit`, the share of the body at or below the corner that is inside the
hang hurt parts (at least 0.6; Tom's gate 25). The grip above the corner is
exempt: the sim hangs every fighter at one depth, and a short fighter's arms,
head and weapon reach above its unchanged hang capsule to hold the lip. Rifleman's natively
accepted hang calibrates these initial values; they are Tom's to tune.
Facing the stage is read on the strip.

`build/anim-score/LOOK-double-jump.tsv` compares a full hop's rise with the
midair jump's rise, each resampled to 16 phases: `mean angle` is the mean
difference, in degrees, of every drawn bone segment's side-view direction
(segments under 4% of standing height skipped), and `contrast` one minus the
mean phase-paired silhouette IoU. A double jump passes at a mean angle of at
least 20 degrees and a contrast of at least 0.2; Illidan's wing beat (24)
and Lich's float (21) are the lowest styles that read as distinct, and the
values are Tom's to tune. The cold reader on the Classic motion strip stays
the bar.

The silhouette centre is a visible mass proxy, rather than a physical
mass-weighted centre. Missing limb names use body travel; the stored `limb`
column makes this inspectable. The independent weight judgement catches
motions these measurements can overrate. A passing animation row needs all
five lines, including an independent judgement, in each supported look.

## Judging

`bun wisp anim judge fetch` retrieves private reference GIFs from SmashWiki.
`bun wisp anim judge prepare --out PRIVATE_DIR [--fighter F]...`
renders batches; `--move FIGHTER:MOVE` selects particular moves. It accepts
the scoring command's graphics and asset flags. The camera holds
still at the middle of the move's height range, as a match camera does, so a
drop or rise shows in the tiles; it follows only travel that would put the body
more than 50 gameplay pixels from that height, so flight does not crop the body
out of its strip, and gameplay scale is unchanged; a movement strip (crouch, ledge hang, double jump)
instead holds the camera on the drawn floor and grows upward so a jump shows
its real height above it. Read `docs/animation-judge-brief.md` in a fresh judge
context and write its requested JSONL. `bun wisp anim judge record
PRIVATE_DIR/scores-*.jsonl` validates and stores numerical judgements in
`tools/move-data/anim-score/judge.jsonl`, each tagged with the identity of the clip it judged: a digest of the key-frame poses `prepare` rendered, written to PRIVATE_DIR/clips.json and attached by `record`. Line 5 takes the per-line median of the first three judgements whose identity matches the clip the scorecard samples now, so a re-authored move drops its old clip's scores; judgements recorded before identities existed count only while no judgement of that move names a clip (#95). Reference pixels stay outside Git.

## Thresholds

The 9 October calibration uses 25 moves: five jabs, tilts, smashes, aerials
and specials, scored independently in five batches. Thresholds use good
individual judged lines (at least 4), rather than admitting a move because
one measured quantity happens to be large. Weight calibrates line 1,
follow-through line 2, anticipation line 3 and readability line 4.

For a minimum take 90% of the smallest positive good observation; for a
maximum take 110% of the largest. Late peak allowance is the largest positive
delay plus one frame. Round outward. Positive minima preserve the requirement
that a frozen body or absent follow-through fails. Where a class has no good
example on a line, use the pooled good examples for that line, and keep its
own contrast threshold. This is an initial calibration, tuned in source by
Tom as better examples are authored.

| Class | Body share ≥ | Mass shift ≥ | End error ≤ | Jump ≤ | Overshoot ≥ | Peak late ≤ | Recovery fill ≥ | Contrast ≥ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| jab | .41 | .15 | .053 | .029 | .029 | 1 | .86 | .36 |
| tilt | .90 | .023 | .053 | .055 | .029 | 2 | .53 | .16 |
| smash | .29 | .071 | .026 | .014 | .095 | 3 | .84 | .43 |
| aerial | .29 | .023 | .008 | .015 | .12 | 3 | .53 | .25 |
| special | .90 | .20 | .046 | .055 | .039 | 1 | .90 | .48 |

Limb strikes need limb drive ≥ .50 in place of body share. Body share is a
weapon-strike rule calibrated on weapon tilts; a snap kick turns from the hip,
so its hip barely travels and its body share sits near .1. The .50 line is
calibrated on Shadow Hunter's six kicks, each named a kick by a cold reader:
limb drive .89–1.24.
Anub'arak's claw rakes (his forward and down tilts, dash attack, and forward,
back and down air) use the same rule: a rake swings the claw from the shoulder
as a kick swings the foot from the hip, and the claw's own swing through
at least 90° (#43) carries most of the tip's travel, so his shoulder cannot
reach the tilt line's .90 body share. His up tilt, smashes, other aerials and
specials, up special included, are carried by the body and keep body share.

Jab weight uses Lich King's second jab; smash weight/return use Malfurion's
down smash; tilt weight uses Mountain King's angled up tilt and Thrall's
forward tilt. Jab return uses Grom's jab and Lich King's second jab. Special
weight/return use Mountain King's and Beastmaster's neutral specials.
The repaired Pit Lord back-air calibrates aerial return and contrast.
Anticipation uses the good jabs, Pit Lord/Lich King/Mountain King tilts,
Blademaster up smash and Beastmaster neutral special. Contrast uses each
class's good readability examples. Tilt return, aerial weight/timing
have no good class example and use the pooled values.

`bun run check` is the named source check.
Re-author worst first under #180; keep a change only when its row improves
and no other line falls, as required by #355.

The initial sampler covers normals for all 26 fighters and damaging or
projectile hero specials; Rifleman/Illidan's separately scripted specials and
non-striking utility moves need additional contact definitions before they
can receive a measured row.
