# Play

- Playtest: `bun wisp play` builds current main (once per revision, however
  many plays start together) and goes from Tom's desktop to a match against a computer
  (smashcraft:docs/play.md). Experiments use `fresh`, captures or `accept` on
  pool clients and never install in Tom's Maps/00-Smashcraft; play installs
  the build as `Smashcraft 0.0.N SHORTSHA` and removes every other file there.
  The playable build plays on the keyboard alone, through Warcraft's own
  local keyboard sampling with two-frame delay and rollback (#60/#166);
  play starts no helper and never needs one.
  When the always-on controller service has a pad, the pad presses the same keys.

- Every landing: the Tom build watcher (smashcraft:tools/tom-build/) builds
  and installs the new tip of main within 10 s of landing as
  `Smashcraft 0.0.N SHORTSHA`, without waiting for main's CI run (Autoland
  already ran the suite on the lane) or the farm or gate checks below, writes its playtest notes and
  logs each install to `~/.local/state/agents/handoffs/tom-build.log`
  (smashcraft:docs/play.md).

- Continuous builds: `bun wisp play --install-green` fetches origin, takes the
  newest commit of main whose CI succeeded and whose farm suite passed for the
  commit or matching tree, or whose Autoland status explicitly names that landed
  commit, and, if it isn't installed yet, builds it once with the play build
  path and installs it as `Smashcraft 0.0.N SHORTSHA` under Maps/00-Smashcraft,
  removing the previous build and any lane build. CI/farm green only stages
  the candidate outside Maps; installation also requires every declared `gate-*`
  check to have verdict `pass` in Classic on its exact bytes.
  Native owners run `bun wisp accept --only gate-* --map CANDIDATE --out DIR`
  on the Classic pool's clients and retain the existing `report.json`, with top-level
  `candidateMapSha256` and `graphicsLook` (`classic`), under
  `~/.local/state/smashcraft/green-builds/accept/SHA256/LOOK/report.json`
  or one subfolder down, `LOOK/RUN/report.json`; the install reads them all
  and needs each check passed in exactly one. `--pair K` names the offline
  pool pair the install runs `bun wisp smoke --native` on: after building
  every candidate it would install, it smokes every move of that candidate one
  fighter pair per run, writes its shard reports there
  (smashcraft:docs/commands/accept.md) and a `smoke.json` in each shard's
  folder, which records whether the run crashed (stopped, not run, or ended without
  a judged match), its dead bindings and its moves that failed to start.
  Without `--pair` the install builds and reads the shard `smoke.json` files
  earlier `bun wisp smoke --native --pair K [--shard N]` runs on this machine
  wrote for the candidate's bytes, on one pair or several; a shard with none
  blocks the install like a smoke crash.
  A smoke crash, a dead binding or a move that fails to start, or a missing
  or mismatched shard `smoke.json`, always keeps the last installed build, and
  status.json reads `blocked` with them under `blocking`. With
  `SMASHCRAFT_GREEN_GATE=enforce`, missing checks, reports, looks, mismatched
  bytes, `needs-look` and every other failed check keep the last installed
  build too. Plato reads the candidate and failing check ids/reasons in
  `~/.local/state/smashcraft/green-builds/status.json`.
  A red, pending or missing CI/farm run is never built, and an older green
  commit never replaces a newer installed build. While Warcraft III runs in
  Tom's prefix, the install holds: it builds nothing, leaves the controller
  service and Maps/00-Smashcraft as they are, and status.json reads
  `held-running-client`; it checks again after building. It never signs in or
  reads account a's secrets. Each install writes playtest notes,
  `~/.local/state/agents/handoffs/playtest-VERSION.md`, listing only the
  unticked boxes whose leading label names Tom, such as `(Tom)`, on the open
  issues the commits since the previous installed build refer to; a failed issue
  fetch writes no notes rather than an empty list. The systemd user service
  (smashcraft:tools/green-builds/) has no timer; it runs only when queued on
  the laptop's ledger runner. It consumes native reports; it has no route to
  dispatch remote Classic.
  `bun wisp play --install-green --dry-run` reports the newest green commit and
  proposed install without building, installing or starting the controller helper.
  `SMASHCRAFT_GREEN_GATE=enforce` is the one switch back to the native gate that
  blocks on every failure; unset, only the smoke's crash, dead-binding and
  move-start failures block, and every other gate failure is a report (the
  install proceeds and status.json reads `installed-unverified` with the gate
  failures).

- Standalone play: `bun wisp play --standalone` opens the Wisp browser player
  with a full three-stock Illidan against Wren Expert Rifleman. `--script FILE`
  runs the native driver's exact pad inputs; `--headless --frames N --out DIR`
  saves frame checksums and captures (`--capture-frames N,N` picks their frames).
  `--presentation native|pool-confirmed|pool-predicted` selects fighter presentation;
  live play defaults to `pool-predicted`, scripts to `native`.
  `--four-fighters --frames 7200 --out DIR` is wisp#48's 60 FPS measurement
  (one game copy, four fighters; smashcraft:docs/play.md).
  `--window native` opens Wisp's Rust window instead of Chrome (`chrome` is the
  default) and draws the stage, sky and fighters; it steps Smashcraft's default
  session, so it refuses `--presentation`, `--four-fighters`, `--host` and
  `--join`; with `--map MAP.w3x --player-assets-only` its worker thread reads
  the map's imports and the Warcraft install as Chrome does; `--start select|results` opens it at character select or in a one-stock match that ends quickly, for the victory screen. A live window keeps Smashcraft's first-run files (whether the Tutorial prompt was answered) in `~/.local/state/smashcraft/native-files`, and a headless `--start select` run keeps the prompt off so captures stay the same; the window has no pointer, so at the prompt the attack key starts the tutorial, the special key or Esc is Not now, and left and right pick the lesson. The command finds the window
  library itself: `WISP_WINDOW_LIBRARY`, else the build of the vendored package's `window/` source in
  `~/.cache/wisp/window`, which the first run builds with cargo (in the package's nix dev shell on
  Linux, which links the Wayland, X11 and Vulkan libraries into the library, so no dev shell or
  `LD_LIBRARY_PATH` is needed) (wisp:docs/native-window-plan.md, "Where a consumer gets the library").
  Private map and Warcraft assets stay in the existing local asset store.
- Host and join: `bun wisp play --standalone --host [--port N]` prints a join
  code and its direct addresses; the other player runs
  `bun wisp play --standalone --join CODE` (or `ADDRESS:PORT`). Both meet at
  fighter selection; a different source tree fails at once with both map
  hashes (wisp:docs/play.md, Host and join). With `--script`, each player's pad
  script presses its own slot and its `#! chat` lines run at frame 30, a
  `-dev fighter N` line as player N.

- Two processes over Wisp's transport: `bun wisp net pair --script PAD --frames N
  [--rtt MS] [--loss P]` plays the playable keyboard build, one slot per process:
  each process presses only its own pad's keys (pad a is slot 0, b slot 1), and
  Wisp's UDP lockstep carries them to both clients (wisp:docs/network-model.md).
  It prints each side's checksum agreement every 60 frames and delivery times;
  `--rtt`/`--loss` add Wisp's delay and loss proxy, `--freeze-at F` and
  `--quit-at F` drill a silent or departing joiner. `net host` and `net join
  ADDRESS:PORT` run one side each (wisp#110).
- Up to four humans through a relay peer room: `bun wisp net pair --humans 4
  --relay local --script PAD --frames N` starts a relay on this machine (the
  binary `WISP_RELAY_BIN` names, else cargo builds wisp's relay/) and plays four
  processes, slot 0 hosting and the rest joining by its code; pads a to d press slots
  0 to 3 and a slot without a pad presses nothing. The last line says whether the
  checksums match on all four (wisp#99). `net host --relay REGION|ADDRESS:PORT
  --humans N` and `net join CODE` run one side each.
- Online acceptance: `bun wisp net-accept --out DIR` plays 20 full three-stock
  matches as `net pair` runs, 5 at a time, cycling 0, 60 and 120 ms round trip
  with 1% loss, each with seeded fighters, stage and pad scripts for both
  players (wisp#112). Per round trip it prints matches that reached the results
  screen on both sides, checksum mismatches, the map's rollback depth p95/p99/max
  against its window, the remote's lead and prediction stalls; it fails on a
  missed result, any mismatch or a p99 depth past the window. Each pad, log and
  results.json land in DIR. It also accounts every scripted press: lost or
  extra presses, rows off their assigned frame (input delay) or different on
  the remote, and ticks from press to the local view running it, failing past
  3. `--relay local` plays every match through a relay on this machine, the joiner
  behind the proxy (wisp's relay peer room, smashcraft#808). `--four-fighters` instead plays one two-player, two-computer match as
  `play --standalone --host` and `--join` windows on this machine and fails on
  a frame-time p95 over 16.7 ms in either window; run it under an exclusive
  capacity lease.
