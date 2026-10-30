# Online plan: real-path measurements

## One match through the deployed Singapore relay (smashcraft#833, 2026-10-30)

The laptop hosted slot 0 and gex45 joined slot 1 through the sgp relay on Nexus
(wisp afd5108e, unit started 8:13 PM UTC), at smashcraft 6afa76d173 with Wisp
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
