# Tom builds

`smashcraft-tom-build.service` runs `bun scripts/tomBuildWatch.ts` from its own
detached worktree `~/code/smashcraft/worktrees/tom-build-watch/ts`, which it moves
to `origin/main` on each start, under `Nice=10` and idle I/O. Every 30 s it fetches
`origin/main`; when the tip is a commit it has not built, it builds that tip's
Classic playable map (the edition Tom plays, about 47 MB; `wisp play` keeps the
private full HD/DE build) with the play build path, without the optional controller helper,
and installs it under Maps/00-Smashcraft (smashcraft:docs/play.md); `wisp play`
builds the helper when Tom starts a controller session. Commits that land during a build
are skipped for the newest tip. Between landings it only fetches.

To install and start the unit:

    git -C ~/code/smashcraft/main worktree add --detach ~/code/smashcraft/worktrees/tom-build-watch origin/main
    mkdir -p ~/.config/systemd/user
    cp tools/tom-build/smashcraft-tom-build.service ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable --now smashcraft-tom-build.service

`systemctl --user restart smashcraft-tom-build.service` picks up a newer
watcher. To stop it, and keep it from starting at login:

    systemctl --user disable --now smashcraft-tom-build.service

Each installed build appends one line to
`~/.local/state/agents/handoffs/tom-build.log`:
`<utc> <sha> <version> <build_s> <land_to_installed_s> <install path>`.
Land time is the commit's committer time. A failed build is in
`journalctl --user -u smashcraft-tom-build`. Every sha the watcher starts is
recorded in `~/.local/state/smashcraft/tom-build/attempted`, so it never builds
a sha twice, even after a failure or restart.

After each install, the watcher removes `Smashcraft 0.0.N-LANE.w3x` lane maps
(`bun scripts/laneBuild.ts`, smashcraft:docs/play.md) of lanes that landed in
the commits since its previous build.
