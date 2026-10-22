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
