# Dev

- Every save: leave `bun wisp dev` running. It prints the saved files' type
  errors, the unit tests that are or directly import a saved file, the
  journeys (the quick match in two simulated clients and the journey tests
  reached the same way) and the whole check, each timed from the save; tests
  that reach a saved file only through other modules are counted and left to
  the landing gate. Add `--data A --data B` to also hot-reload both clients
  as `hot --watch` does. smashcraft:ts/scripts/wisp/commands/dev.ts declares
  the files tests read at run time, the journey tests and the per-file
  source-shape audit.
- One commit: `bun wisp dev --since REF` checks the diff since REF the same
  way once and exits nonzero on any problem; `--since HEAD^` times the edit
  loop on the last commit.
