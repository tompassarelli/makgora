# View

- Player view: `bun wisp view scene DATA_DIR...` and `bun wisp view frame
  FRAME.ppm...` report what a player would see wrong; `view models --prune` removes facts for deleted models without remeasurement; `view models` rewrites
  the model facts they read; `view models ... --only MODEL,...` refreshes only the named rows (smashcraft:docs/player-view.md); `view strikes --assets DIR`
  rewrites the hero strike moments swings and specials align to
  (smashcraft:docs/fighter-animation-work.md, "Hero swing alignment");
  `view motion --assets DIR [--character ID]` measures every fighter's movement and recovery
  clips and rewrites their foot cadence and audit (smashcraft:docs/fighter-motion.md);
  `view reach --assets DIR [--character ID]` rewrites how far fighters' swings
  draw toward their strikes (smashcraft:docs/hurtboxes.md);
  `view reachcues --assets DIR` rewrites which normals show a reach flare: an
  active hit region more than 0.15 body heights (132 u) past the drawn Classic
  body and weapon swept over the active frames (#481);
  `view cues [--move FIGHTER:MOVE]... [--graphics classic|definitive]` renders
  every attack and special cue in Wisp and fails any move over the effect budget
  (smashcraft:docs/design/visual-quality.md, "Effect budget").
- Classic effect visibility: `cd ts && bun scripts/wisp/effectVisibility.ts --stock-cache DIRECTORY [--json] [--strict]`
  reads one exact private 3.0.0.24268 build cache, with imported assets from the frozen map inputs. It reports every fighter's model-data visibility as visible, invisible or Unknown; `--json` includes every use, source digest and input hashes. `--strict` refuses invisible rows while listing Unknown rows and their reasons. Model-data visibility is separate from physical native acceptance.
  Record the same evidence through `bun scripts/cueModels.ts --record --stock-cache DIRECTORY`; the existing cue-record landing check validates its per-use/source/provenance digests without private assets on hosted runners, refuses missing/invisible uses and lists every Unknown reason. Passing this report gate leaves calibration and Unknown resolution open. Historical frozen Shockwave remains incomplete even with a geoset; current playing Shockwave can pass. Confirmed emitter births hidden by predicted cue phase remain Unknown (#365/#496).
