# Animation scorecard

From `ts/`, `bun wisp anim score` samples the shipped Classic timeline bodies,
writes `build/anim-score/classic.tsv` (a report, not tracked), and prints the worst 40 moves
and a summary for every fighter. `--fighter F` limits a run to a fighter slug;
`--assets PRIVATE_DIR` uses another packaged asset view. A limited run replaces that fighter's rows.

Each row measures the mesh at the exact animation time chosen by production
pose selection while the simulation plays the move; a dash attack starts from a
run at the fighter's run speed, as the game enters it. Distances are fractions
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
   A dash attack is its own class: its anticipation lives in the windup,
   so it is measured from the windup frame alone, whatever the move's first
   frame holds, and its body share line is calibrated on dash attacks that
   draw the weapon back.
2. **Return:** mean drawn-vertex error from ready on the final move frame,
   largest single-frame change from end lag through two following frames,
   and tip travel past contact along its incoming direction. Zero overshoot
   fails even if the move ends exactly at ready.
3. **Timing:** the deepest pullback lies before first active; the extension
   peak is within one frame before contact or the class's late allowance;
   recovery keeps moving for the class's minimum share of end lag. Startup
   of three frames or less can omit measurable pullback. A dash attack or a
   move with several hits holds its hit regions for many frames, so its
   extension peak may fall anywhere up to the last active frame plus the
   late allowance, and two checks measure its follow-through from contact
   to the end: no pose holds within 5% of body height for more than 9
   frames (`held`), and the largest single-frame change of the return after
   the last active frame is at most 1.4 times the return's mean frame change
   (`return`), so the body neither freezes through the hold nor pops back to
   ready. Active windows come
   from production collision regions or projectile spawns. The table also
   lists the linked Melee reference's start and total from the checked-in
   frame-data records; those columns do not change our gameplay timing.
4. **Contrast:** rasterize the drawn triangles, then take one minus the
   larger IoU of windup/contact and contact/mid-recovery. More is clearer.
5. **Judgement:** a fresh agent reads six gameplay-size key poses beside a
   Melee reference, with frames added from contact to the end so no two shown
   frames are more than six frames apart, split into images of at most six
   panels so each panel reaches the judge at the size a six-panel strip did (a move with several hits adds each hit's contact frame
   and, for each later hit, its windup: the frame after the previous hit
   where the striking tip is pulled furthest back, so the motion behind
   every hit is in view), scoring readability, weight, anticipation, follow-through
   and character independently. Three fresh judges score each clip, and
   line 5 passes when the per-line median of the first three judgements of
   that clip is at least 4/5 on every line. A move with fewer than three
   judgements of its current clip has no passing line 5, and judgements past
   the third do not count, so re-judging cannot roll a pass. Decided
   2026-10-24 by the proxy under Tom's standing direction (north gate 34),
   because one judge's score varied by about one point per line on the same
   clip; the 4/5 bar stays. Judges see the key poses at the match camera's
   typical framing rather than its widest, with the 4/5 bar and three judges
   unchanged: Tom's decision of 2026-10-24 via north gate 36, because the
   widest framing shows a fighter smaller than a match usually does. Lines
   1–4 keep the far camera's pixel scale, since nothing ties their
   measurements to the judge framing, so their calibrated thresholds stand.

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
the scoring command's graphics and asset flags. A move strip renders at the
match camera's typical framing, `JUDGE_CAMERA` in
`ts/scripts/wisp/animJudgeCamera.ts`: the median per-frame camera distance
of one seeded two-fighter computer match on Frozen Throne, which
`bun scripts/matchFraming.ts` (from `ts/`) replays and prints beside the
widest framing (917.7 against 2132.3, so a fighter draws 2.32 times larger).
Each tile is cropped to the drawn extent of the move's shown poses plus a
margin, never enlarged. The camera holds
still at the middle of the move's height range, as a match camera does, so a
drop or rise shows in the tiles; it follows only travel that would put the body
more than 50 pixels from that height, so flight does not crop the body
out of its strip; a movement strip (crouch, ledge hang, double jump)
keeps the widest framing and instead holds the camera on the drawn floor and grows upward so a jump shows
its real height above it. Read `docs/animation-judge-brief.md` in a fresh judge
context and write its requested JSONL. `bun wisp anim judge record
PRIVATE_DIR/scores-*.jsonl` validates and stores numerical judgements in
`tools/move-data/anim-score/judge.jsonl`, each tagged with the identity of the clip it judged: a digest of the judge framing, the key-frame poses `prepare` rendered and, for a move that travels, each key frame's forward travel, written to PRIVATE_DIR/clips.json and attached by `record`. Line 5 takes the per-line median of the first three judgements whose identity matches the clip the scorecard samples now, so a re-authored move or a changed framing drops the old clip's scores, and a judgement recorded before identities existed no longer counts (#95, #96). Reference pixels stay outside Git.

A caster's move is read with its spell effect: Tom's decision of 2026-10-26 via
north gate 33, after 24 judges scored Kael'thas's dash attack 3 on character
from its robed silhouette alone. A fighter's look lists those normals in
`cueReadNormals`; the sampler places the move's hit-area cue on each frame as
the game draws it (`normalAreaPose`), `prepare` draws it in the key poses and
says so in the caption, and the clip's identity covers the cue placements, so a
move judged with its effect keeps those judgements only while the effect is drawn.
A caster normal whose weapon covers its hit region gets no reach flare, so
`SIGNATURE_CUE_NORMALS` in `disjointCues.ts` draws the fighter's cue on it
regardless of reach: Medivh's dash attack draws his arcane missile and
Malfurion's bursts Entangling Roots at the staff (north gate 41, 2026-10-26).

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
| dash attack | .22 | .023 | .053 | .055 | .029 | 2 | .53 | .16 |
| smash | .29 | .071 | .026 | .025 | .095 | 3 | .84 | .43 |
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

A dash attack is not a tilt (the proxy's ruling of 2026-10-26 under Tom's
delegated judged-box rulings of 2026-10-25): three cold judges failed
Medivh's and Murloc's dash attacks for lacking a weapon draw-back (#343,
#345), while the tilt rule scored every Medivh candidate that drew the staff
back below .90 (behind the hip .56, cocked upward .78). It keeps the tilt
class's values apart from body share, which is measured from the windup frame:
the shoulder's travel from the windup to contact over the tip's.

Provenance: #344, 2026-10-26, north gate 42 (Tom's answer with the proxy's
ruling under the judged-box delegation of 2026-10-25). The class first left the
tip's draw-back before the windup out of its travel, which still measured the
tip from the move's first frame, so a fighter whose ready pose carries the
weapon behind the shoulder (Grom's axe) passed only by starting with the weapon
already thrust forward, and nine fresh judges then read his windup as a flick
(anticipation 2 and 3). Measured from the windup, the four dash attacks whose
three judges score 4 on every line give body shares of 1.00 (Goblin Tinker,
Malfurion), .83 (Kael'thas) and .25 (Medivh, staff drawn behind the hip); 90%
of the smallest, rounded outward, sets the line at .22, and a dash attack whose
shoulder stays planted still scores 0.

Jab weight uses Lich King's second jab; smash weight/return use Malfurion's
down smash; tilt weight uses Mountain King's angled up tilt and Thrall's
forward tilt. Jab return uses Grom's jab and Lich King's second jab. Special
weight/return use Mountain King's and Beastmaster's neutral specials.
The repaired Pit Lord back-air calibrates aerial return and contrast.
Smash jump is .025, not the .014 calibrated on its one move: under .014
Shadow Hunter's forward smash only fit by spreading the return so evenly
that a cold viewer read a held pose, while every follow-through a viewer
could see measured .0146–.025 (#70, 2026-10-25).
Anticipation uses the good jabs, Pit Lord/Lich King/Mountain King tilts,
Blademaster up smash and Beastmaster neutral special. Contrast uses each
class's good readability examples. Tilt return, aerial weight/timing
have no good class example and use the pooled values.

The held-window checks (line 3) are calibrated on the two moves fresh judges
scored 4 on follow-through on the filled strip: Kael'thas's dash attack
(held 7, return 1.18) and Thrall's back air (8, 1.27); 110% of the larger,
rounded outward, gives 9 frames and 1.4. Cairne's down air, judged 4 on the
six-pose strip, scored 3, 3 and 2 on the filled one: its spike holds from
frame 19 to 34. Neither drawn-vertex distance (5 frames) nor silhouette
overlap (4) measures that hold, so line 5 alone catches it. Measuring line
2's overshoot past the last active frame was tried and dropped, because it
failed Kael'thas, Thrall and Cairne alike. They apply to dash
attacks and multi-hit moves only, the moves fresh judges scored on the filled
strip; single-hit aerials with a long held pose, such as a held neutral air,
keep the single-contact rules until judged. Decided 2026-10-26 by the proxy
under Tom's judged-box delegation (north gate 37), from the diagnosis on
#343: the follow-through line failed on every dash attack because the
strike stopped at contact and the active frames barely moved.

`bun run check` is the named source check.
Re-author worst first under #180; keep a change only when its row improves
and no other line falls, as required by #355.

The initial sampler covers normals for all 26 fighters and damaging or
projectile hero specials; Rifleman/Illidan's separately scripted specials and
non-striking utility moves need additional contact definitions before they
can receive a measured row.
