# Combos

- Combo potential: `bun wisp combos [--fighter NAME]... [--jobs N]` searches
  true combos and tech-chase reads, replays its best routes, and writes the
  per-fighter openings-per-kill table (docs/design/balance.md, "Combo potential").

- Advantage state: `bun wisp combos --advantage [--fighter NAME]... [--jobs N]`
  measures every fighter's throws at 0/20/40/60% against a light, medium and
  heavy target with and without DI, its forced knockdown and tech-chase
  coverage, tech trap and juggle, and writes
  smashcraft:tools/move-data/advantage-state.md against the targets in
  smashcraft:docs/gameplay-design.md, "Advantage state" (#388). Autoland
  regenerates the whole roster for every landing (docs/ci.md#autoland); run
  only `--fighter NAME` locally to inspect a change.

- Zero-to-death: `bun wisp combos --zero-to-death [--fighter NAME]... [--jobs N]`
  runs every opener from 0% against the light, medium and heavy targets at the
  centre and the ledge against the escape-optimal DI, lists each route that
  takes the stock without a read, tech chase or edge-guard between hits, with
  its frame-by-frame inputs, and fails when it finds one
  (smashcraft:docs/gameplay-design.md, "Advantage state", #44).

- Links: `bun wisp combos --links [--fighter NAME]... [--jobs N]` says what
  each opener hit (each region class: clean, late, sweet, sour) combos into at
  0-150% against victim weights 60, 75, 100 and 143 under every DI: per
  follow-up the frame advantage, whether the explorer's best input lands it,
  and its class against the victim options of the agency measure (true,
  DI-dependent, read, none). It writes
  smashcraft:tools/move-data/links/<fighter>.jsonl and .md
  (smashcraft:docs/design/melee-parity-plan.md, "Combo analyzer", #294).
  `--fighter fixture:fox` runs Melee's Fox, a check-only fighter built from
  references/melee-frame-data (smashcraft:ts/scripts/ledger/fixtures/fighters.ts,
  #296); `bun ts/scripts/ledger/fixtures/fighters.ts` lists what the corpus
  does not give it. It is absent from the roster and the map.
  `--melee ROW`, repeatable, measures 0-60% twice, as shipped and with the
  ledger row `ROW` on Melee's handling for that run only, and prints the true
  and DI-dependent links gained and lost at 0-20% and 30-60%; the switched rows
  go to build/links-melee/ROW/<fighter>.jsonl. It refuses a row with no Melee
  value, a parity row and a row with no switch in
  smashcraft:ts/scripts/ledger/meleeSwitches.ts (#298).

- Objectives: `bun wisp combos --objectives [--fighter NAME]` checks each
  declared target in smashcraft:tools/move-data/combo-objectives.json. Its
  `links` (an opener hit at a percent window into a follow-up, against a
  victim weight, at least a class and optionally with DIs that must not
  escape) are checked against the committed link table; its `throws` declare
  each fighter's four throw roles, and each named fighter's throws are
  simulated against their role's test. It names every row, percent and throw
  that misses and fails (smashcraft:docs/design/melee-parity-plan.md, "Combo
  analyzer", #299 and #332).

- Validation: `bun wisp combos --validate [--jobs N]` runs the cited Fox cases
  in smashcraft:ts/scripts/comboValidation.ts on the Fox fixture fighter
  against itself at Fox's weight, each through the link table's measure with
  every ledger row that has a switch on Melee's handling, and fails when one
  comes out of its Melee class (true, DI-dependent, or no combo meaning read
  or none), unless the case cites the open ledger row that explains the miss
  (smashcraft:docs/design/melee-parity-plan.md, "Combo analyzer", #297).
