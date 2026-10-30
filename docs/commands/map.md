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
  `bun wisp map boot [MAP.w3x]` starts a playable build's own script (or, without a
  map, the playable build compiled from the checkout) on two headless clients (one Lua process per player slot, side by side) in
  32-bit Lua, passes the first-run Controls screen, moves the pointer across
  character select, and fails on any thrown error or a hidden select panel. It
  runs before every landing (the farm's boot job), on main's CI, and on each
  Tom build before it is installed (smashcraft:tools/tom-build/README.md), because
  a map that builds can still open to an empty screen: 0.3-dev.460 passed
  `Boolean` as a callback, which is nil in Lua, and every select update threw.
  Its check driver compiles through the map build's compile cache and is reused while
  the checkout's tree is unchanged; `bun wisp map boot --driver` compiles it alone, which
  the Tom build watcher runs beside the map build so the compile is off the critical path.
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

- Shared builds: `bun wisp map build` keys its map by the hash of the checkout's
  tree and uncommitted changes (which hold `ts/wisp.lock` and the build-input
  pins) and every argument but `--out`, which carry the profile and edition.
  A second request with the same key, even one running at the same time in
  another lane, waits for the first and copies its map from
  `~/.cache/wisp/maps`, logging `reused map build HASH`; the size check still
  runs on the copy. `WISP_MAP_REUSE=off` builds fresh, and
  `WISP_MAP_REUSE_STORE` and `WISP_MAP_REUSE_GIB` move and cap the store
  (wisp:docs/compile-cache.md#map-reuse). A capture build of unchanged fixtures
  at the same commit, such as the control map of origin/main that a before
  capture uses, is that same reused map.
