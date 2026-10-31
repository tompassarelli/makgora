# Frozen Throne look: reference board

Take one of the Frozen Throne remake (Tom, 2026-10-31). Layout, collision and platform positions are unchanged; only the backdrop, sky and scenery change. Composition and mood come from Tom's references; no reference art, WoW model or texture enters the repository.

## Hard rules

These come from Tom's playtests and hold for every later take; a pass that seems to need breaking one asks Tom first.

1. No supports under platforms. The raised platforms float, as in any platform fighter: no stem, pillar, pedestal or column stands under them. Take 2 added dark pillar stems under each platform after a complaint about floating pillars that was about the skull pillars, never the platforms, and Tom read the stemmed platforms as mushrooms (2026-11-01). `frozenThroneContrast.test.ts` fails when any piece in front of the stair stands within a raised platform's span.
2. The skull pillars stay, grounded, and are never removed. Two tall skull-topped pillars flank the throne, each standing on solid ice with its base visibly on the surface, nothing hovering, and each joined toward the throne by heavy chains (Tom's references of the Frozen Throne summit: two pale stone pillars crowned with carved skulls, spiked chains, a snow ramp up to the throne, cyan ice crystals). Take 4 removed them because they hovered over the void; the fix for a hovering prop is to ground it, never to delete it (2026-11-01). `frozenThroneContrast.test.ts` fails when a skull pillar is missing on either side, when a side has no chain, or when a prop near the deck stands neither on the deck nor on an ice floe's top.

## References (private, outside Git)

`~/.local/share/smashcraft-stage-design-frozen-throne/references/`:

- `tom-134.png`: Warcraft-style concept: a throne on an ice spire behind the deck, a snowy stair, chained pillars, two curved bone arches, aurora in a storm sky, falling snow, a mist vortex below the deck, a thick carved ice slab.
- `tom-135.png`: first concept: gothic Icecrown towers either side, ice spires, runed platforms, moon and aurora.
- `tom-136.png`, `tom-138-throne-wow.png`, `tom-139-throne-front.png`: the throne seen from the deck: a snow ramp with blue-lit steps, two tall pillars at the stair head, a stepped ice spire with icicle ledges, cyan crystal clusters either side, a strong cyan backlight, one huge arch.

## Composition

Palette: near-black teal sky, steel-blue ice, dark saronite for towers and pillars. Backdrop layers stay darker and lower in contrast than the fighters (stage-art rules 14 to 16); the crystals, causeway and side ledges sit below fighter brightness (#875), so fighters stay the brightest shapes on the play plane.

Layer order, back to front:

1. Sky: dark teal gradient with a dim green aurora band, original 256x128 texture (`ts/scripts/stageSky.ts`, `aurora`).
2. Snow: the existing drifting-snow model.
3. Throne: a high-backed dark chair standing on the top of a six-floe ice spire (y 2020 to 2150, base z -177, lifted 150 above the take-three base for the causeway): a tall back slab (`IceFloe3`), a crown of one `IceCrownObelisk` between two `IceCrownPillar` spikes above it, two armrest slabs and a seat slab in front, all in pale ice ([88, 108, 128] before the stage mood, the brightest the fighter-contrast cap allows) so the chair reads lighter than the dark spire under it and the deep blue sky behind it (take 4; take 3's dark chair matched the native window's sky once the cyan crystals were gone). The foot of the spire hides behind the deck.
4. Great arch: one huge `IC_IceArch` at y 4800 framing the spire.
5. Far ice spires: Glacier2 and Glacier5 stretched tall, left and right.
6. Causeway: the first stair restored, five still stock ice floes stepped from the deck's back edge (y 1360 to 1520, z 0 to -220), each lower and deeper than the one nearer the camera (depth scale 5 to 13, width 2.5, tint [64, 82, 104], below fighter brightness, #875), so the ice visibly climbs from the deck to the throne's dais (Tom's playtest, 2026-10-31, after the throne take removed the stair). The spire and chair (the floes, back slab, pillars, obelisk and arms at y 2020 to 2150) are lifted 150 so the stair ends under the chair's arms and does not cover the throne the way the first stair did. A floe's `matrixScale` is depth, width, thickness once yawed 270, so the stair is wide at the bottom and narrow at the top.
7. Skull pillars (hard rule 2): two stock `IceTorch` (Skull Torch, the only Classic Icecrown skull pillar) at x of 260 each side, y 1400, standing on the top step of the stair with their bases sunk 4.5 units into its surface (the top step is 3.75 wide so both bases sit on it), stretched to 1.625 times their height, pale stone `[150, 156, 170]`, and `unlit`: they play their Death sequence, which turns the brazier's particle flame off, so the window draws no magenta and Classic no flame. A stock Dungeon `Chain0` (Classic has no Icecrown chain) hangs at scale 5 against each pillar's inner face (x of 105, y 1380), from the skull down toward the stair, between the pillar and the throne.
8. Crystal clusters: none since take 4. The eight `Icecrown_Crystal3` behind the throne drew as large flat translucent shards in the native window and, in game, as a cyan field brighter than the fighters (#897's cold read).
9. Gothic towers: `IceCrownObelisk` and `IceCrownPillar` pairs at x of 2800 to 3100, dark, and the two near glaciers at x of 3100 to 3200, pushed clear of the deck ends (#875, take 2).
10. Floor: the existing ground under the deck, tinted deep navy so it is not a flat grey field (#875). The native window takes the sky from the distance fog, so the fog is a deep blue (0.15625, 0.28125, 0.453125) that keeps the sky quiet behind the fighters.

The two side ledges are the same stock ice floe tinted steel-blue (`stockPlatforms.ts`), not the untinted white the first takes drew. The platforms float with nothing under them (hard rule 1). The arch is dimmed to a deep steel blue, the pale spire and stair are a step darker, and the floor is a lighter navy so the deck underside separates from it at far zoom.

## Element map

- Throne on an ice spire: a chair composed from stock pieces (take 3, 2026-10-31). Take 2's obelisk seat between two pylons read as three towers. The stock `FrozenThrone` model was tried at its natural proportions and at 0.5, 1.3, 1.6, 2 and 3 times (y 2400 to 3600): it is a ring of cliff with a runed ice crystal on a pillar and a stair inside, so at match zoom it reads as a cave, a monolith or a stair, never a chair, and the cliff fills the far zoom, so it is not used.
- Snowy stair: not built in take 3 (see layer 6).
- Chained pillars: the two skull pillars with stock `Doodads\Dungeon\Props\Chain\Chain0` chains (layer 7). The Dungeon `ChainPost` was tried and draws as a wooden gallows. Pieces cannot pitch, so a chain hangs; none spans from a pillar to the throne.
- Bone or ice arches: stock `IC_IceArch`.
- Icecrown gothic towers: stock `IceCrownObelisk`, `IceCrownPillar`.
- Ice spires: stock `Glacier2`, `Glacier5`. Crystal clusters (`Icecrown_Crystal3`) were removed in take 4.
- Aurora in a storm sky: original sky texture.
- Falling snow: existing stage snow emitters; Warcraft's own Northrend blizzard or heavy snow weather and moonlight rays are the next layer (weather effects over the stage rect).
- Mist vortex below the deck and runed deck body: not in take 1; the deck body texture is held back for the native texture fixes in flight, and a mist effect needs coordination with the water stage art.

## Take 1 status

Headless Wisp renders at near and far match zoom, then Classic native captures on gex45 (one match zoom, one fighter facing each way, 31 Oct 2026), were judged; Tom reviewed the native capture at match zoom and approved landing take 1 (2026-10-31). Take 2 owes the throne on a tall spire as the centrepiece, chains, mist, snow, a real wide frame and three cold viewers.

## Take 3 status

The throne is a dark high-backed chair on the spire's dais, centred behind the deck (2026-10-31, Tom asked when the backdrop gets a readable throne). It follows FT-1 (silhouette and layering) and FT-2 (the dark mass reads against a luminous blue backlight).

- Chair: a back slab, a three-spike crown (`IceCrownObelisk` between two `IceCrownPillar`), two armrest slabs and a seat slab, all uniform or axis-scaled stock pieces with binary32 scales. The chair is scaled to 0.75 of its first size because the native window's match zoom crops anything above about 520 units over the dais; at full size the crown left the frame.
- The cyan crystals moved behind the chair (y 2450 to 2550); in front of it their translucent glow washed the chair out.
- `matrixScale` order for these floes is depth, lateral, height (lateral is the second entry).
- Checks: `bun tools/stage/contrast.ts --stock-light 2` passes; `headlessSeparation.ts` reports the same negative band gap as before the change on every row, and a smaller one on all twelve rows compared (it fails on origin/main too and is not the landing gate).
- Captures: before and after, both pair orders, in the Wisp native window and the headless renderer under `~/.local/state/smashcraft/shots/ft-throne/`.

## Stair in-game capture (#897)

The restored stair was captured in a real Warcraft III pool pair at near match zoom, Shadow Hunter first and Chen Stormstout first, on the checkout's development map (31 Oct 2026; `bun wisp accept --only '897-*' --pair K --map STAGED.w3x`, frames in `~/.local/state/smashcraft/shots/ft-stair-ingame/` on gex45). One cold viewer in a fresh session saw the ice tiers rising from the deck's back edge to the throne block but called the link weak (the tiers meet the throne base without a landing, and two thin floating ice slivers connect to nothing), and said the fighters are not the clearest shapes: the cyan crystals behind the throne, the two skull braziers and the arch are brighter than the small, low fighters. The fighters-first half of the box is open.

## Take 4 status

Tom's native-window playtest (2026-11-01, map 0.3-dev.702) found the skull pillars floating, no throne and junk in the back.

- The skull pillars were the two `IceTorch` braziers: they stood at deck height 1300 units behind the deck's middle with nothing under them, so they hang in the air in Classic as well. They are removed, and `frozenThroneContrast.test.ts` now fails when a prop near the deck stands neither on the deck nor on an ice floe's top.
- The magenta clusters were the braziers' particle flame. Classic draws it as a few small dim dots in the emitter's own magenta; the native window draws a dense column of large bright puffs. That is a Wisp emitter-scale difference, recorded on wisp#178; Classic does not tint particles by the effect colour, so tinting them is not the fix.
- The translucent shards were the eight crystals; they are removed (layer 8).
- The throne was hidden behind the top platform's thick dark stem and matched the sky. The chair is pale ice, and the centre stem is as slim as the side stems (matrix scale 0.5 across), so the high back, arms and crown read on either side of it.
- Captures: `~/.local/state/smashcraft/shots/throne-window/` (before-near, after-near, after2-near; native window, near match camera).

## Take 5 status

Tom's playtest (2026-11-01) undid two misreads. The platform stems (take 2) and the slim centre stem (take 4) are gone: the platforms float (hard rule 1). The skull pillars take 4 deleted are back, grounded on the stair's top step and chained (hard rule 2, layer 7). Chain0 draws about 250 units above its model extents at scale 5 in the native window, so its height was set from captures, not from its bounds. Captures: `~/.local/state/smashcraft/shots/throne-window-fix/take5-near.png` and `take5-far.png` (native window, near and far match camera).
