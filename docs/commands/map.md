# Map

- Map commands: `bun wisp map release --name NAME --out OUT.w3x` builds the map
  for players or Tom: the exact command line Tom's dev builds run (playable
  profile, Classic edition), so a hand build never carries the debug build's
  settings (it adds only `--commit SHA` and `--predict-cost`).
  `bun wisp map build --profile NAME --name NAME --out OUT.w3x` is the build
  for diagnostics and every other profile; it refuses to run without
  `--profile`, and `--profile main` is the debug build.
  Both build the TypeScript map from the private inputs smashcraft:build-inputs/
  names (`map build`'s `--base`, `--container`, `--assets`, `--summon` override one);
  `bun wisp map rebuild MAP.w3x` replaces only its script.
  All three commands resolve every special, attack, contact-accent and projectile
  cue model through the renderer's real asset resolver.
  A missing path fails the build before replacing the map.
  `--profile playable --predict-cost` also writes predicted Lua cost and its
  raw samples beside the map (`.lua-cost.json` and `.lua-cost.perf`); see
  [workflow](workflow.md) for the calibration scope and fixture comparison.
  `--profile native-input` measures the playable keyboard path with developer
  setup and the response probe (Ctrl+G records, Ctrl+H exports); its rendered
  marker identifies the callback actually captured in pixels. Report that
  diagnostic overhead; journal integrity is a separate input path.
  `--profile playable-single-sends` is the playable map with each input row
  sent alone instead of in pairs, for a same-gateway paired/single comparison
  of the rates file's `send`, `lt`, `echo` and `rb` fields (#418).
  `--profile pause-probe` runs the integrity map's unchanged input path and
  starts its response probe at match setup. The first pause and resume emit
  `pause-boundary` rows; resume exports the positions presented in that callback
  automatically, for `ts/test/native/pads/206/pause-dash.pad`.
  Headless `pad` writes `pause-draws.jsonl` with the last paused picture and
  first resumed picture, fighter/effect positions and animation clocks,
  observing once after each real draw's callbacks (#86).

- Map size: players download the map in the lobby, so prefer Warcraft's own
  assets (reshape, recolour, rescale or recombine stock models, doodads,
  effects and animations) before importing a file. A custom asset is fine
  where stock can't do the job well; each new import's commit names its size
  and why stock couldn't do it. `bun wisp map build` prints the map's size and
  imported bytes; the default build fails when the map is more than 10% over
  smashcraft:ts/map-size-baseline.tsv, naming the largest new imports. After a
  justified import or a cut, rebuild with `MAP_SIZE_UPDATE=1` and commit the
  baseline (smashcraft:docs/design/map-size.md).


- Frame workload: `bun wisp map build --profile frame-cost ...` runs the
  isolated 4096-frame TypeScript executor and records its complete replay state.
  smashcraft:ts/scripts/frameCost.ts reads recorded paired benchmark results.
