# Farm

- Compute farm: `bun wisp farm test [--ref REF] [--wait]` runs the full Bun
  and 32-bit Lua suites, sharded by measured time
  (smashcraft:.github/workflows/farm-test.yml). It refuses a commit already
  on main (main's CI runs these suites) or pending in Autoland (queued,
  testing alone, passed alone or in a train: Autoland runs them).
  Balance and Playtest run only on a commit on main or on a lane tip named
  with `--lane NAME` (pushed to `claude/NAME`) or on a `probe/NAME` branch
  (`safe-push --to probe/NAME`, then `--lane probe/NAME`), never on a scratch
  branch. A `probe/` branch is a candidate measured by the farm field only:
  Autoland never lands it. Memory soaks, perf, pads and difficulty runs may also use a `farm/`
  scratch branch, the place for scratch instrumentation, since Autoland lands
  every pushed `claude/` lane, including one pushed only to be measured.
  The Scratch retire workflow (smashcraft:.github/workflows/scratch-retire.yml)
  runs when any of these runs completes and deletes every `farm/` and `probe/`
  branch that no active run or open pull request holds and whose head commit
  was neither committed nor pushed within the 3-hour scratch grace (180 minutes,
  `HEAD_GRACE_MINUTES`; it outlasts a dispatch that retries while the hosted
  slots are full); the deletion line prints the `git push` that restores it.
  A newer run of the same shape on the same line (main, the lane or the
  scratch commit) cancels the older one (each `--matchups` run is its own shape,
  because GitHub refuses a run whose concurrency group holds a long pair list),
  and every job first cancels its run
  when the commit has left main (or main reverted it) and its lane
  (smashcraft:ts/scripts/farmGuard.ts). Job timeouts sit about 1.5 times above
  the longest measured job; Balance packs each runner core to 750 s from
  each pair's newest measured seconds and gives shards 45 minutes, because a
  pair's time moved up to 3.31 times between commits.
  `bun wisp farm balance [--ref REF] [--lane NAME] [--wait]` plays the
  balance gate's computer field (Wren Expert, 400 a pair; `--opponent`, `--tier`,
  `--per-pair`, `--seeds`) on GitHub's free hosted runners, a `cpuField
  --pairs` process a core. The plan measures running hosted jobs across the
  owner's recently active public repositories and reserves the time-weighted
  p90 concurrent hosted jobs from the latest ten completed Autoland runs per
  repository. Its matrix admits `40 - busy - reserve` jobs and refuses when
  no slots remain; `--wait` then re-dispatches with a backoff (60 s doubling to 10 min, one
  line per wait) until admitted or `--wait-minutes N` (180 by default) pass, and without
  `--wait` the refusal fails at once naming the shortage. The measurement is printed in the plan and the command's
  final report. The account runs 40 jobs at once (GitHub Pro; wisp:docs/ci.md,
  "Runner capacity and waiting"). Work is packed across four cores by measured
  CPU time into jobs of at most 15 predicted minutes. Long ceiling panels and
  spam probes are partitioned without changing their matches, seeds or verdicts;
  the `balance-timings` artifact supplies the next full-roster plan. Until one
  exists, the plan reads the previous full field's job durations and ceiling
  CPU records. The field is followed by each fighter's spam probe (its top damage move only,
  `--probe N` matches a pair, 40 by default, 0 to skip), and with `--wait`
  prints the verdicts, the field table and the damage-by-move, play-style,
  openings-per-kill and balance-score tables (smashcraft:docs/design/balance.md).
  Local saved fields use `bun scripts/cpuField.ts --merge FILE`;
  `--seed-offset N` starts a fresh seed range for optimizer holdouts.
  A Wren Expert run with at least 400 matches per pair fails when the win-rate
  gate or the balanced gate fails, after publishing the report artifact;
  lower-tier or smaller exploratory fields remain reports.
  `--matchups rifleman:chen-stormstout,lich:chen-stormstout` runs only those
  named pairs for a repair comparison; its report is not a full-roster gate.
  `bun wisp farm pads [--ref REF] [--only PATH]... [--wait]` plays
  every top-level smashcraft:ts/test/native/pads/ script (or each issue
  file or folder named by `--only`, such as `--only 151 --only rifleman-cues.pad`) headless through the
  real helper against its own `#!` expectations, for a change that moves hit
  timing or a new issue script on a loaded host; each job uploads its traces
  (`gh run download RUN`), the source of a new script's `#! expect` lines;
  `bun wisp farm perf ["RUN ARGS" ...] [--out DIR]` runs each
  `bun wisp perf RUN ARGS` in its own job (default `playable-bot-four`),
  prints each summary and writes each run to DIR. Predictions come from
  counts, so a runner predicts what this machine would; use it instead of a
  local perf run; `bun wisp farm memory [--minutes N] [--wait]` runs the
  30-minute memory soak (also nightly). Without `--ref` it measures the checkout's HEAD (a commit not on
  main goes to a scratch `farm/` branch, deleted after the run).
  `bun wisp farm memory --matches 50 --ref FULL_SHA --wait` runs the playable
  Lua build in two clients per job through 50 all-computer matches across at most
  four jobs, including rematches,
  and fails on a crash or desync. `bun wisp soak memory --matches N --bundle FILE`
  checks an extracted playable Lua bundle locally; its report names every match.
  Use the farm instead of a local cpuField or pad run: the repository is public, so the
  runners cost nothing, and this machine stays free.
  The self-hosted `farm-big` runners live on two hosts: gex45 (11 smashcraft
  runners, always on) and Tom's laptop whiterabbit (2 smashcraft runners of 4
  CPUs and 8 GiB, the same rootless Podman image, one job per container, no
  sudo and no access to his home or secrets). The laptop's runners pause while
  its game reserve is on (`north capacity game-reserve`), its gaming hold is set
  (`north capacity gaming`) or a Warcraft III client runs outside the agent and
  native slices: idle runners stop within 10 seconds, a job already running
  finishes, and the runners return when the signals clear. Both hosts take
  the same `farm-big` jobs, so a job may land on either; nothing in a
  workflow can name a host. Routing keeps counting only gex45's 11 runners
  (`capacity` in ts/runner-routing.json), so a paused laptop never leaves a
  planned job waiting. Both hosts come from the firn `farm-runners` module
  (nixos-config:modules/farm-runners/default.nix).
