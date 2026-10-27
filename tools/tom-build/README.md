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
`checkout=S,bun-install=S,map-build=S,maps-copy=S`; `-` is
unknown. A build above 20% pressure counts against neither budget: the watcher
neither files nor closes a speed-budget issue for it. A failed build is in
`journalctl --user -u smashcraft-tom-build`. Every sha the watcher starts is
recorded in `~/.local/state/smashcraft/tom-build/attempted`, so it never builds
a sha twice, even after a failure or restart. A build that finds a pinned input
missing from the local store runs `bun wisp inputs fetch` for the store hosts in
`INPUT_HOSTS` (gex45, skipping the host it runs on) and builds once more; if the
input is still missing, the watcher forgets the sha so the next poll tries again.

Each install replaces the previous build in Maps/00-Smashcraft and removes any
`Smashcraft X.Y-LANE.w3x` lane map (`bun scripts/laneBuild.ts --install`,
smashcraft:docs/play.md).
