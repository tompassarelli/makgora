# Water stage art direction: the Tomb of Sargeras at dusk tide

One page. Rules and mechanics are in [water-stage](water-stage.md); the art bar is
[stage-art](stage-art.md) and [visual-quality](visual-quality.md). Full-send item,
2026-10-31: take stage 7 to a finished native-window look. Classic models only.

## Reference board

Judgment only; nothing here is copied, traced or committed.

1. **Delfino Plaza's bay** (Super Smash Bros. Ultimate, local reference
   `delfino-plaza.png`): a bright sea fills the lower half, a dense town band
   sits right behind the stage and hills close the frame. Take the full-width
   sea and the dense band at one depth.
2. **Wuhu Island's horizon** (Ultimate, `wuhu-island.png`): sea from the horizon
   to the frame edge, one thin band of land, a third of the frame for sky. Take
   the minimal horizon that is still never empty.
3. **Pirate Ship's open ocean** (Ultimate, `pirate-ship.png`): rock spires as
   small accents on a sea running to the horizon, the stage's own mass filling
   the lower frame. Take the spires as depth markers.
4. **Hokusai, "The Great Wave off Kanagawa"** (c. 1831, public domain, Wikimedia
   Commons): a curling crest edged in white foam fingers over a flat deep blue
   band. Take the foam as a drawn line with a hard inner edge, not noise.
5. **Hokusai, "Fine Wind, Clear Morning"** (c. 1831, public domain, Wikimedia
   Commons): a lit mountain in graded air, one cloud band in the sky. Take
   atmospheric perspective: each farther plane is paler and bluer.
6. **Anti-reference: Tomb in 0.0.100** (`00-anti-smashcraft-tomb-0.0.100.png`)
   and the native playtest of 2026-10-31: a flat sky band, a tiled sea and a
   tiled deck with nothing behind the fighters.

## Mood

A calm teal tide at the end of a storm: low warm sun upper left, thin mist on the
water, a few rain streaks drifting off a passing cloud bank. Stylised and
saturated like the Classic fighters, never photographic. Quiet in the middle of
the frame, interesting at its edges.

## Palette

- **Sky**: top `#5f8fc4`, horizon `#cfe6e8`, cloud bank `#e9eef0` with `#9db4c6`
  undersides. Always a gradient.
- **Sea**: crest `#7fd0cf`, body `#2f8f9c`, trough `#1d5f74`, foam `#f4fbfa`.
  Refraction shows the submerged deck and supports at 60% strength, tinted
  toward the body colour.
- **Deck and platforms**: warm stone `#8a6f5c` top, `#4a3a36` underside, lighter
  top edge so the walking line reads.
- **Backdrop planes** (far to near): `#a9c3d3`, `#7da3b8`, `#4f7f94`; each lower
  in contrast and saturation than the one in front.
- **Shafts**: `#fff1c8` additive at no more than 18% over the backdrop and none
  over the play plane's brightness band.

## Layers, back to front

1. Sky gradient with one slow cloud band.
2. Far spires and a low island, hazed to the sky colour (CC0 rock meshes).
3. Mid sea stacks and a ruin silhouette, one value step darker.
4. Near sea stacks behind the deck, the darkest and quietest of the three, so
   fighters read lighter against it.
5. Animated sea: two ripple layers moving at different scale and direction,
   refraction of what lies beneath, foam lines at the deck and platform
   waterlines moving with the tide and stopping in the slack.
6. Light shafts and mist over layers 2 to 4 only, never over the play plane.
7. Weather: drifting mist and light rain streaks at depth, off the play plane.

## What stays readable

- Fighters are the brightest, most saturated thing: a clear value step above the
  layer directly behind them. The fighter-contrast check in visual-quality
  keeps its threshold.
- The deck's top edge, both side platforms and the waterline are drawn exactly
  where the simulation puts them. Frame fractions of stage 7 from the stage
  silhouettes: deck x 0.065 to 0.935, top y 0.43, 0.07 thick; side platforms
  x 0 to 0.185 and 0.815 to 1, top y 0.304, 0.022 thick. Foam and shafts never
  cross these edges.
- The tide direction is legible from the foam; in the slack it stops.
- No bright highlight, shaft or lit gap directly behind the fighting area.
- Frame time budget 8.3 ms at 2880x1920 on the laptop.

## The sea, from Tom's Warcraft reference (2026-10-31)

The reference, `tom-wc3-water-reference.png` (local, Warcraft III terrain water
seen from above, not committed): a shallow turquoise band along the shore that
ramps to deep blue, fine glittering ripples at one texel scale, and white foam
waves breaking along the shoreline with a lighter wet edge behind them.

- **Surface**: animate through Warcraft's own water texture frames, read at
  runtime from the player's install (ReplaceableTextures/Water), never shipped.
  Our StageWater tile stays the fallback where the install lacks them.
- **Depth ramp**: shallow turquoise `#7fd0cf` at the deck, platform and stack
  waterlines to deep `#1d5f74` at the horizon and below the deck line.
- **Shoreline foam**: where water meets the deck, platform supports and the
  backdrop stacks, a foam wave line (reference 4's hard inner edge) with a pale
  wet band behind it; it moves with the tide and stops in the slack. One foam
  line per waterline in the sim's edge list; placement is this stage's.
- **Reflection and refraction**: a dimmed, rippled reflection of the backdrop
  planes; refraction of the submerged deck and supports at 60%. Fighters and the
  deck draw in front and the sea never tints them.
- **Horizon**: edge-on; ripple scale shrinks toward the horizon and the sea
  hazes to the sky's horizon colour in a thin bright line.
- **Not native terrain water**: it hid fighters and the deck (reverted
  2026-10-12); the sea stays the stage's own model and shader.

## Assets

Original generated art and CC0 meshes only; sources and licences are in
[references](../references.md). Nothing from Blizzard beyond the player's own
install at runtime.

## Style target (2026-10-31)

Tom chose to commit fully to stylised water and approved the proxy's recommendation
the same evening (paraphrased): the surface follows World of Warcraft Forever's
water and the reactions take the water's own colour and light. He then sent eight
Forever frames as the primary surface target, replaced "painted colour bands" with
depth-tinted translucency, and ruled that Rivals of Aether 2 is not the look (its
flat cel colours, drawn outlines and bright cartoon highlights are out); from it
we take a few readability ideas, drawn in Forever's soft painted-natural style.
This section
governs wherever it differs from the palette, foam and reference lines above:
foam is no longer `#f4fbfa` and no longer a hard-edged line, and the sea has no
caustic web. The one-page sheet is
`~/.local/state/smashcraft/shots/water-style/style-sheet.png` (references stay
outside Git); the redesign pass is judged against the rules below.

### What the references show

- **Forever, the surface** (pond, lake, open sea, river, dusk and sunset frames):
  deep muted teal-green; translucent, so the bed, stones and a sunken hull show in
  the shallows and fade with depth; fine low-contrast ripples; broad low highlights;
  nothing glossy, no caustic web on the surface. Everything is scene-lit.
- **Forever, motion**: foam exists only where water moves or meets something, as
  thin translucent broken white streaks that follow the flow and fade at both ends.
  A swimmer's ring is a faint, soft, slightly darker or lighter distortion of the
  surface, not a drawn line. Calm water reflects the far bank and sky dimly and
  broken by ripples. A low sun leaves a glitter path of short broken horizontal
  dashes that widen and scatter toward the camera.
- **Rivals 2, readability ideas only**: a fighter entering the water throws a tall,
  short-lived splash column and spray, a fighter knocked in throws a wide splash
  fan, and one standing in it keeps a short crown and a small whitecap around the
  legs; faint concentric rings spread from fighters and from posts standing in the
  water; nearby objects (posts, deck) reflect in the water below them; clear
  shallow water shows its bed with a broken network of soft light lines lying on
  the bed under the surface, and dark weed shapes below; the water plane reads
  clearly apart from the playable deck. Colour, brightness and lifetime follow the
  Forever rules, at lower contrast than Rivals.

### Rules

Measured on a native-window capture at match zoom, 1920x1080, in both facings.
Luma is Rec709 on 8-bit sRGB (0 to 255). A block is a square of 0.2 of the frame
height of open water (no deck, fighter, foam line or reaction inside it); p50 and
p99 are that block's median and 99th-percentile luma. Reference values are from the
Forever frames; ours are from Tom's native-window Tomb capture of 2026-10-31 (3:03 PM), four blocks of open water.

Surface

1. **Palette.** Body ramps through three stops by depth: shallow `#42655e`, mid
   `#244942`, deep `#0f2c34` (Forever's lit shallows, open sea and deep water). Body
   saturation (HSV) at most 0.5 anywhere on the sea. Hue stays teal-green; a stage's
   own light tints it. Naxxramas poison keeps its green hue and thickness and takes
   rules 2 to 5 and 7 to 16 with its own stops.
2. **Depth, not bands.** One continuous shallow-to-deep ramp, zero visible steps:
   no luma step over 8 between points 4 px apart on a vertical line through the sea
   (shore foam, horizon and fighters excepted).
3. **Translucent.** The submerged deck, supports and rocks show through at 60% of
   their dry luma at the waterline and fade to under 10% by 1.5 deck thicknesses
   below it (deck thickness is 0.07 of frame height at match zoom). Fighters and the
   deck draw in front and the sea never tints them.
4. **Fine, quiet ripples.** Luma standard deviation in a block: at most 6 in deep
   water and 12 in lit shallows (Forever 1 to 5 and 11; ours 24 to 30 on Tomb).
5. **Low highlights.** In a block p99 is at most 1.75 times p50 (Forever 1.2 to 1.74;
   ours 1.9 to 2.8 on Tomb) and no open-water pixel exceeds luma 200 on a stage with no
   visible sun. Zero caustic web on the surface: the water shader's surface
   caustics are 0 for Tomb and Naxxramas. Light lines belong on a bed seen through
   clear shallow water only: soft, broken, on the bed under the surface, bed p99 at
   most 1.5 times the bed's p50 and fading to nothing where the ramp passes mid. No heavy
   swells: the swell term raises no block's p99/p50 past this rule.
6. **Sun glitter, only where the sun is low and in view** (Durotar Skies and
   Ahn'Qiraj; none on Tomb or Naxxramas). A path from the sun's screen x toward the
   camera made of dashes at most 4 px tall, each a broken horizontal highlight in the
   sun's colour at most 0.7 opaque; dashes cover at most 35% of the path's area, so
   no smooth band forms, and they widen and scatter toward the camera.
7. **Dim reflection.** Reflected backdrop luma at most 45% of its source, displaced
   2 to 6 px by the ripples so its edges break; the sea hazes toward the fog colour
   at the horizon with no line brighter than the sky beside it.

Foam

8. **Only where water moves or meets something.** A foam line at each waterline in
   the sim's edge list (deck, platform supports, stacks, shore) and soft streaks
   along the tide's flow; none elsewhere, and none at all in the slack.
9. **Soft, broken, tinted.** Streaks 20 to 120 px long, opacity at most 0.55, ends
   fading over at least a third of their length, a waterline covered at most 60% of
   its length at a time, never a closed loop. Peak luma at most 1.6 times the local
   water's p50 and at most 190; foam colour is the water's crest colour mixed at most
   55% toward the horizon colour, never `#f4fbfa`, never a pixel with all three
   channels over 215.

Reactions (rings, wake, splash, droplets)

10. **Ring.** A soft distortion plus a faint tint, not a drawn line: peak luma
    within plus or minus 20 of the local water, edge gradient at least 6 px wide, at
    most 2 rings per fighter at once, each fading out within 45 frames. A fighter
    that is not touching the surface makes none. Each deck support or post standing
    in the water gets the same ring, at most 1 at a time and fainter, plus a soft
    foam wisp on its upstream side under rules 8 and 9.
11. **Wake.** At most one V of 2 soft streaks behind a swimmer, at most 3 fighter
    widths long, opacity at most 0.4, gone within 30 frames of the fighter stopping.
12. **Splash and droplets.** One splash per crossing, in or out, 8 to 14 droplets,
    a column up to 0.5 fighter heights tall (a fighter knocked in at speed:
    a fan up to 1.0 tall and 24 droplets, same luma caps), no spray pixel over luma 200, tinted
    with the water's crest and light, parked or faded by frame 36. A fighter that
    keeps moving through the surface leaves a soft churn at the waterline, at most
    0.4 opaque, gone within 20 frames of the fighter leaving it; one standing in
    it keeps a crown up to 0.25 fighter heights and a small whitecap around the
    legs, at most 0.55 opaque, with no ring pattern drawn as a line. Reaction hue stays within 25 degrees of the water body's hue:
    no green, opaque or thick wash over a teal sea. Never solid white: no reaction
    pixel has all three channels over 200.
13. **Objects reflect.** The deck's underside, posts and stacks reflect in the
    water directly below them, under rule 7, at least 12 luma darker than the object
    and rippled, so the waterline reads as a contact.
14. **Plane apart from the deck.** At every waterline the sea's median luma differs
    from the deck's adjacent face by at least 25, and the sea carries no stone, grid
    or deck texture.

Legibility

15. **Fighters stay first.** The sea's p99 luma stays under the lowest fighter
    body's median luma at both camera extremes, and the fighter-contrast check in
    visual-quality keeps its threshold.
16. **Frame budget.** Water and reactions stay inside the 8.3 ms frame at 2880x1920.

### Judged how

The redesign pass lands when a capture of Tomb and of Naxxramas at match zoom, both
facings, plus one with a fighter entering, one swimming and one leaving the Tomb sea
passes rules 1 to 16 by measurement, and two cold viewers shown the sheet's target
column and then the capture call them the same style.

### Style sheet status (2026-10-31)

The sheet shows our Tomb from Tom's native-window capture of 3:03 PM and Naxxramas
from his capture of 3:11 AM (before the poison look pass), because a fresh native
run was held by the laptop's game reserve and gex45's load; a fresh capture of each
is still to be taken and measured against rules 1 to 16 before the redesign pass
lands. Across five rounds of two cold viewers each, the target frames and palette
read as one muted, scene-lit teal style to every viewer; the dissent was only that
the drawn splash and glitter specs sit beside frames, which the redesign pass
resolves by rendering them in the engine. Their notes are beside the sheet.
