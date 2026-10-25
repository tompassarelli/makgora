# Melee recovery reference for Smashcraft's recovery redesign

Scale: 1 Melee unit (MU) = 6 Smashcraft world units (w)
(`smashcraft:ts/src/game/sim/tuning.ts` `WORLD_UNITS_PER_MELEE_UNIT = 6.0`). Cells read
"MU (w)". Speeds are per frame at 60 fps. Smashcraft's main deck spans −600..600 w (±100 MU)
and the hero reference height is 132 w (22 MU); stage sizes are in
`smashcraft:docs/design/stages.md`.

## Table

| Fighter | Gravity | Fall speed | Air speed | Aerial jump height × count | Up-B first active / total / special-fall landing (frames) | Up-B travel as recorded | Side-B or other recovery as recorded |
|---|---|---|---|---|---|---|---|
| Fox | 0.23 (1.38) | 2.80 (16.8) | 0.83 (4.98) | 40.2 (241) × 1 | 20 / 92 / – | Fire Fox in the air 77.7 (466) | Illusion in the air 83.7 (502) |
| Falco | 0.17 (1.02) | 3.10 (18.6) | 0.83 (4.98) | 41.8 (251) × 1 | 43 / 84 / 3 | Fire Bird in the air 60.1 (361) | Phantasm in the air 77.1 (463) |
| Marth | 0.085 (0.51) | 2.20 (13.2) | 0.90 (5.4) | 25.2 (151) × 1 | 5 / 39 / 34 | 50.6 (303) in the air; 47.2 (283) from the ground | none |
| Sheik | 0.12 (0.72) | 2.13 (12.8) | 0.80 (4.8) | 38.0 (228) × 1 | 36 / 94 / 4 | start rise 30.5 (183), then the teleport | none useful; Vanish is the recovery |
| Jigglypuff | 0.064 (0.384) | 1.30 (7.8) | 1.35 (8.1) | unknown (own animation) × 5 | no recovery up-B | — | Pound; not helpless |
| Peach | 0.08 (0.48) | 1.50 (9.0) | 1.10 (6.6) | unknown (own animation) × 1 | 6 / 40 / 4 | 35.0 (210) in the air; 36.8 (221) from the ground | Float; Peach Bomber |
| Ganondorf | 0.13 (0.78) | 2.00 (12.0) | 0.78 (4.68) | 22.2 (133) × 1 | 13 / 64 / 30 | 41.9 (251) in the air; 54.5 (327) from the ground | Gerudo Dragon |
| Captain Falcon | 0.13 (0.78) | 2.90 (17.4) | 1.12 (6.72) | 28.6 (172) × 1 | 13 / 64 / 30 | 37.6 (226) in the air; 48.9 (294) from the ground | Raptor Boost |
| Mario | 0.095 (0.57) | 1.70 (10.2) | 0.86 (5.16) | 26.7 (160) × 1 | 3 / 37 / 30 | 38.4 (230) in the air; 40.4 (242) from the ground | Cape lift 9.2 (55); Tornado rise 39.9 (239); not helpless |
| Samus | 0.066 (0.396) | 1.40 (8.4) | 0.89 (5.34) | 26.1 (157) × 1 | 4 / 47 in the air / 24 | 46.1 (277) in the air; 44.5 (267) from the ground | bomb jumps and grapple |
| Mewtwo | 0.082 (0.492) | 1.50 (9.0) | 1.20 (7.2) | unknown (own animation) × 1 | 7 / 32 / – | teleport at 5.0 (30) a frame | none |

An air dodge leaves the fighter helpless (SmashWiki "Air dodge"), and it can't catch the ledge
until its 49-frame animation has ended (`smashcraft:docs/physics.md`, "Outer ledge recovery").

## How each value was obtained

- **Gravity, fall speed, air speed, aerial jump height, jump count**: from
  `smashcraft:docs/design/melee/movement.md` (Falling and Jumps tables), which reads
  `smashcraft:references/melee-frame-data/character-attributes.csv`. Peach, Mewtwo and
  Jigglypuff use their own animation-driven aerial jumps, which movement.md marks "own", so
  their heights are unknown.
- **Up-B first active, total and special-fall landing**: meleeframedata.com's `up_b` (`aup_b`
  where the aerial version differs) `start`, `total` and `ld_fl_spec`, from
  `smashcraft:references/melee-frame-data/records.jsonl`; – where the record has none.
- **Recorded travel**: libmelee's recorded frame table (`melee/framedata.csv` at revision
  `ef679270`, SHA-256 `8e0d8112…`, the file the repo's libmelee intake uses), summing each
  up-B and side-B action's per-frame `locomotion_x/y`. None of these figures is frame-perfect:
  the frame on which an action starts and ends can shift each total by about one frame of
  travel.

## Edgeguard character by archetype

- **Fox / Falco**: very long recoveries, Fire Fox about 78 MU and Fire Bird 60, Illusion and
  Phantasm about 84 and 77. But the charge before the travel is a sitting target (Falco's
  first active frame is 43), and the travel is a fixed straight line. An opponent who reads the
  angle intercepts it or takes the ledge. Falco's shorter Fire Bird and fast fall make his
  recovery the worse of the two.
- **Marth**: good vertical reach (51 MU) with little sideways reach. The move is fast (frame
  5). Hitting him low, or taking the ledge so the move finishes into helpless fall, beats it.
- **Sheik**: strong and flexible vertical reach with an invisible teleport. Her start is long
  and visible (first active frame 36), so edgeguarders attack the startup or the landing
  rather than the endpoint.
- **Jigglypuff / Peach**: five floaty aerial jumps with Pound, or Peach's float with no
  vertical drop. Their mix-ups come from timing rather than a single committed move. They are
  hard to edgeguard by position and are punished by covering where they must eventually land.
  Peach's parasol fall is slow, so the punish window is long.
- **Ganondorf / Captain Falcon**: short, slow, predictable dives of 38–42 MU from the air. They
  fall fast (Falcon) or drift slowly (Ganondorf). They are easy to edgeguard: an intercept above
  the ledge, a ledge-hog, or a reverse hit off the dive's descent.
- **Mario / Samus / Mewtwo (cheap extras)**:
  - Mario's up-B is short (38 MU) but fast (frame 3), and he adds Cape and Tornado lift.
  - Samus's up-B gives 46 MU with 24 frames of special-fall landing; she also has tether and
    bomb stalls.
  - Mewtwo's teleport is fast and long, after a floaty approach.

## Sources and rights

- In-repo, read only:
  - `smashcraft:ts/src/game/sim/tuning.ts`
  - `smashcraft:docs/design/melee/movement.md`
  - `smashcraft:references/melee-frame-data/records.jsonl`, `character-attributes.csv` and
    their `README.md`
  - `smashcraft:docs/physics.md` ("Outer ledge recovery")
- meleeframedata.com database: https://github.com/mitchhit234/meleeWebProject `characters.db` at
  `ec5155149faeed24b5e5781d7efe17387cc9ee3d` (https://meleeframedata.com/). Rights: no reuse
  license found; factual numbers only.
- libmelee: https://raw.githubusercontent.com/altf4/libmelee/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv.
  Rights: LGPL-3.0; factual recorded numbers only, no code used.
- SmashWiki (https://www.ssbwiki.com/Dolphin_Slash, https://www.ssbwiki.com/Falcon_Dive) was
  checked and gives no distances, so it is not used for any number. Rights: CC BY-SA text; not
  reused.
