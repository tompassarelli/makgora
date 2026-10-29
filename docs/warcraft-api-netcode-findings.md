# Warcraft API and netcode findings

Historical record: the captures, trial tables and asset measurements below describe their named builds before the 9 October 2026 roster cut (#339). They are not the current roster or asset inventory.

Reusable Warcraft API and netcode findings from Smashcraft trials, each with the build it was observed on. Status and open decisions live in roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16); raw trial records live in smashcraft:evidence/. General Warcraft guidance is in the warcraft-modding skill and its api-gotchas reference.

## Earlier rejected ingress paths — 4 October

The serial keyboard/file-ACK replacement is rejected: native five-second trials
confirmed only 36–50 frames, with median ACK waits of 81–92 ms. Its first
original-frame tap does not establish usable throughput. Removing synchronized
carrier-key registration did not fix the delay. Evidence:
smashcraft:evidence/keyboard-mailbox-20261004/README.md.

The earlier bounded one-packet read check showed delayed delivery rather than a
permanently dead receiver: both clients received the packet and fixed markers,
confirming frame2, with own-receipt ages801.025/817.627ms. Sending on the next
callback did not avoid the delay. Adding the normal preload start/end calls
also failed to repair it (631.836/698.486ms). The same compiled Lua map was used
for both checks; this does not establish eventual delivery for native JASS59.
Evidence: smashcraft:evidence/journal-read-boundary-20261004/README.md. Its proposed
keyboard-state replacement subsequently failed the native throughput trials
above; it is not the selected playable input path.

**Usable game:0.0.40, restored in a two-client fight. Failed controller experiment:59.** Internal diagnostic
numbers41–59 are not successive delivered game releases. Release status and
experimental run identity are tracked separately from now on.

The two-client gameplay result below remains delivered. The responsive keyboard
path serves the digital controller mapper reported usable by the operator.
Arbitrary original-frame controller edges through service stalls remain open.

Selection isolation54 passed saved controls, while55/56/57 reproduced the
pre-input disconnect;57 had only the order diagnostic setup added. Moving this
probe out of gameplay closed selection in full58/59. Full58 then exposed native
checksum thread exhaustion. Fragment-bounded hashing passed the existing
checksum/rollback test and allowed59 to complete both pre-read ready messages.

59 retained both helper taps at originalframes19 and97 (second during~250ms
helper stop), but both native clients sent32 packets/64rows and received none
in the trace; confirmation remained0. Reject59 as the gameplay replacement.
Keep the exact counterexample for the owning post-read delivery repair.
Evidence is in smashcraft:evidence/journal0059-evidence-20261004/; controller
latency, original-frame application and pause/stall guarantees are not proven.
No alternative has beaten the delivered direct-sync baseline.

**Populated preload-file ingestion reproduces the seconds-long backlog.**
The same two Warcraft III 3.0 clients ran exact Smashcraft 0.0.24, build
`netcode-0024`, SHA256
`1aa3895cbc98919fe7c300d8e71863e79faae853322bcde3b027b0c05e4c6a0f`.
Fresh readiness identified two human fighters in slots 0 and 2. Both were in
MATCH, with spare slots closed. Sequential arms offered 300 messages per client
at 30 Hz through the same `SC_GP` registration and receiver.

| Arm | A mean / maximum echo | B mean / maximum echo | What changed |
| --- | --- | --- | --- |
| Generated 16-byte messages | 95 / 215 ms | 87 / 215 ms | No file read or input admission |
| Populated-file 16-byte messages | 3,989 / 7,555 ms | 4,146 / 7,789 ms | Fresh immutable preload filenames and the actual FileIO read |
| Generated production I4 packets | 100 / 229 ms | 97 / 213 ms | Production decoding, original-frame admission, sending and receipt; neutral two-row inputs, no files |

All 300 messages arrived in each arm/client. Reported missing, duplicate,
failed-submission, unexpected-packet and file-validation counts were zero.
The file-backed arm's first 30 messages averaged 809/778 ms, increasing to
6,745/7,025 ms for its last 30 (A/B). The generated arms did not develop that
backlog. Both final exports appeared about 37.25 host-wall seconds after the
trigger, versus about 36.8 native-game seconds.

These are native submission-to-own-receipt ages, not physical controller-to-screen
measurements. A/B strings have matching lengths but distinct diagnostic labels.
I4 sent 2,384 payload bytes/client, versus 4,800 for each 16-byte arm, and used
neutral input rather than ordinary combat. Arms were sequential. Their ending
simulation frames differ; the exports do not prove paired terminal checksums.
The result narrows the slow behavior to populated-file integration under these
conditions. It does not yet identify which operation inside that path causes it.

Evidence: `smashcraft:evidence/native-journal-packet-comparison-20261004/isolation0024/`.
Details: `smashcraft:evidence/native-companion-landing-result-20261004.md`.

Earlier 0.0.23 missing-file trials delivered all 60 messages/arm/client with
about 91–111 ms mean echo. Repeated missing-file reads alone did not reproduce
the production delay. A missing-file result does not establish populated-file
cost. Native timers reported zero read duration at their displayed precision
even in the slow populated arm; they do not establish zero blocking wall time
inside callbacks.

## Follow-up: fresh paths alone did not reproduce the backlog

The same retained clients ran exact Smashcraft 0.0.28 / `netcode-0028`, SHA256
`38d3fd123d2818d0e16e14b58b23cebb467b0ef1cc79067d8ea8f78077646fae`, in
MATCH with human slots 0 and 2 and spare slots closed. Ctrl+P offered 100
messages/client/arm at 30 Hz through `SC_GP`. Every arm used the same 16-byte
value, with a six-byte arm/sequence envelope: 22 bytes/message, 2,200 bytes/arm.

| Arm | A mean / maximum echo | B mean / maximum echo |
| --- | --- | --- |
| Repeated populated filename | 97 / 166 ms | 94 / 158 ms |
| Fresh populated filenames | 132 / 242 ms | 139 / 249 ms |
| Tooltip set/get/clear without Preloader | 108 / 220 ms | 105 / 193 ms |

Every arm/client received 100/100, with zero reported bad payloads, local read
errors, failed sends or duplicates. Native phase spans were 3.433, 3.466 and
3.432 seconds. Host-observed exports finished about 10.577 seconds after the
trigger. Both clients read their own local fixtures named for slot 2; that
filename does not identify the observer or sender.

This falsifies fresh filenames as a sufficient explanation under this bounded
workload. It does not contradict the 0.0.24 reproduction: that arm used changing
file contents and 300 samples, whereas this run used constant file contents and
100 samples. Payload envelopes and diagnostic drivers also differ. Changing
contents and longer sustained runs remain deciding tests; do not diagnose
Preloader, tooltip updates or an engine limit from these observations alone.
No physical response, paired checksum or 60 Hz claim follows from this probe.

Evidence: `smashcraft:evidence/native-journal-packet-comparison-20261004/fileio0028/`.

## Longer changing-content reproduction on 0.0.28

The same 0.0.28 match subsequently ran the earlier Ctrl+B diagnostic, with 300
messages/client/arm at 30 Hz. Generated 16-byte traffic averaged 93/86 ms,
changing file-backed 16-byte traffic 2,730/2,884 ms, and generated production I4
88/95 ms (A/B). Every arm/client received 300/300 with zero reported duplicates,
failed submissions, file-validation failures or unexpected packets.

The file arm's first 30 averaged 661/654 ms, rising to 4,077/4,313 ms for its
last 30. Maximum ages were 4,977/5,111 ms, with 241/251 drain callbacks. It again
reproduced growing delay while generated arms stayed near the fast baseline.
Its native spans totaled 34.165/34.331 seconds. The initial host watcher used
incorrect build-specific receipt names; exports actually use
`wc3-melee-transport-isolation.txt`. Embedded `netcode-0028` identity was checked
when collecting them afterward. No precise host export-observation latency is
claimed for this run. Ending I4 simulation frames/checksums differ.

This strengthens the reproduction but still does not isolate changing tooltip
content from duration or diagnostic-driver behavior. The next discriminator
uses 300 changing values and a shared 30 Hz driver for generated, tooltip-only
and fresh-file arms.

Evidence: `smashcraft:evidence/native-journal-packet-comparison-20261004/isolation0028/`.

The 0.0.28 order ready receipts identify existing owned Footmen and enabled
selection, but immediate selected flags were zero. Native details later showed
a Footman. Neither a held Stop hotkey nor a real UI right-click produced an
exact-carrier receipt. Selection/command UI usability remains unproved; this
is a harness boundary, not a native-order latency or reliability verdict.
Evidence: `smashcraft:evidence/native-journal-packet-comparison-20261004/order0028/`.

## Matched changing-content discriminator on 0.0.29

Both retained clients ran exact Smashcraft 0.0.29 / `netcode-0029`, SHA256
`c151677f5decc8172a27c61fc39a3268c323ff68f5d24e9453aa599e8fe2591b`, in MATCH
with slots 0/2 and other slots closed. Build passed with zero errors/18 warnings.
All arms offered 300 changing 16-byte values/client at 30 Hz using a shared
independent driver, a six-byte arm/sequence envelope, and the same `SC_GP` route.

| Arm | A mean / maximum echo | B mean / maximum echo |
| --- | --- | --- |
| Generated changing values | 99 / 125 ms | 89 / 125 ms |
| Changing tooltip set/get/clear, no Preloader | 116 / 235 ms | 110 / 235 ms |
| Fresh populated-file reads, changing values | 3,101 / 5,819 ms | 3,195 / 5,862 ms |

Each arm/client sent 6,600 bytes and received 300/300. Reported missing,
bad-payload, local-read-error, failed-send and duplicate counts were all zero.
The file arm required 157/155 drain callbacks and spanned 15.229/15.163 native
seconds, versus approximately 10.1 seconds for each preceding arm. Final
receipts were host-observed at 35.768/35.829 seconds after the trigger.
Both clients read their own local s2-named fixtures.

Changing tooltip operations alone did not reproduce the delay at matched
sample count, offered rate and payload size. The populated-file path still
reproduces it. This rules out tooltip set/get/clear alone as a sufficient cause
under these conditions, but does not yet isolate Preloader execution from the
FileIO wrapper or the content-sensitive behavior seen in the shorter constant
trial. Native displayed read duration remains zero and does not measure wall
blocking. These are sequential game-clock own-echo measurements; no physical
response or full competitive acceptance follows.

Evidence: `smashcraft:evidence/native-journal-packet-comparison-20261004/fileio0029/`.

## What the actual pinned libraries do

The historical map used for these library observations was Wurst compiled to
Lua for Warcraft III 3.0. Its recorded compiler and standard-library identities
were declared in that revision's `smashcraft:wurst-toolchain.lock`:
compiler `9913e1bd300c2053637d756a11bae8c3c8ed568f`, standard library
`bb1e0458db5a372ba2a6928112452785e435d01a`.

The pinned `FileIO` read calls `Preloader(filename)`, reads ability-tooltip
chunks through `BlzGetAbilityTooltip`, and clears consumed chunks through
`BlzSetAbilityTooltip`. It returns local data and does not itself call GameCache
sync or `BlzSendSyncData`. The pinned modern `SyncSimple` uses
`BlzSendSyncData` and sequences queued transfers. Our production input sender
calls `BlzSendSyncData` directly. The 2018 GameCache-based Wurst tutorial does
not describe this modern wrapper's implementation.

## Prior art and API alternatives

Warcraft's deterministic-lockstep model makes ordinary player commands a useful
baseline. Each client simulates shared gameplay from delivered commands. The
model does not imply that every local/native value is shared, nor that our
fighter simulation receives rollback automatically.

| Path | Relevant evidence | Decision still requiring a native measurement |
| --- | --- | --- |
| Direct `BlzSendSyncData` | Current generated-message and generated-I4 runs deliver quickly; production file-backed traffic falls behind | Sustained ordinary input payloads and capture-to-presentation behavior after root repair |
| Real player orders, ability or shop commands | These use Warcraft gameplay command/event mechanisms | Actual local UI command, both-client event receipt, hotkeys/selection, release/held/analog and frame semantics |
| Selection-encoded integers | TriggerHappy `SyncInteger` v1.2.1 transports digits through selectable dummy-unit events, with completion/sign markers | Sustained useful payload width/rate, integrity, event overhead and player-selection interference |
| GameCache integers plus selection marker/acknowledgement | Historical Wurst tutorial and TriggerHappy `Sync` v1.3.0 use this mechanism | Current-build capacity and ordering; small keys and packed integer payloads under a matched workload |
| Synchronized key events | Existing native baseline; down/up and modifier registration are available | Repeat, focus and receipt delay on the actual build; receipt time is not original capture time |
| Local key polling | Warcraft 3.0 declarations support polling | Actual callback cadence; short transitions between polls can be missed |

Scripted `Issue*Order` calls are not an established substitute for a real local
player command. A proxy must receive real UI/player actions before its transport
performance can be assessed. Local `SelectUnit` is a distinct, historically
demonstrated networking mechanism. Selection dummies must be selectable; Locust,
selection limits and transient UI state matter. A 31-unit selected bitset is not
a valid full-width encoding within Warcraft's ordinary 12-unit selection limit.
Small-value tests cannot establish general 32-bit throughput.

The 0.0.24 order probe wrote paired ready receipts, but the first real Stop
attempt produced no order receipts. Selection/hotkey/command usability remains
unproved; this is not evidence that native orders are slow or unreliable.
Evidence: `smashcraft:evidence/native-journal-packet-comparison-20261004/order0024/`.

## Historical claims and their limits

- The [2020 desync thread](https://www.hiveworkshop.com/threads/desync-2-possible-causes-found.323158/)
  estimates approximately 5,000 integers/minute without a benchmark, exact
  encoding or a defined current build. This is a lead, not a modern sync quota.
- The [2018 networking tutorial and follow-up](https://www.hiveworkshop.com/threads/wc3-networking-crucial-component-of-codeless-save-load.304287/)
  describe GameCache sync followed by a selection completion marker. The author
  reports roughly 4 KB/s initially, falling to 1 KB/s, and says later orders/chat
  can wait behind a large `SyncStored*` transfer. These are historical reports
  for that mechanism, not current `BlzSendSyncData` measurements.
- That discussion identifies cache/mission/key strings and per-call overhead,
  short keys, and 32-bit integer packing as performance considerations.
  Convenience or age alone does not rank the APIs.
- TriggerHappy's [selection transport](https://www.hiveworkshop.com/threads/syncinteger.278674/)
  carries the integer itself. His [GameCache sync library](https://www.hiveworkshop.com/threads/sync-game-cache.279148/)
  sends GameCache values and uses selection-based acknowledgements from clients.
  These are different mechanisms. Public source visibility is not permission to
  copy code; this record summarizes mechanisms and cites sources.
- The same 2018 discussion says `SyncStoredString` failed on its tested version.
  Escape-count encoding uses one event per count and competes with player Escape
  presses; its small action size does not imply an efficient general channel.
- Historical TCP/6112, relay-host and bandwidth descriptions need a version and
  hosting context before being applied to current Battle.net. An old host player
  is not assumed to be the current network relay.

Community API documentation, pinned source:
[common.j at d49b2ba](https://github.com/lep/jassdoc/blob/d49b2ba47c72ad757aa17abdfa9ccd55a7493fd5/common.j),
[BlzSendSyncData](https://lep.nrw/jassbot/doc/BlzSendSyncData),
[Preloader](https://lep.nrw/jassbot/doc/Preloader).
Preloader annotations report per-path caching and Lua-map Jass2Lua execution;
version scope matters. This is not an ordinary fresh file read. Fresh paths,
same-path changes, missing files and populated files require separate checks
when the choice affects live input.

## Terrain height and determinism

`GetLocationZ` is explicitly asynchronous in the native documentation. Height
can vary with platform, graphics/assets, walkable destructables or terrain
deformation. It cannot become shared collision or combat truth without a shared
representation. The Hive thread's later discussion connects unit fly height to
vision/occlusion; it does not establish that every local fly-height change is
safe or that every call desyncs.

The scoped authored-source trace found one `GetLocationZ` call in
`smashcraft:wurst/Melee.wurst`, initializing `floorHeight`. Its consumers position
effects and audio. The native fighter's fly height is independently calculated
from `1800 + z`; authored fighting geometry is separate. This trace did not find
the local terrain height feeding fighter collision/combat or native unit height.
It does not establish complete cross-platform determinism, and it does not
explain the measured file-backed queue growth.

## Lua numbers in the game

Warcraft's map Lua uses 32-bit integers (`math.maxinteger` is 2147483647) and
binary32 numbers. Integer arithmetic wraps silently past 2^31. Host Lua,
JavaScript and the Wurst test interpreter differ from it: stock Lua and
JavaScript use 64-bit integers and binary64 numbers.

Its float arithmetic is not consistently IEEE round-to-nearest. Multiplication
and addition can land one ulp toward zero, division one ulp away from nearest,
and a decimal numeral that isn't exactly binary32 can read as the binary32
below the nearest; `1 + 3 * 2^-24` returns exactly 1. (`1/3` and
`tonumber("0.1")` did round to nearest in one probe.) The exact rounding
model is unknown. Synchronized simulation therefore uses only exact operations:
integer arithmetic below 2^31 (division as Lua `//`), scaling by powers of two,
and the Binary32 helpers, whose integer-limb implementation matches host
results bit for bit in the game. A raw float product in Melee sine/cosine
differed by one ulp in 150 of 600 results until it used `multiplyFloat32`.
No host test reproduces the game's raw float results.

Until Wisp a382883, `f32(a op b)` compiled to the raw operator, so every
synchronized `f32` sum and product could differ from Bun by an ulp. In the
0.0.48 bot session no native moment replayed headlessly (#59). The first
differing state was at frame 0: the Rifleman's `aerialJumpSpeed`,
`f32(melee(4.1) * 0.94)`, was 23.12399673461914 in the game, the exact product
rounded toward zero, and 23.123998641967773 on the host. A 32-bit Lua whose raw
`+ - *` round toward zero landed one of the five moments on its recorded
checksum, which no round-to-nearest runtime did. It still diverged on the others,
so toward-zero is not the whole model. Wisp now compiles `f32(a + b)`,
`f32(a - b)` and `f32(a * b)` to exact binary32 operations. Evidence:
smashcraft:evidence/native-divergence-20261006/README.md.

Raw division and literals still differed natively until Wisp 6c466bb. In the
7 October Rifleman pad run (Wisp e74e784), every fighter line matched the
headless run, but the camera and the pose rate did not. The native camera,
recovered from the trace checksums, settled where Warcraft's quotient
379.64484f / 0.49583164f was 765.6729126. The nearest binary32 is 765.6728516.
The native pose rate 2.5005886554718018 is `1.417f / (34 * FRAME_SECONDS)`
with the literal `0.016666667` read as 0x1.11111p-6, the binary32 below the
nearest. Wisp now compiles `f32(a / b)` to the exact `divideFloat32` and
prints literals as exact hexadecimal floats. Its toward-zero Lua32 also rounds
`/` and decimal numerals toward zero, so tapes catch both. Evidence:
smashcraft:evidence/native-camera-divergence-20261007/README.md.

`string.pack`, `load` and `math.type` are available to map code. Evidence:
smashcraft:evidence/warcraft-lua-numbers-20261005/README.md.

## Preloader reads in the game

`Preloader` checks on every call whether the file exists, but runs the content
it first read from a path for the rest of the session. Rewriting, or deleting
and re-creating, a file under a name the map has already read returns the old
content. A path that was missing when probed is read once it appears. Anything
the map reads more than once from a host-written file therefore needs a new
name for new content. Hot reload numbers its manifests and names its chunk
files by payload checksum. Evidence:
smashcraft:evidence/warcraft-preloader-cache-20261005/README.md.

## Ending a Battle.net game from script

`EndGame(false)` called on every client on the same frame of a two-player
Battle.net custom game (Warcraft 3.0.0.24268, 5 October) left both clients
showing a black frame indefinitely. They were idle, ignored keys and Alt+Enter,
and recovered only by closing the game and pressing Play in the still
signed-in launcher. Leave a multiplayer game through the game menu
(F10, E, Q) instead.

## Input and rollback claims we can make

The actual Linux companion retained tested queued kernel events and original
timestamps through approximately 250 ms helper/game stops. This is bounded
event-retention evidence, not an unconditional every-frame physical guarantee.
Polling can miss a whole press/release between samples. Device non-reporting,
kernel queue overflow/disconnect, or events older than an already-published
interval cannot be reconstructed; detected loss must not silently become a
newer-frame input.

[GGPO](https://www.ggpo.net/) requires deterministic stepping, complete save/load
and continued network servicing; prediction stops at its configured limit.
[Slippi](https://github.com/project-slippi) is relevant rollback/input prior art,
but an emulator's facilities do not establish Warcraft's facilities.
Rollback repairs late correctly captured/framed inputs; it cannot recreate
uncaptured input, repair an unknown clock offset or hide multi-second delivery
with our tested 24-frame window (400 ms at 60 Hz).

Continuing update callbacks prove neither inexpensive callbacks nor smooth
rendering, wall-clock cadence or harmless OS scheduling/GC. Matching eventual
checksums prove neither low latency nor fairness. Cross-machine frame epochs,
drift and pause policy remain unresolved. W3Champions/FLO-style hosting may
change delivery and jitter; equalization deliberately delays faster paths.
Neither fixes uncaptured events or wrong frame assignment. A native matched
hosting comparison remains unproved.

## Synchronized input transport

Each client sends its journal's admitted rows in one `SC_GP` message every 6
callbacks (10 a second at 60 callbacks a second), and sends at once on the
callback that admits a row with a new press. A token bucket caps both: a
message spends 6 callbacks of credit, credit refills one a callback up to two
messages' worth, and nothing is sent without a message's credit, so the
average stays at 10 a second, a burst is at most two messages, and the
6-callback cadence is never delayed. The one exception is a press right
after a message that held one, such as an ultimate's second press one
callback after its first: it goes out on any credit not below zero, so the
two presses are the two-message burst, and credit may fall to one message
below zero until the cadence refills it. No three messages go on
consecutive callbacks (#215,
smashcraft:ts/src/game/netcode/journal/transport.ts). A message carries
every admitted frame not yet sent, in order, as an I5 message
(smashcraft:ts/src/game/input/wire.ts): the first frame's row, then only rows
that differ from holding the row before them, each after a count of held
frames. A hold keeps held buttons, stick and triggers and drops edges, press
vectors and throw taps, exactly as remote prediction does, so holds cost no
bytes and never cause a rollback. Receivers expand every frame and accept
them through the unchanged ledger.

Warcraft limits a synchronized message's prefix and data together to about
255 bytes ([BlzSendSyncData](https://lep.nrw/jassbot/doc/BlzSendSyncData)).
Messages stop at 200 data bytes, which still carries 8 frames whose every
field changes, so a backlog after a stall drains faster than 60 frames a
second arrive. `-dev batch N` selects N callbacks per message (1–12) for the
next match; the integrity capture's `--sweep RB:BATCH` commands it.

Why: on 0.0.42 r8, both players' echo stayed at about 110–150 ms with sparse
input at 15 paired I4 messages a second, then grew to 1–2 seconds once input
was dense and never drained; at 30 messages a second it grew within 3 seconds.
91% of late local starts were prediction stalled at the 24-frame window waiting
for those rows. Replayed through both senders headlessly, r8's recorded rows
cost 15 messages and 358–458 bytes a second paired, and 10 messages and
150–166 bytes a second as I5.

## Catching up after a stall

The companion helper assigns each row by its own clock, `segment_frame +
floor((t − epoch)·60/1e9)`, so it keeps journaling 60 frames a second whatever
the game does. Each 60 Hz callback admits the local journal's rows, runs
confirmed frames on accepted rows, reconciles, and runs speculative frames on
local rows and predictions (smashcraft:ts/src/host/loop/rollback.ts).
When the game loses time — a stall, or a game clock behind real time, as
saturated clients showed (wisp:docs/network-model.md) — the helper is ahead
by the lost time, and only running more than one frame a callback brings the
simulation back to real time.

Until #48, admission took one journal record a callback, and wc3-journal sends
two rows a record: catching up ran at most two frames a callback, one more
than real time adds. In two headless clients of the playable build with
Battle.net's measured latency, a 2 s stall took 2 s to recover; a game
that runs fewer than 30 callbacks a second never recovers, and its inputs
reach the screen later and later until the helper's 120-record output queue
fills (4 s), then stay that late, the lasting slowdown the 0.0.47 playtest
reported (#48).

Since #48, `CATCH_UP_FRAMES` (smashcraft:ts/src/game/session/playback.ts) bounds
every callback alike: at most 6 admitted rows, 6 confirmed and 6 speculative
frames, the confirmed and speculative limits it had before. A sender may admit
`FUTURE_LIMIT` = 128 frames past its confirmed frame (64 before): while catching
up at 6 frames a callback, the rows between admission and confirmation (a
message every 6 callbacks, then the echo) exceeded 64 and held admission.
A receiver takes a row up to `FUTURE_LIMIT` past K, never past its own
confirmed frame: K is common and never ahead of the sender's confirmed frame,
so every client accepts every admitted row alike. Measured from the
receiver's own confirmed frame, a client that came out of three 2 s stalls
behind refused rows its peer had already admitted (`tooFarAhead`), the ledgers
parted, and the match froze on network seeds 11 and 14 of
smashcraft:ts/test/local-start.test.ts.
smashcraft:ts/test/lag-recovery.test.ts stalls both games, then one, for 2 s
in a two-client playable match with a computer fighter and #26's dense taps:
both clients are back to their pre-stall lag within 47 callbacks (0.78 s),
no callback runs more than 6 frames of any kind, every confirmed frame ran
the rows its helpers journaled for it, and the confirmed checksums are equal.
Over seeds 7, 11, 13 and 17 and three stall times the recovery took
0.70–0.85 s; with 4 frames a callback, up to 1.07 s.

The helper's rows reach the map as text typed into its edit box, and
Warcraft takes that text at a cost that grows with how much it takes at once.
In 0.0.48's native bot session (smashcraft:evidence/bot-session-0048-native-20261006/),
after each 2 s stop of client B its helper typed the 16 records its window
allowed, 608 characters, in one go: B's receipts then came about 280 ms apart
instead of 100, each time with all 16 records, and the helper's clock stayed
15–25 frames ahead of what B consumed for 5 s (40 s with four fighters).
Catching up faster made it worse: B consumed records sooner, which opened
the helper's window 16 at a time. The same bursts, 13 records and more, came
30 times on each client in that session's #26 rematch, which had no stop: the
loaded host put the helpers behind, and the late local starts and prediction
stalls followed. The pre-#48 map took at most two rows a callback, so the
helper typed at most about six records at once.

So the helper types at most 160 characters past the record the map's receipt
says arrived, and while a record waits untyped, contiguous row packets pack
into the existing I5 message format (at most 64 frames). Holds omit repeated
rows; every press and release remains on its original frame. A message joins
the waiting record only when its complete envelope still fits 160 characters
(smashcraft:controller/README.md). Dirty text receipts
are written every two map ticks, at most 30 per client per second, so the
smaller typing window drains within the recovery budget. The map admits a joined
record's rows within the same per-callback budget, over as many callbacks as
it takes. smashcraft:ts/test/lag-recovery.test.ts charges each frame's typed
text as Warcraft's stop, 0.00003 frames per character squared, with the
callbacks Warcraft owes then caught up 10 a frame: the old typing never
recovers from a 2 s stall there and needs 0.8 s after a 0.5 s one, with late
local starts; with these limits a 2 s stall takes 21 callbacks, and after
#26's 250 ms stall every press starts within a callback of its capture.

A player on the keyboard fallback (#46) has no helper: the map polls their
keys once a callback, so their clock counts callbacks and loses the stalled
time with the game, while another player's helper journals on. The
confirmed match then waits on the keyboard's rows and the helper player's
input stays as late as the stall was, for the rest of the match. The
keyboard's clock therefore follows the furthest frame another player has
already sent (`ShadowInputSchedule.othersThrough`), its rows admitted under
the same `CATCH_UP_FRAMES` cap. In `bun wisp soak --policy absent --matches
20`, 3 matches stayed behind their input for good without it and none with
it (6 October 2026). That holds for the journal build's keyboard fallback; the
playable build's keyboard loop now takes its frame target from real time
(below, "Stepping the simulation from real time").

The helpers' frames are never moved: re-anchoring a stalled player's clock
would put rows on frames other than the ones #26's integrity check expects
from the input's own timestamps, and needs a map-to-helper protocol. Catching
up changes only how many frames a client runs in a callback; confirmed state
depends only on the accepted rows, so clients stay identical.

What a callback costs, Lua32 on the development host (the playable bundle in
Wisp's headless runtime, 6 October 2026; Warcraft ran the 4096-frame
workload about 1.17 times slower than this host's Lua32):

| Callback | Solo vs a computer Rifleman: p50 / p95 ms, native calls | Four fighters with the computer Illidan |
| --- | --- | --- |
| No frame | 0.41 / 0.54, 106 | 0.73 / 1.38, 131 |
| Predicts 2 frames | 1.39 / 1.88, 114 | 2.44 / 9.49, 142 |
| Confirms a 6-frame message | 3.28 / 4.74, 189 | 12.2 / 21.6, 285 |
| Catching up after a 2 s stall | 2.74 / 8.20, 140 | 6.81 / 25.8, 222 |

In a solo match a catch-up callback stays within half a 16.7 ms frame at p95
(8.2 ms, about 9.6 ms in Warcraft by that ratio). With four fighters,
confirming a message takes more than a frame at p95, as it did before #48
(19.5–21.6 ms between runs), and catching up does too (25.8 ms): two
humans' rollback corrections are half of that match's Lua time, and Wisp's
exact binary32 arithmetic, knockback decay above all, about a sixth; that
arithmetic also allocates at least half of what a solo match does.

The worst callbacks were the collector's: Lua's incremental collector works
in proportion to what a callback allocates, so its sweep landed on the
callbacks that confirm or replay, which allocated the most. In that build a
four-fighter callback confirming a message allocated 571 KB at p50 and
1.65 MB at p95, and callbacks in which the collector freed memory were the
slowest of the run. Since Wisp 880e4e8 binary32 allocates nothing for a
normal result, and replay copies only what it must
(smashcraft:docs/typescript.md); the same callbacks allocate 18 and 26 KB,
a solo match 8.8 KB a callback instead of 45, and a callback in which the
collector freed memory is no slower than the others. Measured interleaved
with the build before on the same busy host, four fighters' confirming
callbacks fell 41% at p95 and catching up 42%.

Exact f32 arithmetic (#59) made every frame about a quarter costlier, and
the worst four-fighter callbacks ran 21–31 frames: a message's 6 confirmed
frames, a correction 15–24 frames deep replayed whole, and up to 6
predicted. Every frame costs about the same, so each kind is now bounded
(smashcraft:ts/src/game/session/playback.ts): a correction replays at most 6
frames a callback in the history's own state while the speculative match
keeps running local rows, and replaces it once the replay reaches the
present; a message's frames confirm 3 a callback, and only a backlog of
more than two messages, as after a stall, 6. Prediction keeps its 6: #60's
gate needs every admitted local row predicted within a callback, which a
smaller share failed while catching up. In steady four-fighter play a
callback ran at most 14 frames instead of 31 (11 but when two messages
land together), and only catching up after a stall, with a correction
pending, 18. A deep correction shows up to four callbacks late (until
catching up ends, after a stall), and a message's confirmed events and HUD
a callback or two late; local presses still start within a callback, and
a 2 s stall still recovers in 21 callbacks headless.

Throughput limits catching up too. Holds cost no bytes, but a message carries
only 8 frames whose every field changes: with such input on every frame, 10
messages a second carry 80 frames a second, and a 2 s backlog of it takes
about 6 s to drain.

## Where prediction waits

Prediction runs at most R frames (24) past the last frame through which every
remote player's rows have arrived (`ShadowInputSchedule.remoteThrough`). It
used to count from K, which also waits for the player's own rows to come back
through Battle.net, though a row is final once the map captures it. In
0.0.49's native bot session
(smashcraft:evidence/bot-session-0049-native-20261006/), client B's own echo
took 120 ms at p50 and 409 ms at p95, against 294 ms at p95 for A.
Prediction then stopped 24 frames past B's own echo while A's rows had
arrived further: of the presses more than a second from any stop, two of B's
started their prediction 4 and 16 callbacks after capture.

smashcraft:ts/test/local-start.test.ts plays that session's four-fighter
match headlessly, with B's messages 100 ms slower and B stopped for 2 s three
times. Bounded by K, a press in steady play started 4 callbacks late, and
the presses B's helper journaled while B was stopped started 48–125
callbacks after capture, waiting for B's own echo. Bounded by the remote
rows, all of them start in the callback that captures them.

A remote player's rows R frames behind still stop prediction, as they must:
rollback can't correct further back. When prediction stops at that window,
the map marks it held until it has run every local row again
(`Rollback.predictionHeld`). Admission also marks it held when the newly
assigned frame is more than R frames beyond the remote rows already received;
a new row can cross that boundary before the callback runs prediction.
The response probe writes a `held` row for each
press captured meanwhile, and the reconcilers report those presses apart from
#60's gate (smashcraft:ts/scripts/integrity/reconcile.ts, pressResult.ts).
In that session such a press of A's, made while B's game was stopped,
started 66 callbacks after capture, and #26's re-run had one at 5 that
waited for A's rows.

## Hit sounds on predicted frames (smashcraft#30, 24 October 2026)

The playable build draws the speculative match, but sounds started only on
confirmed frames, and the local input delay of 2 keeps confirmation a frame
or two behind even with no remote player. A native voice check on main
fb77ff639 heard 124 of 238 hit sounds on the drawn hitstop frame, 76 one
frame late and 38 two late. A hit sound (the hit voice class) now starts as
the speculative frame that lands the hit runs, and the confirmed frame and any
re-run of that frame skip it by the fighter, frame and hit, shield and special
serials (smashcraft:ts/src/game/render/combatEffects.ts, `presentPredicted`).
Movement, special and KO sounds still start on confirmed frames, and the
voice cap, priority and ducking are unchanged.

A rollback that erases a predicted hit does not cut its sound: rollback
fighting games keep sounds that already started, and a wrong sound is rarer
than a late one, since prediction misses only when a remote input changed.
A hit that first appears in a rollback's replayed frame still sounds on
its confirmed frame. The decision is presentation only: it never reaches the
simulation, a snapshot or a checksum.

A headless Lua32 run of the playable build with four Expert computers, one
client and a 25 ms local turn (confirmation one or two frames behind) started
202 of 202 hit sounds on the callback that first drew their frame; before the
change 189 started one callback late and 13 two late. With a second client
playing over measured Battle.net delivery (392 corrections, deepest 17
frames), 160 of 162 started on that callback, none twice, and the two late
ones were hits first produced by a replayed frame.

## Game clock against real time — 24 October

Warcraft's game clock loses real time in steps that double at power-of-two game
times, and every timer callback follows it. A solo Classic 3.0.0.24268 game on
gex45 (offline LAN client lan3a, its own local game, no Wisp host), playable
build at 77f0e75003a6 plus `gms`, one idle human against an intermediate
computer in Endless, ran 1,750 game seconds. Each second's `gms` is the game
time a 512-second reference timer advanced against `os.clock`; `os.clock`
matched the rates files' modification times to 3 ms over 947 s.

| Game seconds | Records | Game/real | Loss | Callbacks per real s | Callbacks per game s |
| --- | --- | --- | --- | --- | --- |
| 0–64 | 63 | 0.99917 | 0.08% | 59.98 | 60.03 |
| 64–128 | 64 | 0.99893 | 0.11% | 59.98 | 60.05 |
| 128–256 | 127 | 0.99738 | 0.26% | 59.89 | 60.05 |
| 256–512 | 255 | 0.99431 | 0.57% | 59.71 | 60.05 |
| 512–1024 | 514 | 0.98830 | 1.17% | 59.34 | 60.04 |
| 1024–1750 | 726 | 0.97613 | 2.39% | 58.82 | 60.26 |

The loss doubles with each binade and is flat inside one, as when the game
clock is a binary32 sum of short real-time steps. Callbacks per game second
stay 60.0, so the timer does not round. The map simulated every callback
(held and stalled 0, speculative frames equal to callbacks) on 11% of each real
second in Lua (mean 109 ms, worst 206 ms), so map cost does not hold frames
back. Contention does not make it: the 174 s while another pair ran averaged
game/real 0.999, the 1,569 quiet seconds after it 0.984, falling with game
time. It explains the 14 October Battle.net games easing to about 58.8 after
minute 17 (1024 s is 17.1 minutes). The clock starts at zero with each
Warcraft game; rematches inside one game keep it running. Per-second `sim`
dips (to 50) are own-input echoes confirming in batches, not lost frames;
the rate a player sees is `spec`.

Wisp's LAN host loses a further 0.03–0.1% in LAN games, because each turn's
length is rounded to whole milliseconds and the remainder is dropped
(wisp:host/lan/host.ts, `step`): host game time ran 0.999–0.9997 of wall time
in 24 October action logs. Evidence: ~/.local/state/smashcraft/evidence/sc-18-fps/.

## Stepping the simulation from real time

The playable build's keyboard loop used to run one extra frame in a callback
only while its frame was at or under the epoch's callback count, so it
simulated as many frames as Warcraft's game clock gave callbacks: 59.71 a real
second by 512 game seconds and 58.82 past 1024 (above). It now takes its frame
target from real time (smashcraft:ts/src/host/loop/realFrames.ts, c8482811a8).
On the epoch's first unpaused match callback, and again on resume, it stores
the current frame and `os.clock`; after that a frame is due when
`anchorFrame + floor(60 × (os.clock − anchorSeconds))` reaches it, read as one
absolute subtraction each callback, never as a sum of steps, so the error stays
one clock step. The due frame is held within `CATCH_UP_FRAMES` (6) of the last
frame run on both sides. A debt over 6 re-anchors to that frame plus 6, so a
stall is dropped as before and a client never bursts. A lead over 6, from
frames another path ran ahead such as catching up after a stall, re-anchors to
that frame minus 6; a smaller lead is repaid by skipping the extra frame.
Forgiving every lead (53ef6d7938) let callback jitter ratchet into extra
frames, 61.05 a real second on the laptop pair, until d9e69a1617. The
extra frame still needs the 4-frame margin inside the rollback window, and now
also a callback that confirmed at most 3 frames and repaired none, so it never
lands on a confirm-6 or repair callback; at most two speculative frames run a
callback. Without `os.clock`, or from 65536 s of process uptime, where its
binary32 step passes 4 ms, the target is the callback count again.

A keyboard callback confirms at most 2 frames, not 3 (smashcraft#239). With a
repair pending, the repair also replays every frame the callback confirms, so
a 3-confirmed callback ran about six frames of work: the 10–11 ms callbacks of
the laptop native-perf capture. Confirmed frames make natives that must match on
every client callback for callback, so the limit may not depend on anything
local such as a pending repair: a limit of 2 only while repairing made the
headless four-client run report a desync (unit calls in a different order on
slots 0 and 1). Confirmation
still outruns arrivals, two frames a callback against one, so a confirmed
debt is repaid over more callbacks, and the drawn frames are unchanged,
because speculative frames do not wait on confirmation. Going from 3 to 2 in
`rollback-four`, the worst catch-up callback fell from 9.46 to 8.91 ms
predicted, and a 6-frame debt took 3.75 callbacks on average (at most 10)
instead of 2.86 (at most 6).

With 2 or fewer confirmable frames, every callback confirms 1, in both
paths (smashcraft#239). Native rows arrive two frames every other callback:
the laptop native-perf capture at 33ee5f809 confirmed exactly 0 or 2 frames in
each of its 7,200 callbacks, half each, and the 2-frame half held 9 of the 10
callbacks over 10 ms and 74 of the 81 over 8 ms (mean 5.96 ms against 4.68).
Spreading the pair over two callbacks moves 1.37 ms of confirmed work off
every other callback. A backlog above 2 frames still confirms 2 (3 or 6 on the
journal path). The limit depends only on the confirmable count, which every
client reaches in the same callback.

The reading changes only how many frames a callback runs. It is never sent,
snapshotted or checksummed; rows stay keyed by frame and confirmed state
depends only on accepted rows, the precedent the journal path's catch-up set
(above, "Catching up after a stall"). Commit 5179da085 had chosen the callback
count because a wall clock "would leave one client a permanent frame ahead";
the rollback window bounds that lead and every epoch re-anchors, and the checks
below measured it. Adjusting the tick timer's period per client was rejected:
callbacks already run exactly 60 a game second, and a per-client period makes
timer expiry, which is synchronized state, differ between clients.

Headless checks, uncommitted scripts with the command and output on
smashcraft#18 (issue comment 6388239655, 24 October 2026), since Smashcraft's
unit tests were removed on 2026-10-20:

- The due-frame function in Bun and Lua32 for clock starts 8192–65474 s: `due`
  never decreased, debt after a re-anchor stayed at most 6, and without a clock
  `due` equalled the callback count.
- Two playable clients, 3,600 callbacks with wall time n·FRAME_MS/0.97613
  (the 2.39% loss): 3,688 frames ran against 3,687.01 due, at most 2 a
  callback, and 0 of 1,483 confirmed checksums differed. With even callbacks
  frames equalled callbacks; with the measured Battle.net turn bursts the end
  was +1.45 frames, again 0 differences.
- The same match with client B's clock at wall × (1 + 2e-4) + 0.012 s: 0 of
  1,482 checksums differed, 14,696 rows matched, `waitingFor` stayed 0, the
  lead peaked at 18 frames (R − 4 = 20) and the end gap was 0.

Native check (smashcraft#18 box E, 24 October 2026): one offline LAN pool pair
on the laptop, Classic 3.0.0.24268, the playable build from d9e69a1617, one
Endless quick match of 280 game seconds with 2 live clients throughout and CPU
pressure at most 0.54. Over 128–280 s on clients a and b: game time ran 0.99683
and 0.99692 of real time, callbacks ran 59.86 a real second, and the clients
simulated 59.978 and 59.986 frames a real second, against 59.869 on the
callback-count target in the same window. Debt stayed at -1 or above, the two
clients' game clocks agreed within 0.009%, own echo stayed flat, and 0 of 11,312
checksums each differed. The worst callback per second was at most 10.009 ms in
99% of seconds (the 10 ms bucket at the clock's 1.0009 ms step) and at most
10.986 ms overall. Two earlier runs found the two pacing defects above: client
a held the callback rate after a 2.86 s gap (negative debt never re-anchored,
fixed in 53ef6d7938), then both clients overshot to 61.05 (fixed in
d9e69a1617). Evidence: ~/.local/state/smashcraft/evidence/sc-18-realtime-laptop/.

## Native 0.0.29 short transport comparison

Same two retained clients, slots 0/2, exact 0.0.29 artifact cited above.
Each arm injected 60 signed 32-bit values per client at 30 and 60 Hz, including
extremes and varying patterns. Each observer expected 120 values. Independent
game-clock timing measured own submission-to-receipt, not physical response.

| Rate / transport | A mean/max | B mean/max | Per-observer integrity |
|---|---:|---:|---|
| 30 Hz direct sync | 166/198 ms | 158/198 ms | 118/120 valid, two invalid |
| 30 Hz GameCache + selection marker | 162/199 ms | 155/198 ms | 120/120, zero reported errors |
| 30 Hz selection digits | 161/195 ms | 156/195 ms | 120/120, zero reported errors |
| 60 Hz direct sync | 158/199 ms | 150/169 ms | 118/120 valid, two invalid |
| 60 Hz GameCache + selection marker | 142/172 ms | 135/172 ms | 120/120, zero reported errors |
| 60 Hz selection digits | 141/172 ms | 135/172 ms | 120/120, zero reported errors |

All direct arms recorded 60 own echoes. Their 17.063/16.030-second phases
included the 15-second drain timeout because completion required valid values.
This is a payload-validation failure, not demonstrated message loss or backlog.
Raw receipts do not identify the invalid values; add per-value wire, expected
and actual diagnostics before naming a cause or ranking performance. Both
selection and direct paths parse strings using S2I, so signed conversion alone
is not yet a demonstrated cause.

GameCache used ntp.w3v, one-character sender missions and two-character sequence
keys, with values changed between rates to prevent stale-cache success. The
selection arm sent framed decimal symbols one at a time, avoiding the 12-unit
selection cap. It changes local selection and does not yet establish harmless
interaction with normal gameplay. Injection lasted two seconds at 30 Hz and
one second at 60 Hz; these trials do not prove sustained capacity, fairness or
a faster physical input path. No superior transport is established yet.

Raw exports and host collection evidence:
smashcraft:evidence/native-journal-packet-comparison-20261004/transports0029/.

## Native 0.0.29 order-command failure

The improved probe confirmed carrier-selected=1 and stager-selected=0 on both
clients after the 0.5-second callback check; immediate ready selection was zero.
All 12 command buttons were explicitly shown and enabled. Real XTEST Stop
inputs were attempted on A and B. Neither observer exported any order receipt;
both Warcraft processes exited and B displayed an unexpected-error dialog.
Private crash reports identify Warcraft 3.0.0 build 24268 access violation
reading address 0x2C58 on both clients. This
association does not establish the exact cause or receipt timing. Native-order
transport remains unproved. Crash reports, dumps and replay remain private;
authored observation and numerical ready/selection exports are retained in
smashcraft:evidence/native-journal-packet-comparison-20261004/order0029/.

## Matched direct-Preloader and constant-content comparison on 0.0.31

Both retained Warcraft III 3.0 clients ran exact Smashcraft 0.0.31,
`netcode-0031`, SHA256
`311214a2e6b4d1019be4f98c66e5cec2f8e136b3129f643b0f53de57ee88b9c9`.
Source base was shared main 6884e987 plus the retained diagnostic edits in
smashcraft:wurst/NativePreloadProbe.wurst and
smashcraft:wurst/NativeTransportProbe.wurst. The build passed with zero errors
and 18 warnings. Native readiness confirmed human mask 5, slots 0/2 in MATCH;
spare slots were closed. The same independent 30 Hz driver and SC_GP receiver
sent 300 values/client/arm, each with a 22-byte envelope (6,600 bytes/arm).

| Arm | A mean / maximum echo | B mean / maximum echo |
| --- | ---: | ---: |
| Generated changing content | 86 / 113 ms | 68 / 100 ms |
| Fresh FileIO changing content | 3,170 / 6,028 ms | 3,064 / 5,445 ms |
| Fresh direct Preloader changing content | 3,050 / 5,521 ms | 2,800 / 5,346 ms |
| Fresh FileIO constant content | 85 / 120 ms | 81 / 162 ms |

Every arm/client received 300/300 with missing, bad payload, local read error,
failed-send and duplicate counts zero. Changing FileIO spans were 15.200/14.833
native seconds; direct Preloader 14.900/14.400; generated 10.100/10.100 and
constant FileIO 10.098/10.098. Final complete receipts were host-observed at
50.803/50.052 seconds after the trigger. All 16 begin/end receipts were collected.

Direct Preloader explicitly reads and clears the same ability tooltip, without
calling the FileIO wrapper. Both clients use local copies of disjoint filename
sets, whose s2 names identify the fixture source, not the observer. The result
rules out the wrapper as a necessary cause and duration alone as a sufficient
cause under this workload. Together with the fast changing tooltip-only arm in
0.0.29, it identifies a content-sensitive populated-Preloader interaction.
It does not identify an engine quota, script-cache mechanism, garbage collection,
OS scheduling cause, or repair. Sequential arm order remains a limitation.
Native read durations display zero and do not measure blocking wall time.
Own-echo ages are game-clock measurements, not physical button-to-pixel latency.

Evidence: smashcraft:evidence/native-journal-packet-comparison-20261004/fileio0031/.

## Direct-sync serialization diagnostic on 0.0.31

Same match and artifact, 60 values/client/arm at 30 and 60 Hz; each observer
expected 120 values. All 12 final receipts were collected, last host-observed
at 40.040/40.041 seconds after the trigger. Direct sync again received 118/120
valid values and two invalid values per observer/rate; all 60 own echoes arrived.
GameCache plus selection markers and selection digits reported 120/120 valid,
zero errors. Exact own-echo mean/max ages:

| Rate / transport | A mean / maximum | B mean / maximum |
| --- | ---: | ---: |
| 30 Hz direct sync | 88 / 100 ms | 79 / 99 ms |
| 30 Hz GameCache + selection marker | 85 / 100 ms | 70 / 100 ms |
| 30 Hz selection digits | 87 / 121 ms | 75 / 98 ms |
| 60 Hz direct sync | 81 / 94 ms | 74 / 94 ms |
| 60 Hz GameCache + selection marker | 95 / 189 ms | 93 / 189 ms |
| 60 Hz selection digits | 77 / 96 ms | 71 / 95 ms |

Every invalid direct value was the minimum signed integer, seq 0 at 30 Hz or
seq 1 at 60 Hz, from each sender. Wire text was `NTP10000-2.147484e+09` or
`NTP11001-2.147484e+09`; parsed actual value was `-2`. The generated map script
emits `-2147483648` and uses Lua `tostring` for I2S. On 32-bit Lua the positive
magnitude of that unary-minus literal cannot be represented as an integer;
this was reproduced at the compiler owner under Lua 5.3.6 built with LUA_32BITS.
Native wire evidence proves the serialization failure before parsing. No
transport loss follows from those two invalid values. The 17.063/16.030-second
direct phases include the 15-second validation drain timeout.

The selection encoder also uses I2S and per-character S2I. Its apparent success
at this edge does not establish faithful decimal-symbol encoding: inspect and
repair the shared integer-literal boundary before claiming extreme-value
protocol integrity. These one/two-second injection windows do not establish
sustained capacity, harmless selection interaction, fairness or physical response.
No alternative beats the direct-sync baseline on established usable evidence.

Evidence: smashcraft:evidence/native-journal-packet-comparison-20261004/transports0031/.


## Minimum-integer compiler repair activated

The Lua printer now emits `(-2147483647 - 1)` for the minimum signed integer,
including optimizer-folded expressions. Under Lua32 this preserves integer type
and exact decimal serialization; the old unary-minus literal became a float
and serialized as scientific notation. Both focused upstream regressions passed
(2 passed, 0 skipped), and the generated reproduction executed successfully.

Compiler checkpoint `6b129956f6e7cf9582510f26b99d305526bf3ded` is published
in the declared compiler repository and pinned by smashcraft:wurst-toolchain.lock.
Compiler JAR SHA256 is
`9495b1f3ad1f1baf53335934e9152874773e6c735b0e5db819b3e7f06c82ed15`.
The consumer’s focused input-protocol checks pass 7/7 with zero errors and nine
existing warnings. Native direct-sync and selection-encoding revalidation is
pending; these checks do not yet establish corrected native protocol integrity
or alter the measured latency verdict.


## Corrected native transport comparison: 0.0.32

Corrected candidate SHA256 `b84ce176e7655bf8561d0456c6fd093bb8dd2f785ca4a09b0096a09c71b46e5e`,
source checkpoint `b7d7000`, compiler `6b129956f6e7cf9582510f26b99d305526bf3ded`.
Both retained clients ran the same match, humans slots 0/1 (mask 3), no additional
players. Build required WC3_RESPONSE_SERVICE_PROBE=1. The earlier 0.0.32 candidate
without that flag supplied no transport evidence. Stage-menu entry alone did
not activate the probe; actual MATCH was observed on both clients first.

All twelve receipts report 120/120 values, zero missing, bad values, duplicates
or send failures; all sixty own echoes arrived. This closes the bounded native
minimum-integer serialization regression. Own-echo game-clock timing:

| Rate / transport | A mean / maximum | B mean / maximum |
| --- | ---: | ---: |
| 30 Hz direct sync | 80 / 99 ms | 75 / 99 ms |
| 30 Hz GameCache + selection marker | 80 / 99 ms | 75 / 98 ms |
| 30 Hz selection digits | 102 / 221 ms | 99 / 215 ms |
| 60 Hz direct sync | 114 / 209 ms | 108 / 209 ms |
| 60 Hz GameCache + selection marker | 721 / 2,023 ms | 743 / 2,148 ms |
| 60 Hz selection digits | 4,759 / 9,420 ms | 4,880 / 9,544 ms |

The corrected short-window comparison favors direct sync at 60 Hz. Selection
and GameCache results vary materially from 0.0.31; these sequential short arms
do not identify the cause of that variation or establish sustained capacity.
No alternative has demonstrated a reliably faster path. These measurements
are transport echoes, not physical controller-to-screen response. The collector
captured all twelve receipts over 32.541 host seconds; it was started before
the trigger, so that span includes setup. Evidence:
smashcraft:evidence/native-journal-packet-comparison-20261004/transports0032/.

Next diagnostic separates changing preload script execution from the origin of
the value sent on the wire. Full responsive companion-to-fight acceptance remains
open; physics/VFX ownership is now under this root and peer listeners are stopped.


## Source-text discriminator: 0.0.34

Candidate source4640a03, SHA256805fd31e96f35f1eff3bec65cb92a9db3a3370cc09e680a83a288de130c32e81,
zero build errors18warnings. Same two clients in one match, slots0/1 mask3,
spare slots closed. Fresh4800 fixtures,128bytes each, source-slot0. All five
arms send changing22-byte envelopes through the same receiver at30Hz,300/client.
Arm definitions: smashcraft:evidence/preloader-source-discriminator.md.

| Arm | A mean / maximum | B mean / maximum |
| --- | ---: | ---: |
| Generated, no file | 111 / 248 ms | 105 / 223 ms |
| Changing tooltip script, discard read and send generated value | 2,786 / 5,039 ms | 3,020 / 5,487 ms |
| Identical script/tooltip, fresh filenames, send generated value | 100 / 220 ms | 103 / 220 ms |
| Only comment changes, constant tooltip, send generated value | 2,802 / 4,911 ms | 2,950 / 5,500 ms |
| Changing tooltip script, send returned value | 3,442 / 6,480 ms | 3,440 / 6,246 ms |

All300/300 own echoes in every arm. Missing,bad payload,read errors,send failures,
duplicates all zero. All20 begin/end receipts collected. Native phase spans
A/B seconds: generated10.131/10.097; changing/discard14.330/14.663;
identical10.164/10.131; comment-only14.463/14.663; returned15.630/15.530.
The same phases' host-observed spans approximately10.076/10.066,
14.317/14.559,10.234/10.233,14.463/14.952,16.380/15.888 seconds.
Host spans include file publication/detection; they are not per-call timings.

Changing source text alone is sufficient to reproduce the slow path under this
workload. Returning/sending the loaded string is not necessary, nor is changing
the tooltip value. Identical source text under fresh paths remains fast. This
supports investigating a small reusable script vocabulary at the external file
boundary. It does not prove the engine's internal compiler/cache mechanism or
that a vocabulary decoder will sustain controller throughput. Sequential order,
one tested build/topology,and own-echo timing remain limits. No physical latency
or full gameplay acceptance follows.

Evidence: smashcraft:evidence/native-journal-packet-comparison-20261004/fileio0034/.


## Vocabulary startup attempt: 0.0.36

Candidate SHA256 `5c02f781b7a9357f9e4a35a10bcca42a415094327e0471dbd6a8f0fb2ae1a368`,
source `a4ed68c` (builder packaging fix; probe source `b509932`). Two retained
clients reached actual phase2 with humans/fighters mask3. Both later reached
Warcraft's score screen during private XTEST Ctrl+P trigger attempts. No begin,
end, or sample receipt appeared; the collector completed with zero receipts.
This supplies no vocabulary throughput or latency result. The exact transition
cause remains unresolved. Candidate0.0.38 adds probe-local request, synchronized
entry, completed-reset markers and an F5 developer-exit marker before testing
the same six arms. These startup writes precede the timed arms.
Evidence: smashcraft:evidence/native-journal-packet-comparison-20261004/vocabulary0036/.

## Parallel physics and VFX checkpoint

Native0.0.37 source `1bc4a7b69a8527f0cbe37c26fff7193f0237be69`, SHA256
`e78ae136a69a4841a2b144416dac30b3e5dc408ac5c978bbd21a3103f09bc0a9`,
records the first scaling difference at fall step6. Identical stored operands
-6.119999885559082 and -1.0199999809265137 have exactly representable sum
-7.139999866485596. Direct world addition gives that result; current normalized
rounding/scaling gives -7.1399993896484375 and actual production velocity matches
the latter. Its normalizedWorld result equals current by construction, so this
is not a separately maintained normalized trajectory comparison. The native
`0.7 + 0.1 + 0.1 + 0.1` sentinel gives one ULP below1; ordinary IEEE32 gives1.
This establishes a scale-conversion defect and native arithmetic difference,
without assigning all broad native35 mismatches to either. Explicit nearest
operations accepting operands before arithmetic are being repaired upstream.
Evidence: smashcraft:evidence/native-physics-precision-20261004/native0037.txt and
smashcraft:evidence/native-physics-precision-20261004/native0037-analysis.json.

Upstream test-harness R2SW formatting repair `0fe2efc959049b4ede2b86c66ae61c130eb04b55`
is published; focused execution passed1/1 with zero skips. The diagnostic
consumer checker uses that immutable runtime source. This is a harness repair,
not a production arithmetic fix. Six common capture/throw, charge/ready, and
ledge catch/recovery cues are integrated at `30ac333`; focused Impact checks
pass21/21. Native appearance/pause/replay remains unobserved. This work runs
alongside netcode under one root; peer mailbox listeners remain shut down.


## Native38 completed export and practical acceptance

All24 receipts and120 sample pages are retained. Every arm sent300/client,
but all six arms recorded zero own echoes and zero peer packets, including
both generated controls. The run supplies no valid vocabulary latency or
receiver-integrity verdict. A local start request preceded synchronized entry
by181.327 host seconds. The vocabulary30 phase publication span was about
195 seconds; vocabulary60 about120–123 seconds, including sending/drain.
Native timer spans and host publication spans diverge. Initial collector
timeout and heavy directory scans are retained as confounds; the collector now
checks exact expected paths. Do not integrate a live vocabulary writer on this
evidence. Existing separate-prefix transport control now distinguishes the
SC_GP receive boundary from general synchronization failure.
Evidence: smashcraft:evidence/native-journal-packet-comparison-20261004/vocabulary0038/.

The operator clarified that intended input frames and responsive viable play
are primary. Physical33/50/83ms percentiles guide measurement; they are not
rigid substitutes for input correctness or playable acceptance. Comprehensive
current state: smashcraft:evidence/smashcraft-delivery-state-20261004.md. Upstream
Binary32 explicit operand repair e3714f629113ee682353c3244065fee3e7d9ae16
passed15/15 and is published; consumer/native integration remains pending.


## Playable delivery checkpoint: 0.0.40

The integrated keyboard/local-prediction candidate completed two-client online
movement, held attacks, specials, jumps, damaging contact, pause/resume, stock
loss, results and two-party rematch into a second fight. Both clients displayed
15%/19% damage after contact. Three trace pairs have 18 matching recorded
confirmed frame/checksum checkpoints; no dropped trace rows, rejected input,
speculative failure or rollback-window block appeared in recorded summaries.
Held-action corrections reached depth 15. This is automated keyboard gameplay,
not measured physical-controller latency or complete frame-retention proof.

The operator reports prior responsive controller play through keyboard mapping.
That working digital input path is separate from experimental continuous-analog
FileIO ingress; the latter's delay must not be presented as a regression of the
former. The short synthetic-tap sequence did not register every action. Explicit
100 ms holds recorded attacks, specials and jumps for both players. Polling can
miss a pulse wholly between samples; no arbitrary short-tap/stall guarantee is
claimed. No additional transport survey blocks this usable candidate.

Map SHA256 13f0ba7f6a78eff1c7f71e14f2c398ebeb38c6f24b06aad9b2540f4f7eaa1f17,
source fa681100fc429735720325bf479f5bcd6944f25d plus map-version 0.0.40.
Build settings and usable instructions:
smashcraft:evidence/smashcraft-delivery-state-20261004.md. Raw traces:
smashcraft:evidence/native-playable-0040-evidence-20261004/.
Binary32 consumer migration is integrated and focused 22/22 passed; world-scale
representation and full native physics fidelity remain separate open work.


## Local logical response: playable 0.0.40

Six recovery-separated shield presses per client (100 ms held, 600 ms released)
all entered predicted shield state in the capture callback, while confirmed
shield remained false. This bounds the sampled-input-to-logical-presentation
seam: feedback need not wait for transport confirmation. It does not measure
physical event capture, actual raster presentation, or hardware-to-pixel latency.
The initial rapid-repeat sequence overlapped 15-frame shield-release recovery
and is excluded from per-press timing conclusions. Clean native-game-clock
probe data and host XTEST submission brackets are retained separately at
smashcraft:evidence/native-playable-0040-evidence-20261004/response/.

The current SDL3/EventMapper/enigo companion also completed a native virtual-pad
trial: movement and all three 100 ms attack presses appeared at both clients,
with six matching confirmed checkpoints. Private foreground eligibility was
observed before emission. This establishes the software mapper/game seam under
the tested conditions, not physical hardware timing or short-stall retention.
Evidence: smashcraft:evidence/native-playable-0040-evidence-20261004/controller-mapper/.

## Journal pause publication boundary

Native 0.0.41 prepared helper frontiers 1422/1431 and selected the shared
PAUSE_COMMIT frame 1431. Helpers then reported "control command lacks v" while
the eventual complete native receipts were valid. The control reader now waits
for the preload function's closing line before parsing; the focused partial-write
regression and helper build passed. Final native pause/resume remains open.
The digital mapper and its responsive native 0.0.40 result remain separate.
Exact candidate, failure limits and recovery state:
smashcraft:evidence/journal-pause-checkpoint-20261004.md.

The corrected native retry retained both edges of a roughly 5.1 ms virtual-pad
tap at original frame 19 in both helpers. They published through frame 2130
without the old partial-control parse failure. The 35-second PREPARE wait
expired before either helper observed its control command. A later held Y
produced complete PAUSE requests on both clients at journal cursor 65 after
the helpers were reaped. The driver never exercised resume or its planned
helper stall. This remains an unfinished native integration check; helper
edge retention does not establish intended-frame gameplay application.
Evidence: smashcraft:evidence/journal-pause0041-evidence-20261004/.


## Native 0.0.42 journal decision

The fixed one-character script vocabulary and original-frame filename repair
are integrated at 1f185f8. Rust journal 7/7 and Wurst Journal 5/5 focused checks
passed. The native two-client match did not complete the first PREPARE wait
within 35 seconds. Both helpers retained the 5 ms attack edges at frame 19;
the footer showed attack animation frame 0 and later 9 with Pausing after
helper shutdown. Those footer values are not simulation frames. Complete pause
requests name next input frame 65 on both clients, establishing journal cursor
progress through frame 64. The exact native attack application frame is unproved. No fresh native trace completed, and the planned
resume/stall steps were not reached. Immutable script content has not established
usable native journal ingress or original-frame gameplay application.

Keep 0.0.40 as the playable keyboard/digital-mapper candidate. Do not reopen the
transport survey or treat this incomplete analog-file experiment as evidence
that its responsive digital input path regressed. Details and bounded logs:
smashcraft:evidence/journal-pause-checkpoint-20261004.md and
smashcraft:evidence/journal0042-evidence-20261004/.

## Native43: callbacks progress, confirmation does not

Admission-horizon gating and deferred-packet retention passed Journal 7/7.
Both native clients recorded 300 callbacks in five native seconds, submitted
32 paired packets/64 input rows, and received no production packets during
that trace. Confirmed simulation stayed at frame 0; local prediction exhausted
its 24-frame allowance. Normal 5 ms attack edges were retained by both helpers
at frame 19; a tap during a 250 ms helper stop was retained at frame 97, beyond
the unadvanced admission horizon. Neither establishes original-frame native
application. The missing boundary is receipt/confirmation; no owning cause is
yet established. This result does not contradict the working digital mapper.

A subsequent generated-packet probe had no local-request receipt, so it gives
no sync-performance verdict. Both signed-in clients then left normally and
the playable 0.0.40 artifact was restored. The experiment remains unfinished;
no general transport survey or repeated green checks block usable delivery.
Details: smashcraft:evidence/journal-pause-checkpoint-20261004.md.
Evidence: smashcraft:evidence/journal0043-evidence-20261004/.

### Journal44/45 integration checkpoint (4 October 2026)

Both clients received both startup messages on SC_GP before journal file reads.
The first 5 ms tap was applied at its original frame 19, but only at native
2.700 s (44) or 2.883 s (45); confirmation stalled at frame 20/24. A frame-97
tap captured during a 250 ms helper stop did not reach gameplay in either
300-callback trace. Warming 65 canonical scripts in45 did not fix this.
This establishes working startup and one original-frame application, while
sustained journal input remains unusable. It does not change the playable40
digital mapper verdict. Detailed results and exact artifact hashes:
smashcraft:evidence/journal-pause-checkpoint-20261004.md.

The next selected repair uses identical script text for every present file and
encodes packet bits by file presence, preserving ready-last atomic publication.
This follows native34’s script-text discriminator; its performance remains
unmeasured until the matched native check. No new transport survey is needed.

### Constant-script journal46 verdict

The matched two-client trial rejected the selected presence-bit representation.
Rust7/7 and mapbuildpassed, and both startup markers arrived before journal
reads. Helpers retainedtap19 andtap97 through a249.893ms stop. Both native
traces then receivedzero production packets across300callbacks; confirmation
stayed0. Both taps were unapplied. The failed source representation was retired
and archived privately, with bounded evidence retained at
smashcraft:evidence/journal0046-evidence-20261004/.

Direct sync with the delivered keyboard/digital mapper remains the usable
choice. Original-frame short-tap/stall retention through FileIO is not delivered.
No observed finding justifies treating the previously responsive mapper as
regressed or continuing another broad transport inventory before usable play.

### Native JASS47: initialization blocks gameplay

The same Wurst gameplay now builds to native JASS. The compiler previously
retained Lua metadata from a Lua base map; owning fix
`b9b534f7032e0de30c183d49b333376affca0838` sets the language for both targets.
Its focused ProjectConfigBuilderTests passed after the regression failed before
repair. Artifact47 metadata was verified as JASS with four players.

Both signed-in clients joined `[TEST] sc47-native-jass` and entered the game
world, but fighter selection never appeared and neither wrote controller
readiness. The driver timed out before creating helpers or injecting inputs.
This is an initialization failure, with no input-latency verdict. Operation
budget exhaustion is a hypothesis, not an established cause. The next build
records initialization milestones to identify the first stopping boundary.

Artifact47 SHA256:
`f5d2520c8b4a72e1d71b19c7242608dd56f27ca09b37950a1e49e488b19e31ec`.

### JASS48/49: startup repaired; selection desync remains

48's durable startup marker stopped after effects setup, within the subsequent
input/replay initialization. 49 separated large allocations using the existing
synchronous Execute helper, including one execution budget per replay slot.
Both clients then recorded initialization complete and displayed fighter
selection. That fixes the observed startup boundary; it does not establish a
general operation-budget diagnosis for every earlier failure.

During character selection, native desync records were written at turn1113.
A returned to results; B remained in selection with A absent. No controller
helpers started and no short-tap samples were injected. The earliest differing
record is category1768977253, with two counters differing by2; the records alone
do not identify the owning cause. 49 therefore provides no input-performance
verdict and is rejected as a playable replacement.

The experimental JASS source and raw failure records are retained privately at
`~/.local/share/smashcraft-build-inputs/production-netcode-20261004/archive/native-jass49/`.
The published Lua source and exact compiler artifact were restored. Exact
playable40 is reinstalled on both clients; its recovery journey is recorded
separately. The general compiler metadata fix remains in its owned compiler
branch. Native evidence: smashcraft:evidence/journal0049-evidence-20261004/.

Artifact49 SHA256:
`d8fcbb8d614188b3047a87985711b6ee04fe372d4eba5cb816ea2313a5a06383`.

### Native50: matched selection state before the disconnect

Both clients completed initialization and received A's Archer choice. Preview
records matched fighter choices, readiness and both unit handle identities
before and after recreation. A still disconnected. Native error summaries
name turn1851, matching presence tag3792 and differing birth tags5125/5127.
Controller helpers never started, so this is not a controller or latency verdict.
The archived raw numeric log repeats earlier turn1113 records; use the current
error summary and selection records for this attempt.

The generated JASS also exposed an owning lifecycle defect: destroying Fighter
did not clear its removed unit reference. Candidate51 moves unit removal and
reference clearing into Fighter's destructor. This is a concrete resource repair;
its causal relationship to the desync is unproved pending the native check.
Evidence: smashcraft:evidence/journal0050-evidence-20261004/.

Candidate51 compiled and initialized on both clients, but reproduced the
disconnect immediately after A's selection, at native turn1281. Presence
tags3792 matched; birth tags5125/5127 differed again. Clearing the Fighter unit
reference therefore does not close this desync. No helpers started and there is
no controller-performance verdict. The candidate and source patch are archived
privately; the published Lua source and exact compiler artifact are restored.
Evidence: smashcraft:evidence/journal0051-evidence-20261004/.

## Keyboard journal bridge: first native result

The native keyboard-mailbox-a trial received production packets and applied
both players' first5ms attack at originalframe19, but confirmed onlyframe36
after5 native seconds. The helper retained later taps across helper/game stops;
their application was not observed in that trace. This replacement is rejected
for throughput pending the owning companion-emission repair. Source checks
passed but did not establish native speed. See
smashcraft:evidence/keyboard-mailbox-20261004/README.md.

The timed native repeat measured about2.75ms median local emission but81–92ms
median acknowledgment waits. Excluding all carrier keys from synchronized
registration did not fix this. The serial chunk/file-ACK protocol is rejected
for playable controller delivery; the passing first tap is not a throughput or
stall-recovery pass. This does not establish a universal engine floor or identify
which part of key visibility versus ACK generation contributes the wait. The
failed source variation was removed. Exact40 remains the playable release.

## Editbox journal: bounded native retention pass, 5 October

The replacement locally polled editbox ingress, repaired Enigo X11 emission and
existing direct sync completed 300 original frames per player on two online
clients. All three 5 ms Attack taps applied once per fighter at frames 19, 97
and 157, including a 249.994 ms helper stop and a 245.027 ms game stop. Both
clients finished at confirmed frame 300 with checksum `978581:476670` and no
input rejection. The same stream included half-stick motion and return.

The helper's text emission medians were 1.416/1.398 ms, compared with ~220 ms
in the first integrated trial. That repair is in the underlying Enigo library,
not a substituted emitter. A failed first attempt with the repaired helper
exposed six temporary X11 mappings left on A by an earlier forcibly stopped
helper. Restoring those test-owned mappings made A's keymap match B's; the
unchanged candidate then passed. Keep this fixture-state failure with the result.

This supports the native short-tap/stall workload in #26. It does not establish
physical response timing, complete pause/focus lifecycle, hardware/platform
coverage or all original-frame guarantees. Playable 0.0.40 remains separate.
The source pins, exact artifact identities, corpus, failed attempt, final
reconciliation and raw logs are in
smashcraft:evidence/editbox-ingress-native-20261005/README.md.

## Tempest-checksum desyncs: handles made at a per-client moment (#158)

Learned on Warcraft III build 24268 (x86_64 `Warcraft III.exe`), 7 October 2026.

**Rule.** Code that runs at a moment only this client chooses must not create
a synchronized handle. That covers this client's own helper rows, its file
reads, its focus and its frame or render callbacks. Synchronized handles
include `CreateTimer`, triggers, groups, effects and units. Passing a Lua
function where a native takes `code` counts too: `TimerStart`,
`TriggerAddAction`, `Condition`, `Filter`, `ForGroup`. So does starting,
pausing or restarting a shared timer. Create these at setup or from a
synchronized event, and on the local path only read them (`TimerGetElapsed`).
The desync guard (smashcraft:ts/test/desync-guard.test.ts) pins the input
trace's start this way. Its lockstep compare flags any synchronized native a
one-client call makes.

Presented and confirmed frames are such moments too: each client paces them by
its own `os.clock` and its own prediction. Chen's parasol was created and
destroyed on presented frames, and two 0.2 Battle.net games desynced on the
first match with Chen (#681). Make a presentation's effects with the fighter's
renderers and only show and hide them afterwards.
smashcraft:ts/test/online-handles.test.ts drifts one client's clock and compares
handle births and deaths per turn while Chen opens and folds his parasol.

If one client creates a handle a turn earlier than the other, the two
clients' birth counters and free-list heads differ at that turn's checksum.
That is a desync, even though both clients end with the same objects a turn
later. The signature is births ±1 with presence ±1, or births ±2 with
presence ±4. Every other Desync.log section matches.

- Each Errors folder's `*_Desync.log` holds the last three turns of every
  checksum section, appended across games. Section names are FourCC decimals:
  `ipse` is Tempest/Ipse, records #1 and #2 are the presence head and births.
  Diff A against B by section and turn. One section differing names the
  subsystem.

**Handle ledger (#681).** A desync seen from one client's Desync.log alone
can't say which call split the clients. Every online client therefore keeps a
ledger (smashcraft:ts/src/host/loop/handleLedger.ts). At install it wraps each
native in `LEDGER_NATIVES`: the effect, lightning, frame, sound, text tag,
timer, trigger, event-registration and location natives the map calls. It
counts each call against the game tick it ran in, which `shell.tick` advances.
Ticks, not confirmed frames, are the unit: game callbacks fire at the same game
time on every client, while each client confirms frames at its own moment.
Once every 60 ticks each human sends its count for the finished window, with
up to 12 nonzero ticks and each tick's first native, as a ledger-only `SC_DY`
message (`lWINDOW:TOTAL,OFFSET.COUNT.NATIVE,...`). Each client compares every
other player's report with its own window. At the first difference it writes
`smashcraft-handle-ledger-pSLOT-tTICK.txt` in CustomMapData, for example
`handle ledger: p1 and p0 differ at tick 632: p1 made or freed 1 (CreateTimer)
and p0 0 ()`. Both clients receive each other's reports, so both write the line,
each naming its own natives for that tick. When the difference lies past the
12 ticks a report carries, the line names the window's tick range and totals.
smashcraft:ts/test/handleLedger.test.ts makes one of two online clients create
one extra timer and checks that both name that tick and `CreateTimer`. Frame
lookups (`BlzGetOriginFrame`, `BlzGetFrameByName`) aren't counted.
## Input sampling against the LAN host's turn interval (24 October 2026)

Asked: can Smashcraft sample more than about 40 inputs a second if the host
sends turns faster than Battle.net's 25 ms? Measured on Warcraft III
3.0.0.24268 (Classic, offline LAN pair 0 on gex45, 60 fps cap), integrity
build from this commit's source, Rifleman mirror quick match with nine stocks.

Method. `-dev callback-clock N` (development builds only,
smashcraft:ts/src/host/loop/callbackClock.ts) records `os.clock` (1 ms
resolution, smashcraft:docs/high-refresh.md) at every `shell.tick` callback
and whether `BlzIsKeyPressed` reports the attack key `c` down, plus the
rollback counters every 600 callbacks, into
`smashcraft-callback-clock-pSLOT-runN.txt`. A host-side driver pressed `c`
on both clients through private-desktop XTEST every 280–520 ms for 50–90 ms,
stamping each press on CLOCK_MONOTONIC (worst send lateness 0.7 ms); heavy
runs added a random tap of `[ ] ; ' t v 1 2` every 30–80 ms on each client.
Each run lasted 80 s (the 25 ms heavy run 120 s); runs over 5 minutes were
not made (no long native runs before 0.1.0). The host's action log gave turn
times and each client's synchronized key actions. Host CPU pressure stayed
under 1.3% (`/proc/pressure/cpu` avg10) in every run.

**The key state we read follows the synchronized key events.** Smashcraft
registers every bound key with `BlzTriggerRegisterPlayerKeyEvent`, so each
press and release also travels to the host as a `key` action. In every run,
the probe-key presses that `BlzIsKeyPressed` never reported down at any
callback were the presses whose key-down and key-up actions the host relayed
in the same turn:

| Run | Client | Presses | Down and up in one turn | Presses minus those | Seen down |
| --- | --- | --- | --- | --- | --- |
| 25 ms, heavy | a | 289 | 108 | 181 | 182 |
| 25 ms, heavy | b | 290 | 140 | 150 | 150 |
| 25 ms, light | a | 187 | 13 | 174 | 174 |
| 25 ms, light | b | 192 | 22 | 170 | 170 |
| 16 ms, light | a | 187 | 50 | 137 | 136 |
| 16 ms, light | b | 191 | 82 | 109 | 109 |
| 16 ms, heavy | a | 187 | 7 | 180 | 187 |
| 16 ms, heavy | b | 189 | 12 | 177 | 189 |
| 25 ms deadline-paced, light | a | 187 | 0 | 187 | 187 |
| 25 ms deadline-paced, light | b | 191 | 0 | 191 | 191 |

Eight of ten client-runs match to one press; the 16 ms heavy run saw every
press although 7 and 12 of them arrived as one-turn pairs, so the reading is
not purely the synchronized event. Either way, a tap is lost when the client
holds both its edges until one send, which happens when the client stalls:
the press's key action reached the host 19–23 ms after the press at the
median in clean runs, but 340–1,260 ms at the 90th percentile in runs where
a client fell behind.

**Callback cadence.** On the LAN and in a solo game alike, a client runs one
60 Hz callback per burst, at about the rendered-frame rate, not a burst of
callbacks per arriving turn as on Battle.net (wisp:docs/network-model.md,
"Turn-burst callbacks"). Gaps between consecutive callbacks, both clients
pooled, in ms; "Seen" is taps `BlzIsKeyPressed` reported down over taps sent;
"Spread" is the range of press-to-sample delays after removing the unknown
`os.clock` offset, with the p5–p95 spread in sampled frames:

| Setting | Input | Turns/s | Game s per wall s | Host waits | Gap p10/p50/p90/p99 | 1 callback per burst | Seen | Spread ms (frames) | Rollbacks/min | Frames rolled back/min | Deepest | Desyncs | Client cores |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 ms, wall-measured steps | light | 43.7 | 0.999 | 0 | 9/16/25/33 | 99.6–99.8% | 174/187, 170/192 | 72–80 (2) | 227–232 | 1,730–1,770 | 17–23 | 0 | — |
| 25 ms, wall-measured steps | heavy, first match | 35.1 | 0.827 | 77 | 2–7/15–16/25/209–212 | 96.9–98.3% | 182/289, 150/290 | 81–87 (3–5) | 275–324 | 4,010–4,260 | 24 | 0 | — |
| 16 ms | light, first match | 63.1 | 0.945 | 48 | 7–10/16/22–23/108–135 | 97.7–99.1% | 136/187, 109/192 | 73–79 (3–4) | 151–171 | 1,650 | 24 | 0 | — |
| 16 ms | heavy | 67.3 | 0.999 | 0 | 8/16/26/30–31 | 100% | 187/187, 189/189 | 57–63 (2) | 581–583 | 4,890–4,920 | 14–15 | 0 | — |
| 25 ms, deadline-paced | light | 39.9 | 0.998 | 1 | 8–9/16–17/26/30 | 100% | 187/187, 191/192 | 32–40 (1) | 233–252 | 1,710–1,760 | 11–12 | 0 | — |
| 17/17/16 | light | 60.0 | 1.000 | 2 | 8/16/26/30–31 | 100% | 187/187, 190/192 | 37–42 (1) | 243–249 | 1,480 | 10–11 | 0 | — |
| 17/17/16 | heavy | 60.0 | 1.000 | 0 | 9/16/26/31 | 100% | 187/187, 189/189 | 47–50 (2) | 583 | 5,090–5,110 | 14 | 0 | — |
| Solo (no host) | light | — | 1.000 | — | 8–9/15–16/26/31–32 | 100% | 187/187, 192/192 | 40–48 (1–2) | 0 | 0 | 0 | — | — |
| 17/17/16, second session | light | 60.0 | 1.000 | 1 | 8/16/26/32 | 100% | 187/187, 192/192 | 48–64 (2) | 247–249 | 1,460–1,490 | 11–12 | 0 | 1.26 |
| 17/17/16, second session | heavy | 60.0 | 1.000 | 0 | 9/16/26/31 | 100% | 183/187, 188/189 | 43–74 (1–2) | 576–582 | 4,980–5,180 | 23–24 | 0 | 1.20 |
| 10 ms, second session | light | 100.0 | 1.000 | 0 | 8/16/27/33 | 100% | 187/187, 191/192 | 43–53 (1) | 231–255 | 1,280–1,330 | 10–15 | 0 | 1.01 |
| 10 ms, second session | heavy | 100.0 | 1.000 | 0 | 8/16/27/32–33 | 100% | 187/187, 189/189 | 40 (1) | 583–584 | 4,560–4,570 | 11–12 | 0 | 1.16 |
| 8 ms, second session | light | 125.0 | 1.000 | 0 | 7–8/17/26/33–34 | 100% | 187/187, 192/192 | 37–58 (1) | 248 | 1,100–1,130 | 8 | 0 | 1.08 |
| 8 ms, second session | heavy | 125.0 | 1.000 | 0 | 8–9/17/25/32 | 100% | 187/187, 189/189 | 44–49 (1) | 583–584 | 4,470–4,500 | 11 | 0 | 1.24 |

No run desynced (host checksum compare, action log). Client CPU was 0.8–1.3
cores for both clients together in the first session, which did not record it
per run. The two runs marked "first match" were each
the first match after the pool started; they stalled for up to 670 ms, the
host waited on a client more than 50 turns behind, and they lost the most
taps, so a pool's first match is not a fair turn-rate sample. At 25 ms the
host ran 43.7 turns a second at a mean step of 22.9 ms, because it took each
step from the wall time since the last turn; Wisp now paces every turn length
against a deadline (wisp:docs/lan.md, "Turn pacing"). Effect 4.0.3's
`Schedule.fixed`, the earlier pacer, fires 107 times a second for a 16.6667 ms
period: the first 17/17/16 attempt ran 92 turns a second at game pace 1.54
and lost 93% of one client's taps; it is excluded from the table.

The pacer, not the turn length, made the difference. With the old pacer, 25 ms
turns carried jittery game steps, client a's presses reached the host in
19–23 ms at the median (61–79 ms at the 90th percentile) and 7–11% of taps
were lost. With deadline pacing (the same Wisp host change, 25 ms steps
exactly, 39.9 turns a second), presses reached the host in 9 ms (20 ms),
no tap was lost and the press-to-sample spread was 32–40 ms, as good as the
17/17/16 cycle (4 ms, 19 ms; 37–42 ms) and the solo game (40–48 ms). A 16 ms
turn is shorter than a 60 Hz frame, so the host sends about 62 turns for
every 60 callbacks and some turns carry no callback; its clean heavy run lost
no taps but spread press-to-sample delays over 57–63 ms.

Not measured here: the parity-tape check per setting (`bun wisp pad` cannot
take a turn length; headless parity is independent of the host's turn
length), runs longer than 80–120 s, and renderer frame times.

**Shorter turns (second session, wisp#31).** The rows marked "second
session" ran later the same day on pair 0 in one pool session, after a
discarded first match: the integrity build of smashcraft 3f765ea24 (before
the smashcraft#218 tap fix), Wisp's deadline-paced host from wisp d04d0c5,
the same driver and seed, 80 s per run. Client cores are both clients'
CPU time over the run's wall time. At 10 ms and 8 ms the host held 100.0 and
125.0 turns a second at game pace 1.000 with no host wait, the clients stayed
1–3 turns behind, and the client still ran one callback per rendered frame.
Lost taps were 0 light and 5 heavy at 17/17/16, 1 and 0 at 10 ms, and 0 and 0
at 8 ms; neither shorter turn used more than 0.04 more cores. The press
reached the host sooner with light input, at a median of 8 ms at 10 ms and
5 ms at 8 ms, against 13–15 ms at 17/17/16; with heavy input it took
29–35 ms at the median whatever the turn length, so the client's own send,
not the turn, set that delay. By wisp:docs/relay.md's rule (zero desyncs,
game pace 1.000 ± 0.002, no more lost taps, at most 0.2 more cores than
17/17/16 in the same session), 8 ms is the shortest clean turn measured; 10 ms
misses by its one extra lost tap with light input.

**Recommendation.** On a LAN the client samples once per rendered frame
whatever the turn length, so a shorter turn does not raise the sampling rate.
What mattered was steady turns: a deadline-paced host at 25 ms sampled as
well as a 17/17/16 cycle and as a solo game, with every tap seen and a 1-frame
spread. Keep Wisp's default at Battle.net's 25 ms, now deadline-paced, so
native checks see the grid players get; `--turn-ms 17,17,16` stays available
for one turn per frame. A relay Smashcraft runs itself should pace turns
against deadlines; 17/17/16 bought no measured sampling gain over 25 ms here,
only fewer frames per turn. The remaining lever is the dropped tap
(smashcraft#218): a stalled client can send a tap's press and release
together, and in light-input runs exactly those taps never showed as held
keys.

## Taps a stalled client never polls (smashcraft#218, 24 October 2026)

Measured on Warcraft III 3.0.0.24268 (Classic, offline LAN pair 2 on gex45,
Wisp's wall-measured 25 ms turns), integrity build, Rifleman quick match,
light scripted taps of `c` (attack) for 50–90 ms every 280–520 ms on both
clients through private-desktop XTEST, 80 s per run. `-dev callback-clock`
now also records, for the local player and the probe key, every
synchronized key-down and key-up event with `BlzIsKeyPressed` read inside
the handler, and every admitted journal row whose pressed mask is set.

**`BlzIsKeyPressed` follows the client's own input pump, not the
synchronized key event.** In a run without stalls, the raw state rose at a
callback 3 callbacks (p50 and p90; at most 6) before the key-down event of
the same tap fired, and the key was already released inside the handler for
44–53 of 187–192 taps; inside every key-up handler it read released. So a
tap is lost when the client's pump takes both of its edges before the next
60 Hz callback, which is what a client stall does; the stalled client then
sends both key actions at once, which is why the host relayed the lost taps'
down and up in one turn.

To reproduce stalls on demand, a host-side driver stopped one client's
Warcraft III process (SIGSTOP, SIGCONT) for 120–250 ms every 0.9–1.6 s,
alternating clients, about 170 stops per run.

**Fix.** The local player's key-down events are reconciled with the polled
state (smashcraft:ts/src/platform/osKeys.ts, per client in `ShellState`):
each rise a poll observes is matched by the key-down event that follows it
within 240 polls; a key-down event with no observed rise is a press the
polls missed and is owed. A poll reports one owed press as held when the key
is up and the previous poll reported it up, so every owed press becomes its
own pressed row and release row, also when the key is held again when the
event arrives or several events arrive together. A rise that comes while a
press is owed takes the owed press (the headless order, where the event
comes first). Events owe a press only in a running, unpaused rollback match.
Replaying this rule over the recorded raw states and events of all twelve
client-runs gives exactly one press per key-down event in each; the first
version, with one owed slot, dropped one of two events that arrived while
the key was held (192 events, 191 presses).

| Run | Client | Taps sent | Host one-turn pairs | Pressed rows |
| --- | --- | --- | --- | --- |
| before, no stalls | a | 187 | 0 | 187 |
| before, no stalls | b | 192 (191 reached the host) | 0 | 191 |
| before, stalls | a | 187 | 55 | 130 |
| before, stalls | b | 192 | 90 | 99 |
| after, stalls | a | 187 | 55 | 187 |
| after, stalls | b | 192 | 50 | 192 |
| after, no stalls | a | 187 | 0 | 187 |
| after, no stalls | b | 192 | 0 | 192 |

No run desynced. The headless pair reproduces the loss with Wisp's
`Lockstep.press`, which sends a key's down and up before the next callback
(headless key state follows the event, the opposite order to native): 12
attack taps in a two-human rollback match on keyboard input gave 0 pressed
rows before the fix and 12 after; 5-frame and 1-frame holds alternating with
taps also gave 12.

## Held-key reads under round-trip delay (wisp#32, 24 October 2026)

Asked: does `BlzIsKeyPressed` report a press only once the press's
synchronized key event has gone to the host and back? If so, every
millisecond of round trip, and every turn of a relay's jitter buffer, adds
to a player's own input delay. Measured on Warcraft III 3.0.0.24268
(Classic, offline LAN pair 1 on gex45, 60 fps cap), integrity build of
59824cc9b, Rifleman quick match, light scripted taps of `c` for
50–90 ms every 280–520 ms on both clients through private-desktop XTEST,
80 s per run, the host deadline-paced at `--turn-ms 17,17,16` (Wisp
origin/main's LAN host, which Smashcraft's pinned Wisp does not have yet).
`wisp lan netem --pair 1 --rtt R` delayed every loopback send by R/2 for
R = 0, 100 and 200 ms, no loss, then R = 0 again. The first match after the
pool started was thrown away.

Method. `-dev callback-clock` records `os.clock` at every `shell.tick`
callback with the raw `BlzIsKeyPressed` state, and at every synchronized
key-down event of the probe key. The driver stamps each press on the host's
wall clock. `os.clock` minus wall time held its median within 2 ms over the
four measured runs on each client process, so one per-client offset, fitted once at R = 0 as the moment a
press reaches the client's input pump, places every later run's callbacks
on the press's clock. Press-to-held is from the press to the first callback
that reads the key down; zero is that fitted pump arrival, so values below
zero are presses that arrived early in their frame. Held-to-event and
press-to-host need no fitted offset (one clock each).

| RTT | Client | Taps seen | Press to held p50 (p5–p95) ms | Held to key-down event p50 (p5–p95) ms | Press to host p50 ms | Raw key down inside the key-down handler |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | a | 187/187 | 4.0 (−7.0–16.1) | 26.3 (22.5–41.3) | 11.4 | 184/187 |
| 0 | b | 192/192 | 5.7 (−5.7–17.0) | 26.3 (22.2–48.8) | 12.3 | 188/192 |
| 100 | a | 187/187 | 3.9 (−6.6–14.9) | 126.4 (121.3–149.0) | 62.8 | 0/187 |
| 100 | b | 192/192 | 3.9 (−7.2–16.3) | 126.8 (121.1–150.2) | 62.9 | 0/192 |
| 200 | a | 187/187 | 5.0 (−6.4–16.3) | 226.6 (214.8–250.7) | 113.8 | 0/187 |
| 200 | b | 192/192 | 4.2 (−6.1–16.3) | 226.4 (220.4–248.3) | 114.0 | 0/192 |
| 0, after | a | 187/187 | 3.8 (−8.1–15.4) | 26.5 (21.1–49.5) | 12.8 | 183/187 |
| 0, after | b | 192/192 | 4.1 (−7.3–15.9) | 26.7 (21.6–50.0) | 13.7 | 190/192 |

Every run held 60.00 turns a second at game pace 1.000 with no host waits
and no desync.

**Verdict: the read is local.** Adding 200 ms of round trip moved the
press-to-held median by +1.0 ms on client a and −1.5 ms on client b, under
one 16.7 ms frame, while the key-down event moved by the full 200 ms and
the press reached the host 100 ms later. By wisp#32's rule (the read waits
for the echo if the median grows by at least half the added RTT, and is
local if it moves by less than one frame), `BlzIsKeyPressed` reads the
client's own input pump, as smashcraft#218 found at RTT 0. At 100 and
200 ms a 50–90 ms tap was already released when its event arrived, so the
raw state read up inside every handler. A player's own pressed row
therefore does not pay the relay's round trip or jitter-buffer depth; the
opponent's view and rollback depth do (wisp:docs/relay.md, "How it meets
Smashcraft's frame-stamped inputs and rollback").

## Callback silences in a two-human match with a CPU (smashcraft#416, 26 October 2026)

Asked: in a native two-human match with one CPU, what does each client's
Lua cost per callback, and what causes each silence over 25 ms between
callbacks: a rollback spiral (our own Lua overrunning its frame), the relay
(turns leaving the host late), or neither? Measured on Warcraft III
3.0.0.24268 (Classic, offline LAN pair 15 on gex45, 60 fps cap, Wisp's LAN
host at 25 ms turns), native-perf build of 24f1320250, Sky Deck, Rifleman
on both human slots against a CPU Illidan, nine stocks. A host-side driver
tapped random movement, attack, special, shield and jump keys on both
clients; the host relayed 156 and 154 key events (about 78 taps each,
one every 2.6 s) during the capture, so the humans' input was light.
Other sessions' LAN clients ran on the same host;
`/proc/pressure/cpu` some avg300 read 44.7% a minute after the capture.

Method. `-dev callback-clock 10800` and `-dev capture 10800` started on
turns 2995 and 3338, so the clock and the frame-cost capture
(wisp:docs/frame-cost.md) overlap for 10,285 callbacks; the first 515 clock callbacks have no Lua
cost, and none of their silences passed 41.7 ms. Every one of the
18 `r` checkpoints puts each capture 515 callbacks after its clock, on both
clients. The host's `actions.log` gives a send time for 6,417 of the
capture's 8,193 turns. Each client's clock is placed on the host's clock
at the callback after the `-dev callback-clock` turn; that anchor is good
to about one frame, so host gaps and the other client's gaps are read
within 25 ms of each silence. A silence is named by these rules, in order:

- **spiral**: the callback before it ran at least one 16.7 ms frame of Lua,
  more of it in the reconcile, confirmed and speculative sections than in
  presentation, camera and UI;
- **neither, presentation**: the same, but presentation, camera and UI cost
  more than the simulation;
- **neither, turn cadence**: at most 41.7 ms, one 25 ms turn plus one 60 Hz
  frame, which turns drawn on frames produce on their own;
- **relay**: longer, the host's turn gap there covers it to within a frame,
  and the other client is silent past 41.7 ms there too;
- **neither, local stall**: longer, with the host and the other client on
  time.

`bun wisp perf native CAPTURE.txt bot --samples bot.perf` read both
captures against `bun wisp perf bot --samples` at the same commit.

| Client | Callbacks | Lua p50 / p95 / p99 / max ms | Gap p50 / p95 / p99 / max ms | Silences over 25 ms | Turn cadence | Spiral | Presentation | Local stall | Relay |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | 10,800 | 5.0 / 9.0 / 12.0 / 28.0 | 19 / 28 / 32 / 54 | 1,914 | 1,894 (≤ 41 ms) | 12 (≤ 39 ms) | 2 (≤ 31 ms) | 6 (44–54 ms) | 0 |
| b | 10,800 | 5.0 / 9.0 / 13.0 / 30.0 | 19 / 28 / 31 / 55 | 1,885 | 1,860 (≤ 41 ms) | 9 (≤ 35 ms) | 2 (≤ 33 ms) | 14 (42–55 ms) | 0 |

**No silence was the relay.** Of 5,255 consecutive logged host turns, 23
left more than 30 ms after the one before and one more than 41.7 ms
(49 ms, at host time 108.7 s). Both clients were in heavy callbacks there,
and their silences stayed within 38 ms.

**Spirals are short.** The 21 spiral silences lasted 26–39 ms. Each
followed a callback of 17–30 ms of mostly simulation: 19 stepped one or two
catch-up frames, and two spent 7 ms in reconcile. Speculative ran 6–10
frames ahead of confirmed. None reached two turns. The largest cluster was
four on client a within 0.2 s, at host time 108.6–108.8 s, around the
host's one 49 ms gap. The four presentation silences were 29–33 ms.

**The longest silences were local.** All 20 silences over 41.7 ms
(42–55 ms) followed callbacks of 3–9 ms of Lua, while the host kept
sending turns 24–30 ms apart and the other client stayed within cadence.
The client itself did not run a callback for that time, and our Lua was
not running. On a host this loaded, that is consistent with the process
not being scheduled, but this run cannot name the cause inside Warcraft.

**Headless over-predicts the tail.** `perf native` gave the same windows
on both clients: median 5.00 ms against 6.04 predicted (+21%), p95
8.97 ms against 14.10 (+57%), and worst window 12.02 ms (a) and 13.00 ms (b)
against 34.24. It exits FAIL on its 20% median and p95 rule. The
prediction comes from `perf bot`'s bot-only match, not from this two-human
match with one CPU.

## Remote key events against remote sync rows, and drawing at burst game time (smashcraft#419, 27 October 2026)

Asked (#14, N3 and N4): does a client see the opponent's synchronized key
event or the opponent's frame-stamped input row first, and how far does the
picture trail each burst's game time with and without `-dev smooth-draw`?
Measured on Warcraft III 3.0.0.24268 (Classic, offline LAN pair 0 on gex45,
60 fps cap, Wisp's LAN host deadline-paced at 25 ms turns), integrity build
of this commit, Rifleman quick match with nine stocks, light scripted taps of
`c` for 50–90 ms every 280–520 ms on both clients through private-desktop
XTEST. One match: 20 s of taps thrown away, then an 80 s capture with
`-dev smooth-draw on` and an 80 s capture with `-dev smooth-draw off`. The
host relayed every turn with no desync. Other sessions' LAN pairs ran on the
same host; `/proc/pressure/cpu` some avg60 read 37–53% around the captures,
and both clients stalled for stretches of the match.

Method. `-dev callback-clock` (v=3, smashcraft:ts/src/host/loop/callbackClock.ts)
now also records, on `os.clock`, every remote key-down and key-up of the probe
key (`D`, `U`), every accepted remote input row that carries a press (`s`,
with its frame), and one `b` token per turn burst: the burst's last Lua
callback, the game time of a probe timer, the burst's frame phase
(smashcraft:ts/src/host/loop/betweenFrames.ts `burstAlpha`), the drawn phase
(`drawnAlpha`), and the burst's draw and tick callbacks. A burst ends at a
gap of 2 ms or more between Lua callbacks. N3 pairs taps exactly: the
receiver's k-th remote key-down is the sender's k-th tap (both clients see the
same synchronized events in the same order); on the sender's own clock its
pressed-row captures are aligned in order to its own key-down echoes, a tap
with no captured row being skipped; and the receiver's `s` row with the same
frame is that tap's row. N4 takes each burst's game time against what it
presents: with smooth-draw on, a point between the last two simulation frames
at the drawn phase (one frame behind by design); with it off, the latest
simulation frame.

**N3: the key event arrives first.** Not one of 718 paired taps had its row
arrive before its key event:

| Run | Sender to receiver | Taps | Taps with a pressed row | Key event first | Same burst | Row first | Row after key p10/p50/p90/max ms | p50 by fifth of the run, ms | Callbacks p50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smooth-draw on | b to a | 192 | 171 | 169 | 2 | 0 | 133 / 1,746 / 2,515 / 3,410 | 160, 1,093, 2,099, 1,951, 2,130 | 102 |
| smooth-draw on | a to b | 187 | 178 | 175 | 3 | 0 | 25 / 208 / 2,007 / 3,224 | 1,872, 228, 147, 139, 112 | 9 |
| smooth-draw off | b to a | 192 | 192 | 187 | 5 | 0 | 16 / 83 / 825 / 1,875 | 873, 74, 74, 56, 47 | 6 |
| smooth-draw off | a to b | 187 | 178 | 177 | 0 | 0 | 82 / 1,415 / 2,031 / 2,819 | 82, 398, 1,677, 1,553, 1,829 | 83 |

In steady stretches the row trails its key event by 47–228 ms at the median;
in stretches where the sender's rows back up, by 1–2 seconds, and the
receiver's speculative frame then runs 72–125 frames ahead of its confirmed
frame (24–30 in steady stretches, the `r` checkpoints). The key event carries
no frame, so it can tell rollback that a press is coming, not on which frame.
Taps with no pressed row (21, 9, 0 and 9 of them) are the dropped taps of
smashcraft#218: the stalled sender's pressed-row capture never saw them.

**N4: drawing at burst game time trades about 1.6 ms of median latency for
even steps.** Game minus presented time per burst, and how far each burst's
presented step differs from its game step:

| Run | Client | Bursts | Game minus presented p10/p50/p90/max ms | Presented step minus game step p50/p90/p99 ms | Bursts with no draw after their tick |
| --- | --- | --- | --- | --- | --- |
| smooth-draw on | a | 6,723 | 17.6 / 17.6 / 19.6 / 20.6 | 1.0 / 2.9 / 2.9 | 101 |
| smooth-draw on | b | 6,150 | 17.6 / 17.6 / 18.6 / 20.6 | 0.0 / 2.0 / 2.9 | 93 |
| smooth-draw off | a | 5,638 | 7.6 / 16.1 / 16.6 / 16.6 | 0.1 / 12.7 / 15.9 | 0 |
| smooth-draw off | b | 6,200 | 4.0 / 15.9 / 16.5 / 16.6 | 4.9 / 13.7 / 16.2 | 0 |

Each capture ran 4,800 frames. Off, the picture holds the last simulation
frame, so it trails game time by anything from 0 to one frame and a burst's
step on screen misses its game step by up to a frame (p90 12.7–13.7 ms).
On, the picture trails by one frame plus 0.9–3.9 ms and each step matches its
game step within 2.9 ms at p99. That misses the 0.5 ms a burst that
docs/high-refresh.md asks before players' builds turn it on, and these are
placements from Lua, not drawn pixels, so the default stays off. Bursts with
no draw after their tick (1.5%) keep the placement from before the tick and
are left out of the on rows.
