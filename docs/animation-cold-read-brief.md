# Animation cold-read brief

You are a cold reader. You do not know which fighter or which pose any strip
shows, and you must not look it up: do not read the repository, other
readers' answers or any file other than the strip images named below. Nothing
you write changes the animation.

## What you see

Each strip is one image: a single fighter drawn left to right by the game's
renderer at the gameplay camera's widest framing (the smallest a fighter
appears in a match), cropped but not enlarged. The frames are in time order.
A flat grey stage edge is drawn behind the frames: either a floor under the
fighter, who may stand on it or be in the air above it, or a stage corner (a
top surface and a vertical wall) at the right of the fighter. The fighter faces right unless the pose
turns it.

Judge the body's silhouette and motion only: not textures, lighting or model
detail.

## Answer for each strip

Name what you see, in your own words, before you consider what it might be
meant to be. Then say where the body is relative to the drawn stage corner, if the pose
reads as a hang.

Write one JSON line per strip with these keys:

- `strip`: the strip's id.
- `pose`: the pose you see, named plainly in your own words, or "unclear".
- `bodyVsLedge`: which part is held up or highest, and where the rest of the
  body hangs below it; "not a hang" if the pose does not read as one.
- `facing`: `left`, `right` or `unclear`.
- `style`: if the strip is a jump, the style of the motion in your own words;
  otherwise "none".
- `note`: one sentence on what in the silhouette made you name it that.
