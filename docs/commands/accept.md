# Accept

- Native acceptance: `bun wisp accept [--only ID...] [--pair K... | --pairs N | --clients-file FILE] [--solo] [--map MAP.w3x] [--dry-run]` runs every
  open native check declared in smashcraft:ts/scripts/wisp/acceptChecks.ts in
  as few fresh matches as their maps allow and prints pass, fail or
  needs-look per check with its evidence folder (wisp:docs/accept.md). `--pair K`
  selects the offline pool pair; every check, capture and receipt follows its
  two clients, and sessions start through `lan fresh`. `--solo --pair K`
  starts each client in its own single-player game through `lan solo`, for
  captures on 3.0.1 where LAN is removed; it sends each game's setup separately.
  Several pairs
  (`--pair K` repeated, or `--pairs N`) split the sessions over every pair at
  once, one process per pair, with each map built once; the merged report and
  each `shard-K/` are under the run's evidence folder. Declare
  a new native box there, next to the issue it closes, instead of a hand procedure.
  Move smoke (dev#467): `bun wisp accept --only gate-moves --pair K --map CANDIDATE.w3x`
  turns on Training on the candidate, then plays every fighter pair from
  fighter select: each standard keyboard key once, every normal, aerial and
  special after a training reset, and the ultimate after both fighters charge
  their mana. Each match ends from the pause menu, and its own replay is judged
  headless (smashcraft:ts/scripts/wisp/smokeJudge.ts): the replay must reach
  every recorded checksum, every key must reach the game and every move must
  start, or `gate-moves` fails and the green install keeps the last good map.
  Keys go out through xdotool with no per-key delay, timed from the game
  rate each match's replay measures. When a step's next reset arrives more
  than 24 frames early, the client froze for that long; a failed move or spot
  check in such a step makes the match invalid, and the gate plays it again,
  up to three attempts, keeping `match-NN-invalid-K.txt` and its reasons. A
  failed spot check also keeps its before and after frames as PPM files.
  `bun wisp smoke` rehearses the same tapes headless on every pair in about ten
  seconds; run it after changing a fighter's inputs or kit.
  `gate-specials-spot` runs in the same session, after `gate-moves`: at each
  rest between training resets the host frame's bright play-area pixels are
  counted, and a special or ultimate fails when the next rest is brighter than
  the rest before it by more than three times the largest rest-to-rest change
  of the normals (smashcraft:ts/scripts/wisp/specialsSpot.ts). Training mode
  drops no meter orb and the count skips the HUD band, so the orb never counts.
  `--map MAP.w3x` uses that already-built candidate for the selected checks
  without rebuilding it; select checks needing the same build profile. Each
  shard receives the same immutable map. Use revision-specific private paths.
  Render cadence: `-dev render-clock` in a development map records timer
  callback bursts and cost; `bun wisp accept --only 169-render-clock --dry-run`
  prints its native plan (smashcraft:docs/high-refresh.md).
  `-dev camera-smooth on|off` compares native one-frame camera transitions
  with the normal camera in the same development map; it keeps the simulated
  camera unchanged (smashcraft:docs/high-refresh.md).
  `bun scripts/cameraDraw.ts --video PRIVATE.mkv --pages DATA_DIR --out PRIVATE_DIR
  [--slot 0 --run 1 --viewport X,Y,W,H]` joins lossless compositor frames and
  their original timestamps to the response marker and exported callback rows.
  Script-cost capture: `bun wisp map build --profile native-perf ...` uses playable
  key input and pooled presentation with developer setup commands. In a match,
  `-dev capture 18000` writes every client's raw callback samples; read full-run
  median/p95/p99/worst with Wisp's capture reader. Procedure and limits:
  smashcraft:docs/native-bot-session.md, "Raw playable cost captures".
