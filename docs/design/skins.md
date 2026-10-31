# Costumes (skins)

A costume is presentation only: a fighter's colour treatment. It never touches frame data, hit regions, the sim or rollback state. The one synced fact is the player's choice, `MatchState.costumeChoices[slot]`, an index into that fighter's costume list.

## Model

- Each fighter has up to 8 costumes (`MAX_COSTUMES`). Index 0 is the default and is untinted.
- `costumesFor(character)` returns the fighter's own `HeroLook.costumes` when its `look.ts` declares them, otherwise `DEFAULT_COSTUMES` (default plus Ember, Frost, Verdant). Adding or changing a costume is a data edit in `ts/src/game/presentation/model/costume.ts` or one fighter's `look.ts`.
- A **tint** costume multiplies the whole model by an RGB colour. A fighter body is a Warcraft unit, so the tint multiplies into the body's vertex colour in `ts/src/host/loop/view.ts` with the existing damage, shield, freeze and item tints. Portraits are tinted at run time with `BlzFrameSetVertexColor` (`ui/costumeTint.ts`), so a costume adds no portrait files and no map size.
- A **skin** costume swaps stock textures on the fighter's own body: `Costume.skin.textures` maps a stock texture path to its replacement. Its body is the fighter's timeline body with only the materials changed, so it keeps his skeleton, mesh and every animation key and plays each clip at that clip's own times; the clip, reach and motion tables serve every costume unchanged. The derive's costumes step (`tools/animations/costume-bodies.ts`, after the clips, bodies and flashes steps in `ts/scripts/wisp/fighterArt.ts`) reads the skins from the fighter's rules (`ts/src/generated/fighter-art/SLUG.ts`, generated from the look), writes `<Fighter>CostumeBody<N>-<sha>.mdx` beside the timeline body in his `original-clips-static-lights` shard and lists it in `ts/src/generated/costumes/`. The fighter pool and the result poses draw a skinned costume's timeline clips from that body (`costumeClipModel`); the white hit flash keeps the default body's, since the mesh is the same.
- Costumes that carry the same skin share one body and one set of portraits: the derive writes the body once and lists it for each index, and `portraitOutfit` names every one of them by the first costume with that skin (Murloc's four costumes are all teal Mrgl, so `FighterTileMurlocTeal` serves the four, with the tints applied at run time).
- A skin costume has its own portraits, `Fighter{Tile,Card,Bust,Stock}<Fighter><Costume>` in the `fighter-renders` family (for example `FighterBustGromHellscreamFelP1`), rendered by `bun scripts/fighterPortraits.ts PRIVATE_OUTPUT --only GromHellscreamFel` from the costume body. `fighterPortrait(character, kind, slot, costume)` names them, and the select card, the HUD plate bust and stock icons and the off-screen bubble pass the slot's costume. The roster grid tile stays the default one, since a tile belongs to the fighter, not to a slot.
- The KO body pool (`CombatEffects`) holds one body per fighter and per skin costume (`bodyVariants`), and a KO shows the body of its owner's costume.
- `-dev quick pair FIGHTER in COSTUME / FIGHTER` starts a quick match in a costume, for example `-dev quick pair grom hellscream in fel / mountain king`.

## Select and sync

- Jump (X/Y in Smash terms, `Action.jump`) on the focused fighter of the character select, or a click on the card portrait, cycles that card's costume. A row of dots under the portrait, in the slot's chip colour, shows the chosen one.
- Both inputs are Warcraft key and frame events, delivered to every client like the team and mode buttons, so `cycleCostume` runs on every client with the same arguments.
- A human may cycle their own card; the actor who may place a CPU fighter may cycle that CPU's card. Choosing a different fighter resets the slot to the default costume. Two players may pick the same fighter in different costumes.
- The choice is carried into the match through `MatchState`; the HUD plate bust, the off-screen bubble and the body use it. The costume is not part of canonical state or the state hash, because no gameplay field depends on it.

## Player identity

Identity stays with the team or slot colour (the unit's team colour, the HUD plate colour, the card chip). A tint multiplies the whole model, so ts/test/costume-colors.test.ts checks that for every fighter and every pair of different slots, each pair of costumes keeps the four slot colours (red, blue, teal, purple) at least 25 CIE76 units apart after tinting. Seed tints stay mild (every channel at least 130 of 255) so team colour still reads.

## Fel Grom

The stock Classic Chaos Grom (`units\demon\chaoshellscream\chaoshellscream.mdx`) is Hellscream's mesh: the same seven geosets with the same vertices, faces and UVs (within 0.0003 units) and the same bone names apart from Hellscream's `Banner`. Hellscream's own model already carries `Textures\HellscreamChaos.blp` as a fading layer over `Hellscream.blp` for his transformation sequences. So Grom's Fel costume is the skin `Units\Orc\Hellscream\Hellscream.blp` → `Textures\HellscreamChaos.blp`: the swap leaves each drawn material as the stock Chaos Grom draws it (an opaque fel skin, team colour under a fel blend), and his authored clips need no retarget. The Fel body adds about 680 KB to the raw map imports.

Fel is Grom's default costume, index 0, so a player who never changes costume plays fel Grom, and his roster tile, card, HUD bust, stock icons, KO body, computer picks and Random all show the fel look; the stock green Hellscream is his first alternate, Green, and the tints follow it on the green body. Tom chose fel as the default after seeing the green tile on the select screen (2026-10-30).

