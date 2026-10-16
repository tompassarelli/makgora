# Native

Native startup verifies private-window focus, observed pointer motion and a
harmless F24 key in the map-written `smashcraft-input-preflight.txt`. The probe
has a twelve-second deadline and names the failed display, focus, pointer or
key-trace boundary. Pad batches probe after their initial hot reload and before
starting helpers. The key receipt is local diagnostic output and changes no
gameplay state. `scripts/wisp/nativeInput.ts` exports `verifyNativeInput` for
native runners using the selected `Clients` and `GameFiles` services.

`bun wisp native-capture reel --out PRIVATE_DIR [--fighter SLUG] [--hold-ticks N]`
prepares Classic motion-reel pad scripts from the current roster and authored
normals, four ground specials and ultimate. Each fighter directory is one
capture-map batch. `native-capture plan PAD...` exercises its requested held
frames headless; this has no native pixel verdict. Build with
`bun wisp native-capture build --out MAP.w3x PRIVATE_DIR/FIGHTER` and launch
that map on the assigned Classic offline pair with `bun wisp lan fresh MAP.w3x
--pair K`. Start the capture collector before launching, so it sees the first
held sample:

```sh
bun wisp native-capture run --clients-file FILE --client NAME --install DIR \
  --offline-build 3.0.0.24268 --manifest MAP.captures.json --out SHEETS \
  --sheets --crop X,Y,W,H --effect-crop X,Y,W,H --minutes 10
```

Both crop rectangles are in full captured-screen pixels: calibrate the body
crop to omit HUD and visible names, and the effect crop to omit the fighter's
body. Eight motion tiles and two effect-only tiles share each opaque row.
Adjacent rows pair right then left. The collector retains only the packed RGB
canvas, writes no raw capture frames, and produces `FIGHTER.jpg` (at most
128 KiB), `FIGHTER.rows.json` and `FIGHTER.captures.json` timing/missed-frame evidence.
The row key is exactly `{"R01":{"slot":"side_b","facing":"right"},...}`;
never show the key to the cold viewer. Default reel holds are 6 ticks rather
than ordinary captures' 180, with one opening tick and no tail; increase `--hold-ticks` if measured collection
misses frames. A 0.0.133 reel is a diagnostic rebuild with driver/capture
changes, not the byte-identical retained native baseline map. Native full-roster
wall time, pixel legibility, calibrated crops and one-pair versus two-pair
throughput still require measurement on the assigned VM clients.

Development builds expose the retained 3.0.0 lever diagnostic: `-dev lever fog on|off`,
`-dev lever density NUMBER`, `-dev lever oversky on|off`, `-dev lever shadows COUNT`
and `-dev lever light INDEX on|off`. Compare `-dev lighting stock|stage` and
`-dev backdrop on|off` in the same paused scene. Use `-dev view near|far` with
`-dev lever camz -100000|100000` to reach the camera's lowest or highest allowed
height; `-dev lever camz off` restores the normal extreme height and
`-dev view off` restores the match camera. The override still passes through
the existing camera limits. `-dev hide fighter SLOT` (SLOT 0 to 3) stops
drawing that fighter's body unit or effect body, its shadow, its disjoint
weapon models, white flash, agency halo, shield and dizzy stars without
touching the sim, stage, other fighters or HUD; `-dev show fighter SLOT` puts
back exactly what was drawn (receipt `dev: fighter SLOT hidden|shown`).

- One-client Definitive look captures (signed-in clone b, c or d):
  `bun scripts/nativeCapture.ts build --out MAP.w3x --control PAD|DIR...` bakes
  the scripts and their `capture` frames into a native-capture map that plays
  both pads itself and holds each capture frame with the fighters' animations
  and effects frozen; host it with `bun wisp fresh MAP.w3x --no-quick
  --clients-file FILE` while `bun scripts/nativeCapture.ts run --clients-file FILE
  --client NAME --install DIR --manifest MAP.captures.json --out DIR` captures
  the screen. `run` first reads DIR/.build.info and the live build from
  `w3/versions`, records both in captures.json and refuses when they differ;
  `bun scripts/nativeCapture.ts build-check --install DIR [--update-bytes N]`
  runs that check alone and, before Battle.net may update to a new live build,
  compares the install's free space with the update's size. A
  capture counts only when the drawn stamp in its own pixels (a row of cells
  along the top-left of the 4:3 UI area) names that fixture and frame, so a
  screen that hasn't redrawn can't pass for it. `--control` first plays the
  checked-in control (the same Rifleman walk twice around a Mountain King script);
  `bun scripts/nativeCapture.ts compare DIR control-walk control-walk-again`
  prints how far the twins' captures differ per frame. `run` also records the
  client's own PipeWire sink to DIR/audio.wav on the captures' clock
  (`--audio-sink SINK` or `--no-audio`). `bun scripts/nativeCapture.ts plan
  PAD|DIR...` plays the scripts headlessly on the map's schedule and checks
  each `#! cue FROM[-TO] NAME: sound=… effect=… tint=b shake=b recoil=b` line
  against the held capture frames, without a Warcraft client.
- Offline Classic capture batches can use `bun scripts/nativeCapture.ts chunks
  --out DIR PAD|DIR...` to build a separate map per row and write
  `capture-batch.json`. Run it with `bun scripts/nativeCapture.ts batch --plan
  DIR/capture-batch.json --out OUT --pair K --desktop PRIVATE_DESKTOP_SH
  --capacity MACHINE_CAPACITY_HELPER --clients-file FILE --client NAME
  --install DIR`. Each row writes an atomic checkpoint keyed by its map hash
  and source revision. On a dropped client or incomplete row, `batch` restarts
  the offline pair and resumes from the first frame missing from that row's
  checkpoint.
- Native silhouettes (wisp#125): a capture script with `#! silhouette a|b
  FIGHTER MOVE [WIDTHxHEIGHT]` (default 1920x1080) holds each capture frame
  twice, the fighter shown and then hidden by `-dev hide fighter SLOT`, with
  its team glow and missile effects off in both grabs and the hidden grab's
  stamp painted the tick after the hide, and
  `run` saves `FIXTURE/<frame>-shown.png` and `FIXTURE/<frame>-hidden.png` plus
  `FIXTURE/silhouette.json` (match frames, slot, fighter, move, resolution) for
  Wisp's `silhouetteBounds(shown, hidden)`; `run` refuses a capture of another
  size. The default scenario is smashcraft:ts/test/native/captures/wisp125-warden-nair.pad
  (Warden's neutral air, 10 held frames); build and run it as above on a
  Definitive clone (clone-c, clone-d or account b), never Tom's install.

Automated native match/rematch tests use one stock by default. A named workload
may use more stocks or a longer timer only when its required sample needs it;
record that reason beside the test (for example, #26's all-binding edge sample).
Keep ordinary combat completion intact; do not force a win to shorten a test.

Frame acceptance follows the root AGENTS.md budget.

Never touch Tom’s install; run account a only as clone-a through its
launch.sh, which yields to Tom’s game. Pick clients by the required look: the
offline LAN pool is Classic only; Definitive checks use the signed-in pairs
clone-c+clone-b and clone-a+clone-d (wisp:docs/lan.md). The offline pool remains the default for Classic pad parity,
captures, `accept` checks and desync hunts.

Wisp gives every verdict that is a number from the map's code (wisp#75 M5):
rules, meters, items, hazards, recovery, match flow,
determinism and checksums, timing, CPU frame cost, audio events, and which
model, effect, animation or HUD element shows on which frame, where, at what
scale and pose. Such a box is met by one Wisp run of the real map, two
simulated players where the rule needs two, citing the run. Appearance that
depends on Warcraft's shading (light, colour, contrast, materials, fog, water,
bloom) gets its verdict on Wisp within its calibrated range when the lever's
fidelity gate passes and the verdict is outside the gate's error margin.
Native truth runs on the Warcraft VM: take one spot check per lever per build
when the verdict is inside that margin, the settings fall outside the
calibrated range, or the appearance depends on PopcornFX particles. Batch those
spot checks on the VM. An unstable reference is inconclusive; it never widens
the gate's bounds. The laptop runs only product proofs requested in the real
game (60 fps on Tom's machine, the trailer, a listening clip). New Done-when
boxes follow the same line.

Native checks use one worker per available client (signed-in b, c, d for Definitive;
clone-a only through its launch.sh), sharing the visual queue; pairs are only for
sync, netplay and EX checks. A TypeScript-only
change (presentation values, effects, menus, CPU tuning) hot-reloads into one
running match with `bun wisp hot --data ... --watch` between captures; rebuild
the map only for imports, object data or art. Each lane builds its own
current-main map (about 90 s) unless one is already built for that commit;
visual captures take no exclusive lease, timing checks do. Record captures per
hour per lane in the status.
A native `bun wisp pad` timing check (a script without a `capture` step) waits
for an exclusive machine-capacity window before client input and keeps it
through the whole batch (maximum 15 minutes).
To run four timing lanes together, start their foreground batch runner inside
one `machine-capacity run --class exclusive --timeout-seconds 900 -- ...`
command; pad children reuse that window. Separate exclusive commands queue in turn.
Each result records `load_average` and `capacity_lease` (#311).
The signed-in clones (B, C, D) cover Definitive captures and tests that need Battle.net
itself: real netplay or latency, direct play, spectating, and as the
updated install the pool is copied from. Do not start them for a Classic offline check;
preserve an already signed-in client at its menu for the next client worker.
A run during which a client wrote a desync report or
crashed is invalid; rerun it.

Read warcraft-modding and its off-monitor dependency,
private-desktop-development, before controlling the game. Default automation off-monitor; use the primary display
for a requested hands-on trial. Preserve authenticated clients across map
iterations. Never direct-launch Warcraft as assumed authentication recovery.
Keep A/B in separate prefixes and use distinct online accounts. Credentials
belong in the encrypted machine configuration, never this repository or logs.

For changed custom UI, inspect the resolved Warcraft frame components before
raw positioning or click overlays. Run headless layout checks where supported,
then verify native hit targets, keyboard-focus release, draw order and
widescreen behavior. Keep local presentation separate from synchronized
gameplay and create shared handles consistently.

Release names and permission follow the root AGENTS.md.

- Native service A/B soak: build the same revision with `bun wisp map build
  --profile soak-playable --out OFF.w3x` and `--profile soak-integrity --out ON.w3x`,
  then run `bun wisp lan soak MAP.w3x --pair K --minutes 30 --out DIR
  --diagnostic-start` on the assigned offline pool host. Both named diagnostics
  install the handle ledger before startup and start the existing rotating
  four-CPU sequence once at selection. Both use journal editbox input, delay 2,
  rollback 24 and ordinary pool presentation; scene reports and frame meters
  are absent in both. Only hot reload, developer console, errors on screen and
  response probe differ (off for soak-playable, on for soak-integrity).
  `--diagnostic-start` skips the chat receipt and command only; both paths wait
  for the same fresh four-CPU snapshot before the unchanged RSS/handle sampling.
  Ordinary integrity maps retain chat startup. Native heap absence remains
  `n/a (no-collectgarbage)`; RSS uses elapsed >=600 seconds, slope <32 MiB/hour,
  and live-handle slope <=0.
