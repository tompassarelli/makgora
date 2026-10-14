# Perf

The #168 budget gates p99 ≤ 10 ms and worst ≤ 14 ms; CI measures Classic with `bun wisp perf playable-bot-four --samples --out CLASSIC.perf` and Definitive with `PERF_LOOK=definitive bun wisp perf playable-bot-four --samples --out DEFINITIVE.perf`, then runs `bun wisp perf budget` on each file.

- Frame cost: `LUA=<32-bit lua> bun wisp perf [quick-match|bot|bot-four|playable-bot-four|playable-duel|playable-human-four]`
  plays a run in 32-bit Lua and prints each client's predicted Warcraft cost
  per frame (p50, p95, worst, typing stall); `bun wisp perf compare A B` fails
  on a 5% rise in instructions (mean or worst 1% mean), predicted cost,
  allocation or typing stall (worst 1% mean). Landing gate (#48):
  CI holds `playable-bot-four` to smashcraft:ts/test/fixtures/perf/playable-bot-four.perf;
  after an intended rise or a cut, rewrite that file with `--out` and commit it.
  Wisp-only acceptance: `bun wisp perf native READINGS --samples FILE --json`
  checks retained solo/four-fighter references within 20% at callback p50/p95;
  then `bun wisp perf compare BASELINE CANDIDATE --json` gates the current
  candidate. The exact command and calibration scope are in
  smashcraft:docs/native-bot-session.md, "Wisp-only frame-cost acceptance".
  `bun wisp perf budget RUN_FILE` holds a `--samples` run to #168's frame
  budget (p99 10 ms, worst frame 14 ms, predicted). `bun wisp perf profile
  playable-bot-four --phases --out FILE` preserves measured samples and each
  client's slow-frame phase samples and simulation/repair step counts;
  profiling is a separate replay, excluded from measured costs. Spike census (#168): `bun wisp
  perf census [--fighter NAME] [--stage ID] [--functions]` plays every
  fighter's moves, specials and follow-ups in a playable-build training match
  and every stage's hazards, and lists any entry over 2 ms above its standing
  baseline without failing; `--functions` names the map functions of each worst frame. Run it
  on the farm (`bun wisp farm perf "census --fighter rifleman --functions"`).
  Per-pair gate (#405): `perf census --pairs FILE` writes each fighter pair's
  (fighter vs the rifleman partner) worst frame, the most p0 Lua instructions
  and the most allocated KB over its moves after the first (the first move's
  start-up frames vary by up to 43% from run to run); `bun wisp perf compare
  test/fixtures/perf/census-pairs.txt FILE` fails when any pair's worst frame
  rises more than 10% (`PAIR_MARGIN` in smashcraft:ts/scripts/wisp/perfPairs.ts)
  over the fixture, naming the pair. Pairs the run skipped are not judged; a
  pair without a fixture row fails. The margin's source: five farm census runs
  of all 26 pairs (2026-10-10) gave identical worst-frame instructions and
  allocation within 6.98% (kael'thas 31.5–33.7 KB). After an intended rise or a cut, rewrite
  the fixture with `--pairs` and commit it.

Session rates (#564): the playable build writes `smashcraft-rates-LOAD-MINUTE.txt` into CustomMapData, one `r` line per real second (os.clock): tick callbacks, draw callbacks, dispatched events, simulation, speculative and confirmed frames, held and stalled callbacks, echo gap mean/max, Lua and tick microseconds, sync sends, input messages received (all and the local player's own echoes), the confirmed, known and speculative frames and the prediction window, paused callbacks, pause and pause-menu toggles and the longest real gap between ticks and Warcraft's game speed (`gs` as GetGameSpeed's index, measured as lobby Fast 2, Normal 1 and Slow 0; Normal runs 0.8 and Slow 0.6 of Fast's callbacks, and the map holds and locks Fast at load and every match start); every 10 s a `c` line of live/created triggers, timers, effects, sounds, frames and units, key-event and trigger registrations, actions, highest handle id and heap, an `e` line of the busiest events, an `l` line of live effects by model and an `s` line of live sounds by file and units by owning player, so a fighter's leaking effect shows by name. All of it is local and never synchronized. `bun scripts/wisp/sessionRates.ts [CUSTOM_MAP_DATA]` (default: Tom's Steam CustomMapData) prints per-minute rates per map load, flags pauses, menu toggles, game speeds other than Fast and long callback gaps (focus loss), checks the map clock against file times, and ends each load with a `fork:` line naming why simulation fell under 55/s (none, game speed, Warcraft callbacks render- or timer-bound, or echo wait) and the minute it began.
