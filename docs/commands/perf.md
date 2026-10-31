# Perf

The #168 budget gates p99 ≤ 10 ms and worst ≤ 14 ms; CI measures Classic with `bun wisp perf playable-bot-four --samples --out CLASSIC.perf`, then runs `bun wisp perf budget` on it. `rollback-four` plays the fixed key tape of `playable-human-four`, its vertical stick alternating 0 and 1 inside the deadzone so every predicted remote row is wrong, while one sender at a time (rotating, every 301 callbacks from callback 240) has its sync messages held for 40 callbacks, so every client stalls at the playable build's 7-frame prediction window and then corrects the whole window; the run fails unless every client's deepest correction reaches that window, and it prints each client's catch-up callbacks (callbacks ending with the confirmed cursor more than `CATCH_UP_FRAMES` behind the known frame) and how many callbacks each confirmed debt of `CATCH_UP_FRAMES` took to clear (from the last callback that many frames behind to none behind); with `--samples` it also lists every callback that ran more than one confirmed or speculative frame as a `journey: catch-up frame` line. CI holds it to the same budget, after the Classic run. `native-perf-four` plays `rollback-four` on the native-perf build, with the host's Lua32 clock, and types `-dev capture` after GO!; with `PERF_CAPTURE=FILE` it writes p0's capture lines there for `bun wisp perf sections FILE` (smashcraft:docs/native-bot-session.md, "Per-section native capture"). Every capture sample, native or headless, ends with `stamps=FRAME,SPECULATIVE,REPLAY`, named `frame,speculative,replay` in the heading: the confirmed simulation frame and the speculative frame the callback ended on (-1 outside a rollback session) and the match's replay serial (smashcraft:ts/src/platform/frameMeter.ts). `perf sections` lists the worst 1% of callbacks with those columns, so a spike names its frame: replay that match from the client's `smashcraft-replay-REPLAY.txt` with `bun wisp replay` (smashcraft:docs/commands/replay.md) to reach `frame` (a native capture writes that replay only after `-dev reset` ends its match; `PERF_PROFILE_FRAMES=F,...` on `bun wisp replay` prints each frame's Lua time, instructions and bytes and samples the listed frames, smashcraft:docs/native-bot-session.md, "Per-section native capture"), and for a headless run profile the spike's callback with `bun wisp perf profile native-perf-four` or `PERF_PROFILE_FRAMES=CALLBACK` on smashcraft:ts/scripts/wisp/perfLua.ts.

- Frame cost: `LUA=<32-bit lua> bun wisp perf [quick-match|bot|bot-four|playable-bot-four|playable-duel|playable-human-four|rollback-four|native-perf-four]`
  plays a run in 32-bit Lua and prints each client's predicted Warcraft cost
  per frame (p50, p95, worst, typing stall); `bun wisp perf compare A B` fails
  on a 5% rise in instructions (mean or worst 1% mean), predicted cost,
  allocation or typing stall (worst 1% mean). Landing gate (#48):
  each change must hold `playable-bot-four` to the Classic budget below
  (smashcraft:.github/workflows/farm-test.yml);
  after landing, main's smoke run plays `playable-human-four`, all four
  fighters on the fixed key tape of smashcraft:ts/scripts/wisp/botMatch.ts
  with no computer deciding, compares it with the previous landed main's
  `main-perf` artifact and reports a 5% rise as main red. The bot match is
  not compared: a gameplay change moves what its computers choose, and so
  its worst frames, as e066ee2f61's dash smash moved p1's top 1% mean
  +5.2% while the fixed tape moved under 0.01% (smashcraft#54). A commit whose message
  carries a `Perf-Rise: <reason>` trailer stating why accepts an intended rise;
  the absolute budget still applies, nothing is re-recorded, and the smoke
  run's summary lists every accepted use.
  Wisp-only acceptance: `bun wisp perf native READINGS --samples FILE --json`
  checks retained solo/four-fighter references within 20% at callback p50/p95;
  then `bun wisp perf compare BASELINE CANDIDATE --json` gates the current
  candidate. The exact command and calibration scope are in
  smashcraft:docs/native-bot-session.md, "Wisp-only frame-cost acceptance".
  `bun wisp perf budget RUN_FILE` holds a `--samples` run to #168's frame
  budget (p99 10 ms, worst frame 14 ms, predicted) and each client's map allocation per frame to 14 KB at the median and 26 KB at the 95th percentile (`--alloc-p50 KB`, `--alloc-p95 KB`; CI's playable-bot-four and rollback-four runs both hold it), and every catch-up callback a `rollback-four` or `native-perf-four` run listed to 10 ms predicted (`--catch-up MS`), printing their p50, p95 and worst and the worst by confirmed+speculative frames run. `bun wisp perf profile
  playable-bot-four --phases --out FILE` preserves measured samples and each
  client's slow-frame phase samples and simulation/repair step counts;
  profiling is a separate replay, excluded from measured costs. `perf profile RUN --alloc
  [--top N] [--alloc-frames heavy|all]` replays the frames at or above any client's 95th percentile of alloc-bytes and
  lists the `--top` map functions by bytes requested per frame, self and inclusive, over every
  client (with `--alloc-frames all`, every frame, as KB per minute at 60 frames a second), from Wisp's `allocationSampler` (wisp:docs/frame-cost.md); Wisp's headless runtime
  and emulated natives are their own row. Spike census (#168): `bun wisp
  perf census [--fighter NAME] [--stage ID] [--functions]` plays every
  fighter's moves, specials and follow-ups in a playable-build training match
  and every stage's hazards on the `census` profile, the playable build without
  the host's session rates, whose 10 s file flush would otherwise be a pair's
  worst frame (#349), and lists any entry over 2 ms above its standing
  baseline without failing; `--functions` names the map functions of each worst frame. Run it
  on the farm (`bun wisp farm perf "census --fighter rifleman --functions"`).
  Per-pair gate (#405): `perf census --pairs FILE` writes each fighter pair's
  (fighter vs the rifleman partner) worst frame, the most p0 Lua instructions
  and the most allocated KB over its moves after the first (the first move's
  start-up frames vary by up to 43% from run to run); `bun wisp perf compare
  PRIOR_PAIRS FILE` fails when any pair's worst frame
  rises more than 10% (`PAIR_MARGIN` in smashcraft:ts/scripts/wisp/perfPairs.ts)
  over the prior run, naming the pair. Pairs the run skipped are not judged; a
  pair without a prior row, a fighter added since, fails when it rises more
  than the margin over the prior's costliest pair (#682). Background sweeps checks full roster coverage
  and fetches pairs from the newest successful Background run on main whose
  artifact is for a first-parent main commit within the 30-day artifact
  retention, excluding the current run. When this instrument has green
  artifacts but none is live (all expired) the run fails with `NoPrior` until a
  `rebaseline` dispatch decides the rise (#836); an instrument with no
  artifact at all, such as a new Wisp build, warns and passes drift comparison.
  Coverage and absolute frame budgets always apply. Joined pairs are uploaded after sweeps and census pass,
  retained for 30 days, and used only once the whole Background run succeeds.
  The margin's source: five farm census runs
  of all 26 pairs (2026-10-10) gave identical worst-frame instructions and
  allocation within 6.98% (kael'thas 31.5–33.7 KB).
  A decided rise rebaselines through the Background sweeps dispatch input
  `rebaseline` (one pair name per line): that run measures the named pairs
  without judging them, every other pair is judged as usual against the prior
  artifact, and the run's own artifact then becomes the baseline under the same
  10% margin (#765). A rebaseline dispatch runs outside main's Background
  concurrency group, so a landing's queued run cannot replace it while it waits.
  The landing-exit rule of 2026-10-30 (every lagged landing reads the stick on
  its landing frame) rebaselined 16 pairs: a mispredicted stick on a landing
  frame now changes state, so the census's rollback re-simulates through the
  landing (Tyrande's air side special 44k to 141k instructions above baseline,
  Cairne 207600 to 296600 worst frame) (#826).
  The Mrgl & Grgl pair's baseline is a three-body measurement: a Mrgl & Grgl match seats
  Mrgl, Grgl and the rifleman, so the pair's worst frame, a headless-timer frame
  holding two whole 1/60 ticks, is about 2 x 162k instructions instead of
  2 x 121k before the duo (242000 to about 329600). Per frame, `bun wisp perf
  compare` of the three-body bot-murloc run against the four-fighter bot-four
  baseline reported the three-body run no worse beyond 5%: worst-frame
  instructions p0 1,533,700 against 1,503,600 and p1 1,537,900 against
  1,566,800; p95 p0 856,100 against 872,000. Rollback and repair cannot lower
  that frame (no repair runs in or near it, and the confirmed frame may not
  borrow the speculative result in training).

Session rates (#564): the playable build writes `smashcraft-rates-LOAD-MINUTE.txt` into CustomMapData, one `r` record per real second (os.clock), continued in `r2`, `r3` records with the same `t=` so each stays within 250 characters (Warcraft cuts a Preload string at 259; the report and harness join them): tick callbacks, draw callbacks, dispatched events, simulation, speculative and confirmed frames, held and stalled callbacks, echo gap mean/max, the game milliseconds a reference timer advanced that second (`gms`; the report's game/real and callbacks per game second), Lua and tick microseconds, sync sends, input messages received (all and the local player's own echoes), the confirmed, known and speculative frames and the prediction window, the match's agreed input delay (`dl`) and smoothed ping (`ping`, ms), the remote rows that arrived that second (`arr`) and, per sender, how many frames the speculative cursor had already run past each row's frame on arrival as mean/max (`lt=P3:12/15,P4:9/11`, negative is early), the local player's own echo in callbacks as mean/max (`echo`), corrections, replayed frames and the deepest replay that second (`rb`, `rbf`, `rbd`), the largest fighter displacement, in world units, that a landed correction moved any fighter by and the corrections that moved one over 20 units (`pop=max/over`), callbacks after at least 2 ms idle (`bur`, one per Battle.net turn burst), the longest run of held callbacks (`hrun`), match callbacks since the epoch began minus speculative frames advanced (`drift`, frames lost to holds and stalls), the real-time frames due minus the speculative frame (`due`, 0 until the real-time frame target lands), computer decisions repairs reused from the earlier run and made again (`bot=reused/rerun`), heap change in KB (`alloc`) and failed `BlzSendSyncData` calls (`sf`), paused callbacks, pause and pause-menu toggles and the longest real gap between ticks and Warcraft's game speed (`gs` as GetGameSpeed's index, measured as lobby Fast 2, Normal 1 and Slow 0; Normal runs 0.8 and Slow 0.6 of Fast's callbacks, and the map holds and locks Fast at load and every match start); every 10 s a `c` line of live/created triggers, timers, effects, sounds, frames and units, key-event and trigger registrations, actions, highest handle id and heap, an `e` line of the busiest events, an `l` line of live effects by model and an `s` line of live sounds by file and units by owning player, so a fighter's leaking effect shows by name. All of it is local and never synchronized. `bun wisp perf rates [RATES_FILE|CUSTOM_MAP_DATA]` (default: Tom's Steam CustomMapData) prints per-minute rates per map load, including speculative frames per real second, game/real and real-time frame debt as last/max `due`, flags debt over 2 frames (`DEBT`), pauses, menu toggles, game speeds other than Fast and long callback gaps (focus loss), checks the map clock against file times, and ends each load with a `fork:` line naming why simulation fell under 55/s (none, game speed, Warcraft callbacks render- or timer-bound, or echo wait) and the minute it began.
