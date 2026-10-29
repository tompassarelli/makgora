# Costumes (skins)

A costume is presentation only: a fighter's colour treatment. It never touches frame data, hit regions, the sim or rollback state. The one synced fact is the player's choice, `MatchState.costumeChoices[slot]`, an index into that fighter's costume list.

## Model

- Each fighter has up to 8 costumes (`MAX_COSTUMES`). Index 0 is the default and is untinted.
- `costumesFor(character)` returns the fighter's own `HeroLook.costumes` when its `look.ts` declares them, otherwise `DEFAULT_COSTUMES` (default plus Ember, Frost, Verdant). Adding or changing a costume is a data edit in `ts/src/game/presentation/model/costume.ts` or one fighter's `look.ts`.
- A **tint** costume multiplies the whole model by an RGB colour. A fighter body is a Warcraft unit, so the tint multiplies into the body's vertex colour in `ts/src/host/loop/view.ts` with the existing damage, shield, freeze and item tints. Portraits are tinted at run time with `BlzFrameSetVertexColor` (`ui/costumeTint.ts`), so a costume adds no portrait files and no map size.
- An **alternate model** costume (a different `.mdl`) is a second kind, not built yet. It needs its own rig check against the default model (bones, parents, sequence names and lengths, weapon attachment) before its clips can be reused; see "Fel Grom" below.

## Select and sync

- Jump (X/Y in Smash terms, `Action.jump`) on the focused fighter of the character select, or a click on the card portrait, cycles that card's costume. A row of dots under the portrait, in the slot's chip colour, shows the chosen one.
- Both inputs are Warcraft key and frame events, delivered to every client like the team and mode buttons, so `cycleCostume` runs on every client with the same arguments.
- A human may cycle their own card; the actor who may place a CPU fighter may cycle that CPU's card. Choosing a different fighter resets the slot to the default costume. Two players may pick the same fighter in different costumes.
- The choice is carried into the match through `MatchState`; the HUD plate bust, the off-screen bubble and the body use it. The costume is not part of canonical state or the state hash, because no gameplay field depends on it.

## Player identity

Identity stays with the team or slot colour (the unit's team colour, the HUD plate colour, the card chip). A tint multiplies the whole model, so ts/test/costume-colors.test.ts checks that for every fighter and every pair of different slots, each pair of costumes keeps the four slot colours (red, blue, teal, purple) at least 25 CIE76 units apart after tinting. Seed tints stay mild (every channel at least 130 of 255) so team colour still reads.

## Fel Grom

The stock Classic Chaos Grom (`units\demon\chaoshellscream\chaoshellscream.mdx`) has Hellscream's bone names and parents (minus a `Banner` bone), identical pivots for the 52 shared nodes, and the same weapon attachment, but 13 sequences instead of 16 (four `Stand First..Fourth` sequences gone, a `Stand - 3` added), so every stored sequence index of Grom's original clips shifts by one and his authored clips (appended after the original 16) would sit at different indices. His clips therefore do not apply unchanged; making the fel model a costume means regenerating Grom's timeline body from the fel stock model with `tools/animations/grom-clips.ts` (its 16-sequence assertion and the three original-clip indices would change) and re-running the weapon-trace and hit-region checks. That is a decision for Tom, not part of this change.
