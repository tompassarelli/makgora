# Stand-in fighters

A stand-in is a selectable placeholder: a fighter on his stock Classic model and
stock clips, playing one shared, plain moveset until his own kit is designed
and built. Tom asked for Akama, Firelord and Goblin Alchemist as stand-ins
(2026-10-29), with their real kits to follow.

The select tile and the match HUD show each stand-in's name with "(WIP)", so
players know he is a placeholder.

## Who

| Fighter | Code | Stock model | Real kit |
| --- | --- | --- | --- |
| Akama | 32 | `units\other\DranaiAkama\DranaiAkama` | Neutral B is his own Shuriken Volley ([roster.md, Akama](roster.md#akama-neutral-b-tom-2026-10-30)) and up B his own Shadow Step ([roster.md](roster.md#akama-up-b-tom-2026-10-30)); the rest is not designed yet |
| Firelord | 33 | `Units\Creeps\HeroFlameLord\HeroFlameLord` | Side B is his own Submerge and Down B his own Lava Raze ([roster.md, Firelord](roster.md#firelord)); the rest is not built yet |
| Goblin Alchemist | 34 | `Units\Creeps\HeroGoblinAlchemist\HeroGoblinAlchemist` | [roster.md, Goblin Alchemist](roster.md#goblin-alchemist) |

## The shared moveset

Source: `ts/src/game/fighters/standin/`. Each stand-in's own folder holds only
his name, his model and clip binding, and the effect models his bolt and burst
draw.

- Body: a middleweight (weight 1.12, height 1.10, width 1.00, run and air 1.00),
  with the 117-unit shield of that height.
- Normals: a two-hit jab, three-angle forward tilt, up and down tilt, dash
  attack, three smashes, five aerials with automatic half landing lag, a grab,
  pummel and four throws. Frame data follows the roster's middleweight
  bands; forward smash, up smash and back air are the kill moves.
- Specials: Bolt (neutral, a straight reflectable shot; Akama's neutral and up are his own Shuriken Volley and Shadow Step), Lunge (side, a short
  rush that a shield stops), Rising Strike (up, a hitting rise into helpless
  fall) and Burst (down, a blast on both sides; Firelord's side is his own Submerge and his down his own Lava Raze).
- No ultimate: the ultimate table is optional and a stand-in has none.
- Every pose is drawn with the model's own stock stand, walk, attack and spell
  clips; damage reactions flinch on his ready stand.

## Gates a stand-in is exempt from

A stand-in is not a finished fighter, so the finished-fighter gates wait for
his real kit:

- Balance band (docs/design/balance.md, 40-60% wins) and the play-style
  profile: the shared moveset is not tuned per fighter, and its numbers
  change when the real kit replaces it.
- Finished-move cold read (finished-move.md): stock clips stand in for
  authored motion until his own clips are made with his kit.

The moves must still start, hit and mirror in both facings, pass every
automated test and play natively.

## Known gaps

- Goblin Alchemist's camera bound measures 609 units tall, because his model's
  `stand - 4` sequence, which his stand-in look never plays, reaches far above
  him; the generator measures every Stand sequence, so matches with him frame
  wider until his real kit binds his own clips.
