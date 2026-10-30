# Net accept

- Online acceptance (wisp#112): `bun wisp net-accept --out DIR` plays full
  three-stock matches between two standalone processes through Wisp's delay
  and loss proxy, with scripted presses drawn from `--seed`, and reports, for
  each round trip, the checksums compared, mismatches, rollback depth and
  presses lost or extra. `--matches` (20), `--frames` (7200), `--jobs` (3),
  `--rtts` (0,60,120 ms) and `--loss` (0.01) set the run's size;
  `--four-fighters` measures a windowed four-fighter match at each requested
  round trip through the same delay and loss proxy. It logs requested delay,
  loss and measured round trip, stores each run under DIR/rtt-MS, and requires
  both windows to have `presentedMs.p95` at most 16.7 ms.
- Outside a capacity scope it admits itself through machine-capacity, as
  moderate for one job and heavy for more, and it runs at most one match per
  two CPUs of its scope, so a run never starves its own handshakes.
- Each side's log, pad script and standalone result land under DIR; the
  command exits non-zero when any round trip fails (smashcraft:ts/scripts/wisp/netAcceptance.ts).
