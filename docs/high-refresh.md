# Presentation cadence in Warcraft III

Smashcraft executes its deterministic simulation at 60 Hz. A faster display
can only show additional fighter positions if Warcraft calls map Lua between
those simulation updates. A high timer callback count alone does not establish
that: multiple timer expirations can execute together before one frame is drawn.

## API and prior art

The declarations consumed by Smashcraft's Wisp pin
`2d04060f674e8280b4791e37b962da382b42da00` expose timers and UI events but no
general render-frame callback. The independently pinned
[jassdoc common.j at d49b2ba](https://github.com/lep/jassdoc/blob/d49b2ba47c72ad757aa17abdfa9ccd55a7493fd5/common.j)
provides the following evidence. Jassdoc annotations are community observations;
they do not establish current Warcraft III 3.0 behavior.

| Candidate | Source evidence | Consequence for presentation |
| --- | --- | --- |
| `TimerStart(timer, 0, true, callback)` | The `TimerStart` annotation reports 10,077 callbacks/s on 1.32.10. | Measure callback spacing and bursts against actual rendered frames; zero does not mean once per render. |
| `TimerStart` at 1/1024 s | An exact binary32 period provides a second timer candidate without period rounding drift. | A larger callback count is useful only if callbacks occur between rendered frames. |
| `TriggerRegisterTimerEvent` | The same annotation reports a 100 Hz ceiling on 1.32.10, including a zero period. | A distinct historical timer path, without a render-rate contract. |
| `FRAMEEVENT_SPRITE_ANIM_UPDATE` | The annotation says it is not functional and has no implementation in the internal event map. | Its name is insufficient evidence for using it as a render hook. |
| Other frame events | Click, mouse, edit-box, slider and dialog events describe user actions. | They do not provide a continuous rendering clock. |
| Camera API | Position, field, controller, noise and smoothing functions expose no `code` callback registration. | Native camera smoothing is not a Lua callback for moving fighter effects. |

[Hive's game-events versus timer discussion](https://www.hiveworkshop.com/threads/using-game-events-as-a-clock-source-instead-of-timers.338408/)
compares periodic timers with unit attacks and time-of-day events. It reports
several update rates, and discusses multiple expirations inside one simulation
update. Those game events provide a distinct clock approach, but none promises
display refresh cadence. Its timer counts include an exact 1/1024 s period.

[Hive's high-FPS UI movement report](https://www.hiveworkshop.com/threads/frames-begin-moving-with-noticeable-delay-in-network-mode-even-with-just-1-player-when-fps-exceeds-270.363069/)
reports different behavior above and below 270 fps in a multiplayer match using
1 ms timers. It demonstrates why actual FPS and multiplayer mode belong in
the measurement; the discussion does not establish a render hook or a cause.

## Native probe

Development builds expose `-dev render-clock`. It runs zero-period and
1/1024-second periodic timers together for four game seconds, writing each
client's `smashcraft-render-clock-pSLOT-runN.txt` in CustomMapData. All timer
handles and callback registrations are created and freed at synchronized times.
Clock samples and reports remain local and never change simulation state.

The report includes total callbacks, retained samples, whether the 64,000-sample
bound was hit, clock resolution, callback burst spacing, callbacks per burst,
game-time steps and recording cost per callback (mean, median, p90 and maximum).
Cost covers the two clock reads, array recording and `TimerGetElapsed`; it is
instrumented callback work, not an estimate of a future interpolation pass.
Values below the clock's resolution cannot be resolved individually.

The `bursts` field groups callbacks separated by more than 1.953125 ms, or twice
the observed clock step if larger. It does not count renderer frames. `os.clock`
is a runtime-provided clock whose relation to elapsed real time must be checked
against the renderer capture duration; a stopped clock or CPU-time-only clock
cannot establish presentation cadence.

Run the same development map and match on an offline LAN pair using Wisp's
`parity` (60 fps) and `hfr` (144 fps) profiles. These profiles differ only in
foreground/background FPS caps. Keep game speed, resolution, graphics settings,
match setup and candidate bytes fixed. After scene loading, invoke the command
once per cap and retain both clients' reports, game version, effective
War3Preferences, renderer frame times/FPS, and error/desync status. The declared
`169-render-clock` native check waits for the report; changing the pool profile
and retaining renderer telemetry remain the native session owner's work.

If callback bursts stay near 60 Hz while the renderer reaches 120–144 fps, timer
interpolation cannot provide fresh positions for those additional frames. If a
candidate tracks the renderer instead, compare its callback cost with the frame
budget before enabling interpolation. Issue #169's native result, rather than
the API names or synthetic tests, decides between these outcomes.

Warcraft III 3.0.0.24268 was measured on source `c7da1c70`, with the same
development map and 1280×720 client on offline LAN pair 1. The native DXVK
renderer overlay reported 151.1 and 135.5 fps on a private output verified at
144.000000 Hz. During the four-game-second probe, the zero-period timer made
40,329 callbacks in 204 bursts (50.8 bursts/s); the 1/1024-second timer made
4,096 callbacks in 217 bursts (54.1 bursts/s). Median game-time steps between
bursts were 24.902 and 24.414 ms. Neither tested timer supplied a callback for
each rendered frame, so presentation retains its 60 Hz simulation updates and
the optional interpolation remains disabled for players.

Recorded callback work averaged 2.06 µs for period zero and 2.19 µs for
1/1024 s, totaling 82.962 and 8.987 ms. The clock step was about 1.007 ms;
individual sub-step callback costs cannot be resolved, and this does not
measure a future interpolation pass. These measurements concern the two timer
candidates, not a guarantee about every engine mechanism.

The probe was repeated on 25 October 2026 against Wisp's deadline-paced LAN
host (wisp:docs/relay.md, "Turn cadence"). The run used the development map
built from source `3636da27b3` on offline LAN pair 2 of the laptop, with
Warcraft III 3.0.0.24268. Wisp's `hfr` profile drew an 800×600 Classic client
capped at 144 fps. Each private output read back 840×640 at 144.000000 Hz
after `wlr-randr --custom-mode 840x640@144Hz`. The first match after the pool
started was discarded. Each turn length then got a new game, `-dev quick` and
one `-dev render-clock`.

Every run had 2 Warcraft clients live, and CPU `some avg10` stayed at or below
1.4. Renderer fps comes from three `DXVK_HUD=fps,frametimes` readings per
client, taken during the probe. Game pace is the probe's game time divided by
its `os.clock` time. Each value is client a / client b, period-0 timer, with
the 1/1024 s timer in brackets.

| Turns | Bursts/s | Median game-time step | Callbacks per burst (p50) | Renderer fps | Game pace |
| --- | --- | --- | --- | --- | --- |
| 8 ms | 98.1 / 80.8 (99.3 / 86.6) | 10.010 / 10.254 ms (9.766 / 10.742) | 100 / 103 (10 / 11) | 143.4 / 145.7 (139.2–153.4) | 1.0007 / 1.0009 |
| 17/17/16 ms | 91.9 / 92.8 (92.4 / 92.8) | 10.010 / 10.010 ms (9.766 / 9.766) | 100 / 100 (10 / 10) | 152.1 / 153.2 (151.0–155.9) | 1.0012 / 1.0004 |

Interpolation is not feasible with 8 ms turns. Bursts/s reached 68% and 55% of
renderer fps, against the 90% the verdict requires, although game pace held
within 1.000 ± 0.002. The 8 ms turns gave no more bursts than the 17/17/16
control. Both settled near 90 bursts a second, about one burst every 1.6 drawn
frames, so the turn length does not set the callback cadence. An 8 ms turn
also allows at most 125 bursts a second, which the 90% rule meets only below
about 139 fps; the renderer ran above that. Players' builds therefore keep
presentation at the 60 Hz simulation update, and the optional interpolation
stays disabled. Raw reports, HUD captures, mode read-backs and pressure logs
are retained at
`~/.local/state/smashcraft/evidence/sc-18-realtime-laptop/h229/`.

For a high-refresh private run, verify the compositor output as well as the
game's FPS cap. The private-desktop launcher creates its output at 60 Hz;
raising the game cap alone left the renderer at 56.6–58.9 fps. On the exact
owned private runtime, `wlr-randr --output HEADLESS-1 --custom-mode
1320x760@144Hz` changed that output to 144 Hz. Confirm the resulting mode and
retain actual renderer samples, such as `DXVK_HUD=fps,frametimes`, before
interpreting timer cadence. Raw reports and renderer samples are retained at
`~/.local/state/smashcraft/accept/codex-native-render-clock-20261007/`.

## Presentation interpolation

Native-input builds' existing response export includes `Q` rows beside `A`
(callback times and frame cursors), `B` (corrections), and `P` (fighter
positions). A `Q` row records the canonical camera, the local camera after
aspect and corner limits, and the engine's camera fields immediately before
that callback applies its next camera request. Each camera records x, z,
distance and tangent; the engine field uses its native FOV in radians instead
of tangent. The native x and z are relative to the arena origin and floor.
Recording overwrites preallocated rows and exports them after the capture.

These are callback samples. Match their response marker to actual rendered
frames and retain the renderer's timestamps to measure holds, skipped
simulation positions and the drawn camera. Neither `Q` nor `drawnFrame` files
alone record every rendered frame. `SetCameraField` currently requests zero
duration; a timed transition experiment also needs to change the camera bounds
that currently constrain x to the newly requested target on every callback.

`-dev camera-smooth on` enables that experiment in a development map:
`PanCameraToTimed` and the changing camera fields request a one-match-frame
transition, while the engine's x bounds encompass the stage's camera range.
The canonical camera and its local aspect/corner limits stay unchanged.
`-dev camera-smooth off` restores the default instantaneous requests. Pausing
applies the last camera immediately. Compare both modes on the same native
map and rendered-frame capture before choosing the playable default.

`bun scripts/cameraDraw.ts --video PRIVATE.mkv --pages DATA_DIR --out PRIVATE_DIR`
reads each video's original presentation timestamp and decodes the probe's
magenta 128-cell marker, joining each captured frame to its exported A/B/P/Q
row. `--viewport X,Y,W,H` crops a whole-output recording to the exact game
window; `--slot` and `--run` select the response export. The marker sits
in the 4:3 UI area, which a widescreen window centres. Native-input maps draw
it from their per-epoch recording too, so the reader counts rows back from the
frozen marker after Ctrl+H, which is the export's last row: start the recorder
before Ctrl+G and stop it after Ctrl+H. The reader reports retained
frame intervals, held match frames and multiple match-frame advances, and
writes the matched timeline for pixel analysis. It deliberately leaves drawn
camera measurement unset: callback camera fields alone cannot establish it.

`bun scripts/stepEvenness.ts --video PRIVATE.mkv --pages DATA_DIR --out PRIVATE_DIR
--viewport X,Y,W,H [--run N --fighters 0,1 --projection FILE]` measures fighter
steps in pixels on the same join (smashcraft:ts/scripts/stepEvenness.ts). With
`-dev view far` holding the camera still, it subtracts a temporal-median
background, takes each fighter's foreground centroid near its projected `P`
position and divides each rendered frame's step by that fighter's projected
per-frame velocity, so steps read in simulation frames. Pixel-identical
captured frames are compositor repeats, not rendered frames, and are skipped.
A run without `--projection` fits the world-to-screen projection and each
facing direction's centroid offset, and writes them to `projection.json`; fit
it with smooth drawing off, where the drawn position is `P[f]`, and pass it
to the smooth-drawing run, whose lag (P[f] − drawn)/(P[f] − P[f−1]) then
reads added latency in frames. `--camera` instead measures the background's
horizontal shift per rendered frame against the `Q` local camera's per-frame
motion, and the engine camera's lag behind that request.

For the private compositor, `wf-recorder --no-damage --codec libx264rgb
--codec-param preset=ultrafast --codec-param crf=0 --pixel-format rgb24
--file PRIVATE.mkv` retains lossless pixels, held frames and original video
timestamps. Omit `--framerate`, which would replace timing with a constant
rate. Set and read back the output's 120 Hz mode and the game's cap separately;
the captured intervals decide the observed recording cadence.

Renderers place moving effects (fighters, their lights, projectiles and pooled
effects) through `placeEffect` (smashcraft:ts/src/game/render/effects.ts). By
default it only sets the position. `-dev smooth-draw on` starts a 1/1024 s
draw timer (smashcraft:ts/src/host/loop/betweenFrames.ts). Warcraft runs Lua
only in turn bursts, so the timer's last callback in each burst places each
effect at the burst's game time, between where the last two simulation frames
put it (smashcraft:ts/src/game/render/motion.ts): every burst then advances
the picture by the same game time, trailing the simulation by at most one
frame and snapping on teleports. `-dev smooth-draw off` places effects at the
simulation frame again; the timer keeps running. The rates line's `dru` is the
draw callbacks' os.clock microseconds per second, and the rates report prints
`draw us/burst`. Drawing never reads or writes simulation state:
smashcraft:ts/test/high-refresh.test.ts checks that every confirmed checksum
of a quick match played in one- and two-frame bursts matches with drawing on
and off. Players' builds keep it off until a native capture shows even
fighter steps within 0.5 ms a burst and one frame of added latency.

The first such capture (19 October 2026, signed-in clones on Battle.net,
1280×720 Classic at a 60 fps cap on a 60 Hz private output, native-input map)
kept it off. The game rendered about 42 distinct frames a second, near the
40 bursts a second. With drawing off, 13% of rendered frames held the
simulation frame and 40% and 41% advanced it by one and two; with it on,
pixel steps narrowed (interquartile range 0.95 against 1.37 simulation frames,
median 1.75). Drawing cost about 0.53 ms a burst in seconds with a running
fighter (0.4–0.68 ms; 0.1–0.3 ms standing), because every 1/1024 s callback in
a burst repositions every moving effect. The pixel lag was too noisy to bound.
In the same session, with the match camera and smooth drawing on,
`-dev camera-smooth on` did not even the background's steps (interquartile
range 0.88 against 0.79 simulation frames off) and moved the engine camera's
median lag behind its request from 1.0 to 1.9 frames, so it stays off.
