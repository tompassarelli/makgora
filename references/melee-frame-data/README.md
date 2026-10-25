# Melee frame-data reference

Smashcraft's one corpus of Melee frame data: a factual research reference, not a
physics specification or an importable character definition. It has four
inputs, each with its own provenance: meleeframedata.com's database
(`records.jsonl`, below), libmelee's recorded per-frame table
(`libmelee.jsonl`, under "libmelee hitbox positions and dodge travel"),
dash-attack travel measured from public Slippi replays
(`replay-dash-attacks.jsonl`, under "Dash-attack travel from public replays") and
FightCore's frame data with knockback values (`fightcore.csv`, with every
fighter's per-phase hitboxes and knockdown thresholds in `fightcore-phases.jsonl`
and `fightcore-thresholds.jsonl`, under "FightCore knockback and getup data").
The public-source parity ledger built on it is
smashcraft:docs/design/melee-parity-plan.md.

The database intake contains 789 records: 502 attacks,
52 grabs, 105 throws, 104 dodges, and 26 character-stat records. It covers all
26 roster entries (counting Sheik and Zelda separately) plus one anomalous
`_marth` throw row retained exactly as found. Do not treat that as a 27th fighter.

## Source and rights

Observed 2026-10-03. The website https://meleeframedata.com/ links its author
Janoris / Mitchell Meier's repository https://github.com/mitchhit234/meleeWebProject.
The input is that repository's `characters.db` at commit
`ec5155149faeed24b5e5781d7efe17387cc9ee3d`, SHA-256
`ebdc169f3b97a3b8693206ca00f8f9b4fb1684f237a41367bf149af581320eb6`.
The site credits https://github.com/pfirsich/meleeFrameDataExtractor for much of
its data; that extractor was not run in this intake.

No project reuse license was found in the upstream tree or README. This intake
records factual numeric observations, identifiers, and their source locations;
it does not copy the website implementation, authored notes, GIFs, textures, or
other artwork. Those materials require a separate rights decision before reuse.
The independent ingestion tool is confined to the foreign-data boundary.

The public site's certificate failed TLS validation (curl error 60, expired
certificate). Unauthenticated public homepage and Fox/Falco/Marth HTML were
read with certificate checking disabled solely for this comparison. All input
database bytes came from GitHub over normally validated HTTPS. The live-page
comparison is therefore a limited observation, not authenticated provenance.
The repository snapshot is not claimed to equal the entire deployed database.

## Record schema

`smashcraft:references/melee-frame-data/records.jsonl` contains one JSON object
per line, identified by `(character, category, action)`:

- `schema_version`: 1.
- `character`: original database character identifier, unchanged.
- `category`: original table: attacks, grabs, throws, dodges, or misc.
- `action`: original move/type identifier; null for misc.
- `source`: repository, exact revision, database path/table, and corresponding
  website URL. The URL is constructed from the source identifier; `_marth` is
  anomalous and is not asserted to have a functioning page.
- `game_revision`: null. Neither NTSC/PAL nor disc revision was established by
  this intake. Do not silently assume NTSC 1.02.
- `frame_index_origin`: 1, the website's stated timing convention. This does not
  certify GIF counters, action-script indexing, or interrupt-boundary semantics.
- `source_values`: original database scalar fields, preserving numbers, empty
  strings, null, and -1 exactly. SQLite numbers have no retained display string.
- `values`: same keys; -1 and empty strings become null. Source null stays null.
  This combines missing and inapplicable values; it never substitutes zero.
- `notes_present_but_excluded`: whether nonempty authored notes were omitted.
  Consult the source before treating such a move as a simple continuous window.

### Field meanings and traps

The raw column names are intentionally preserved, even when misleading:

| Source field | Meaning / limit |
|---|---|
| attacks.start, end | Reported first/last active frame; not a list of discrete hit windows |
| attacks.total | Reported total/action boundary; do not infer end lag by subtraction without resolving IASA and indexing |
| attacks.iasa | Reported animation interrupt frame |
| attacks.stun | **Shield stun**, not hitstun |
| attacks.percent, percent_weak | Reported strongest/weakest base damage, not multi-hit total; source warns values are rounded |
| attacks.ld_fl_spec | Landing lag after special fall |
| attacks.auto_cancel_s, auto_cancel_e | Source autocancel boundary fields; preserve convention before interpreting intervals |
| attacks.land_lag, cancel_lag | Landing and L-cancel lag |
| grabs.start, total | Grab startup and total |
| throws.start, end, total, percent | Reported throw timing and damage; site's timing assumes Mario as target |
| dodges.start, inv_end, total | Invulnerability start/end and total |
| misc.weight | Reported weight |
| misc.gravity | **Terminal (fall) velocity**, neither gravitational acceleration nor fast-fall speed: it equals `character-attributes.csv` Terminal Velocity for all 26 fighters |
| misc.walk_speed | **Dash speed** on the live site, not walking speed |
| misc.run_speed | Run speed |
| misc.wd_length | Wavedash length **rank**, not distance |
| misc.wd_frames | Perfect-ledgedash-angle intangibility frames, not wavedash duration |
| misc.jump_squat, wall_jump | Jump squat; wall-jump availability as 0/1 |

No hitbox geometry, hurtbox geometry, knockback growth/base knockback, launch
angles, collision rules, hitstun formula, electric hitlag rules, or VFX timing
is established by this dataset. It cannot prove a Melee physics port. Nor can
it directly calculate shield safety without contact frame, spacing, landing,
interrupt rules, defender options, and movement context. Multi-hit gaps and
special-case behavior may exist only in the omitted notes.

## Coverage and observed check

`smashcraft:references/melee-frame-data/coverage.json` records counts for every
character and table and missing counts per scalar field. 584 records contain
at least one null/missing/inapplicable value; 333 have excluded source notes.
These counts do not mean 584 moves are broken: many aerial-only fields are
inapplicable to grounded attacks.

Every output line was parsed; counts cover all five input tables. The nearest
representative check matched these database entries against live HTML:

| Character / action | Start–end | Total | IASA | Shield stun |
|---|---:|---:|---:|---:|
| Fox jab1 | 2–3 | 17 | 16 | 3 |
| Falco jab1 | 2–3 | 17 | 16 | 3 |
| Marth jab1 | 4–7 | 27 | 26 | 4 |

This checks transcription and limited source/site agreement, not game accuracy.
The source `_marth` row and missing values remain unresolved observations.

## Repeat the intake

Run from the checkout's root. The command downloads only the 104 KiB SQLite data file, never images or game assets.
Bun is needed; `nix shell nixpkgs#bun -c bun` can replace `bun` where unavailable.
The tool checks the input hash before reading and refuses unreviewed nonnumeric
field values. It regenerates records and coverage, then parses every line and
checks the three representative entries above. Expected duration: seconds.

```sh
curl --fail --location 'https://raw.githubusercontent.com/mitchhit234/meleeWebProject/ec5155149faeed24b5e5781d7efe17387cc9ee3d/characters.db' --output /tmp/melee-fd-characters.db
bun references/melee-frame-data/intake.mjs /tmp/melee-fd-characters.db references/melee-frame-data
```

The script does not fetch live pages or claim fresh deployment parity. Updating
the pinned revision requires rechecking source terms, column meanings, anomalies,
and representative site values rather than merely replacing the checksum.

## libmelee hitbox positions and dodge travel

`smashcraft:references/melee-frame-data/libmelee.jsonl` reduces libmelee's
recorded frame table to what meleeframedata.com's database lacks: where each
normal attack's and grab's hitboxes are, frame by frame, and how far each attack
and ground dodge moves the fighter on each frame. It has 477 records, one per `(character, action)`,
for the 26 fighters (Popo stands for the Ice Climbers; Nana is left out).

Source: https://github.com/altf4/libmelee at revision
`ef679270ff95f0d42339dcdf1608282a35023349`, file `melee/framedata.csv`, SHA-256
`8e0d811290b511902076c0011db1a0116356a7ddaa68dfa369ea4f5dcdc93777`, the same
file smashcraft:docs/physics.md cites for roll travel. libmelee is licensed
LGPL-3.0; only factual numbers recorded from the game are kept, renamed to this
corpus's identifiers, and no libmelee code is used. The table was recorded by
libmelee's authors from the running game; its disc revision is not stated.

Each record has:

- `character`, `category` and `action`: the identifiers of `records.jsonl`
  (`attacks` jab1, jab2, jab3, dattack, ftilt, utilt, dtilt, fsmash, usmash,
  dsmash, nair, fair, bair, uair, dair; `grabs` standing_grab, dash_grab;
  `dodges` forward_roll, back_roll, spot_dodge). Forward tilt and forward smash
  are the unangled versions.
- `source`: repository, revision, path, and libmelee's own character and
  action numbers (the game's fighter kind and action state).
- `frame_index_origin`: 1, as in libmelee; `recorded_frames`, the action's
  recorded length; `first_iasa_frame` and `first_facing_changed_frame`, the
  first frame libmelee marks interruptible or turned, or null.
- `hitbox_frames`: each frame with an active hitbox, and for each hitbox its
  `size` (radius) and `x`, `y` position relative to the fighter, in Melee
  units, with `x` positive ahead of the fighter.
- `locomotion_x`: for attacks and dodges, the fighter's horizontal movement on
  every frame, positive forward; null for grabs. The forward travel up to frame
  *n* is the sum of the first *n* entries; adding a hitbox's `x` and `size` on
  that frame gives its reach from where the move started.

Coverage is libmelee's. Of jab, the three tilts, the three smashes and dash
attack, 201 of the 208 for 26 fighters are recorded; libmelee has none for the
dash attacks of Bowser, Donkey Kong, Jigglypuff, Luigi, Mario, Roy and Yoshi,
which "Dash-attack travel from public replays" below measures. Kirby's dash
attack (63 frames hitting 9 to 43), Mr. Game & Watch's jab, down tilt and forward smash, Ness's three
smashes and Peach's forward smash are those fighters' own action states, which
libmelee records but does not name; each is identified by its recorded length
and hit frames matching `records.jsonl` (Kirby's state 351 for his dash attack; Ness's forward smash 49 frames hitting
16 to 17, up smash 49 hitting 12 to 31, down smash 61 hitting 12 to 31; Mr.
Game & Watch's jab 17 hitting 4 to 6, down tilt 29 hitting 6 to 13, forward
smash 44 hitting 13 to 33). Peach's forward smash is in neither frame table;
libmelee records three states of 47 frames hitting 15 to 18, her golf club,
frying pan and tennis racket, which SmashWiki's move page
(https://www.ssbwiki.com/Peach_(SSBM)/Forward_smash) times the same, and the
first is kept. Up to four hitboxes per frame are recorded. Positions describe the
recorded animation, not the full collision geometry; hurtboxes are not
recorded. Representative checks: Fox's jab hitboxes are on frames 2 and 3, as
in `records.jsonl`, and his forward roll turns on frame 20 of 31. His forward
smash travels 1.34 units a frame on frames 9 to 14 and about 1 a frame to
frame 30.

Repeat the intake from the checkout's root (seconds):

```sh
curl --fail --location 'https://raw.githubusercontent.com/altf4/libmelee/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv' --output /tmp/libmelee-framedata.csv
bun references/melee-frame-data/libmelee-intake.ts /tmp/libmelee-framedata.csv references/melee-frame-data
```

The tool checks the input hash, refuses non-numeric values and frame gaps, and
checks the two representative records.

## Dash-attack travel from public replays

`smashcraft:references/melee-frame-data/replay-dash-attacks.jsonl` gives the
per-frame forward travel of the seven dash attacks libmelee never recorded:
Bowser, Donkey Kong, Jigglypuff, Luigi, Mario, Roy and Yoshi. It is measured
from tournament replays as black-box observation of the running game: each
player's position on every frame of the dash attack action state (50), from
its first frame.

Source: the Slippi Public Dataset v3 (about 95,000 tournament `.slp` replays
compiled by altf4 and shared on the Slippi Discord in October 2020, with
contributions from nikki and yashichi), through its Hugging Face mirror
https://huggingface.co/datasets/erickfm/slippi-public-dataset-v3.7 at revision
`c82be5f6e43f3388555cfe0cf8652580601f396d`, licensed CC0-1.0 on its card.
`replay-inputs.json` pins the 104 replays that contribute, by dataset path
and SHA-256. The replays are read by `replay-intake.ts`, written for this
corpus from Project Slippi's public replay specification
(https://github.com/project-slippi/slippi-wiki/blob/master/SPEC.md); no
parser library is used. Only positions, facing, action state and its frame
counter are read; nothing comes from the game's files.

A dash attack counts when it is entered from another state, stays grounded at
one height and facing, its frame counter rises by one every frame (no hitlag,
so it hit nothing), and it lasts at least to the frame before `records.jsonl`'s
IASA (total where IASA is absent). Each record has:

- `character`, `category` and `action` as in `libmelee.jsonl`; `source`:
  dataset, revision, specification and the replays the instances came from.
- `frame_index_origin`: 1; `recorded_frames`: the frames at least five
  instances cover, which ends at or near IASA since players act out of it.
- `instances`: the number of instances measured on each frame.
- `locomotion_x`: the median forward movement on each frame, Melee units,
  positive ahead of the fighter, as in `libmelee.jsonl`;
  `locomotion_x_min` and `locomotion_x_max`: its range over the instances.

Control: the tool measures Fox, Captain Falcon and Marth the same way and
refuses to write unless every frame's median is within 0.001 units of
libmelee's recorded travel. On 2026-10-25 the medians matched over 39, 39 and
45 frames (total 33.59, 38.45 and 27.27 units), so dash-attack travel is the
same from replay to replay and the median is the move's own travel. Totals
for the seven: Bowser 34.39 over 55 frames, Donkey Kong 14.75 over 54,
Jigglypuff 32.89 over 38, Luigi 37.12 over 59, Mario 32.94 over 41, Roy 26.45
over 39, Yoshi 45.56 over 43, from 9 to 15 instances each. The disc revision
is not stated by the dataset.

Repeat the intake from the checkout's root (downloads about 260 MB, then
seconds):

```sh
jq -r '.replays[].path' references/melee-frame-data/replay-inputs.json | while IFS= read -r p; do
  curl --fail --location --create-dirs --output "/tmp/slippi-public/$p" "https://huggingface.co/datasets/erickfm/slippi-public-dataset-v3.7/resolve/c82be5f6e43f3388555cfe0cf8652580601f396d/$(jq -rn --arg p "$p" '$p|@uri' | sed 's|%2F|/|g')"
done
bun references/melee-frame-data/replay-intake.ts /tmp/slippi-public references/melee-frame-data
```

The tool checks every replay's hash and the control before writing.

## FightCore knockback and getup data

`smashcraft:references/melee-frame-data/fightcore.csv` is FightCore's Melee frame
data for all 26 fighters, 1215 rows, one per `(Character, Section, Move)`. It
adds what the other two inputs lack: each move's launch angle, base knockback,
knockback growth and set knockback, and the getup, tech, ledge and dodge
options per fighter.

Source: the FightCore frame-data export `fightcore_melee_frame_data.xlsx`
(https://www.fightcore.gg), downloaded by Tom on 2026-10-26, SHA-256
`f75fed5ed62a4524465b96ce5d576102c01a9f81bbb6c235adf22fb70bb0e96d`. The file is
the workbook's "All Characters" sheet converted with `ssconvert`; the 26
per-character sheets hold the same rows. No reuse license was found with the
export; only factual numbers and move names are kept, and FightCore's GIFs and
animation credits are left out. The disc revision is not stated.

Columns, as FightCore names them:

| Column | Meaning / limit |
|---|---|
| Section | Air (133), Grounded (168), Tilt (115), Special (193), Grab/Throw (178), Dodge (104), Edge (38), Getups/Techs (286) |
| Frame Timeline | Frame numbers where the move changes phase (start, active edges, IASA, end) |
| First Active, Last Active, Total Frames, IASA | Frames, counting from 1; `-` where not applicable |
| Landing lag | `N (M L-Cancelled)` for aerials |
| Autocancel | `<A B>`: auto-cancels when landing before frame A or from frame B |
| Damage | Per hitbox or hit, `/`-separated, strongest first, e.g. `12 / 9%` |
| Angle | Launch angle in degrees; 361 is the Sakurai angle |
| Base Knockback, Knockback Growth, Set Knockback | Per hitbox, `/`-separated in the Damage order; `-` where absent |

`/`-separated values list a move's hitboxes or hits, not separate moves, and a
column may hold one value for all of them. Hitbox positions and sizes are not
in this file; `libmelee.jsonl` has them. Representative check: Fox's neutral air
is active 4-31 of 49, IASA 42, landing lag 15 (7 L-cancelled), autocancel
`<4 36>`, as in `records.jsonl`, with angle 361, base knockback `10 / 0` and
growth 100.

Repeat the intake from the checkout's root:

```sh
ssconvert -S fightcore_melee_frame_data.xlsx /tmp/fightcore.csv
cp /tmp/fightcore.csv.0 references/melee-frame-data/fightcore.csv
```

`smashcraft:references/melee-frame-data/fightcore.ts` reads the file into typed
rows: frames as numbers or null for `-`, landing lag split into normal and
L-cancelled, autocancel as its two frames, and Damage, Angle, Effect, Base
Knockback, Knockback Growth and Set Knockback as per-hitbox arrays, empty for
`-`. Angle 361 stays 361 (`SAKURAI_ANGLE`). It refuses a row with an unknown
section, a wrong cell count or a non-numeric value, and `fightCoreSource` names
the row and column a value came from. `character-attributes.ts` reads every
named movement and body field, with slash-separated fields preserved as arrays
and `attributeSource` naming the page, fighter and column. Both modules are
used by `ts/scripts/ledger/fixtures/fox.ts` and type-checked by `bun run check`.

`check-readers.ts` prints disagreements for every move with an explicit action mapping and
the `misc` rows. Its field rules are explicit: first/last active, total, IASA,
ordinary/L-cancelled landing lag, autocancel boundaries and strongest/weakest
damage compare with the corresponding columns; attributes `Weight`, `Terminal
Velocity`, `JumpSquat Frames`, `Dash Initial Velocity`, and `Dash & Run
Terminal Velocity` compare with `misc.weight`, `misc.gravity` (which matches
terminal velocity despite its source label), `misc.jump_squat`,
`misc.walk_speed` (the source label says walking speed; it matches dash initial
velocity), and `misc.run_speed`, respectively. The attribute gravity and
fast-fall velocity have no matching `misc` fields. A null in either source
means the field is not compared. Slash-separated attributes are preserved;
they agree with a scalar reference only when exactly one value is present and
equal.

For parity intake, `records.jsonl` remains authoritative for its reported
timing, landing lag, autocancel and damage fields; FightCore is authoritative
for per-hitbox angle, base knockback, growth, set knockback and getup/tech
rows. `character-attributes.csv` is authoritative for per-fighter attributes.
The comparison reports differences without changing either source or choosing
a value on behalf of later tooling. Run it with:

```sh
bun references/melee-frame-data/check-readers.ts
```

### Per-phase hitboxes and knockdown thresholds (all 26 fighters)

The export collapses each move's hitboxes into one row. FightCore's move pages
give them per phase, and per target fighter the percent where each hitbox
reaches a knockdown threshold. `fightcore-intake.ts` reads the public pages
of https://www.fightcore.gg for all 26 fighters: every move page with hits
(`/characters/<id>/<fighter>/moves/<move id>/<move>/`) and the 26 fighter
pages for target weights, Fox's and Falco's first fetched on 2026-10-26 and
all refetched on 2026-10-25 (Fox's and Falco's values unchanged; Next.js build
`mCnHWCVj-AuXOKBpo5Uk9`), at most one request a second. Each record carries
its page URL, fetch date and build. Only numbers and move names are kept; the
pages' GIFs and animation credits are left out. FightCore's site code
(https://github.com/FightCore/fightcore-next) carries no license; its data
repository (https://github.com/FightCore/frame-data, GPL-3.0) says its JSON
and CSV files are free to be used by others.

- `fightcore-phases.jsonl`: one record per `(character, move, phase)` for
  every move FightCore lists with hits; moves without hits
  (dodges, rolls, techs, jump) have none. `start`/`end` are the phase's active
  frames, counting from 1; `0`/`0` where FightCore gives no range. `hitboxes` lists the phase's hitboxes (`id0`...)
  with damage, angle (361 the Sakurai angle), base and set knockback, growth,
  effect, weight independence, attacker and defender hitlag, each again when
  the defender crouches, and shieldstun.
- `fightcore-thresholds.jsonl`: for each phase of the moves FightCore gives a
  crouch-cancel table (not grabs, pummels or throws), one record per hitbox
  group (hitboxes of the phase with equal damage, angle, base, growth and set
  knockback). `targets` maps each of the 26 target fighters to its `weight`
  and `percent` (schema version 2; version 1 repeated the group once per
  target, 31 MB for all 26 attackers). `percent` maps the knockback threshold to the
  target's lowest pre-hit percent that reaches it, one value per `staleness`:
  80 (tumble, ASDI down fails), 120 (tumble through crouch cancel), and for
  Sakurai-angle hitboxes 32 and 48 (the knockback where the angle stops
  sending at 0 degrees for ASDI down and crouch cancel). `"never"` is
  FightCore's "Never breaks"; set knockback is either 0 or never.

How they relate to the export: the export's `Damage`, `Angle`,
`Base Knockback`, `Knockback Growth` and `Set Knockback` columns list the
distinct values over all of a move's phases and hitboxes, `-` standing for 0,
so each column's value set equals the set over the move's phase records, and
`First Active`/`Last Active` span the phases' ranges. The intake prints every
move where they differ. For Fox and Falco every value set agrees; 24 frame
ranges differ, all where one side gives none. The pages give no range
(`0`/`0`) for the up, back and down throws, the specials (Blaster, Fox
Illusion, Falco Phantasm, Fire Fox, Fire Bird, Falco's Reflector, ground and
air) where the export has active frames, and the export gives none for the
pummel (pages 4-4) and the rapid jabs (pages 2-3) of both fighters. Over all
26 fighters on 2026-10-25, 50 paged moves have no export row of the same name
(mostly Kirby's 25 copied specials, and names such as Giant Punch, Skull Bash
and Shield Breaker), value sets differ in 21 moves of 15 fighters, and 199
frame ranges differ: 147 where the pages give none, 31 where the export gives
none and 21 where both give one.

Thresholds: a page renders only its first phase's first hitbox, with fresh
staleness and percents rounded up, which is what FightCore labels its
"Ceiling percentages" default. The other phases, hitboxes and staleness
levels are what the page shows when its tabs and staleness queue are clicked:
FightCore's stated rule, percent `= (100 + weight) / 14 × ((100 / growth) ×
(threshold − base) − 18) / (damage + 2) − damage × (1 − staleness)`, rounded
up, and for set knockback the weight-dependent set-knockback formula. The
intake applies that rule to every hitbox and refuses to write unless it
reproduces every rendered card exactly (2010 cards over the 26 fighters). `staleness` lists the reductions when
the move fills FightCore's nine-slot queue from slot 1 (0.09, then 0.08, …,
0.01), from fresh to nine uses: 0, 0.09, 0.17, 0.24, 0.30, 0.35, 0.39, 0.42,
0.44, 0.45. FightCore's rule subtracts the staled damage from the percent but
keeps the fresh damage in the knockback term.

`fightcore-thresholds.ts` reads both files. `bun wisp oracle` checks every
threshold percent against our knockback formula (`ts/scripts/meleeThresholds.ts`):
fresh percents through the shipped `ts/src/game/sim/knockback.ts`, stale ones
through a Melee-only staling path, since Smashcraft has no staling. Two
kinds of FightCore percent are named ledger rows instead of disagreements:
percents above Melee's 999% damage limit (`knockback-threshold-percent-limit`)
and the "never" its rule gives a zero-growth hitbox whose base knockback
already reaches the threshold (`knockback-zero-growth`, Samus's up special).

Repeat the intake from the checkout's root (about 25 minutes the first time at one
request a second, seconds from the page cache in the first directory):

```sh
bun references/melee-frame-data/fightcore-intake.ts /tmp/fightcore-pages references/melee-frame-data
```

### Which file wins

`bun references/melee-frame-data/fightcore-check.ts` pairs FightCore's rows with
`records.jsonl` and compares every field both hold. Specials are paired by
their input slot under the SmashWiki name, and the script keeps that mapping.
Each disagreement is printed beside a third source where the corpus has one:
libmelee's recorded hitbox frames, length and IASA, or the attributes file's
per-aerial landing lag. On 2026-10-26 it paired 740 moves and compared 3594
values, of which 307 disagree. The rule per field, from that run:

- First active frame, total frames and IASA: libmelee decides where it holds
  the move, and elsewhere `records.jsonl` wins. libmelee sided with it on 10 of 10
  attack starts, 11 of 11 attack totals, 42 of 45 grab starts, 42 of 44 grab
  totals (FightCore counts grabs one frame later) and 3 of 5 IASA frames.
- Last active frame: libmelee decides where it holds the move, and elsewhere
  FightCore wins, as libmelee sided with it on 22 of 34.
- Landing lag and L-cancelled lag: the attributes file's per-aerial landing lag
  decides. It sided with FightCore on both rows (Bowser's neutral and forward
  air, 30 where `records.jsonl` has 15), and the L-cancelled lag follows the same
  file.
- Damage, angle, base knockback, growth, set knockback and effect: FightCore wins
  as the only file listing every hitbox. `records.jsonl` percent and percent_weak
  are rounded strongest and weakest values and stand only where FightCore has none.
- Throw damage (40 of 104 throws differ, with neither file always the larger),
  autocancel (6 rows) and dodge intangibility (4 rows): unresolved, so neither
  file wins. A check that uses one of these rows takes the value from SmashWiki
  and cites it.
- Shieldstun: `records.jsonl` for every fighter. For Fox and Falco,
  `fightcore-phases.jsonl` also gives it for each phase.
- Fighter attributes: `character-attributes.csv` wins. It agrees with the `misc`
  rows on weight, terminal velocity, jump squat and run speed for all 26
  fighters, and on dash speed for all but Luigi (1.34 against 1.3).
  `records.jsonl` holds no fast-fall speed.

## Character attributes

`smashcraft:references/melee-frame-data/character-attributes.csv` lists each of
the 26 fighters' movement and body attributes, one row per fighter and 97
named columns: walk, dash and run speeds and accelerations, ground friction,
jump squat, jump and short-hop initial velocities, air jump multipliers,
number of jumps, gravity, terminal and fast-fall velocity, air mobility, air
speed and air friction, weight, model scale, shield size, normal and per-aerial
landing lag, ledge-jump and wall-jump velocities, and similar. Column names are
the spreadsheet's own, including its question marks on uncertain fields and its
blank headers.

Source: the SuperCombo Wiki table "SSBM/Character Attributes"
(https://wiki.supercombo.gg/w/SSBM/Character_Attributes), exported as
`ssbm_character_attributes.csv` and downloaded by Tom on 2026-10-26, SHA-256
`c0338e7abadeea674381442b74549a420cd3ab13ce2c155121c9f8927b0e80f1`. Two kinds of
row are dropped: the row of data-file offsets under the header, and the six
non-playable entries whose names start with `zz`. Only factual numbers are
kept, credited to that page; the wiki's prose is not copied. The disc revision
is not stated.

Units are Melee units and frames. Representative check: Fox's jump squat is 3,
as in `records.jsonl`, and his terminal velocity 2.8 is the value that file
mislabels `gravity`; his gravity is 0.23 and fast-fall velocity 3.4.

`smashcraft:references/melee-frame-data/character-attributes.ts` reads one row
per fighter with the movement and body columns typed (weight, run velocity and
air speed as `/`-separated lists, since some fighters carry two values; hex
cells such as `0x02` as numbers) and every other named column kept as text.
`attributeSource` names the page, fighter and column a value came from.

## SmashWiki attack intangibility

`smashcraft:references/melee-frame-data/smashwiki-intangibility.csv` lists the
Melee jabs, tilts, smashes and dash attacks that make part of the fighter
intangible, one row per move: `character` and `action` in this corpus's
identifiers, `body_part` (blank where the page gives none) and the
`first_frame` and `last_frame` of the intangibility, counting from 1. Moves not
listed have none on the page.

Source: SmashWiki's "Intangibility" article
(https://www.ssbwiki.com/Intangibility), revision 1997771 of 2025-08-23, read as
wikitext on 2026-10-25 (SHA-256
`8fcbc2bf53623d64041639a4f7636f6cc447cb40a8d897c4e96c5bb4ca44d6ca`). Only the
Melee frame numbers and body parts of its moveset table are kept; the page's
prose is not copied. Hurtbox shifts that are not intangibility, such as a lean,
are not recorded. Representative check: Fox's up smash makes his head
intangible on frames 1 to 9 and his down smash his legs on frame 6.
