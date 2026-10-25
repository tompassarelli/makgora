# Melee's gameplay camera and ours

How smashcraft:ts/src/game/sim/matchCamera.ts frames and follows the fighters.
Stage camera limits, blast zones and the off-screen magnifier are in
smashcraft:docs/physics.md, "Camera limits, off-screen damage and blast zones".

Melee's camera keeps every fighter in view, zooming out as they spread apart
and in as they close, and lets a launched fighter outrun the view into the
off-screen magnifier. Its constants
are not on a public page, so the values below are Smashcraft's own, tuned by
watching play and by `bun scripts/cameraFeel.ts`.

Each frame matchCamera.ts gives every fighter a subject box around its body
that is longer ahead of it than behind, eases each box edge toward its target
so a turnaround slides the box rather than jumping it, scales the boxes by the
number of fighters, clamps them into the stage's camera range, fits the union
into the view, keeps the view's corners inside the range, and then eases the
view toward that goal. Hitlag does not move the camera; a launched fighter is
followed like any movement until the camera range stops the box.

## Smashcraft's camera

matchCamera.ts runs these steps once per match frame in deterministic state,
with Melee heights at six world units a Melee unit: box 198 forward, 54 back,
96 up, 54 down around a point 60 above the feet; extents ease by 3 × the
subject ratio a frame (0.5 Melee units before scaling); interest 9–18% and
zoom 14% a frame, the follow speed reading the larger side of the subject box;
eye distance 498–6000. Corner and underside limits shape the goal before
easing, so reaching a limit eases in. Deliberate differences:

- **Side view.** Warcraft keeps yaw 90° and pitch 10°, so the fit has no tilt
  or pan angles; it centres the box. The half-angle tangent eases from 30° to
  38°.
- **16:9 and the HUD.** The fit uses the 16:9 match view, and its vertical
  fit keeps the box above the HUD (1.44 half-heights instead of 2). A
  fighter within 100 of the main deck's underside keeps it and the fighter
  above the HUD. Our view is therefore height-bound in neutral where Melee's
  4:3 view is usually width-bound, so a jump zooms out a little more than in
  Melee.
- **Slower zoom.** The eye distance eases 14% a frame. Our
  height-bound fit turns every jump on a platform into a zoom, so at nearly twice that rate four
  fighters made the view zoom more and reverse more often than Melee's
  (`--players 4`: zoom p95 3.3% vs 2.3% of the view a frame, travel 59% vs 49%
  a second, 108 vs 57 snap frames). At 14% four-player zoom travels 49% a
  second, p95 2.6%, 29 snap frames, and live fighters leave the view in about
  the same number of frames (871 vs 836).
- **Final clamp.** After easing, the view is clamped into the camera range
  once more, so no eased frame ever shows past it (#80's blast-zone rule).
- **No quakes.** Hits keep the camera steady (smashcraft:docs/gameplay-design.md).

## Measuring camera movement

`bun scripts/cameraFeel.ts` (from ts/) plays six fixed computer 1v1 matches, or
three four-player ones with `--players 4`, and
reports, for our camera and for the script's reference camera driven by the
same fighter paths, the pan and zoom per frame as fractions of the view,
the change of that velocity per frame, frames that jump more than 3% (pan) or
6% (zoom), travel a second, direction reversals a second and our frames with a
live fighter outside the view. On these
matches before #110 our camera matched Melee's in typical movement (pan p95
1.5% vs 1.4% of the view a frame, zoom p95 3.2% vs 2.5%) but snapped when a
limit or the deck underside was reached (up to 24% of the view in one frame
vs Melee's 7%), because those limits clamped the eased view instead of its
goal.
