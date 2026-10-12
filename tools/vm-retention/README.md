# Farm VM retention

`smashcraft-vm-retention.service` runs on Tom's machine, which holds the VM's
SSH key, only when queued on the laptop's ledger runner after farm VM work, so
nothing fires while no work is queued. The service runs `vm-retention.sh`, which:

- rsyncs the VM's `/home/user/out` and `/home/user/fidelity` into
  `~/.local/state/smashcraft/vm-archive/{out,fidelity}`, keeping relative paths;
- prints each set's file count and byte total on both ends and, only when they
  match, deletes from the VM the files `find DIR -mtime +2 -type f` lists whose
  laptop copy has the same size;
- warns once (notify-send and a line in
  `~/.local/state/agents/watchdog/incidents.md`) when the VM's free space falls
  below `VM_RETENTION_WARN_GB` (10), and re-arms when it recovers.

To install it:

    install -Dm755 tools/vm-retention/vm-retention.sh ~/.local/libexec/smashcraft-vm-retention.sh
    cp tools/vm-retention/smashcraft-vm-retention.service ~/.config/systemd/user/
    systemctl --user daemon-reload

To queue one run:

    threads queue add laptop - -- systemctl --user start --wait smashcraft-vm-retention.service

Each smashcraft runner on the VM prunes its own `_work` after every job with
`ghr-work-prune.sh` (`ACTIONS_RUNNER_HOOK_JOB_COMPLETED`, beside the disk guard):
it empties `_temp`, runs `git clean -ffdx` in the checkout (node_modules and job
outputs, which the next job's checkout step deletes anyway) and keeps only the
newest version of each action in `_actions`. It keeps the checkout's `.git`
(about 1 MB; its objects come from `/srv/farm-mirror`) and tracked files, so
the next job fetches only the new commit. To install it on the VM, for each
idle runner N in 1..4:

    install -m755 ghr-work-prune.sh /usr/local/libexec/ghr-work-prune.sh
    cp ghr-work-prune.conf /etc/systemd/system/ghr-smashcraft-N.service.d/
    systemctl daemon-reload && systemctl restart ghr-smashcraft-N
