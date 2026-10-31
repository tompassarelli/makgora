# Tom builds

`smashcraft-tom-build.service` runs `bun scripts/tomBuildWatch.ts` from its own
detached worktree `~/code/smashcraft/worktrees/tom-build-watch/ts`, which it moves
to `origin/main` on each start, under `Nice=10` and idle I/O. Every 10 s it fetches
`origin/main`; when the tip is a commit it has not built, it builds that tip's
Classic playable map (the edition Tom plays, about 47 MB; `wisp play` keeps the
private full HD build) with the play build path, without the optional controller helper,
and installs it under Maps/00-Smashcraft (smashcraft:docs/play.md); `wisp play`
builds the helper when Tom starts a controller session. Commits that land during a build
are skipped for the newest tip. Between landings it only fetches. While Warcraft III
runs in Tom's prefix it still builds and adds the new file but removes and moves nothing
until the game closes (smashcraft:docs/play.md).

To install and start the unit:

    git -C ~/code/smashcraft/main worktree add --detach ~/code/smashcraft/worktrees/tom-build-watch origin/main
    mkdir -p ~/.config/systemd/user
    cp tools/tom-build/smashcraft-tom-build.service ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable --now smashcraft-tom-build.service

The watcher exits as soon as `origin/main` moves past the commit it runs
from, and `Restart=always` starts it again on the new tip, so every build is
named and installed by the newest watcher code. To stop it, and keep it from starting at login:

    systemctl --user disable --now smashcraft-tom-build.service

Each installed build appends one line to
`~/.local/state/agents/handoffs/tom-build.log`:
`<utc> <sha> <version> <build_s> <land_to_installed_s> <land_to_main_s> <cpu_pressure_peak> <live_clients> <stages> <install path>`.
Land time is the commit's committer time; `land_to_main_s` ends when GitHub
records the push to main, so it is the lane's pre-land gates. `cpu_pressure_peak`
is the host's `/proc/pressure/cpu` some avg10 peak during the build, `live_clients`
the Warcraft III processes on the host, and `stages` the build's
`[inputs-fetch=S,]checkout=S,bun-install=S,map-build=S,boot=S,maps-copy=S` (`inputs-fetch` is the
fetch of pinned inputs the store lacked, run before the build starts, present only then); `-` is
unknown. A build above 20% pressure counts against neither budget: the watcher
neither files nor closes a speed-budget issue for it. A failed build is in
`journalctl --user -u smashcraft-tom-build`. Every sha the watcher starts is
recorded in `~/.local/state/smashcraft/tom-build/attempted`, so it never builds
a sha twice, even after a failure or restart. Before each build the watcher runs `bun wisp inputs fetch` for the store hosts in
`INPUT_HOSTS` (gex45, skipping the host it runs on), which copies only the pinned entries the local store
lacks (0.5 s when none) and links every file whose bytes match a stored entry; the build then runs once.
If the fetch fails and an input is still missing, the build fails with the missing input and the watcher
forgets the sha so the next poll tries again.

Before installing, the watcher runs `bun wisp map boot` on the built map (its check driver compiles beside the map build, so `boot=` in the stages is only what follows the build)
(smashcraft:docs/commands/map.md). A map that does not reach character select is
not installed: the previous build stays in Maps/00-Smashcraft, the journal says
why, and `~/.local/state/agents/handoffs/tom-build-refused.log` gets one line
`<utc> <sha> <version> <reason>`.

Each install replaces the previous build in Maps/00-Smashcraft and removes any
`Smashcraft X.Y-LANE.w3x` lane map (`bun scripts/laneBuild.ts --install`,
smashcraft:docs/play.md).

## Window library

Right after a build is installed and its line is logged, the watcher checks whether
`~/.cache/wisp/window/<hash>/release/libwisp_window.so` exists for the window source of the
Wisp its own `ts/` has pinned (Wisp keys the cache by a hash of `window/`, so the check is true
exactly when that hash is new). If it is missing, the watcher starts
`bun scripts/prepareWindowLibrary.ts --sha <sha>` detached, under the capacity class `tom`, and goes on
polling: the map install never waits for it and the next landing's map build is not held back.
The script copies the package's `window/` to `~/.local/share/smashcraft-build-inputs/window-source`
(so a later `bun install` that moves the pin cannot change the source mid-build), builds it with the
resolver Wisp's player uses, and appends one line to `tom-build.log`:
`<utc> <sha> window-library <seconds> <hash> <library path>`. A library that already exists logs nothing.
The unit has `KillMode=process`, so a restart onto the next tip leaves a running window build alone;
a second build of the same hash waits on `window-library.lock` and finds the library built.
Tom's `bun wisp play --standalone --window native` then opens it without a cargo build.
The script reads the resolver from the pinned package's `host/window/library.ts` by path, because the
package exports no window entry.
