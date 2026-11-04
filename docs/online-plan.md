# Online plan: real-path measurements

## One match through the deployed Singapore relay (makgora#833, 2026-10-30)

The laptop hosted slot 0 and gex45 joined slot 1 through the sgp relay on Nexus
(wisp afd5108e, unit started 8:13 PM UTC), at makgora 6afa76d173 with Wisp
ed0634aa. `bun wisp net host --relay sgp --frames 7200 --script PAD` ran on the
laptop (37 ms from the relay) and `bun wisp net join CODE --frames 7200 --script
PAD` on gex45 (187 ms from the relay). The pad is `net-accept`'s generator at
seed 833: Blademaster against Warden on stage 6, three stocks, no time limit,
scripted presses for both slots. Evidence: `evidence/sc-833-online`.

Both sides reached the results screen at frame 1613 (match start at frame 213),
ran 7200 frames and compared 120 checksums with 0 mismatches.

- Round trip measured by the host's pings through the relay: 208.66 ms (joiner
  209 ms); the host set 7 frames of input delay.
- Map rollback (window 7, delay 3): depth p50/p99 5/5, max 5 on both sides (128
  rollbacks on the host, 131 on the joiner); lead p50/p99 5/6; 0 stalls.
- Transport: 15 slips on each side; 301 late frames on the host and 234 on the
  joiner; wait 7.5 s on the host and 7.0 s on the joiner over 120 s of wall time.
- Delivery to the host p50/p95/p99/max 180.93/198.8/230.95/351 ms; to the joiner
  59.83/69.3/104.12/707.47 ms.

Host report:

```
{"report":{"slot":0,"humans":2,"delay":7,"rttMs":208.66,"frames":7200,"checksumsCompared":120,"mismatches":0,"deliveries":1576,"deliveryMs":{"p50":180.93,"p95":198.8,"p99":230.95,"max":351},"stepMs":{"p50":1.24,"p95":5.06,"max":70.47},"slips":15,"lateFrames":301,"waitMs":7484.33,"packetsSent":10534,"packetsReceived":10446,"bytesSent":1601627,"bytesReceived":1531709,"largestSent":370,"largestReceived":389,"wallMs":120120.88}}
```

Joiner report:

```
{"report":{"slot":1,"humans":2,"delay":7,"rttMs":209,"frames":7200,"checksumsCompared":120,"mismatches":0,"deliveries":1607,"deliveryMs":{"p50":59.83,"p95":69.3,"p99":104.12,"max":707.47},"stepMs":{"p50":0.83,"p95":2.27,"max":29.94},"slips":15,"lateFrames":234,"waitMs":6962.39,"packetsSent":10459,"packetsReceived":10520,"bytesSent":1606529,"bytesReceived":1526140,"largestSent":396,"largestReceived":363,"wallMs":120112.38}}
```

## Correction smoothing and prediction at 1 frame of delay (makgora#1122 part 7, 2026-11-05)

At 1 frame of input delay a rollback at 150 ms round trip moves a drawn fighter
more than 20 world units about as often as at 2 frames (87 against 83 over the
4500-frame soak). The cost is visual, so the native window now eases it: when a
rollback moves a fighter, the drawn body stays where it was and closes 30% of
the remaining offset each tick, snapping when the offset is over 160 units or
the fighter leaves the stage (`ts/src/host/loop/correctionEase.ts`). The offset
lives in the presentation only; the simulation, replays and checksums never see
it.

Command, on the laptop (whiterabbit) under perf-window's quiet native lease:
`bun scripts/perf-window.ts --here --resolution 2880x1920 --preset High --stage
Blackrock --online 150,300 --jitter 10 [--input-delay 1]`, four fighters, 3600
measured frames after 900 warmup frames. The scripted match is deterministic:
the laptop's counts without smoothing equal gex45's from part 3 exactly.

- Corrections: rollbacks that moved a fighter in the simulation more than 20
  units, host + join.
- Drawn jumps: ticks whose drawn body landed more than 20 units off where it
  would have been drawn without the correction, after the ease, host + join.
  Without smoothing every correction is a drawn jump.

150 ms:
- Delay 2, no smoothing: 83 corrections (52 + 31), so 83 drawn jumps, 66 per minute.
- Delay 1, no smoothing: 87 (48 + 39), so 87 drawn jumps, 70 per minute.
- Delay 1, smoothing: 87 corrections, 3 drawn jumps (3 + 0), 2.4 per minute; largest 252 units, a snap.

300 ms:
- Delay 1, no smoothing: 127 corrections (69 + 58), 102 per minute.
- Delay 1, smoothing: 127 corrections, 49 drawn jumps (40 + 9), 39 per minute.

Rollbacks per second 2.80 / 3.72 (host / join) in every delay-1 run, depth
p50/p99/max 5/5/5 and 4/5/5 at 150 ms, 7/7/7 and 6/7/7 at 300 ms; 75 checksums
compared with 0 mismatches in every run. Worker frame (step+encode) p99, host / join: 2.66 / 2.84 ms
without smoothing and 2.89 / 2.85 ms with it at 150 ms; 2.60 / 2.63 and 2.94 /
3.08 ms at 300 ms. The first smoothing run overlapped about 6 cores of
unleased builds (load 8 to 13) and read 4.2 to 9.6 ms p99 with the same counts;
the rerun above is the clean one.

Prediction was already what part 7 asked for: a remote player's missing row
repeats its held buttons, stick and triggers and drops every edge (pressed,
released, special and dodge directions, SDI, throws), in `predictInto`
(`ts/src/game/input/inputRow.ts`), which Wisp's schedule calls as the codec's
`hold`. The soak now counts mispredicted frames, speculative frames that ran a
remote row its accepted row then contradicted: 5.60 / 4.65 per second at 150 ms
and 4.99 / 3.72 at 300 ms (host / join), the same with and without smoothing,
since smoothing changes no input. That is two frames per rollback: each
scripted tap's press frame and its release frame. Neither is predictable from
the previous row, so no cheaper guess was built.

## Lua32 rollback cost at input delay 1 against 2 in the Warcraft build (makgora#1122 part 8a, 2026-11-05)

The question: can the Warcraft build play at 1 frame of input delay, as the
native window does since part 6, without breaking the frame budget the perf
gate holds? The gate holds p99 ≤ 10 ms and worst ≤ 14 ms
(makgora:ts/scripts/wisp/perfBudget.ts).

Setup:

- Run: `PERF_INPUT_DELAY=N bun wisp perf playable-human-four --samples --out
  FILE`, then `bun wisp perf budget FILE`.
- Match: four human peers on the fixed key tape, 1800 measured callbacks, on
  the playable build (Classic, window 7).
- Delivery: Battle.net's measured turn model, 80 ms one way and 25 ms turns
  with the measured extra-turn spread (`syncDelivery(MEASURED_BATTLE_NET)`).
  Online-rollback.test.ts uses the same model.
- `PERF_INPUT_DELAY` sets the host's manual delay on every peer before the
  match starts, the way the lobby control does. It is new in this change
  (makgora:ts/scripts/wisp/perfLua.ts). With it set, the run prints each
  peer's agreed delay, rollbacks, depth p50/p99/max and callbacks held at the
  window edge.
- Machine: the laptop, under a moderate machine-capacity lease, load about 6
  on 24 cores. The frame costs are not wall-clock times. The gate predicts
  Warcraft milliseconds from each callback's Lua instructions, native calls
  and allocation (`nativeFrameCost(WARCRAFT_COST)`, Wisp), so they don't
  depend on the host machine or its load. The same runs give the same
  numbers on gex45 or CI.

Each line gives the four peers.

- **Delay 1:**
  - rollbacks/s: 8.30, 8.17, 8.23, 8.27
  - depth p50/p99/max: 5/7/7 on all four
  - held at the window edge: 994, 1007, 991 and 994 of 1800 callbacks
  - p99: 8.22, 8.18, 8.12 and 8.14 ms
  - worst: 9.38, 8.94, 9.35 and 9.36 ms
  - worst catch-up callback: 8.93, 8.94, 8.69 and 8.95 ms (budget 10)
  - no desync
- **Delay 2** (the same numbers as the Auto run, which also agreed 2):
  - rollbacks/s: 8.07, 8.03, 8.03, 8.23
  - depth p50/p99/max: 5/7/7 on all four
  - held: 899, 880, 892 and 887 of 1800
  - p99: 8.07, 8.01, 8.05 and 8.06 ms
  - worst: 10.00, 9.51, 9.99 and 10.20 ms
  - worst catch-up callback: 8.73, 8.32, 8.73 and 8.73 ms
  - no desync

Worst-frame Lua at delay 1 is 9.38 ms, under the 14 ms budget and below
delay 2's 10.20 ms. Its p99 rises by about 0.15 ms, and every peer stays under
10 ms. Depth is the same at both delays because the window caps it at 7. Delay
1 rolls back about 2% more often and holds about 12% more callbacks at the
window edge.

**Decision under the rule:** the universal 1 applies to both builds.
`PLAYABLE_BUILD` plays 1 offline and is Auto's floor online, the same as the
native window, so the separate `NATIVE_PLAYABLE_BUILD` is gone.

On Battle.net the cost is the held callbacks, not the frame time. At a 160 ms
round trip Auto now agrees 1 where it used to agree 2. The host can still
raise the delay, and error correction raises the next match's delay when
prediction holds. Battle.net is not the competitive path (Tom, 2026-10-30).
