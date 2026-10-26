# Melee parity plan

Tom found combos weak, especially at low percent (neutral air into grab), and
set the direction on 2026-10-26: first a clean, verified Melee-parity
baseline, tagged so any later deviation can be reverted to Melee's handling;
then combos at least as achievable as Melee, maybe slightly easier, with
explosive punishes that need a few correct reads and intense edge guarding.
The parity record is generated from the code so it cannot rot, and a combo
analyzer says what combos into what, so objectives such as "this move at 30%
combos into grab" can be dialled. The first fighter is Maiev, modelled on Fox
with some Falco, without becoming Fox in a costume.

The work is the umbrella issue "Melee parity baseline and combo program"
(#311), whose children are listed in order under [Order of work](#order-of-work).

Melee facts come only from public sources (README "Principles"): SmashWiki,
FightCore.gg, meleeframedata.com and libmelee through
`references/melee-frame-data/`, and the case study in `docs/design/melee/`.
Fox and Falco numbers live only in check-only scripts as numbers, never in the
map.

## What the survey found

- The shared knockback, hitlag, hitstun, tumble, DI and launch-decay rules are
  already Melee's, to float32 (`ts/src/game/sim/knockback.ts:40-252`,
  `ts/src/game/sim/motion.ts:206-257`). `bun wisp oracle`
  (`ts/scripts/meleeOracle.ts`) already checks about 120 behavioural
  scenarios against Melee, with Fox and Falco reference records as numbers
  (`ts/scripts/meleeOracle.ts:37-46`), and every departure names a deviation
  row of the ledger by id (#290).
- The combo search exists: `bun wisp combos` (`ts/scripts/comboExplorer.ts`)
  is a headless, deterministic beam search over inputs at percents 0-180, DI
  out/up/down/in/none, against Rifleman and Cairne; `ts/scripts/agencyBranch.ts`
  measures each link's escape across every victim option. What is missing is a
  per-move link table (frame advantage and reach to each follow-up, with a
  class) and a validation against a Melee fighter.
- Moves are authored per hitbox (`ts/src/game/sim/heroMoves.ts:22-40`) but a
  hit carries a fixed launch direction (`ts/src/game/sim/hitRegions.ts:30-31`),
  so there is no Sakurai angle; play has no set knockback (#272 adds the
  field); weak hits are a global ratio (`ts/src/game/sim/strongHits.ts:4-19`).
- Every hero except Illidan and Rifleman inherits the shared `reference`
  physics record (`ts/src/game/sim/tuning.ts:138`), whose gravity 0.23, fast
  fall 3.4 and jumps 3.68/2.1 are Fox's; heroes vary only weight, ground
  speeds, air speed and traction (`ts/src/game/sim/tuning.ts:243-260`,
  `ts/src/game/sim/heroes/heroBodies.ts:26-50`).
- The repo still holds values sourced from game internals: offset-named field
  reads in `ts/scripts/meleeCaseStudy.ts:582-601`, retail-file and
  decomp-name citations in code comments and docs. They are cleared first
  (#285, #286), because the ledger may cite only public sources.
- The unit tests that once pinned these values were removed on 2026-10-20
  at Tom's request, so parity is checked by scripts in `bun run check` and
  headless runs, not unit tests.

## Do the presets kill low-percent combos?

Not by themselves. Each fighter has its own LINK/POKE/LAUNCH/EDGE/KILL/SPIKE/
JUGGLE/CHASE table built with `makeHit` (`ts/src/game/sim/heroes/authoring.ts:45`),
for example Maiev's at `ts/src/game/sim/heroes/wardenMoves.ts:22-31` and
Cairne's at `ts/src/game/sim/heroes/cairneMoves.ts:8-15`. They replace Melee's
common "low base, growth 100" with base 12-26 and growth 50-136. Through our
Melee-exact formula, hitstun at 0% is the same as Fox's neutral air or higher:

| Hit (victim weight 60 / 143) | 0% | 30% | 60% |
|---|---|---|---|
| Maiev neutral air, POKE 4.58% at 50° | 14 / 14 | 20 / 18 | 26 / 22 |
| Maiev forward air, EDGE 7.63% | 20 / 19 | 32 / 27 | 44 / 35 |
| Maiev up throw, JUGGLE 3.82% | 23 / 23 | 26 / 25 | 30 / 27 |
| Fox neutral air clean, 12% Sakurai, base 10, growth 100 (FC; SmashWiki "Fox (SSBM)/Neutral aerial") | 17 / 15 | 31 / 24 | 46 / 34 |
| Fox neutral air late, 9%, base 0, growth 100 (same sources) | 10 / 9 | 22 / 17 | 33 / 24 |

Hitstun frames. Maiev's rows come from her presets through
`ts/src/game/sim/knockback.ts:54-98`; Fox's from the same formula on the
cited values.

Three differences do lower low-percent combos, and the analyzer measures each
one against Melee's handling before anything is retuned (#298):

1. No Sakurai angle. Melee's 361 launches a grounded victim flat under 32
   knockback, so a weak neutral air leaves them grounded and grabbable
   (SmashWiki "Sakurai Angle"). Maiev's neutral air launches at 50°
   (`ts/src/game/sim/heroes/wardenMoves.ts:124`), and any upward direction
   lifts a grounded victim (`ts/src/game/sim/knockback.ts:128`).
2. Small damage per hit. Her neutral air deals 4.58% against Fox's 12%, so the
   percent and the damage term grow slowly and mid-percent hitstun lags
   Melee's.
3. The air dodge is refreshed on hit and ends actionable (deviation row "Air
   dodge", #100), so a victim leaving hitstun dodges away with no helpless
   fall to punish.

Removing L-cancelling is not one of them: every aerial already lands with the
cancelled lag (`ts/src/game/sim/moves.ts:55-61`), which helps combos.

## Formula and constant families

Our code, the Melee value and its public source, and whether we match. The
ledger issues (#287, #288, #289) turn each line into a generated row; anchors
here are from main at 938bf89c8 and the tool resolves them afresh on every run.
Sources name the SmashWiki page unless marked: MFD is
`references/melee-frame-data/records.jsonl` (meleeframedata.com), FC is
`references/melee-frame-data/fightcore.csv` (FightCore.gg export for all 26 fighters, on main at 98282eb3b, read through #310), CA is `references/melee-frame-data/character-attributes.csv` (SuperCombo Wiki "SSBM/Character_Attributes", per-fighter attributes for all 26 fighters), CS is our case study in `docs/design/melee/`.

### Hits, knockback and hitstun

| Item | Our code | Ours | Melee and source | Status |
|---|---|---|---|---|
| Knockback formula | `ts/src/game/sim/knockback.ts:46-60` | ((0.1p + 0.05·p·d)·200/(w+100)·1.4 + 18)·g/100 + b, cap 2500 | Same (Knockback) | match |
| Inputs: post-hit percent, integer damage | `ts/src/game/sim/knockback.ts:35-38,78-81`; `ts/src/game/sim/contacts.ts:264` | p = truncated pre-hit percent + damage; d truncated, at least 1 | Same (Knockback) | match |
| Weight term | `ts/src/game/sim/knockback.ts:40-44` | 200/(w+100) | Same (Knockback; CS archetypes.md:13-19) | match |
| Set knockback | `ts/src/game/sim/knockback.ts:62-67` | Formula present, no move field; #272 adds `setKnockback` | Set knockback replaces percent with 10 and damage with the set value (Knockback) | missing in play until #272 |
| Launch angle | `ts/src/game/sim/hitRegions.ts:30-31`; `ts/src/game/sim/contacts.ts:404` | Fixed direction per hit, mirrored by facing | Angle per hitbox | match in kind |
| Sakurai angle | `ts/src/game/sim/knockback.ts` `sakuraiDegrees`; `sakurai` on a hit | Same, opt-in per hit; no move uses it yet | 361: grounded 0° under 32 knockback, 44° above 32.1; airborne 45° (Sakurai Angle) | match, #291 |
| Grounded low launch and bounce | `ts/src/game/sim/knockback.ts:122-134` | Below tumble with flat or downward direction stays grounded; tumble downward bounces ×0.8 | Ground hit below tumble stays grounded; spiked victims bounce (Knockback, Meteor smash) | match |
| Crouch cancel | `ts/src/game/sim/knockback.ts:72,89` | Knockback ×2/3, hitlag ×2/3; throws exempt | ×2/3 knockback (Crouch cancel; CS defense.md:99-101) | match |
| Smash-charge victim | `ts/src/game/sim/knockback.ts:73` | ×1.2 | Not confirmed on a public page | needs public source, #292 |
| Smash charge | `ts/src/game/sim/moves.ts:10-13,174` | 60 frames to 1.3671x for every fighter, then held up to 120 more frames with no further gain | 60 frames to 1.3671x, then releases by itself (Smash attack) | charge parity; hold is a deviation, Tom 2026-10-26, #328 |
| Hitstun | `ts/src/game/sim/knockback.ts:19,96-98` | ⌊0.4·KB⌋, at least 1 | ⌊0.4·KB⌋ (Hitstun) | match |
| Tumble threshold | `ts/src/game/sim/knockback.ts:100-105` | KB ≥ 80 | 80 (Tumble) | match |
| Hitlag | `ts/src/game/sim/knockback.ts:85-90` | ⌊d/3 + 3⌋, electric ×1.5, crouch ×2/3, cap 20 | Same (Hitlag; CS defense.md:58-61) | match |
| Strong-hit extra hitlag | `ts/src/game/sim/knockback.ts:83`; `ts/src/game/sim/contacts.ts:163` | +3 both fighters | None; strength is per-hitbox values (Hitlag) | deviation, open (#292) |
| Who freezes | `ts/src/game/sim/contacts.ts:270,274,332`; `ts/src/game/sim/projectiles.ts:164` | Attacker and victim on direct hits and shield hits; not the shooter of a projectile | Same (Hitlag) | match |
| Launch speed | `ts/src/game/sim/knockback.ts:18,125` | KB × 0.03 Melee units a frame | 0.03 (Knockback) | match |
| Launch decay | `ts/src/game/sim/motion.ts:206,237-257` | 0.051 a frame along the launch | 0.051 (Knockback) | match |
| Gravity and fall in hitstun | `ts/src/game/sim/step.ts:627-635`; `ts/src/game/sim/motion.ts:140-144` | Fighter's own gravity and terminal speed; no fast fall in hitstun | Same (Hitstun, Fast fall) | match |
| Knockback stacking | `ts/src/game/sim/knockback.ts:20,140-146` | New launch replaces under 10 frames, merges per axis after | Not documented on SmashWiki | no data |
| Trajectory DI | `ts/src/game/sim/knockback.ts:197-252` | Up to 18°, by the perpendicular share of the stick | 18° max, perpendicular (Directional influence) | match |
| ASDI | `ts/src/game/sim/smashDirectionalInfluence.ts:18,153-163` | 3 units at hitlag end | 3 units (Automatic smash directional influence) | match |
| SDI | `ts/src/game/sim/smashDirectionalInfluence.ts:17-27,112-150` | 6 per fresh input, paid at most 3 a frame; 12 per hit, 24 per string | 6 units per input, no cap (Smash directional influence) | deviation, #70 |
| Staling | none | none | 9-move queue (Stale-move negation) | deviation, owner 2026-10-04 |
| Clank and priority | `ts/src/game/sim/attacks.ts:230-241` (grabs only) | Strikes trade | 9% rule for ground attacks; aerials don't clank (Priority) | deviation, `docs/gameplay-design.md:1407` |
| Hitbox order and rehit | `ts/src/game/sim/attacks.ts:50-71,111-121`; `ts/src/game/sim/contacts.ts:314-317` | Region order, strongest knockback wins when several connect | Lowest hitbox ID wins (Hitbox) | deviation, open (#292) |
| Strong and weak hits | `ts/src/game/sim/strongHits.ts:4-19` | Weak = 0.7 damage, 0.85 growth and base | Authored per hitbox, for example Fox neutral air 12/9%, base 10/0 (FC; Neutral aerial) | deviation, open (#292) |
| Percent cap | `ts/src/game/sim/contacts.ts:336` | none | 999% (Damage) | open (#292) |

### Defence, knockdown and shield

| Item | Our code | Ours | Melee and source | Status |
|---|---|---|---|---|
| Tech window and lockout | `ts/src/game/sim/geometry/techInput.ts:5-6,40-47` | 20, 40 | 20, 40 (Tech) | match |
| Tech in place and roll | `ts/src/game/sim/down.ts:30-31,45`; `ts/src/game/sim/conditions.ts:21-22` | 26 frames, intangible 1-20; roll 40, 1-34; one profile | Per fighter (Tech; FC Getups/Techs rows) | deviation, shared profile |
| Missed tech | `ts/src/game/sim/down.ts:32,169`; `ts/src/game/sim/step.ts:166-169` | DownBound 26 | Per fighter (Knockdown; FC Getups/Techs rows) | compare per fighter, #288 |
| Floor rebound on missed tech | `ts/src/game/sim/down.ts:82-101`; `ts/src/game/sim/surfaces.ts:16-18` | Rebounds ×0.8 | Fall stops (Meteor smash) | deviation, Tom 2026-10-15 |
| Down-wait timeout | `ts/src/game/sim/down.ts:33,185-192` | 220 then stand | Not on SmashWiki | no data |
| Jab reset | `ts/src/game/sim/down.ts:36,38`; `ts/src/game/sim/contacts.ts:386,398` | Damage ≤ 7 below tumble resets | Docs disagree, under 7 or 7 or less (Lock) | open, #286, #292 |
| Getup stand, roll, attack | `ts/src/game/sim/down.ts:34-43`; `ts/src/game/sim/moves.ts:13-19`; `ts/src/game/sim/conditions.ts:16-20` | 30; 35; 49 with startup 16; one profile | Per fighter (Getup; FC Getups/Techs rows) | deviation, shared profile |
| Wall and ceiling tech | `ts/src/game/sim/surfaces.ts:19-21,200-215`; `ts/src/game/sim/tuning.ts:355-362` | 5-frame hang, 14 intangible; ceiling impulse frame 14 | Same window as floor tech (Tech) | match |
| Shieldstun, ground | `ts/src/game/sim/shield.ts:34-37,68-87` | ⌊(0.45d + 2)·200/201⌋ | Same (Shield; CS aerials-on-shield.md) | match |
| Shieldstun, aerials | same | Damage term ×4/3 | As ground | deviation, #106 |
| Shield health, drain, regen, break | `ts/src/game/sim/fighter.ts:32`; `ts/src/game/sim/shield.ts:20,28-30,62-64` | 60, 0.28, 0.07, 30 after break | Same (Shield) | match |
| Shield pushback | `ts/src/game/sim/shield.ts:38-40,94-97` | min(2, (0.09d + 0.4)·0.6) | Same (Shield) | match |
| Shield release | `ts/src/game/sim/shield.ts:23-24`; `ts/src/game/sim/step.ts:274-285` | 11 frames | 15 (Shield) | deviation, #100 |
| Powershield | `ts/src/game/sim/shield.ts:15-19,141-149` | Parry | Reduced stun and reflect (Powershield) | deviation, #102 |
| Shield drop through platform | `ts/src/game/sim/platformMoves.ts:83-89` | none | Down drops through (Shield dropping) | deviation, #103 |
| Jump and grab out of shield | `ts/src/game/sim/jumpsAndDodges.ts:35-48`; `ts/src/game/sim/conditions.ts:111-145` | Yes | Yes (Out of shield) | match |
| Up special out of shield | `ts/src/game/sim/conditions.ts:103,125-127` | Only after takeoff | From jump squat (Out of shield) | open, #288 |
| Grab startup | `ts/src/game/sim/moves.ts:213,259,312` | 5, active 3, total 36, shared | Per fighter, Fox standing grab from MFD and FC | deviation, shared profile |
| Grab hold and mash | `ts/src/game/sim/moves.ts:326-336`; `ts/src/game/sim/mash.ts:7,35-39` | 90 + 1.75 per percent, 8 per input, at least 60 | 76 + 1.6 per percent (Grab) | deviation, #101 and #550 |
| Pummel | `ts/src/game/sim/moves.ts:338-342`; `ts/src/game/sim/grabs.ts:163-194` | Repeatable in code, one in `docs/gameplay-design.md:789` | Repeatable (Pummel) | open, #288 |
| Throws | `ts/src/game/sim/grabs.ts:70-105` | Knockback hits; regrab off throw hitstun refused (#85) | Knockback hits; throw speed weight-dependent (Throw) | deviation, #85 |

### Movement, landing, ledges, platforms and the stick

| Item | Our code | Ours | Melee and source | Status |
|---|---|---|---|---|
| Normal landing | `ts/src/game/sim/down.ts:26,113-115` | 4 | 4 for most of the cast (Landing lag) | match |
| L-cancel | `ts/src/game/sim/moves.ts:55-61,124-128` | Always the cancelled lag | Press within 7 frames halves it (L-cancel) | deviation, #54 |
| Aerial auto-cancel | none | Not modelled | Per aerial, for example Fox neutral air before frame 4 and from 36 (FC) | missing, #292 |
| Edge cancel | `ts/src/game/sim/step.ts:313-329,659-662` | Landing lag cancels off an edge; shield slide-off falls helpless | Landing lag cancels off an edge (Edge cancel); our shield slide-off rule is ours | deviation for the shield case, #275 |
| Ledge catch box | `ts/src/game/sim/ledge.ts:52-58,82-90,155-169` | Fox and Falco boxes | Same (Edge) | match |
| Ledge intangibility | `ts/src/game/sim/ledge.ts:21-26,213-214` | 30, 8 fewer each regrab | 30 every grab (Edge; FC Edge rows per fighter) | deviation, #386 |
| Ledge regrab lock | `ts/src/game/sim/transitions.ts:20,74-77` | 30 | 30 (Edge) | match |
| Ledge hang limit | `ts/src/game/sim/ledge.ts:23,273` | 300 then drop | none | deviation, #411 |
| Ledgedash intangibility | `ts/src/game/sim/transitions.ts:66-71` | Lost on letting go | Kept (Ledge-dash) | deviation, `docs/gameplay-design.md:2100` |
| Platform drop and ascent | `ts/src/game/sim/platformMoves.ts:18-24,82-97` | Instant mount and drop | Drop on fresh down; ascent passes through (Platform) | deviation, #103 and #392 |
| Platforms in hitstun | `ts/src/game/sim/platformMoves.ts:98-101` | Lands | Lands (Platform) | match |
| Air dodge | `ts/src/game/sim/jumpsAndDodges.ts:69,87`; `ts/src/game/sim/transitions.ts:214` | Once per airtime, actionable, refreshed on hit | Ends in helpless fall (Air dodge) | deviation, #100 and #347 |
| Stick deadzone | `ts/src/game/sim/stickZones.ts:4` | 0.28 | 0.2875 is the commonly quoted value (Control stick) | open, #292 |
| Stick zones | `ts/src/game/sim/stickZones.ts:5-15` | Dash 0.8, crouch 0.6875, tap jump 0.6625 | Same (Control stick; CS movement.md) | match |
| Tilt versus smash | `ts/src/game/input/combat.ts:33-44`; `ts/src/game/input/adapter.ts:73,133-137` | Strong button or C-stick | Stick speed (Smash attack) | open, #292 |
| Tilt modifier | `ts/src/game/input/adapter.ts:87-91`; `ts/src/game/sim/stick.ts:11-15` | Just inside Melee's thresholds | none, a box-controller convention | addition, #282 |
| Tap jump | adapter | Off, jump is a button | On (Tap jump) | deviation, #49 |

### Fighter attributes

| Attribute | Our code | Ours | Melee and source | Status |
|---|---|---|---|---|
| Shared record | `ts/src/game/sim/tuning.ts:138` | gravity 0.23, terminal 2.8, fast fall 3.4, jump squat 3, jumps 3.68/2.1, double ×1.2, air acceleration 0.08, air friction 0.02 | Fox's values (CA; `ts/scripts/meleeOracle.ts:37`) | match to Fox, a design choice to review per fighter |
| Rifleman | `ts/src/game/sim/tuning.ts:162` | gravity 0.17, fast fall 3.5, jump squat 5 | Falco's (CA; `ts/scripts/meleeOracle.ts:42`) | match to Falco |
| Illidan | `ts/src/game/sim/tuning.ts:186` | gravity 0.19, fast fall 3.45, jump squat 4, weight 86 | Inside the Melee spread | ours, inside spread |
| Heroes | `ts/src/game/sim/tuning.ts:225,236-260`; `ts/src/game/sim/heroes/heroBodies.ts:26-50` | weight 75 × body, walk/dash/run clamped to Melee's spread (`ts/src/game/sim/tuning.ts:236-239`), air speed 1.0 × body, traction | Melee spread per attribute across the 26 fighters (CA) | per fighter in #289 |
| Maiev | `ts/src/game/sim/heroes/heroBodies.ts:29` | weight 60, dash 2.0, run 2.3, walk 1.6, air speed 1.10, Fox's falls and jumps | Fox weight 75, Falco 80 (CA) | lighter than any spacie, retuned in #304 |

## Ledger

A Bun TypeScript tool, `bun wisp ledger` (the name `parity` already means Lua
parity tapes), under `ts/scripts/ledger/`.

- Rows are TypeScript modules by family: hits, defence, movement, attributes.
  A row is `id`, `family`, `name`, `melee` (value and public source URL),
  `ours` (a reader that imports the exported constant, or a headless probe
  through `ts/src/game/match/padScene.ts`), `anchor` (the exported symbol,
  resolved to `file:line` by the tool on every run), and `status`: `parity`,
  or `deviation` with `reason`, `issue` and `decided` (Tom's decision date),
  or `open` while Tom has not decided.
- It writes `docs/design/melee-parity.md`, never edited by hand, listed under
  `[[generated]]` in `structure.toml`.
- `bun wisp ledger --check` runs inside `bun run check`, which pre-push already
  runs. It fails when the page is stale; when our value differs from Melee's
  with no deviation row; when a deviation now equals Melee's (delete the row);
  when an anchor no longer resolves; or when a row has no public source.
- `--open` lists rows awaiting Tom; `--melee <row>` lets the analyzer run one
  row on Melee's value.
- Deviation reasons move out of the hand table in
  `docs/gameplay-design.md:828` into the rows; the oracle names a row id for
  each departure and its scenarios show on the page as behavioural checks
  (#290).

## Baseline tag

`melee-parity-baseline-1`, cut on origin/main (#302) only when all of these
hold on that commit:

- `bun wisp ledger --check` passes and `bun wisp ledger --open` is empty:
  every row is parity or a deviation with Tom's decision date.
- `bun wisp oracle` passes.
- `bun wisp combos --validate` passes the Fox cases (#297).
- The FightCore threshold oracle passes (#314): for every move and target
  fighter, our formula gives FightCore's percent for knockback 80 (tumble, ASDI
  down), 120 (tumble under crouch cancel), 32 and 48 (Sakurai-angle edges).
- Parity tapes are 0 divergent in both Lua32 modes.

A later deviation is reverted to Melee's handling by row: the row records
Melee's value and the anchor, and `--check` confirms the revert by refusing a
deviation that now equals Melee's. Later baselines take the next number. The
combo-ease value (#301) ships after the tag, so the tag is pure Melee plus
Tom-approved deviations.

## Combo analyzer

Built on the existing headless sim and search, not beside them.

- Link table, `bun wisp combos --links` (#294): for each opener hit (each
  region class: clean, late, sweet, sour) at 0-150% in steps of 10, victim
  weights 60, 75, 100 and 143, DI none/in/out/up/down and the victim options
  of `ts/scripts/agencyBranch.ts:34`, it records per follow-up the attacker's
  frame advantage, whether the follow-up reaches (lands within its active
  frames from the best input `ts/scripts/comboExplorer.ts` finds), and a class:
  true (every option is hit), DI-dependent (only some DI escapes), read
  (another option escapes), none. Output `tools/move-data/links/<fighter>.jsonl`
  and a page; byte-identical across runs.
- Fox fixture (#310, #295, #296): FightCore's export for all 26 fighters
  (`references/melee-frame-data/fightcore.csv`, per-hitbox angle, base, growth
  and set knockback, getups, techs and ledge options) and the SuperCombo
  attributes (`character-attributes.csv`) get typed readers, FightCore checked
  against meleeframedata (#310); a check-only module transcribes Fox's attributes and hitboxes as
  numbers; the sim loads it as a check-only fighter absent from the roster and
  the map.
- Threshold oracle (#313, #314, #315): FightCore's move pages give each hitbox
  phase with its frame range, attacker and defender hitlag and shieldstun, and
  per target fighter the percent where knockback reaches 80, 120, 32 and 48 at
  each staleness. Intaken for Fox and Falco first, then all 26, they are golden
  oracles that test weight, integer damage, crouch cancel and the 80 and 32
  rules end to end; stale rows run through a Melee-only staling path, since
  Smashcraft has no staling.
- Validation (#297): at least 8 cited Fox cases, including expected
  non-combos and DI-dependent links, must come out in the right class with
  deviations switched to Melee for the run.
- Attribution (#298): `--melee <row>` runs Maiev's and Rifleman's openers at
  0-60% with one deviation at a time on Melee's handling, counting restored
  links. This answers which deviation kills neutral air into grab with numbers,
  not guesses.
- Objectives (#299): rows in `tools/move-data/combo-objectives.json` (fighter,
  opener, region class, percent window, victim weight, follow-up, required
  class, and optionally the DIs that must not escape), decoded by
  `ts/scripts/comboObjectives.ts`. `bun wisp combos --objectives` reads the
  committed link table without simulating: each link-table percent inside the
  window needs a row whose class is at least the required one (true over
  DI-dependent over read) and whose DI escapes miss every listed DI. It names
  each missed row and percent and exits non-zero. JSON rather than TypeScript
  because scripts may not import from tools (`structure.toml`). Maiev's rows
  and identity guard are in [Maiev](maiev.md) (#303).
- Throw roles (#332): the same file's `throws` declares each fighter's four
  throws by role from [throw roles](throw-roles.md) (Rule B, #331), with the
  role's percents unless a throw gives its own. After the link rows,
  `--objectives` runs each role's test from that page's menu on the combo
  explorer against a Kobold at weight 75 under DI none, in, out, up and down
  (`ts/scripts/throwRoleObjectives.ts`), checks that each fighter covers at
  least three roles, and names every throw that misses. This part simulates,
  so it runs under heavy admission, one `--fighter` at a time for the roster.
  The first declarations are today's slots: up throws combo starters, down
  throws tech-chase starters, the KILL-class back throws kill throws, every
  other forward and back throw positional.

The agency rule (`docs/gameplay-design.md:578`, at most 2 true links in a row,
0-to-death in 2-3 reads) stays the guard against loops; the objectives set the
floor that combos must reach.

## Slightly easier than Melee

One knob, measured before chosen (#300, #301): hitstun frames per knockback
(`HITSTUN_FRAMES_PER_KNOCKBACK`, Melee 0.4, `ts/src/game/sim/knockback.ts:19`).
It lengthens every link in proportion to the hit's strength without changing
launch distance, kill percents, tumble at 80 knockback or edge-guard
trajectories, so edge guarding stays Melee's while punishes get easier. The
analyzer tables true and DI-dependent link share at 0.40, 0.42, 0.44 and 0.46
on the Fox fixture and Maiev, and Tom picks. Per-move tuning then sets each
fighter's identity; a global DI reduction is held back because it would weaken
the defender's reads that the agency rule depends on.

## Maiev

After the baseline (#303-#308). Her targets come from Fox's ground game
(neutral air and jab into grab at low percent, down air into her down special,
up throw into up air by DI) and Falco's verticality (higher jumps, faster fall,
up air strings that end in a read), written as objectives. The identity guard
keeps her Maiev: marks, poison, Blink, Shadow Pursuit stun and Fan of Knives;
no reflector-like shine loop, no laser. Order: targets (Tom approves), her own
physics record inside the Melee spread, aerials, ground game and throws, edge
guard, then a balance field.

Running work is absorbed, not restarted:

- Side special stun and pass-through (#273) lands as filed; its stun is a
  set-hitstun Smashcraft move with no Melee analogue, a Maiev deviation row,
  and its +14 frames is her first objective row.
- Down special swap (#272) lands as filed; its `setKnockback` field is the set
  knockback row of the ledger (#287), and the air Fan of Knives spike is one of
  her edge-guard tools (#307).
- Tilt-modifier values (#282) land as filed; they are the stick rows of #289.

## Move shapes

Tom asked (2026-10-26) for rules on move shape, drawn from Melee data, as
checks in the character-creation and balance tooling. A command, `bun wisp
shapes`, reads our kit values as `ts/scripts/balanceKit.ts` does, and its
`--check` runs in `bun run check`. Each rule lists its exceptions, each with a
reason.

- **Range triangle and smash budget** (#318, #319): jab wins up close; tilts
  beat jabs and some short-hop aerials on speed. Tom's move-budget rule
  (2026-10-26): every smash is more committal than its matching tilt (later
  start, more total frames) and pays that back on at least one option
  (corrected the same day: power splits into options of its own). The options
  are (a) reach equal to the tilt's or slightly more, (b) a meatier, longer
  hitbox, (d) a launcher from low percent, (e) an early kill, (f) damage, (g)
  a launch angle as a tool (spike, semi-spike or tech-chase angle), (h) coverage
  (both sides, overhead, platforms, ledge), (i) disjoint, (j) intangibility or a
  hurtbox shift on chosen frames (Captain Falcon's forward smash leans back under
  grabs), (k) shield pressure, (l) a sweetspot or tipper, and (m) out-of-shield
  or jump-cancel access. The combo analyzer supplies (d), (e), (g) and (k)
  (#326); frame, hitbox and hurtbox data supply the rest (#319). In `records.jsonl`, smash totals
  average 49 frames against 33 for tilts. Active spans average 6.9 against 5.0
  forward, 11.7 against 8.3 up and 12.0 against 4.1 down. Reach is unproven
  until forward travel is added: libmelee positions omit it, so forward smash
  out-reaches forward tilt for only 11 of 23. #318 adds travel, measures every
  option and records the rule in `docs/gameplay-design.md`. #319 and #326 fail a smash
  that is more committal but wins on no option, unless an exception records
  Tom's reason.
- **Hitbox radius bands** (#320): Melee's largest hitbox radius per move type,
  median across fighters in Melee units: jab and tilts 3.9, forward and down
  smash 4.7, up smash 5.1, aerials 4.3-5.5, dash attack 4.5. Ours, relative to
  body size, must sit in the band for the move type.
- **Dash attacks** (#321-#324): Melee's share one shape at different speeds.
  From `records.jsonl`: Fox and Falco active 4-17, total 39; Sheik 6-12, total
  37; Captain Falcon 7-16, total 39; Mario 6-25, total 48; Marth 12-15, total
  49. Shieldstun is 5-7, so they are punishable on shield, and the fighter keeps
  its run momentum through the move. Ours are inconsistent: Maiev 5-7, total 18;
  Mountain King 11-15, total 26. The rule is derived from all 26 fighters, then
  our 26 dash attacks are retuned to it in three batches. Each fighter whose
  animation no longer reads as a lunging dash attack gets its own re-authoring
  issue.
- **Later tuning note, not part of parity:** Tom thinks Melee's dash attacks are
  a little too strong at high percent. Revisit this after the baseline, as a
  deviation row with its own decision.

## Throws

Tom almost never links a throw into a punish and feels our throw hitstun is
shorter than Melee's (2026-10-26). This is the first and most tangible parity
item. #329 measures frame advantage after each of our throws at 0, 30, 60 and
90% on a Fox-weight target. It sets them against the throws of Fox, Falco,
Sheik, Marth and Captain Falcon, computed from `fightcore.csv` under Melee's
weight-dependent throw rules (`character-attributes.csv` flags). It names the
cause before any fix. #330 proposes a throw-role menu from prior art: combo
starter, set-knockback tech-chase starter, kill throw, positional throw,
regrab, percent-window confirm. It also offers two roster rules: today's fixed
slot per role (#107), or a per-fighter set covering at least three roles.
Tom picks in #331. #332 verifies each throw's role at its window with the
analyzer.

## Taste guide

A page generated from the reference data, `docs/design/melee/top-tiers.md`. It
shows Melee's top eight (Fox, Falco, Marth, Sheik, Jigglypuff, Captain Falcon,
Peach, Ice Climbers) against the rest, as distributions per move type and per
attribute (#333). It then says, with cited public rationale, which moves and
attributes put each one above (#334). Tom can browse it to build instinct for
frame-data ranges.

## Order of work

1. Clean room: #285, #286.
2. Ledger: #287, #288, #289, #290; the move-data checks repair #309.
3. Fixes and decisions: Sakurai angle #291, unknown rows #292, Tom's decisions #293.
4. Analyzer: link table #294, FightCore reader #310, per-phase and threshold intake #313 then #315, threshold oracle #314, Fox fixture #295, fixture fighter #296, validation #297, attribution #298, objectives #299.
5. Baseline tag #302; combo-ease measure #300 and Tom's pick #301.
6. Maiev: targets #303, movement #304, aerials #305, ground game and throws #306, edge guard #307, balance field #308.

7. Move shapes: travel and reach #318, shapes check #319, analyzer options #326, radius bands #320, dash-attack rule #321, dash-attack retunes #322, #323, #324.

8. Throws: parity measure #329, roles proposal #330, Tom's pick #331, analyzer roles #332.

9. Taste guide: distributions #333, rationale #334.

## Numbers we lack

`references/melee-frame-data/fightcore.csv` gives per-hitbox angle, base,
growth and set knockback for every move of all 26 fighters, plus their getups,
techs and ledge options; libmelee gives hitbox positions; `character-attributes.csv` gives every
fighter's gravity, terminal and fast-fall speed, jump squat, jump and short-hop
velocities, air speed, mobility and friction, ground friction, dash and walk,
weight, shield size, per-aerial landing lag, and ledge and wall jumps. Still
missing:

- Hitlag multipliers by element and effect: FightCore's move pages give the
  attacker's and defender's hitlag per phase (#313), from which the
  multipliers can be checked; SmashWiki "Hitlag" states them.
- Hitbox priorities within a move (FightCore gives phases, not IDs): SmashWiki's "<fighter>
  (SSBM)/<move>" Hitbox Data tables (seen on "Fox (SSBM)/Neutral aerial") and
  "Priority".
- Universal engine constants with a public source: knockback stacking under 10
  frames, the down-wait timeout, the smash-charge knockback multiplier and the
  stick deadzone (SmashWiki "Knockback", "Knockdown", "Control stick", or
  Smashboards write-ups). Without one they stay `no data` rows.
- Cited Fox combo and non-combo percents for the analyzer's validation:
  SmashWiki move pages mention some; community percent charts are needed for
  the rest.
