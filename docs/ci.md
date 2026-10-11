# CI

| Workflow | Runs | Does |
| --- | --- | --- |
| CI (smashcraft:.github/workflows/ci.yml) | every push except `farm/**` and `claude/**`, pull requests, dispatch | development loop, perf gate, Lua32 suites, and the sweeps the suites skip (Sweeps (Bun), Lua32 (sweeps)); Autoland's dispatch after a landing runs only the smoke job (perf compare and commit metrics), because the farm test already ran every check on that commit |
| Main is red (smashcraft:.github/workflows/main-red.yml) | after each CI run on main | the sheriff reverts a landing that turned green main red, then opens, updates or closes the "main is red" issue (smashcraft:AGENTS.md) |
| Farm test (smashcraft:.github/workflows/farm-test.yml) | `bun wisp farm test`, autoland | every check CI runs: full Bun and Lua32 suites with their sweeps, sharded (wisp:docs/farm.md), and the stack trace, parity corpus, tapes and numeric, perf compare, effect-kit, clean room, benchmark and computer coverage checks; the census runs after landing in Background sweeps. Its summary, uploaded even when the run fails or times out, names each failing test (a Lua test with its module), failing check, Lua budget overrun and missing shard |
| Background sweeps (smashcraft:.github/workflows/background-sweeps.yml) | each landing (Autoland dispatches it with the landed SHA), push to main, nightly | on `farm-big`: the Bun and Lua32 suites with `SWEEPS=1`, and the per-pair worst-frame census (#405) in 7 fighter shards whose joined pairs must stay within the margin of test/fixtures/perf/census-pairs.txt; a landing's red run goes to the sheriff (see Sheriff) |
| Playtest (smashcraft:.github/workflows/playtest.yml) | nightly, dispatch with `matches` | plays computer-versus-computer matches across every fighter, stage and computer level on the newest green main, each seed twice to compare state hashes, and opens or updates one issue per finding kind (smashcraft:docs/commands/soak.md) |
| Autoland (smashcraft:.github/workflows/autoland.yml) | push to `claude/**`, `safe-push --to main`, dispatch with `branch` | main's one landing queue: tests each waiting tip alone at once, lands trains of tips that passed |
| Autoland sweep (smashcraft:.github/workflows/autoland-sweep.yml) | every 5 minutes from Autoland heartbeat while Autoland has work, every finished Autoland or Farm test run, dispatch with `dry-run` or `landed` | cancels stuck Autoland runs and requeues their lanes; opens the "Autoland stalled" issue while main is idle with lanes pending |
| Effect upgrade (smashcraft:.github/workflows/effect-upgrade.yml) | Mondays, dispatch | `effect-kit upgrade` and `effect-kit check`; a clean upgrade goes to Autoland, findings to the "Weekly Effect upgrade" issue |

## Autoland

Autoland is main's one landing queue. Cloud workers push to `claude/NAME`;
`safe-push --to main` checks a local lane, pushes it to
`claude/land-LANE-SHA` and waits for its verdict (the repository's
.safe-push sets `landing.queue = autoland`). Nobody else pushes main, so no
landing restarts another's suites.

1. **Queue.** A push marks the branch tip with a pending `autoland` commit
   status ("queued") and starts a plan run.
2. **Test alone.** A plan run gives each idle test slot the next waiting
   tip (priority, then arrival); the other tips keep "queued" until a plan
   finds a slot free, so no run waits on a busy slot. A test run is: the tip rebased onto main, the pre-push gate
   (smashcraft:ts/scripts/prePush.ts) on a scratch `farm/autoland-SHA`
   branch and the farm test workflow, which runs every check main's CI runs.
   Tests run in three slots of one farm run each, outside the landing queue;
   a plan starts a test only while Autoland's queued and running hosted jobs
   plus the new run's 16 stay within 32 of the account's 40 (a test or train
   run with no `suite /` job yet counts 16), and logs "Autoland hosted jobs:
   N/32" in its summary. The train is never held by that budget.
   Because tests run outside the landing queue, a red tip gets its failed status and run summary within minutes. A
   conflicting tip, or one that changes `.github/workflows/` (the workflow
   token can't push those), is refused. A green tip becomes "passed alone on
   MAIN as tree TREE".
3. **Train.** One train at a time takes up to 4 tips that passed alone, first
   passed first, and rebases them onto main. A leader whose rebase is the
   very tree it passed alone lands by itself without another suite; any other
   train runs the gate and farm test once as one merged candidate.
4. **Land.** Only when the suites pass on that exact candidate, main's known
   failures included (#394), and its regenerated reports meet their targets,
   main is fast-forwarded to it plus the reports commit, each branch's
   status becomes "landed as SHA" and its branch is deleted. Pushes made with
   the workflow token start no workflows, so the run dispatches main's CI,
   which runs only its smoke job for a landed commit.
5. **Red.** A red lone tip gets a failed status, and its run fails with a
   job summary and annotation saying "Autoland didn't land" and naming the
   files or tests. Autoland posts no issue comments: read outcomes with
   `gh run list --workflow autoland.yml` and `gh run view RUN_ID`, or the
   tip's `autoland` commit status. The branch stays; push a fix to it and it queues
   again. A red train of several tips sends each back to testing alone; the
   first to pass again on main leads the next train and lands without a
   suite.

Lanes don't regenerate whole-roster reports. After the gate, Autoland's
`reports` job runs beside the suite: it reruns `bun wisp combos --advantage`,
commits changed tools/move-data/advantage-state.{jsonl,md} as "Regenerate
reports for LANES" with the changed rows in the summary, and refuses a
candidate whose regenerated rows miss a target (ts/test/advantage-state.test.ts).
The suite tests the candidate and the reports job tests the regenerated rows,
their only reader; `land` waits for both and pushes the reports commit.

Every dispatched run ends with a plan unless it was cancelled, and a plan tests
again any pending tip that no unfinished run holds, so a later plan rediscovers a cancelled tip. The scheduling decisions are a pure function
(smashcraft:ts/scripts/autolandCore.ts). The
run's own status is red whenever a suite shard fails; its `land` job and
summary say what landed. To test a refused branch again without a new
commit: `gh workflow run autoland.yml -f branch=claude/NAME`.

Everything runs from source: no private build inputs, no `.w3x` build.
Runner placement comes from the reviewed `ts/runner-routing.json` file. Autoland reports and farm-test
Bun, Lua32 and check jobs use hosted runners (`premerge`). Balance, background
sweeps and the census use `farm-big` (`background`), preserving the background pool. Background sweeps on a push to main coalesce: a running sweep finishes, and a newer main replaces only the queued one, so the next run covers the newest main; dispatched and scheduled runs never coalesce. The `farm-runner` dispatch
input measures an alternative box for even Bun/Lua jobs on the first attempt;
retries ignore that override and select the plan's hosted output directly, including
when the original plan job's outputs are reused. No repository variable
controls runner placement. Farm and background planners read the workflow
revision's file, so measuring an older commit or bisecting a failing shard
does not depend on that old source containing current routing policy. Delete obsolete runner variables only after these
workflow versions are live on main.

The local `ts/scripts/jobWatchdog.ts` command observes only `autoland.yml` and
`farm-test.yml`. Its pure core uses real job start/finish timestamps, grouped
by exact workflow, job name and hosted/self-hosted class, from completed
successful or failed jobs in the previous seven days. Cancelled, timed-out,
skipped and unassigned jobs contribute no baseline. Missing comparable data
or fewer than five completed samples means observation only; each such key
logs as unbaselined once per monitor process. It never substitutes a guessed median. A completed
baseline refresh is required within 24 hours. Job history is cached outside
Git and refreshed separately from the 20-second monitor, with a bounded API
budget and a shared 3,000-call reserve.

Only a job whose status is `in_progress`, whose runner is assigned, and whose
execution exceeds twice that median can trigger cancellation. A run with an
in-progress land or queue job only alerts: "land in progress, not cancelled".
The protection is checked again before cancellation, including pending receipts.
Queue age is
never an execution deadline. The GitHub cancellation API stops the entire
qualifying run, including healthy sibling jobs; it cannot cancel one job.
After that run finishes, the workflow-run `rerun` endpoint retries that
qualifying run on hosted runners, including its healthy sibling jobs. Any genuine failed job recorded before or after cancellation
preserves the red result and prevents automatic test retries. Retry attempts
are excluded from watchdog cancellation, preventing a recovery loop. Atomic
local receipts track cancellation, notification and retry across restarts.
Autoland's cancelled plan job skips replanning so recovery cannot dispatch a
second fresh run alongside its rerun.

The existing `socrates-chat post --as smashcraft-lead` and `--as alerts` route
spools the same job/runner/elapsed line to the lead room and
`#socrates-alerts`. A successful command records local spool acceptance; the
relay's `socrates-chat log` proves delivery. No workflow secret or new
messaging integration is needed. Production runs through the Tom-only systemd
user units in `tools/job-watchdog/`, with Tom's home and alert spool, never
inside the Codex sandbox or a root service. Start the reviewed timer only after
its routing is live. The command defaults to observation;
`--apply` requires checked current main. An explicitly scoped `--probe-run`
allows only the owned `codex/autoland-job-watchdog` branch.

## Autoland sweep

No laptop service is on the landing path. While any `claude/` tip has a
pending `autoland` status or an Autoland run is unfinished, Autoland heartbeat
(smashcraft:.github/workflows/autoland-heartbeat.yml), one hosted job, starts
the sweep every 5 minutes; it stops after 10 empty minutes and hands off to a
successor after 5.5 hours. Every Autoland plan and every sweep starts a
heartbeat when none is running or queued, so a push restarts it. Each finished
Autoland or Farm test run also starts the sweep (skipped within 2 minutes of
the last one). GitHub's 5-minute schedule is a last resort: this repository's
schedules run about 6.5 hours late (#513). Stop the heartbeat with
`gh variable set AUTOLAND_HEARTBEAT --body off`, then cancel its run. The sweep lists
the unfinished Autoland runs with their jobs, and `stuckRuns` in
smashcraft:ts/scripts/autolandCore.ts cancels (force-cancels after 60 min)
any run where:

- a job waited more than 5 minutes for a self-hosted runner (no runner, or
  the runner or farm VM went offline), or 20 minutes for a hosted one;
- a job ran more than 15 minutes (the longest healthy landing job takes
  about 7);
- a test run executed more than 30 minutes, or a train or plan more than 45;
- a test run waited more than 5 minutes for its slot, or another run waited
  more than 5 minutes with nothing running in its concurrency group.

Once the cancelled runs finish, the sweep dispatches a plan, which tests
their lanes again in free slots and starts a train for tips that passed.
A plan refuses a tip already tested alone 3 times (a hang, train-failure or
retry loop) with a failed status; `-f branch=` retries it. While main has
been idle for 30 minutes with lanes pending, the sweep dispatches a plan
every time and opens the "Autoland stalled" issue, comments on it at most
every 30 minutes, and closes it once main moves. Prove the alarm without a
real stall with `gh workflow run autoland-sweep.yml -f landed=ISO_TIME`, which
treats main as last moved then; inject a stuck run with
`gh workflow run autoland.yml -f test="BRANCH SHA" -f slot=N -f farm-runner=LABEL`
(smashcraft#513).

## Sheriff

Main's last landing doesn't stay on main red. After each CI run on main,
"Main is red" first runs the sheriff (smashcraft:ts/scripts/sheriff.ts) on it.
The same holds for each Background sweeps run Autoland dispatches for a
landing: its `main-red` job waits for the sweeps and the census, then
dispatches the sheriff on that run, so a census regression reverts its landing
like a red CI step:

- **Revert.** The run failed at a step after setup, and main's previous
  finished CI run was green on an ancestor. Every commit from that green
  commit to the run's commit (the landing, or the whole train) is reverted as
  one `github-actions[bot]` commit on main, carrying `Sheriff-Reverts: SHA...`
  and the commits' `Refs smashcraft#N`. The sheriff dispatches main's CI for
  it and reopens every closed issue the commits reference
  (`Refs smashcraft#N` or a subject's `(#N)`). It posts no issue comments:
  the job summary and a `Sheriff` annotation (`gh run view RUN_ID`) name the
  reverted commits, the failing step and the run. No "main is red" issue opens for the reverted run; the revert's own
  CI run reports.
- **Report only.** A cancelled or timed-out run or job, a job without a
  failing step (runner lost), a failing setup step (checkout, Bun, install),
  a red parent (whether the same first failing step or a different one), a
  landing that is itself a revert, one that changes `.github/workflows/`
  (the workflow token can't push those) or one that doesn't revert cleanly:
  the job summary says why and "main is red" reports as before.

The decision is a pure function, checked on main's recorded runs of
2026-10-09 (smashcraft:ts/test/sheriff.test.ts). Rerun it on a run:
`gh workflow run main-red.yml -f run=RUN_ID`.
