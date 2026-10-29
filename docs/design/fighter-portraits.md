# Fighter portraits

Every selectable fighter uses cut-out 3D renders of its match model with the shared Rifleman camera and crops; cards, HUD busts and round stock icons come from the same pose (#323).

Character select, the player cards, the HUD plates and the off-screen bubble
show each fighter as a render of its own model, like Smash Ultimate's select
screen: a head-and-shoulders crop on one shared background for the grid, and
the full body for the cards and HUD.

## Why renders, not command icons

Warcraft III's frame space is 0.6 units tall at every resolution, so a unit
covers `height / 0.6` pixels: 1800 at 1080p, 3200 on a 2880x1920 display. In
classic graphics (`hd=0` in War3Preferences.txt) a command-button icon
(`ReplaceableTextures\CommandButtons\BTN*.blp`) is 64x64. Warcraft's own
command card draws it at about 0.039 units, roughly 2x. The selection frames
drew it at 3.7x on grid tiles and 6x on cards and HUD plates on that display,
so the icons came out blurry. Frames are square (one size for both sides), so
they were never stretched.

## Sizes

smashcraft:ts/src/game/ui/portraitFrames.ts sizes each frame from the texture
pixels it draws on a 1920-tall display. A portrait is drawn at its texture's
own size or smaller, never stretched past it:

| frame | texture | drawn on 2880x1920 |
|---|---|---|
| player card, HUD plate | 384 px card render | 384 px (0.12 units) |
| grid tile | 256 px tile render | at most 256 px (scales down with roster size) |
| off-screen bubble | 256 px tile render | 128 px |

## Generating

`bun scripts/fighterPortraits.ts PRIVATE_OUTPUT` (from ts/, through the
capacity helper) draws every fighter in `RENDERED_FIGHTERS` with Wisp's
headless renderer from the body the match draws: its timeline body
([#363](https://github.com/tompassarelli/smashcraft/issues/363)).
Use `--only NAME,...` to limit the fighters.
Each Classic Bust also gets Wisp's portrait receipt (scene, render size, the
crop the texture holds, texture size and parts) in `fighter-renders/receipts/`,
stored with the family; `PORTRAIT_PARTS` in smashcraft:ts/scripts/portraitParts.ts
names each fighter's Classic head, face, weapon and gripping-hand nodes, kept to
the nodes its drawn body has. The headless renderer supplies them as
`render.portraits`, so `bun wisp headless --bounds` gives each drawn bust an
`inFrame` row (wisp#140). It points each receipt's timeline body at the one the
map imports now, so rebuilding a body never orphans a stored receipt. Each
receipt also records `source`, the SHA-256 of the fighter's source model in the
assets view, and smashcraft:ts/test/portraitSources.test.ts fails when any
fighter's receipts name a different hash than its current model, so a model swap
fails until that fighter's portraits are rendered again (#712).
Each body is posed at the frame of its Stand clip whose face
joints (nose, else eyes, else the head attachment) stand highest above its
head bone, so an idle that bows the head still shows the face, and turned
about the vertical so its face points at the camera, 20 degrees toward image
left so the weapon hand and near pauldron sit behind it. The face's heading
comes from the bind pose's
level head-bone-to-nose (else eyes, else the head mesh's forward-most tenth)
direction turned by the bone carrying most of the head mesh. Bodies whose head
mesh has under 50 vertices (Murloc and Peon) face the camera as their body does. Only the yaw
turns: tilting a body to level a bowed face lays the whole card render over.
The camera looks level through a narrow lens fitted to the silhouette, so the
face is seen from within 4 degrees of its own height. Where that still hides
the face, `CORRECTIONS` in smashcraft:ts/scripts/fighterPortraits.ts adds a
per-fighter turn, Stand time, global-sequence clock, camera angle or crop zoom; `level` poses at the
Stand frame whose face is closest to level and tilts the camera (at most 35
degrees) to meet what tilt remains. Wisp draws the same pose the script
evaluates. The portrait is lit in four passes summed after rendering in display
values: the
neutral stage light's ambient alone, a key from the camera's side (25 degrees
toward image left, 30 above), a low fill from 40 degrees toward image right and
a rim from behind, image right and 35 above, so no face falls half into
shadow (#363). Three weightings
(`LIGHT_VARIANTS`) are each exposed so the P1 bust's mean luma reaches 110; the
one lighting the largest share of the bust above luma 50 lights all five outfits.
`bun scripts/portraitLight.ts [FIGHTER_RENDERS]` (default: the stored family) checks
every fighter: bust mean luma within 85-150, roster max/min at
most 1.6, lit share at least the calibrated floor, the card render's box
centred and filling 90-96% of its texture, the chip's mass near its centre line,
and the player preview's frame centred in its card's preview area (below the
tag, above the name box, or above the CPU summary). The generator fails when a
head mesh's centre falls below its silhouette's middle. The hero glow under the feet is
hidden by pointing its additive texture at stock black. Each fighter is drawn
in Warcraft's Coal team colour (`NEUTRAL_TEAM_COLOR`) for the neutral grid
tile, and in red, blue, teal and purple for its slot outfits; files append
`P1` through `P4`. Tiles and busts frame head and shoulders around the head mesh: the posed vertices bound to the
head bone or its direct children, evaluated with Wisp's vendored war3-model
(its version-1800 skin reader), not the body's bounds; stock icons frame the
head alone.
The custom-game preview uses the red and blue player cards.

It writes `PRIVATE_OUTPUT/fighter-renders/`; store that folder with
`bun wisp inputs add fighter-renders`. The map build imports each portrait at
its path. The renders are proprietary derived art and stay outside the repository.

Murloc's eyelids (the green ovals, Head01 and Head02) lie over his eyes for the
start and a few brief windows of a 7.5 s global-sequence loop and slide 3.6 units
back to show the blue eyes for the rest, so the clock the match was sampled at
(0) draws them shut. His `CORRECTIONS` entry holds the clock at 1.5 s, where
both eyes are open; his Stand pose is the match's sampled frame, as for any
fighter whose head mesh is too small to place a face (the frame with the
highest head attachment, 4.113 s, bows his head and hides the face). Posed
through his `Bone_*` rig, Wisp's renderer draws the stock model correctly: its
node matrices equal the pivot-and-parent composition of the model's own tracks
at every key.
The earlier Blender set drew Forsaken Paladin black: Blender's MDX reader lost
the textures of his version-1800 skinned body.

Picked cards, HUD busts, stock icons and off-screen portraits use the fighter
slot's variant; the roster grid keeps its neutral portrait.

The results pose and the star-KO body play their clips on the timeline body
too.

## Match HUD plate

The plate follows the damage HUDs of Melee, Ultimate and Rivals in the
selection screen's art (gold edge, bevelled metal, navy). One 544x236 plate
(smashcraft:tools/selection/art/HudPlate.svg) per fighter is drawn 1:1 on the
reference display, whatever the player count; the panels in the right half of
the screen use its mirror image (`HudPlateMirror`), so two players' panels face
each other. A player-colour band sits behind the fighter's head-and-shoulders
render (`Bust`, 256 px, clear background), which breaks out of the plate's top
as Ultimate's does. The whole damage percent is large with a small percent sign
after it: the simulation keeps fractional damage, but every readout (HUD,
results, training) shows the whole percent. Its colour blends continuously
white → yellow (50%) → red (100%) → dark red (150% and above). It shakes for 14
rendered frames on each hit, harder for bigger hits, and is otherwise at rest at
every percent: it never trembles on its own (Tom's correction, 2026-10-27;
local presentation on the render clock only). The ultimate bar fills the track under the percent, the name
sits on the strip under it, and the stock row under the name shows one 38 px
head render per remaining stock, as Rivals does: up to five, then one icon and
the count. smashcraft:ts/src/game/ui/plateLayout.ts holds every box in plate
pixels. The number and its percent sign carry a 2-pixel outline, dark around
the light colours and light from 150%, so the dark reds stay readable on the
plate and on dark stages.

## Overhead marker

Above each fighter in a match, as in Rivals, a marker repeats the whole percent
in the HUD's colour, outline and hit shake, the player's name (the Warcraft
player name, or CPU) in the slot colour under it, and a slot-colour triangle
(`MarkerArrow`) pointing down at the fighter. It sits a fixed 16 reference
pixels above the top of the fighter's standing hurtbox (higher while an escape
meter shows), follows the fighter every rendered frame, hides while the fighter
is offscreen, out, or the match is paused, and two markers that would overlap
are pushed apart sideways (smashcraft:ts/src/game/ui/fighterMarker.ts). It reads
simulation state and never writes it.

## Slot colours

A fighter's model shows its slot's Warcraft player colour in a match
(`BlzSetSpecialEffectColorByPlayer` with `Player(slot)`): red, blue, teal and
purple for slots 1 to 4. smashcraft:ts/src/game/ui/slotColors.ts holds those
colours, and smashcraft:tools/selection/build-art.ts paints each slot's chip,
selection card and HUD plate band from them. The portraits themselves are
neutral, so a fighter's colour appears only on its own slot's card and plate,
the same on every client.

## Selection cursor

Ready chips use a frame 65% of the roster tile width at every resolution and
UI scale. The authored chip's 237-pixel rim spans a 256-pixel canvas, so its
visible diameter is 60.18% of a tile, within #346's 55–70% reference band.
The pointer target follows that frame size; the P1/P2 labels keep their art.

On the fighter select screen the stock Warcraft cursor (the Human gauntlet; the
build forces every player slot to Human) stays visible. While a chip is carried
the cursor is hidden (`BlzEnableCursor`) and the local client draws a pinching
steel gauntlet, with the chip's top rim between thumb and fingertip. The hidden
state is asserted every update; the shown state is sent once when it returns.
`SelectionHandPoint` is painted but never displayed. `SelectionHandPinch`
uses Tom's publicly approved AI-created
smashcraft:tools/selection/art/wc3-pinching-hand.png through the same builder.
The authored source's pinch point is (256, 288). The Classic 32x32 texture has the stock normal cursor's alpha footprint,
29x27 at (2,4). It uses the stock
HumanCursor model's 0.025x0.0239 UI quad over its 30.19-pixel UV region;
UI pixels scale with client height divided by 0.6. The corresponding visible
bounds at 1080p are 43.23x38.48 pixels; other poses are unchanged.
The phase owner permits the stock
cursor in stage selection, pause, title and settings menus or when a panel
opens over the roster. Both cursors stay hidden during gameplay and results.
The selection asset build is described in smashcraft:docs/build-inputs.md.
Warcraft has no
per-render Lua callback (smashcraft:docs/high-refresh.md), so hand and chip move
together once per 60 Hz tick from one mouse sample.

## Classic tile colour floor

Provenance: Tom's 0.0.192 character-select finding #563 item 22, measured
14 October 2026 against fighter-renders `0c7fa1e1bd36802077b565a94055923d729964f050d720ceb1da4a229fc4536e`.
The neutral tile's foreground uses its matching P1 bust alpha mask to exclude
the shared navy background. Mean HSV saturation and Rec. 709 p90 minus p10
luma measure colour and contrast. A tile fails when both fall below 70% of
the Classic roster median; naturally gray fighters pass through retained
contrast. The washed-out Anub tile measured saturation 0.129 and contrast
106.7 against floors 0.222 and 147.0. Removing its portrait-only 2.6 gamma
lift restores saturation 0.251 and contrast 194.9 while its P1 bust remains
at mean luma 108.9 with lit share 0.844. `portraitLight.ts` reports this floor
with the existing light and placement checks.
