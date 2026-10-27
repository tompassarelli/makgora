# Play current Smashcraft

Players download the map from [Hive Workshop](https://www.hiveworkshop.com/threads/smashcraft-0-1-0.375492/).
Put it
in the Warcraft III Maps folder and open it from Custom Games. The GitHub
repositories contain code only; maps are distributed on Hive Workshop.

`bun wisp play --standalone` opens Smashcraft in the Wisp browser player,
with Illidan against a Wren Expert Rifleman over the normal three stocks and
seven-minute clock. Keyboard controls and the browser's gamepad controls enter
the playable map's keyboard sampling. The browser draws the map's models,
camera, effects and HUD from the headless client and plays its sound cues.

`bun wisp play --standalone --script test/native/pads/cpu-expert.pad --headless
--frames 1070 --out build/standalone-cpu --capture-frames 200,600,1000` runs
the existing native pad driver and saves each frame's checksum plus captures.
`cpu-expert.pad` is the original `cpu-level-9.pad`: commit `c0424f66` renamed
it, and `775bf730` changed its setup to `-dev quick cpu wren expert`. Every
authored pad input and its frame through 1070 stayed the same; `c2ad9697`
updated the expected damage after the CPU changes. This is the CPU fixture for
standalone/native comparisons. Map assets are read from the existing private
inputs, with stock assets cached outside the repository.

`bun wisp play --standalone --four-fighters --frames 7200 --out DIR` is
wisp#48's frame-rate measurement. It runs one game copy, as live play does:
Illidan on the bot beat's keys against computer Rifleman, Illidan and Warden,
99 stocks and a two-minute clock, so four fighters stay on stage. It prints
the frame timing summary (the target is a p95 frame time of at most 16.7 ms);
`DIR/standalone.json` keeps every frame's timing. Add `--headless` to run it
without a window. Run it under an exclusive capacity lease.

Add `--presentation native|pool-confirmed|pool-predicted` to select the map's
fighter presentation. Live play defaults to `pool-predicted`; scripted play
defaults to `native` and keeps the same authored pad driver in every profile.
Capture requests name logical match frames. Scene JSON also records the raw
headless callback frame, which includes the 30 startup callbacks.

From ~/code/smashcraft/main/ts, run `bun wisp play`. It builds current main,
points the always-on controller service at the matching helper, and hosts a match on Tom's main display
against a computer. The match plays on the keyboard; a pad the service finds
presses the same keys, and without one play says "keyboard" and goes on. It reuses the signed-in Battle.net launcher and never signs
in, logs out or switches accounts.

Maps/00-Smashcraft keeps at its top level the latest release `Smashcraft X.Y.Z.w3x` (online hosting picks it) and the newest installed main build
`Smashcraft X.Y.Z-dev.N.w3x` (the file and in-game title carry the same name). Installing a main build (`play`, `playtest:build`,
the Tom build watcher, `play --install-green`) removes every older dev build; every earlier release moves to old/, none is deleted. Only releases are public, so X.Y.Z is the next release, never a build
counter: the patch after the newest `vX.Y.Z` tag reachable from the commit
(`git describe --tags --match 'v[0-9]*.[0-9]*.[0-9]*' --exclude 'v*-*'`),
and N counts the first-parent commits on main since that tag
(`git rev-list --first-parent --count vX.Y.Z..COMMIT`), so it only grows along main and
the newest build is the highest N: `Smashcraft 0.1.1-dev.830`. The map description names the full commit. When Tom calls a release candidate, a
`v0.1.1-rc.N` tag on its commit names the build `Smashcraft 0.1.1 RC-N`
(the highest N), and the `v0.1.1` release tag names it `Smashcraft 0.1.1`. At
most one lane or test build for Tom to try sits beside the dev build (lane builds below,
`play --lobby-only MAP.w3x`); it replaces any earlier one and goes when the next
main build installs. Test, integrity, capture and diagnostic builds go to a
private folder or a pool client, never this one: `wisp map build` and
`wisp map rebuild` refuse a path inside it, and the pool clients' map installer
refuses Tom's documents folder.

The play build checks the build inputs, cue models, package and map size,
and skips the Lua cost prediction; `bun run playtest:build --predict-cost` adds it (smashcraft:docs/commands/workflow.md).

Main's smashcraft:build-inputs/ names the private inputs: base map,
container, assets and summon clips, each by the hash of its contents in the
store (smashcraft:docs/build-inputs.md). Map builds check every input against
its hash and every imported file against the script and archive. Build outputs
and proprietary assets stay outside source trees; dependency installation and
compilation happen in the revision's own worktree, under the revision's lock,
so plays started together build one map and share it. The controller helper is
optional and cached by its controller source tree (smashcraft:controller); a failed helper build leaves
the keyboard and never blocks the map. A new source revision builds a new map;
repeated runs reuse its map and helper.

Helper compilation uses one Cargo target directory at
`~/.local/share/smashcraft-build-inputs/play-helper-target`, shared across
revisions of the play-build worktree. Cargo locks its build output; the play launcher
also holds a lock through copying the finished binaries into the controller
source tree's `play-helpers/` directory, so concurrent revisions deliver their
own helper. On 8 October 2026 the old fresh-worktree build took 4m46s;
the first shared-cache fill took 4m32s and a second worktree reused it in
0.15s of Cargo time (2.147s including Nix and capacity setup).

## Every landing in Maps

The Tom build watcher (smashcraft:tools/tom-build/) builds each new tip of
main and installs it under Maps/00-Smashcraft, as `bun run playtest:build`
does, without opening the lobby. It fetches origin/main every 10 s; when main
moved to a commit it has not built, it builds that commit with the same
version numbering and revision locks as `play`, under `Nice=10` and idle I/O.
Commits that land during a build are not built one by one: the next build is
of the newest tip. A sha is built once, even after a failure or a restart
(`~/.local/state/smashcraft/tom-build/attempted`). A new build gets a new
`Smashcraft X.Y.Z-dev.N` file at the top of Maps/00-Smashcraft and replaces the previous dev build and any
lane build there; releases are left alone.
While Warcraft III runs in Tom's prefix the watcher still builds and copies each new dev build, under its new
file name, and moves or removes no file the game could have open; it logs that the
tidy of older dev builds and releases (into old/) waits, and does the tidy within
a poll after the game closes. Each install writes the same
playtest notes as `bun wisp play --install-green`
(smashcraft:docs/commands/play.md).

Each install is held to two speed budgets: the build within 20 s and the
landed commit installed in Maps within 360 s. An install over either opens or
comments on the one GitHub issue "Speed budget: a landing took too long to
reach Tom's Maps folder" for an agent to find the stage that grew and what it
recomputes whose inputs did not change; the next install within both closes
it (smashcraft:ts/scripts/tomBuildWatch.ts).

Start it (once, from the main checkout):

    mkdir -p ~/.config/systemd/user
    cp tools/tom-build/smashcraft-tom-build.service ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable --now smashcraft-tom-build.service

Stop it with `systemctl --user disable --now smashcraft-tom-build.service`;
`bun scripts/tomBuildWatch.ts` from ts/ runs it in the foreground. Each
installed build appends one line to `~/.local/state/agents/handoffs/tom-build.log`:

    <utc> <sha> <version> <build_s> <land_to_installed_s> <land_to_main_s> <cpu_pressure_peak> <live_clients> <stages> <install path>

`land_to_installed_s` counts from the commit's committer time; the other
fields name the stage a slow landing spent its time in (smashcraft:tools/tom-build/README.md). Failed builds
are in `journalctl --user -u smashcraft-tom-build`.

## Lane builds before landing

From a lane's worktree, `cd ts && bun scripts/laneBuild.ts` runs `bun run check`
and the lane's own tests (test files changed since its merge base with
origin/main, uncommitted ones included), then builds the lane's working tree
with the play build (no Lua prediction) as `Smashcraft X.Y.Z-LANE.w3x` in
`~/.local/state/smashcraft/lane-builds/LANE/`, which holds only that lane's
newest build. `--install` also installs it in Tom's Maps/00-Smashcraft for him
to try. X.Y.Z is the next release; LANE is the branch's last segment without `land-`
(`claude/land-cairne-air-924c72aef489` installs
`Smashcraft X.Y.Z-cairne-air-924c72aef489.w3x`); `--lane BRANCH` names it
explicitly. An installed lane map replaces any other lane or test map in the
folder and leaves the main build alone; builds of one lane wait for each other.
Main's numbering ignores lane maps, and the next main build to install removes
the lane map.

## The desktop client

Players use [smashcraft-client](https://github.com/tompassarelli/smashcraft-client):
its release bundles the controller service, and its Play launches the current
map in Maps/00-Smashcraft ([client interface](client-interface.md)). It needs no
checkout of this repository.

## Controller without play

The controller service ([padbridge](https://github.com/tompassarelli/padbridge)
with Smashcraft's plug-in, smashcraft:controller/README.md) runs from Tom's
login as the systemd user unit padbridge.service, declared in
nixos-config. It runs the launcher ~/.local/share/padbridge/bin/padbridge
`--service --plugin` ~/.local/share/smashcraft-build-inputs/controller/wc3-journal;
both are links to the pinned service and the plug-in built together under
play-helpers/. It finds Warcraft III on :0 by itself, follows any
Smashcraft session (one Tom opens from Custom Games included, and a reopened
map) and survives Warcraft restarts and pad replugs. `play` and
`bun wisp controller` point the links at main's build and restart the unit
when it changed; without the unit, `bun wisp controller` runs the service in
the foreground. Its state is in ~/.local/state/padbridge/service.txt;
its log is `journalctl --user -u padbridge`.

Controller layouts: `bun wisp controller layout melee|z-jump|tom`. melee (the default) is Melee's buttons by function: A attack, B special, X and Y jump, RB grab, no tilt or short-hop button; z-jump makes RB jump and X grab; tom is Tom's own (LB short hop, RT shield, right stick tilts, L3 unbound). Both triggers shield by default. The client Controller page also chooses the layout, tap jump and full or light shield for each trigger. These choices stay in the controller service settings across restarts. A running service changes immediately; a stopped service reads the saved choice at its next start.
