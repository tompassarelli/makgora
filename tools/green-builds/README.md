# Green playtest builds

`smashcraft-green-builds.service` runs `bun wisp play --install-green` from
its own detached worktree, `worktrees/green-builds-runner`, moved to
`origin/main` before each run (docs/commands/play.md). It has no timer: it runs
only when queued on the laptop's ledger runner, so nothing builds while no work
is queued.

Each run smokes every move of the candidate natively on the pool pair named by
`SMOKE_PAIR` (`systemctl --user edit smashcraft-green-builds.service`, then
`Environment=SMOKE_PAIR=K`); without it the install refuses. A smoke crash, a
dead binding or a move that fails to start always keeps the last installed
build; every other native gate failure blocks only with
`SMASHCRAFT_GREEN_GATE=enforce` and otherwise installs as
`installed-unverified`. The 13 shards take about an hour, so the unit allows
150 minutes.

To install the unit:

    mkdir -p ~/.config/systemd/user
    cp tools/green-builds/smashcraft-green-builds.service ~/.config/systemd/user/
    systemctl --user daemon-reload

To queue one run, when a green main is newer than the installed build and its
Classic gate reports exist:

    threads queue add laptop 402 -- systemctl --user start --wait smashcraft-green-builds.service

`gh` must be signed in for the user the service runs as.
