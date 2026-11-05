# Frozen Throne look: reference board

Take one of the Frozen Throne remake (Tom, 2026-10-31). Layout, collision and platform positions are unchanged; only the backdrop, sky and scenery change. Composition and mood come from Tom's references; no reference art, WoW model or texture enters the repository.

## Hard rules

These come from Tom's playtests and hold for every later take; a pass that seems to need breaking one asks Tom first.

1. No supports under platforms. The raised platforms float, as in any platform fighter: no stem, pillar, pedestal or column stands under them. Take 2 added dark pillar stems under each platform after a complaint about floating pillars that was about the skull pillars, never the platforms, and Tom read the stemmed platforms as mushrooms (2026-11-01). it is a defect when any piece in front of the stair stands within a raised platform's span.
2. The skull pillars stay, grounded, and are never removed. Two tall skull-topped pillars flank the throne, each standing on solid ice with its base visibly on the surface, nothing hovering, and each joined toward the throne by heavy chains (Tom's references of the Frozen Throne summit: two pale stone pillars crowned with carved skulls, spiked chains, a snow ramp up to the throne, cyan ice crystals). Take 4 removed them because they hovered over the void; the fix for a hovering prop is to ground it, never to delete it (2026-11-01). it is a defect when a skull pillar is missing on either side, when a side has no chain, or when a prop near the deck stands neither on the deck nor on an ice floe's top.

## References (private, outside Git)

`~/.local/share/makgora-stage-design-frozen-throne/references/`:

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
- Captures: before and after, both pair orders, in the Wisp native window and the headless renderer under `~/.local/state/makgora/shots/ft-throne/`.

## Stair in-game capture (#897)

The restored stair was captured in a real Warcraft III pool pair at near match zoom, Shadow Hunter first and Chen Stormstout first, on the checkout's development map (31 Oct 2026; `bun wisp accept --only '897-*' --pair K --map STAGED.w3x`, frames in `~/.local/state/makgora/shots/ft-stair-ingame/` on gex45). One cold viewer in a fresh session saw the ice tiers rising from the deck's back edge to the throne block but called the link weak (the tiers meet the throne base without a landing, and two thin floating ice slivers connect to nothing), and said the fighters are not the clearest shapes: the cyan crystals behind the throne, the two skull braziers and the arch are brighter than the small, low fighters. The fighters-first half of the box is open.

## Take 4 status

Tom's native-window playtest (2026-11-01, map 0.3-dev.702) found the skull pillars floating, no throne and junk in the back.

- The skull pillars were the two `IceTorch` braziers: they stood at deck height 1300 units behind the deck's middle with nothing under them, so they hang in the air in Classic as well. They are removed, and it is now a defect when a prop near the deck stands neither on the deck nor on an ice floe's top.
- The magenta clusters were the braziers' particle flame. Classic draws it as a few small dim dots in the emitter's own magenta; the native window draws a dense column of large bright puffs. That is a Wisp emitter-scale difference, recorded on wisp#178; Classic does not tint particles by the effect colour, so tinting them is not the fix.
- The translucent shards were the eight crystals; they are removed (layer 8).
- The throne was hidden behind the top platform's thick dark stem and matched the sky. The chair is pale ice, and the centre stem is as slim as the side stems (matrix scale 0.5 across), so the high back, arms and crown read on either side of it.
- Captures: `~/.local/state/makgora/shots/throne-window/` (before-near, after-near, after2-near; native window, near match camera).

## Take 5 status

Tom's playtest (2026-11-01) undid two misreads. The platform stems (take 2) and the slim centre stem (take 4) are gone: the platforms float (hard rule 1). The skull pillars take 4 deleted are back, grounded on the stair's top step and chained (hard rule 2, layer 7). Chain0 draws about 250 units above its model extents at scale 5 in the native window, so its height was set from captures, not from its bounds. Captures: `~/.local/state/makgora/shots/throne-window-fix/take5-near.png` and `take5-far.png` (native window, near and far match camera).

## Cold read of take 5 in Classic (#875)

Native Classic captures on gex45 (3 Nov 2026, map built from 61b0d50594, pool pair 1, `bun wisp accept --only 'sep-2-*'`, Shadow Hunter against Chen Stormstout paused, both clients' views, near and far camera; evidence `~/.local/state/makgora/accept/20261103-133446/`). Three fresh viewers, given only the images, read:

- First look: near, the fighters first in 2 of 3 (the stepped altar first in the third); far, the arch first in 3 of 3, with the fighters third and called tiny.
- Centrepiece: the throne's stepped altar and towers, 3 of 3.
- Flags: the side ledges hover (2 of 3), which is hard rule 1 working as built; the deck floats over the void with no support (3 of 3); the haze or floor behind the deck is a flat plane with no depth (2 of 3); the chained blocks on the top step look dropped there (2 of 3); the stair steps are flat slabs with little shading (3 of 3). None flagged the towers overlapping the deck.

`tools/stage/contrast.ts --separation` on these frames still fails: worst gap -44.1 L\* (limit 0), and Chen's lower quartile sits at L\* 9 against a backdrop band of 9 to 25 in every view.

## Cold read of take 6 in Classic (#875)

Native Classic captures on gex45 (3 Nov 2026, map built from 79522b844, pool pair 1, `bun wisp accept --only 'sep-2-*' --pair 1`, evidence `~/.local/state/makgora/accept/20261103-180008/`) after the arch fell to `[30, 41, 60]` and four dark far ice shelves were added below the deck. Three fresh viewers, given only the near and far images:

- First look: near, the fighters first in 2 of 3 (the pale tower block first in the other); far, the arch first in 3 of 3, with the fighters called tiny and not the clearest shapes in 3 of 3.
- Centrepiece: the pale towered citadel under the arch, 3 of 3.
- Flags: the new far shelves and a thin slab beside the citadel base read as floating slabs (3 of 3); the haze or floor behind the deck is still a flat plane (3 of 3); the towers frame the deck ends slightly (2 of 3 at far zoom).
- `tools/stage/contrast.ts --separation`: worst gap -15.5 L\* near (was -44.1) and -42.8 far (was -44.1), limit 0. The dark shelves lower the backdrop band to L\* 5 to 24, below Chen's dark half at L\* 9.

The shelves did not read as depth; they read as more floating plates, and the arch still leads at far zoom because the far camera shrinks the fighters, not because of the arch's tint. The next take should try a lighter, haze-graded floor instead of discrete shelves and a smaller arch, not a darker one.

## Take 7 (#875, 2026-11-04)

Take 6's far shelves read as more floating plates and the floor stayed a flat plane, so take 7 removes them: the four far ice shelves and the thin landing slab at the citadel base (the one floe between the stair's top and the dais, which sat at deck height in the air and connected to nothing) are gone, and a floe returning there is a defect. The floor under the deck is a lighter haze-graded navy `[58, 82, 120]` (was `[42, 60, 90]`) that the distance fog pulls toward the sky's blue, and the great arch's scale falls from 7.5 to 5.5 so its footprint is smaller at far zoom, its tint unchanged at `[30, 41, 60]`.

Native Classic, pool pair 1, `bun wisp accept --only 'sep-2-*' --pair 1`, map built from 6398988a8 plus this change; evidence `~/.local/state/makgora/accept/20261104-154958/`. `tools/stage/contrast.ts --separation`: worst gap -17.0 L\* near (take 6: -15.5) and -44.1 far (take 6: -42.8), limit 0. The lighter floor raises the far backdrop band to L\* 29 to 49 behind Shadow Hunter, so the lighter floor costs separation at far zoom.

Three fresh viewers, given only the near and far images: far, the arch first in 3 of 3 (two of them with the shrine it frames), both fighters called tiny and low-contrast in 3 of 3; near, the glove or the red glow under Shadow Hunter or the shrine first, with Shadow Hunter's dark body lost against the dark rock behind it in 3 of 3; the shrine and its chained pillars the centrepiece in 3 of 3. Flags: the thin raised platforms at fighter height read as floating slabs (3 of 3, hard rule 1 working as built); the floor behind and below the deck is still a flat plane (3 of 3); dark spires crowd both frame edges at far zoom (2 of 3). Nobody flagged the far shelves or the citadel-base slab. Box 2 is not met; the open causes are the floor's lack of depth, the far camera shrinking the fighters and Shadow Hunter's dark body against the near dark spires.

## Take 8 (#875, 2026-11-05)

Take 7's cold viewers read the floor behind and below the deck as a flat plane (3 of 3) and led with the great arch at far zoom (3 of 3). Take 8 adds a height fog (`heightFog` in `stageScenery.ts`) and darkens the floor to `[34, 48, 74]` (was `[58, 82, 120]`) so the fog grades it toward the sky's blue with distance. No piece is added, so hard rules 1 and 2 are untouched.

The first try (landed as 25717afbc) started the height fog at 5000 units like the Home and Hazard stages; a Classic capture gave take 7's numbers to the decimal and an identical far image, because the visible floor lies inside that range. The second try starts it at 3300, the stage rules' minimum (end 8000, density 0.5, cap 0.75, from 1600 down to 300 below the deck).

Native Classic, pool pair 1, `bun wisp accept --only 'sep-2-*' --pair 1`, map rebuilt from the checkout, evidence `~/.local/state/makgora/accept/20261105-012720/` (the far mask step lost a command receipt there, so the far gap is not measured; the near gap is). `tools/stage/contrast.ts --separation` near: worst gap -15.5 L\* (take 7: -17.0), limit 0; the dark half of Chen's body is what holds it below zero. Three fresh viewers, given only the near and far images: far, the arch or the pale altar first in 3 of 3 with both fighters tiny; near, the red-glowing fighter first in 3 of 3, and the altar with its pillars (and the arch around it) the centrepiece in 3 of 3, with no one flagging the towers; the floor behind the deck still a flat plane in 3 of 3, though the far floor now fades darker near to lighter far; the pale ice shelves read as flat or floating slabs in 3 of 3 (hard rule 1); the stepped altar block competes with the fighters at near zoom in 2 of 3. Box 2 is not met.

What the repeated reads show: three takes of tint, haze and shelves have not moved the floor verdict, and the far camera shrinks both fighters below any backdrop's brightness, so a backdrop-only pass is unlikely to meet the box. The clause that no viewer flags the ledges contradicts hard rule 1.

Gate 17 (the recommended option, defaulted 2026-11-05) relaxed box 2 to near zoom only: the fighters first, the throne the centrepiece and no tower overlap flagged; the ledge and far-zoom floor clauses are dropped, since the platforms float by hard rule 1 and the far camera shrinks the fighters. Take 8's near read meets it: fighters first 3 of 3, altar centrepiece 3 of 3, no tower overlap flagged.
