# Frozen Throne look: reference board

Take one of the Frozen Throne remake (Tom, 2026-10-31). Layout, collision and platform positions are unchanged; only the backdrop, sky and scenery change. Composition and mood come from Tom's references; no reference art, WoW model or texture enters the repository.

## References (private, outside Git)

`~/.local/share/smashcraft-stage-design-frozen-throne/references/`:

- `tom-134.png`: Warcraft-style concept: a throne on an ice spire behind the deck, a snowy stair, chained pillars, two curved bone arches, aurora in a storm sky, falling snow, a mist vortex below the deck, a thick carved ice slab.
- `tom-135.png`: first concept: gothic Icecrown towers either side, ice spires, runed platforms, moon and aurora.
- `tom-136.png`, `tom-138-throne-wow.png`, `tom-139-throne-front.png`: the throne seen from the deck: a snow ramp with blue-lit steps, two tall pillars at the stair head, a stepped ice spire with icicle ledges, cyan crystal clusters either side, a strong cyan backlight, one huge arch.

## Composition

Palette: near-black teal sky, steel-blue ice, one cyan glow behind the stair, dark saronite for towers and pillars. Backdrop layers stay darker and lower in contrast than the fighters (stage-art rules 14 to 16); the crystals, stair and side ledges sit below fighter brightness (#875), so fighters stay the brightest shapes on the play plane.

Layer order, back to front:

1. Sky: dark teal gradient with a dim green aurora band, original 256x128 texture (`ts/scripts/stageSky.ts`, `aurora`).
2. Snow: the existing drifting-snow model.
3. Throne spire: ten stock ice floes stacked and narrowing from dark at the foot to pale at the top (y 2100, z -420 to 262), crowned by an `IceCrownObelisk` seat between two `IceTorch` pylons at z 300; the foot hides behind the deck and the colour climbs from near-black teal to pale ice so the lit seat is the first thing the eye reaches.
4. Great arch: one huge `IC_IceArch` at y 4800 framing the spire.
5. Far ice spires: Glacier2 and Glacier5 stretched tall, left and right.
6. Stair: five stacked stock ice floes narrowing upward, a plain stepped snow ramp, centred at y 1400 to 1520, tinted to a mid steel-blue (#875).
7. Stair pillars: two `IceTorch` towers flanking the stair head.
8. Crystal clusters: eight `Icecrown_Crystal3` either side of the stair, tinted cyan.
9. Gothic towers: `IceCrownObelisk` and `IceCrownPillar` pairs at x of 2500 to 2900, dark, pushed clear of the deck ends (#875).
10. Floor: the existing ground under the deck, tinted deep navy so it is not a flat grey field (#875). The native window takes the sky from the distance fog, so the fog is a deep blue (0.15625, 0.28125, 0.453125) that keeps the sky quiet behind the fighters.

The two side ledges are the same stock ice floe tinted steel-blue (`stockPlatforms.ts`), not the untinted white the first takes drew.

## Element map

- Throne on an ice spire: original tiered spire from stock `North_IceFloe3` slabs with an obelisk seat and two pylons; the stock `FrozenThrone` model is a closed rock dome with its throne inside, so it is not used (take 2, 2026-10-31).
- Snowy stair: original stepped ramp built from stock ice floes (generic shape).
- Chained pillars: stock `IceTorch` towers; chains between them are not built (no stock chain model, and models cannot roll).
- Bone or ice arches: stock `IC_IceArch`.
- Icecrown gothic towers: stock `IceCrownObelisk`, `IceCrownPillar`.
- Ice spires and crystal clusters: stock `Glacier2`, `Glacier5`, `Icecrown_Crystal3`.
- Aurora in a storm sky: original sky texture.
- Falling snow: existing stage snow emitters; Warcraft's own Northrend blizzard or heavy snow weather and moonlight rays are the next layer (weather effects over the stage rect).
- Mist vortex below the deck and runed deck body: not in take 1; the deck body texture is held back for the native texture fixes in flight, and a mist effect needs coordination with the water stage art.

## Take 1 status

Headless Wisp renders at near and far match zoom, then Classic native captures on gex45 (one match zoom, one fighter facing each way, 31 Oct 2026), were judged; Tom reviewed the native capture at match zoom and approved landing take 1 (2026-10-31). Take 2 owes the throne on a tall spire as the centrepiece, chains, mist, snow, a real wide frame and three cold viewers.
