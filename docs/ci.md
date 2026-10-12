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
   a plan fills every free slot whose run fits 32 of the account's 40 hosted
   jobs at every moment: each run reserves the measured job profile `PROFILE`
   left at the new run's peak (15 jobs for 2.5 min, then decaying; a run with no
   `suite /` job yet counts 15), and logs "Autoland hosted jobs: N/32 now, M at
   the next peak". The train is never held by that budget. A lane whose first
   `autoland` status is over 60 min old goes ahead of every other, oldest first.
   Because tests run outside the landing queue, a red tip gets its failed status and run summary within minutes. A
   conflicting tip, or one that changes `.github/workflows/` (the workflow
   token can't push those), is refused. A green tip becomes "passed alone on
   MAIN as tree TREE".
3. **Train.** One train at a time takes up to 4 tips that passed alone, first
   passed first, and rebases them onto main. When the leader is the tree it
   passed alone plus only main commits that miss its paths (`pastMain`), it
   and up to one more such tip land without another suite (`trainStep`); any
   other train runs the gate and farm test once as one merged candidate.
   Every plan, standalone or ending a run, holds the `autoland-plan-step`
   lock, and a tip marked "waiting to test alone" under 2 min ago counts as
   testing, so no tip is planned twice (#515).
4. **Land.** Only when the suites pass on that exact candidate, main's known
   failures included (#394), and its regenerated reports meet their targets,
   main is fast-forwarded to it plus the reports commit, each branch's
   status becomes "landed as SHA" and its branch is deleted. If main moved
   while the train ran (a direct `safe-push` of a workflow change), the
   tested commits are rebased onto the new main and land without another
   suite when every new main commit misses the train's changed paths and
   the rebased tree is exactly the tested tree plus main's changes; a main
   commit touching a train path, `.github/workflows/` or
   `ts/scripts/autoland*` sends the tips to the next train (`pastMain` in
   smashcraft:ts/scripts/autolandCore.ts). Pushes made with
   the workflow token start no workflows, so the run dispatches main's CI,
   which runs only its smoke job for a landed commit.
5. **Red.** A red lone tip gets a failed status, and its run fails with a
   job summary and annotation saying "Autoland didn't land" and naming the
   files or tests. A conflicting rebase (injected proof lane for #513 box 9) comments once on each issue the lane's commits reference (Refs/Fixes #N) and raises the "Autoland stalled" alarm; when every conflict is a generated report (taken from main, then regenerated) or a build-inputs pin whose families merge file by file in a reachable store (`resolveConflicts` in smashcraft:ts/scripts/autolandCore.ts), it resolves them and the lane goes on, and source conflicts are never resolved (#513). Otherwise Autoland posts no issue comments: read outcomes with
   `gh run list --workflow autoland.yml` and `gh run view RUN_ID`, or the
   tip's `autoland` commit status. The branch stays; push a fix to it and it queues
   again. A red train of several tips sends each back to testing alone; the
   first to pass again on main leads the next train and lands without a
   suite.

A train landing past a moved main is checked by one docs-only direct commit pushed mid-train (#513).
A conflicting rebase is checked by injected lanes that conflict in a generated report, a build-inputs pin and a source file (#513).

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
sweeps and the census use `farm-big` (`background`), preserving the background pool. Background sweeps on main coalesce, whether pushed, dispatched or scheduled: a running sweep finishes, and a newer main replaces only the queued one, so the next run covers the newest main; runs on other refs never coalesce. The `farm-runner` dispatch
input measures an alternative box for even Bun/Lua jobs on the first attempt;
retries ignore that override and select the plan's hosted output directly, including
when the original plan job's outputs are reused. No repository variable
controls runner placement. Farm and background planners read the workflow
revision's file, so measuring an older commit or bisecting a failing shard
does not depend on that old source containing current routing policy. Delete obsolete runner variables only after these
workflow versions are live on main.

The Autoland sweep below is the only automatic canceller; the laptop job watchdog was removed after it cancelled healthy runs on stale code (#466, #513).

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

The sweep and heartbeat also list unfinished Farm test runs (each requested or finished one starts a sweep) and cancel them on the same job, run and pending bounds without requeueing, so `bun wisp farm test --wait` in safe-push fails within a minute with no summary instead of holding the landing lock.

Once the cancelled runs finish, and on every sweep while lanes are pending
and no plan is unfinished, the sweep dispatches a plan, which tests
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
- **Rerun.** A failure that measured nothing never reverts: a cancelled or timed-out job or step, a lost runner, a failing setup step or an `Unmeasured` error annotation (the census's "measured N of M") reruns the failed jobs once, then reports.
- **Report only.** A cancelled run, a red parent (whether the same first failing step or a different one), a
  landing that is itself a revert, one that changes `.github/workflows/`
  (the workflow token can't push those) or one that doesn't revert cleanly:
  the job summary says why and "main is red" reports as before.

The decision is a pure function, checked on main's recorded runs of
2026-10-09 (smashcraft:ts/test/sheriff.test.ts). Rerun it on a run:
`gh workflow run main-red.yml -f run=RUN_ID`.
