# Dash attacks

To reach 4/5 on line 5 of the animation scorecard
([animation-scorecard.md](animation-scorecard.md)), a dash attack needs every
tile of the judge strip to show a different whole-body shape. The strip draws a fighter at
the match camera's typical framing, a few dozen pixels tall, with no two shown
frames more than six apart from contact to the end. At that size a limb or
weapon turning inside an unchanged body reads as a held pose. This brief is
what each of the seven dash attacks (#339–#345) is authored against (#358).

Frames, hit regions, damage and knockback stay as #324 set them; the brief
only places poses on the existing frames.

## What the judges said

The 149 dash-attack judgements in `tools/move-data/anim-score/judge.jsonl` up
to 2026-10-26 repeat the same complaints across fighters (notes matching each,
by keyword):

| Complaint | Notes | Answered by |
| --- | ---: | --- |
| Contact, active and early recovery are one held or frozen pose | 79 | Drive, then recoil |
| The end pops or snaps from the lunge to the upright idle | 38 | A rise that starts after the active window and absorbs the skid |
| No planted foot; the legs dangle, trail or float | 36 | Legs that change with each beat |
| The striking limb or weapon is small or lost against the body | 35 | Present it outside the body line |
| The windup is a stumble, tumble or forward pitch, not a coil | 13 | A coil that rocks back on bent knees |

Ten of those judgements gave follow-through 4 (Kael'thas, Goblin Tinker and
Murloc), and their notes name a body that carries through the active window
and "settles gradually" or "smoothly" to stance.

## Pose sequence

Six poses, keyed on the move's own frames, in the order that passed line 5 on Kael'thas. `C` is the first active frame,
`L` the last active frame and `E` the last frame of the move.

1. **Run** (frame 0): the run pose the dash attack starts from.
2. **Coil** (about `C − 3`): the root rocks back about 30° with the knees
   bent and the chest tucked back, and the striking limb or weapon is drawn
   back behind the shoulder. Both parts are needed. A fold and pelvis drop
   with only about 10° of lean back read as "a slight hunch", and a straight
   body tipped back with no knee bend reads as a stiff tilt or a tumble.
   Keep both feet under the body, with no foot raised.
3. **Contact** (`C`): the lunge, already pitched deep. The front foot reaches
   ahead, the rear leg pushes long behind and the strike is extended toward
   the hit region. On Kael'thas the root pitches about 38° forward and drops
   10 units at contact; at 22° judges said the torso "still leans back with
   only the arms thrust out".
4. **Drive** (about `C + 3`): the body carries on lower and flatter: on
   Kael'thas the root pitches about 50° forward and drops about 22 units, the
   front knee bends under the weight and the rear leg trails straight. The
   strike stays level, so both arms rotate with the pitch.
5. **Recoil** (`L`): the body is still low (about 34° and 12 units down on
   Kael'thas), and the striking limb or weapon draws back toward the body,
   the elbow folding as the hit spends itself. The last active tile changes
   shape through the limb while the body keeps carrying the slide.
6. **Settle** (`L` to `E`): the body rises and the knees absorb the skid
   through two in-between poses (about 40% and 70% of the end lag), each one
   part of the way to ready in height and lean, with no new limb shape on the
   way. An arm flipping overhead in recovery reads as a new pose, not
   follow-through. Ready arrives on the last frame.

Size each change for the tile, not the bone. At judge-tile size a robe,
shell or chassis turns with the root as one block, so a 10–15° change of
lean between shown frames reads as "nearly the same held pose". On Kael'thas
the judges first saw separate beats when the drive pitched 50° and dropped
22 units.

Keep the body low until the active window ends. Standing up by `L` reads as a
pop "while still active", even with a gradual settle after it; an upright
brake at `L` scored follow-through 3 in three takes. The rise belongs to the
recovery.

Throughout, present the striking limb or weapon outside the body's outline at
contact and drive, at least 30° off the torso line, because a short arm or a
thin weapon against a robe, shell or chassis disappears at strip size.

## Measured constraints

The scorer's lines 1–4 must still pass (`bun wisp anim score --fighter F`):

- **Line 1, body share ≥ 0.90.** The shoulder must travel with the tip from
  the deepest pullback to contact, projected on the line from the
  contact-frame chest to the hit region's far end. On Murloc (#345) a contact
  root offset above about `tx` 22 tilted that line steeply and dropped body
  share to 0.69–0.74, and pulling the spear back with the arm kept line 1 only
  while contact stayed at about `tx` 22. On Kael'thas a coil that sank the
  pelvis 10 units scored 0.89; keeping the root back (`tx` −60 to −72) with
  the sink at 4 units scored 0.97–0.98, with the arm drawn back behind him,
  which the dash-attack class allows.
- **Line 2, overshoot ≥ 0.029.** The tip carries past its contact position
  along its incoming direction; drive does this.
- **Line 3, peak and hold.** Before gate 37 (2026-10-26) the tip's reach had to
  peak within two frames of contact; on Murloc any later forward key moved the
  peak to 10, 18, 32 or 33 and failed, which is why reach had to peak by frame
  7. Since be28d6138 a dash attack's peak may fall as late as `L + 2`, no pose
  may hold within 5% of body height for more than 9 frames, and the return's
  largest frame change may be at most 1.4 times its mean. Drive and recoil keep
  the hold at 4–7 frames; an even settle keeps the return ratio at 1.1–1.3.
- **Line 4, contrast ≥ 0.16** between windup and contact and between contact
  and mid-recovery.

## Where it was tested

Kael'thas's dash attack (#341) is keyed against this brief in
`dashAttackKeys` of `tools/animations/kaelthas-clips.ts` and passes all five
lines, line 5 at a median of 4 from three fresh judges. The takes that led
there, their lines 1–4 and their fresh-judge medians are on #358.

Medivh's dash attack (#343) is keyed against it in
`tools/animations/medivh-clips.ts`, which solves the staff arm separately at
each key. Between two keys solved apart, the interpolated staff swung up to
60° off its aim (pointing at the floor mid-drive), so the windup and active
window there are keyed every frame from the brief's poses (`everyFrame`).
Drive, recoil and settle lifted readability and follow-through to 4; weight
and character stayed at 3, because the cloak hides his hips, legs and free
hand at tile size and judges read the lunge as a rigid board.

Medivh's dash attack is now authored in Blender
(`tools/animations/medivh-dash-attack.py`), as gate 40 ruled for a stalled
generator clip. Three things the generator could not do carried it: feet and
staff hand solved to targets each frame (a planted front foot, a back leg that
stretches out), the staff aimed along its own shaft rather than the
hand-to-staff pivot line (28° off), and robe panels that flare over the legs
just enough to keep the hem off the floor. Without the flare, the per-frame
floor-set lifted the whole body back up by however far the hips dropped. His
arcane cue (Medivh's own missile) is drawn on the move as a caster's signature
normal. Lines 1–4 pass (body share 0.93, held 7, return 1.34) and three fresh
judges give medians 4/4/4/4/4.

Malfurion's dash attack (#342) is authored in Blender
(`tools/animations/malfurion-dash-attack.py`): a rear-back of about 30° on
bent knees with the staff drawn up behind his shoulder, held from frame 2,
a lunge on the first active frame, a 45° pounce mid-window, then an even
glide from the pounce to ready. An upright brake at the last active frame
read as a pop (follow-through 3), and every pose take scored character 3
until his signature cue was drawn: Entangling Roots at the staff, held on
the model's drawn geometry because Tranquility's particles never render
natively. Lines 1–4 pass (body share 1.00, held 7, return 1.24) and three
fresh judges give medians 4/4/4/4/4.

Anub'arak's dash attack (#339) draws Impale spikes at the hit (north gate 45).
His claws vanish against the shell at tile size, and no pose take scored
readability 4 without the spikes; with them, his generator clip reaches 4.
Follow-through stays at 3 in every compact take: three changes to the active
window (an even glide from the last active frame, a deeper pose at that frame,
and a root lunge that keeps carrying forward until it) each read to the judges
as one held pose from contact to the last active frame. Blender takes that
flatten the body lower at each beat by splaying the legs out reached
follow-through 4 but lost readability to 3, since the splayed legs crowd the
claws. Raising the rear as the claws dig down through frames 8–19, with no
splay, did not help either: hind legs swung under the hips, a nose-down pitch
and a lifted abdomen put the rear above the head by frame 19 while the claws
stab the floor ahead, and judges read the risen body as a hunched, cluttered
mass. On the Blender take that scored 3/4/3/3/4; on the generator clip, which
keeps its windup and contact, 3/4/4/3/4. Lines 1–4 pass; three fresh judges
give the shipped clip medians 4/4/4/3/4.

Peon's dash attack is a trip-and-dive (2026-10-28), keyed as gestures in
`tools/animations/peon-clips.ts` with its `reauthor` pass: a forward root
offset (`ahead`) carries the drawn body about 58 units out through the slide,
so the hit regions sit on the drawn pickaxe, and a one-leg `kick` throws the
tripped leg up behind him. The `tuck` squash scales along his own body axis,
so on a prone body it shortens him instead of flattening him; a belly-flop
squash cost 13 units of reach and was dropped. Five takes moved the judges
from 3/3/3/3/3 to 4/4/3/3/4 by giving each judged tile its own shape: arms
flung overhead and behind as he rocks back, a flat superman at contact, heels
kicked up mid-slide and a chest lift on the last active frame. Anticipation
stays at 3 in every take, the judges reading the trip as "a stumble rather
than a pull-back"; a trip is the move's premise, so the coil rule above and
this move pull against each other. Follow-through stays at 3 with "drifts
slowly upright": the return-ratio line keeps the rise even, and a faster rise
fails it.
