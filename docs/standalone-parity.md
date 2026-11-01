# Standalone parity with the Warcraft build

`bun wisp play --standalone` runs the same map code as the Warcraft build, but
the frames, sound, input and clock come from Wisp's browser player, not from
Warcraft III (wisp:docs/play.md, "Standalone window"; smashcraft:docs/play.md).
This audit (smashcraft#804, online plan box P1) lists each surface where the
two differ. Each line names the difference, the check that shows it and either
the box that fixes it or the reason it stays. It blocks the player build
(smashcraft#807) and sits beside the frame-for-frame pad comparison
(smashcraft#806).

## Rendering

- **Lighting and effects levers.** Wisp's Classic profile draws day/night
  light, fog, sky, sun shadows, water and the cinematic filter. It does not
  draw point lights, PBR, point-light shadows, bloom, ambient occlusion or
  height-fog falloff, and terrain is unsupported (Smashcraft hides it and draws
  each stage's sea as a model). Check: the profile table in
  wisp:docs/headless.md ("Graphics profiles") and
  `bun wisp fidelity check LEVER --reference DIR --candidate DIR` per lever
  (wisp:docs/fidelity.md), which returns PASS, FAIL or INCONCLUSIVE against
  frozen native captures. Stays: Warcraft's renderer is fixed
  (smashcraft:docs/design/visual-quality.md, "The renderer is fixed"), so an
  absent lever changes look, not play; a lever whose gate returns FAIL gets its
  own box when that verdict exists, and none is recorded for the standalone
  window yet.
- **Stage-specific gaps.** Stratholme draws without two models that name the
  missing `TerrainArt\Misc\misc_CharredEarth.blp`, and Naxxramas without
  `NaxxDeco0`; Nordrassil, Blackrock and Hellfire lack bloom or omni lights
  that their native stages show. Check: the "Smashcraft's stage matrix" table in
  wisp:docs/headless.md, and `bun wisp headless --render` of that stage beside a
  native capture of it. Stays until a stage issue asks for the missing model:
  the levers involved are not load-bearing for the fighter, deck and HUD reads
  (smashcraft:docs/graphics-settings.md, "What Smashcraft reads on screen").
- **Fighter presentation profile.** Live standalone play defaults to
  `pool-predicted`, scripted runs to `native`; live Warcraft play also defaults
  to `pool-predicted`. Check: `bun wisp play --standalone --window chrome --headless --script
  test/native/pads/cpu-expert.pad --frames 1070 --out DIR --presentation native`
  against `--presentation pool-predicted` (smashcraft:docs/play.md). Box:
  smashcraft#806 compares both profiles frame for frame with the native
  recording.

## Menus and HUD

- **Entry path.** The standalone window never shows the title, fighter
  selection or settings menus: `createStandaloneSession` runs the developer
  command `-dev quick cpu wren expert hero illidan` (or the four-fighter setup)
  and throws "standalone match did not start" unless the match phase begins
  (smashcraft:ts/scripts/wisp/standalone.ts). Check: read that function; the
  lobby, selection and settings frames in `ts/src/game/ui/` run in the Warcraft
  build alone. Stays for now: the player's choices are the command line's, and
  a menu-driven entry is a new outcome that belongs with the player build's
  packaging (smashcraft#807).
- **Pointer, text and the Game Menu.** The page registers only `keydown`,
  `keyup` and `blur` listeners (wisp:host/browser/standalone.ts), so no mouse
  click, cursor, text box or F10 Game Menu reaches the map, while the Warcraft
  build keeps its cursor on select and wakes it for the single-player Game Menu.
  Check: the same file has no pointer listener; clicks and typing exist only as
  `Lockstep.click` and `Lockstep.type` in headless journeys
  (wisp:docs/headless.md, "Typing and clicks"). Stays: every in-match verb is a
  key, and Enter starts or pauses (wisp:docs/play.md).
- **HUD frames.** The match HUD, results banner and fighter plates are map
  frames (`BlzCreateFrame*` in `ts/src/game/ui/`). Standalone draws a frame's
  parent visibility, texture and text through Wisp's UI renderer over the same
  4:3 area (0.8 by 0.6) as Warcraft. Check: a scripted run's scene JSON per
  `--capture-frames` frame lists the frames shown, to compare with the native
  screenshot of the same match frame from `bun scripts/nativeCapture.ts`
  (smashcraft:docs/commands/native.md); a frame the map declares and the scene
  omits is a standalone gap. No such comparison has been recorded for the
  standalone window, so the HUD's parity stands on the shared renderer and not
  on a measurement. Stays: that comparison belongs with smashcraft#806's native
  recording, which already holds the same match frames.

## Sound

- **Cue timing.** Both builds run the same map calls, so which sound or track
  starts on which frame is the same by construction. Check: from `ts/`, `bun
  wisp headless quick-match --sound-cues FILE.json --json` (run for this audit
  on 2026-10-30, 5.9 s) logged 1,492 events: 1,486 `sound create`, 4 `music
  start` and 2 `music stop`, each with source, frame and gain
  (wisp:docs/audio.md). It logged no `sound start`: the journey makes the
  sound bank's handles and plays no fighter cue, so it shows stage music
  (smashcraft:docs/design/stage-music.md) but cannot show move cues. Stays:
  move-cue timing has its own checks, the event sounds of smashcraft#82 and
  the voice budget (smashcraft:docs/commands/native.md, "Voice budget").
- **Playback.** The window plays decoded sounds through the browser; Warcraft
  mixes with its engine, adds automatic model-event sounds and scales music by
  the player's slider, none of which the cue log carries
  (wisp:docs/headless.md, "Rendered frames and sound cues"). Check:
  `standalone.json`'s audio event, ready and playback counts and its list of
  missing sounds, against the native client's sink recording `audio.wav` from
  `bun scripts/nativeCapture.ts run`. Stays: volume as heard and device
  output are native-only readings, and a missing sound is already a listed
  failure in `standalone.json`.

## Input

- **Controller path.** Warcraft takes controller input through the helper in
  smashcraft:controller, including the analog cursor packet and trigger
  pressure (smashcraft:docs/melee-analog-shield.md,
  `ts/src/host/loop/analogPad.ts`). The window takes keyboard keys and the
  browser Gamepad API, and `heldKeys` turns a stick past 0.28 into a digital
  direction (smashcraft:ts/scripts/wisp/standalone.ts), so a standalone pad
  cannot produce analog shield pressure. Check: read `heldKeys`, and run the
  same pad in the native build's analog diagnostics. Stays: the digital map is
  what `cpu-expert.pad` and net-accept feed both builds, and an analog browser
  path is new input design, not parity.
- **Press accounting.** Pad scripts and live keys both end as key events the
  map samples. Check: `bun wisp net-accept --out DIR` reports for every round
  trip the presses lost or extra, rows off their assigned frame, presses that
  differ on the remote and the ticks from press to the local view, and fails
  past 3 (smashcraft:docs/commands/net-accept.md; `pressAccounting` in
  smashcraft:ts/scripts/wisp/netAcceptance.ts). That shows the standalone
  transport carries presses without loss; the Warcraft side of the same count
  is the `net pair` run (smashcraft:docs/commands/play.md). Stays: both are
  held to the same count.
- **Latency.** The window draws the scene stepped from the previous display
  frame's input, so each scene shows input one display frame (16.7 ms at 60 Hz)
  later than it was read; Warcraft adds its own client and vsync delay. Check:
  the press-to-local-view ticks in net-accept's accounting, and `presentedMs` in
  `standalone.json`. Stays: the one-frame lead is the pacing that keeps a slow
  step from missing a display frame (wisp:docs/play.md).

## Frame time

- **Frame cost and cadence.** The window's frame is the map step plus Chrome's
  draw, paced by `requestAnimationFrame` and bounded by the display; the
  Warcraft build's frame is the map callback under Warcraft's frame cap
  (`maxfps`, smashcraft:docs/graphics-settings.md) and its renderer. The window
  also needs a gpu capacity lease and Chrome. Check: `bun wisp play
  --standalone --window chrome --four-fighters --frames 7200 --out DIR` prints the frame-time
  p95 against the 16.7 ms target and keeps every frame in `DIR/standalone.json`;
  `bun wisp net-accept --four-fighters --out DIR` requires both windows'
  `presentedMs.p95` at most 16.7 ms at each round trip; the Warcraft side is
  the frame-cost capture in `ts/src/platform/frameMeter.ts`. No four-fighter
  run was made for this audit. Stays: the two clocks measure different work, so
  the standalone claim is the window's own p95 and the Warcraft figure is a
  separate reading of the same map's callbacks.
- **Startup.** The window loads the visible scene's models before its first
  step and records startup time and prepared asset counts apart from frame
  timing; Warcraft loads the map before it shows a frame. Check: the startup
  fields of `standalone.json`. Stays: startup is outside the match's frame
  budget.

## Netcode transport

- **Transport and joining.** Standalone matches use Wisp's UDP lockstep with a
  join code carrying the host address, port and the first 8 hex digits of the
  map hash, with no relay and no hole punching; the Warcraft build uses
  Battle.net or LAN and the map's own rollback journal. Check: `bun wisp
  net-accept --out DIR` (checksums compared, mismatches, rollback depth and
  press accounting at 0, 60 and 120 ms round trip with 1% loss;
  smashcraft:docs/commands/net-accept.md). Stays: both builds must reach the
  same simulation checksum, which is the parity claim; addressing differs by
  design.
