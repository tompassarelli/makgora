# Onyxia

Onyxia is two fighters in one stock. She starts every stock as Lady Katrana
Prestor, a Stormwind noblewoman who racks up damage with quick shadow
strings, and her down special reveals Onyxia, the black dragonflight's
broodmother, whose claws, tail and breath guard the ledge and finish the
stock. Tom asked for her in the Goblin Alchemist's place, with the
transformation on down special and a separate ultimate (2026-10-31). All
combat values are original, provisional Smashcraft tuning.

## Roster place

- She takes the Goblin Alchemist's place. The Alchemist is hidden, not
  deleted: `HIDDEN_FIGHTERS` in smashcraft:ts/src/game/sim/heroes/releaseRoster.ts
  lists his slug, which takes him off the select grid, Random and the
  computers' draws; removing it restores him. His kit, look, home stage
  row and object data stay.
- The select grid ends Mannoroth (Pit Lord), Onyxia, Archimonde, before the
  Random tile (Tom, 2026-10-31).
- Her select card, portrait and name read "Onyxia" and show Prestor.
- Her home stage is Blackrock (12), the black dragonflight's mountain.

## Two forms, one fighter

The forms are two characters: `Character.onyxia` (Prestor, selectable) and
`Character.onyxiaDragon` (the dragon, never selectable). A swap sets the
fighter's character and copies that character's tuning (moves, specials,
ultimate, physics, ground, shield) on the swap's last frame
(smashcraft:ts/src/game/sim/forms.ts). Character and tuning are already in
the rollback snapshot and the state hash, so the swap replays like any
other state, and every per-character table (hurtbox, body, model, sounds,
CPU plan) follows the current form. The dragon's hero names Prestor as its
home form, so a lost stock respawns her human. The presentation rebuilds a
fighter's renderers on the frame its character changes.

No passive, no resource: the form is action state, like a stance. The swap
costs:

- **Reveal** (Prestor's down special, 44 frames). She stands exposed for 37
  frames; any hit cancels it and she stays human. On frames 38-41 a burst of
  wings around her deals 6% and pushes foes off; on frame 44 she is the
  dragon. In the air it holds her in place.
- **Human Guise** (the dragon's down special, 26 frames). On frame 26 she is
  Prestor again.
- Both share one 300-frame (five-second) cooldown that starts on the press,
  so a cancelled Reveal still spends it, and neither form can swap straight
  back.

## Prestor: the damage builder

A light caster-noble (weight 0.94, run 1.06) whose moves start fast and
launch low, so they chain at low and middle percent and kill late.

Normals (startup / active / recovery; damage):

- Jab: a backhand, then a palm of shadow (3/2/12, 3%; 4/2/14, 4%).
- Forward tilt (three angles): a shadow flick (6/3/16, 8%).
- Up tilt: a rising sweep that starts juggles (5/4/14, 6%, set to pop).
- Down tilt: a heel trip that pops the foe up for a follow-up (5/3/14, 6%).
- Dash attack: a gliding shove (6/6/20, 8%).
- Smashes kill late: forward 14% (14/3/32), up 13% (12/4/30), down 12% both
  sides (11/3/30).
- Aerials are her combo tools: neutral air 8% both sides (4/6/16, landing
  10), forward air 8% that pops up (5/3/18), back air 10% (6/3/18), up air
  7% with a low launch for chained up airs (5/3/14), down air 9% that pops
  up rather than spikes (8/3/20).
- Grab 7/2/22. Up throw (4%, low launch) is her combo throw; down throw 5%
  for a tech chase; forward 6%, back 9%.

Specials:

- **Shadow Bolt** (neutral). A short, quick bolt (frame 9, 16 units a frame,
  24 frames of life) that deals 5% with a low, fixed-feeling launch, so it
  holds a foe for her next strike. Reflectable.
- **Courtly Feint** (side). A gliding step and palm strike (frames 10-14,
  7%) that pops the foe up; a shield stops the step. Once per airtime in the
  air.
- **Shadow Ascent** (up). She rises two reference heights in a column of
  shadow that taps for 4%, then falls helpless.
- **Reveal** (down), above.

## The dragon: the finisher

A heavy, wide body (weight 1.30, run 0.84, 1.6 times Prestor's reach and
hurtbox) whose moves start slower and launch hard: she trades combos for
edge-guarding and kill confirms.

- Tilts 10-12% with high growth; forward smash, a tail sweep, 20% (20/4/42);
  up smash, fire overhead, 18%; down smash 16% front then back.
- Back air (16%, tail) and forward air (14%, bite) kill from the ledge; down
  air (15%) spikes airborne foes; up air (13%) finishes juggles.
- Up throw (9%) sets up an up air kill confirm at high percent; back throw
  (13%) is a kill throw.

Specials:

- **Flame Breath** (neutral). A cone of fire ahead of her: three holding
  bursts of 3% on frames 14, 20 and 26, then a 7% launch on frame 32.
- **Wing Buffet** (side). One wingbeat sends a gust (frame 12, 14 units a
  frame, 22 frames) that deals 4% with a long, fixed push: the edge-guard
  tool that blows recovering foes away from the ledge.
- **Wing Lift** (up). A great wingbeat lifts her 2.6 reference heights and
  knocks away anyone beside her (9%), then she falls helpless.
- **Human Guise** (down), above.

## Ultimate: Deep Breath

The same in either form. Embers mark six lanes of ground ahead of her, a
hold of flame sweeps along them (5% each, a set knockback), then pillars of
fire erupt along the line and launch (12%). She hovers through the wind-up
in the air; hitting her ends it and every flame still to come.

## Models and credits

The terms of both pages Tom chose were read on 31 October 2026 and are
recorded in smashcraft:docs/design/roster-next.md#hive-model-terms.

- The dragon: [Onyxia by Symphoneum](https://www.hiveworkshop.com/threads/onyxia.348925/),
  its "Lore Accurate" `Onyxia.mdx` and `Onyxia_portrait.mdx`, built from
  Warcraft III Reforged assets and usable with credit to Symphoneum. It is a
  Reforged HD model (PBR textures in DDS); Smashcraft ships a Classic MDX 800
  conversion of it (smashcraft:tools/animations/hd-to-classic.ts), which draws
  the diffuse texture only. It has flying animations only, so the dragon hovers
  with its claws on the floor.
- Prestor: [Katrana Prestor by Footman16](https://www.hiveworkshop.com/threads/katrana-prestor.362851/),
  Classic SD, 843 polygons, an edit of AndrewOverload519's Female Human Mage
  and kangyun's Sally Whitemane staff with both permissions posted. Tom chose
  it after hearing that its texture is based on her World of Warcraft texture
  plus freehand work, and judged it not a World of Warcraft port (decision
  relayed 2026-10-31, gate 145). Its icons are Hearthstone crops and are not
  imported; the select portrait is rendered from the model. The model keeps its
  team-colour cape and glow layers, so each player's Prestor shows the slot colour.
- The page Tom first picked (Hive 375457, a World of Warcraft port) and DSDK's
  model are not used.

## Status (31 October 2026)

Landed: this design and the select grid order. The form swap, both kits and
their tests are on the `onyxia` branch (smashcraft:ts/src/game/sim/forms.ts,
smashcraft:ts/src/game/fighters/onyxia/), waiting on the Prestor model and the
dragon's Classic-mode check before the roster switch hides the Alchemist.
