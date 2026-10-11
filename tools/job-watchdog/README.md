# Job watchdog

These are systemd **user** units for Tom's laptop. All four units require
`ConditionUser=tom`; never run the production monitor in a Codex sandbox or
as a root system service. The user manager supplies Tom's home and login
environment, so GitHub authentication and the Socrates alert spool belong to
the same user as the relay.

After this lane's command and routing have landed, install the units from a
Tom shell:

    install -d ~/.config/systemd/user
    install -m 644 tools/job-watchdog/smashcraft-job-watchdog.service tools/job-watchdog/smashcraft-job-watchdog.timer tools/job-watchdog/smashcraft-job-watchdog-baseline.service tools/job-watchdog/smashcraft-job-watchdog-baseline.timer ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable --now smashcraft-job-watchdog-baseline.timer smashcraft-job-watchdog.timer

The baseline refreshes every twelve hours and also precedes monitor startup.
The monitor scans every twenty seconds. Its existing current-main check and
24-hour baseline freshness check fail closed. Keep the main checkout and its
frozen dependencies current before starting the timer.

Inspect with `systemctl --user status smashcraft-job-watchdog.service` and
`journalctl --user -u smashcraft-job-watchdog.service`. Stop both schedules
with `systemctl --user disable --now smashcraft-job-watchdog.timer smashcraft-job-watchdog-baseline.timer`,
then stop the two services. A timer alone does not stop an already running
monitor.

