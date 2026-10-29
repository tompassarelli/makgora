# Native

Native startup verifies private-window focus, observed
pointer motion and a harmless Scroll Lock key in the map-written
`smashcraft-input-preflight.txt`. The probe has a twelve-second deadline
and names the failed display, focus, pointer or key-trace boundary. Pad
batches probe once per game, after its first hot reload when `--hot` is
set, so the probe exercises the reloaded script. The key receipt is local
diagnostic output and changes no gameplay state. Native clients never
deliver F24 (0x87) to the map, so the probe uses Scroll Lock, which has
one native keycode and no engine binding. `scripts/wisp/nativeInput.ts`
exports `verifyNativeInput` for native runners using the selected `Clients`
and `GameFiles` services.

`bun wisp accept --dry-run --only 482-shield-energy` plans four held captures:
shield down, full, mid and low. The acceptance driver sends
`-dev shield-energy down|full|mid|low` after the training setup. The full,
mid and low commands resume normal partner shield input until the requested
energy is reached, then pause after drawing. Each capture has a
`SMASHCRAFT SHIELD` receipt in `smashcraft-dev-shield-energy-pSLOT.txt`, naming
the simulation frame, raised state, energy, and drawn centre/radius in stage
coordinates. The receipt describes the draw parameters; judge the pixels too.
Classic `raised=T` with no visible bubble is FAIL, never RECAPTURE.
AI observation records in replay dumps retain default shield energy; only
the live fighter state or these direct receipts measures shield drain.

On the persistent showcase map, `bun scripts/showcase.ts send CLIENT_DATA_DIR
dev -dev showcase demo NAME` plays the fighter's showcase rows in-map on the
shared timeline (`src/game/session/showcaseTimeline.ts`), writing the same
`CAPTURE SCRIPT` status and drawn stamps as the capture map.
`bun scripts/showcaseDemoCheck.ts SLUG...` plays that demo headless and
refuses unless every held stamp and status equals the timeline frame for frame.

`bun wisp native-capture reel --out PRIVATE_DIR [--fighter SLUG] [--hold-ticks N]`
prepares Classic motion-reel pad scripts from the current roster and authored
normals, four ground specials and ultimate. Each fighter directory is one
capture-map batch. The timeline stands the dummy where the move's hit reads:
a ground move at three quarters of its reach; an aerial at the middle of its
last active region, so the whole swing shows before contact; for an up tilt
or up smash whose highest region sits more above the head than ahead of it,
tossed so it peaks with its feet at that region's middle on the first active
frame, clear of the fighter's own model; a down smash whose sides open on
different frames on the side of its first hit, braced to take that hit
without knockback, then moved to the other side with its hit record cleared
the frame before its second hit opens, and sampled at that hit after the
first hit's hitlag, so both hits show; a command grab at its lunge plus three
quarters of its strike. A special that rushes forward until it meets a body also
samples the middle and last frames of its rush, and the camera holds still
from the frame before the rush to the move's end, so the travel shows.
`native-capture plan PAD...` exercises its requested held
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
`-dev lever density NUMBER`, `-dev lever oversky on|off`, `-dev lever sky on|off`,
`-dev lever shadows COUNT` and `-dev lever light INDEX on|off`. `-dev backdrop off`
followed by `-dev lever sky on` shows only the sky behind the fighters, a still
light backdrop for native silhouette captures (wisp#2); `-dev backdrop off` alone
leaves them on black. Compare `-dev lighting stock|stage` and
`-dev backdrop on|off` in the same paused scene. Use `-dev view near|far` with
`-dev lever camz -100000|100000` to reach the camera's lowest or highest allowed
height; `-dev lever camz off` restores the normal extreme height and
`-dev view off` restores the match camera. The override still passes through
the existing camera limits. `-dev hide fighter SLOT` (SLOT 0 to 3) stops
drawing that fighter's body unit or effect body, its shadow, its disjoint
weapon models, white flash, agency halo, shield and dizzy stars without
touching the sim, stage, other fighters or HUD; `-dev show fighter SLOT` puts
back exactly what was drawn (receipt `dev: fighter SLOT hidden|shown`).

- One-client captures:
  `bun scripts/nativeCapture.ts build --out MAP.w3x --control PAD|DIR...` bakes
  the scripts and their `capture` frames into a native-capture map that plays
  both pads itself and holds each capture frame with the fighters' animations
  and effects frozen, seeking an effect whose draw entry reseeks by age to the
  held frame's age on every held tick, so consecutive frames show it grow;
  host it with `bun wisp fresh MAP.w3x --no-quick
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
  each `#! cue FROM[-TO] NAME: sound=… effect=… tint=b shake=b recoil=b teeter=b` line
  against the held capture frames, without a Warcraft client.
- Voice budget (#30): `bun wisp map build --profile voice-check --out MAP.w3x`
  starts four Wren Expert computers over three stocks and two minutes as soon
  as fighter selection opens, paints the drawn stamp on every match frame, and
  at the match's end writes `smashcraft-voice-log.txt`: each admitted combat
  voice with its frame, the frame drawn that tick, fighter, class, voice slot,
  live voices and volume. Host it with `bun wisp fresh MAP.w3x --no-quick
  --clients-file FILE` while `bun scripts/voiceCheck.ts run --clients-file
  FILE --client NAME --install DIR --out DIR` records the client's sink audio
  and stamped screens on one clock (at most 5 minutes);
  `bun scripts/voiceCheck.ts judge DIR` writes `onsets.tsv` and
  `verdict.json`. A hit passes when its audio onset, after the median latency
  of non-hit voices with no other voice within 150 ms, lies within one frame of the
  moment its frame was drawn.
- Trailer footage (#363): `bun wisp map build --profile trailer` plays every
  shot in `src/game/session/trailerShots.ts` in turn as the same seeded Expert
  computer match `bun scripts/playtest.ts --repro SEED` plays headless
  (`fieldMatch`), up to the shot's end frame, with the drawn stamp on every
  frame. It plays the shipped pool-predicted match and holds every simulated
  frame from the shot's start to its end for 5 game ticks, the capture reel's
  frame hold (`holdEveryVisualFrame`), so a recording below 60 fps still shows
  every frame. It writes `smashcraft-trailer-log.txt`: each shot's stock losses and
  state checksums at its first and last frame. Play it with `lan solo` on a
  `--pool-profile capture-classic-1080` pair while `bun
  scripts/trailerCapture.ts record --clients-file FILE --client NAME --install
  DIR --out DIR --geometry 'X,Y 1920x1080'` records the game area with
  wf-recorder at 60 fps. `bun scripts/trailerCapture.ts judge DIR` replays
  each seed headless, compares its checksums and stock losses with the log,
  assembles `shot-NN-seed-S.mp4` from the first capture frame stamped with
  each game frame from start to end, one clip frame per game frame, and passes a
  shot only when its clip is 1920x1080 at 60/1 with every frame from start to
  end stamped exactly once.
- Offline Classic capture batches can use `bun scripts/nativeCapture.ts chunks
  --out DIR PAD|DIR...` to build a separate map per row and write
  `capture-batch.json`. Run it with `bun scripts/nativeCapture.ts batch --plan
  DIR/capture-batch.json --out OUT --pair K --desktop PRIVATE_DESKTOP_SH
  --capacity MACHINE_CAPACITY_HELPER --clients-file FILE --client NAME
  --install DIR`. A row map may hold several fixtures; it completes when every
  fixture's frames are captured. Each row writes an atomic checkpoint keyed by its map hash
  and source revision. On a dropped client or incomplete row, `batch` restarts
  the offline pair and resumes from the first frame missing from that row's
  checkpoint. On 3.0.1, where the pool has no LAN provider, add `--solo`: each
  row plays through `lan solo` on a freshly started pair, since a pool launch
  plays one solo game, so a `--solo` batch refuses a pair that is already
  running. 3.0.1.24371 only starts with network, so its batches
  also pass `--network`, which starts that one pair through `lan pool --pair K
  --network` (wisp:docs/lan.md, Guardrails); every other pair stays offline.
- Native silhouettes (wisp#125): a capture script with `#! silhouette a|b
  FIGHTER MOVE [WIDTHxHEIGHT]` (default 1920x1080) holds each capture frame
  twice, the fighter shown and then hidden by `-dev hide fighter SLOT`, with
  its team glow and missile effects off in both grabs and the hidden grab's
  stamp painted the tick after the hide, and
  `run` saves `FIXTURE/<frame>-shown.png` and `FIXTURE/<frame>-hidden.png` plus
  `FIXTURE/silhouette.json` (match frames, slot, fighter, move, resolution) for
  Wisp's `silhouetteBounds(shown, hidden)`; `run` refuses a capture of another
  size. The default scenario is smashcraft:ts/test/native/captures/wisp125-warden-nair.pad
  (Warden's neutral air, 10 held frames); build and run it as above, never on
  Tom's install.

Automated native match/rematch tests use one stock by default. A named workload
may use more stocks or a longer timer only when its required sample needs it;
record that reason beside the test (for example, #26's all-binding edge sample).
Keep ordinary combat completion intact; do not force a win to shorten a test.

Frame acceptance follows the root AGENTS.md budget.

Never touch Tom’s install; run clone-a only through its
launch.sh, which yields to Tom’s game. The offline LAN pool is the default for pad parity,
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

Native checks use one worker per available client (signed-in b, c, d;
clone-a only through its launch.sh), sharing the visual queue; pairs are only for
sync, netplay checks. A TypeScript-only
change (presentation values, effects, menus, CPU tuning) hot-reloads into one
running match with `bun wisp hot --data ... --watch` between captures; rebuild
the map only for imports, object data or art. Each lane builds its own
current-main map (about 90 s) unless one is already built for that commit;
`native-capture` visual captures take no quiet session. Record captures per
hour per lane in the status.
Every native `bun wisp pad` run is compared frame for frame, so it waits for
machine-capacity's quiet native session before client input and keeps it
through the whole command, captures or not (#69). Each result records
`load_average` and `quiet_window`.
The signed-in clones (B, C, D) cover tests that need Battle.net
itself: real netplay or latency, direct play, spectating, and as the
updated install the pool is copied from. Do not start them for an offline check;
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

Developer setup uses the synchronized `-dev` chat channel in dev, integrity and
native-driver builds. Player builds refuse it. Slots are 1–4; teams are 0–3.
`-dev percent SLOT N` sets an active fighter to a whole percent from 0–999;
`-dev lives SLOT N` sets its remaining stocks to 1–99;
`-dev beside SLOT OTHER` moves it onto another active fighter's position.
These fighter commands require a running match. To apply them before frame 1,
use one chat event such as
`-dev setup quick hero murloc;percent 1 150;lives 1 3`.
The setup command runs up to 32 non-nested commands in order.
`-dev teams on` enables Team Battle at character select; `-dev team SLOT T`
assigns the actor's fighter or a computer to a team through the lobby rules.
`-dev slots 1 14` selects one human fighter and three computers;
`-dev slots 0 15` selects four computers while connected humans operate the menus.

## Shared capture queue

Animation lanes on gex45 get native Classic frames of their take from one
shared queue instead of building a map and starting a pool of their own (#614).
From the lane's `ts/`, with the take committed:

```sh
bun wisp anim capture enqueue --lane LANE --fighter SLUG --move MOVE [--rev REV] [--crop X,Y,W,H] [--dummy SLUG]
bun wisp anim capture wait ID [--minutes N]
bun wisp anim capture status
```

`MOVE` is an `anim score` move name (`up-air`, `side-special`, `ultimate`).
`enqueue` refuses a lane with uncommitted tracked changes, because the frames
are of the committed revision. Each job captures the move's showcase row in
both facings at the lane's revision. `wait` prints the result: `sheet.png`
(one row per facing, right on top), the frames folder, the map hash and the
built source revision. Its `judge` folder holds a `batch-1.md` for
`bun wisp anim judge run JUDGE_DIR`. Every lane clip gets its own sheet, so
each cold viewer still judges one clip alone. `--crop` is in captured-screen
pixels and applies to every tile. `--dummy SLUG` stands that fighter in as the
target instead of a mirror of the mover, so a large fighter's silhouette does
not merge with an identical body at the hit; it changes only the capture.

A special that reflects is staged with the dummy at most 300 units away, and
closer when the dummy's neutral-special projectile could not fly there and
back, slowed by the reflect, within its life. The dummy first fires that
projectile, timed to arrive in the middle of the reflect window, so the sheet
shows the shot turned back into the dummy instead of only the cast.

`bun wisp anim capture serve [--pair K] [--hosts local|any] [--once] [--idle-minutes N]` runs the
service from a checkout of main on gex45. Without `--pair` (or with `--pair
auto`) it leases the next free pair from the shared pair queue (`bun wisp lan
lease`, wisp:docs/lan.md#leasing-a-pair) and gives it back when it stops, so
several services and other native requests land on different pairs. With
`--hosts any` the lease may hand out a pair of another host (`$WISP_PAIR_REMOTE`,
whose host name is the ssh destination, such as `tom@10.77.0.2=0,1` for the
laptop while `laptop status` says available). The service then builds each
map here as usual, copies its stored build over ssh into that host's
`~/.cache/wisp/maps` under the same key, runs `nativeCapture.ts batch` there
from `~/code/smashcraft/main/ts` with that host's own private desktop, clients
and installs, and copies the frames back before writing the sheets; the batch
log records a `ship` step with the host and key ([remote
run](../../ts/scripts/captureQueueRemote.ts)). It takes every pending job and folds
the lanes' revisions into as few merged revisions as it can. A lane joins a
merge only when its own changed files and its fighter's `build-inputs` entries
are byte-identical to its revision, so the clip is exactly the lane's. Lanes
that conflict or edit the same file get their own merged revision. For each
merged revision the service builds one native-capture map holding every
fixture, while the warm pool starts. It then captures every fixture in one
client session through `nativeCapture.ts batch` (map hash and source revision
checkpoints as above) and writes one sheet per job. The pool is
`lan pool --foreground --pair K --queue --owner capture-queue --owner-pid
SERVICE`: it waits its turn in wisp's line, stays warm between batches and stops
when the service exits. The service stops after `--idle-minutes` (default 30)
with an empty queue, or after one pass with `--once`. Stop it early with
Ctrl-C or SIGTERM to its PID; that also stops its pool. Whoever starts it owns
it. The queue lives in `~/.local/state/smashcraft/capture-queue`
(`SMASHCRAFT_CAPTURE_QUEUE`): `pending/`, `taken/`, `results/ID/` and
`batches/BATCH/log.jsonl`, which records each step's wall seconds (fold, map
build, pool wait and clients to door, capture, each fixture). The defaults name
gex45's pair `K` client `lanKa`, its install and the north private-desktop and
machine-capacity helpers; override them with `--client`, `--install`,
`--clients-file`, `--desktop` and `--capacity`. Collector runs stop after
`--minutes` (1 to 5, default 4).

## Native batch planner

Use `bun wisp native plan --boxes FILE.tsv --out PLAN.json`, then
`bun wisp native run PLAN.json --out DIR [--pairs N] [--dry-run]` to union,
deduplicate and shard native evidence work. See [native planner](../native-planner.md)
for TSV fields, executor configuration and resume records.
