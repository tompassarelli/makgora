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

## Assets

Original generated art and CC0 meshes only; sources and licences are in
[references](../references.md). Nothing from Blizzard beyond the player's own
install at runtime.
