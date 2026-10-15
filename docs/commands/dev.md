# Dev

- Every save: leave `bun wisp dev` running. It prints the saved files' type
  errors, the unit tests that are or directly import a saved file, and the
  journeys (the quick match in two simulated clients and the journey tests
  reached the same way), each timed from the save; tests that reach a saved
  file only through other modules are counted and left to the landing gate.
  The whole-project `bun run check` is not part of the loop: pre-push runs it.
  Add `--data A --data B` to also hot-reload both clients as `hot --watch`
  does. smashcraft:ts/scripts/wisp/commands/dev.ts declares the files tests
  read at run time (`tests.reads`, which for a test with a computed `import()`
  also names the modules it loads), the journey tests, the per-file
  source-shape audit and the per-test timeout the complete test run uses. A
  test that reads files or computes an `import()` without a `reads` entry runs
  on every save, so give each new one its entry.
- One commit: `bun wisp dev --since REF` checks the diff since REF the same
  way once and exits nonzero on any problem; `--since HEAD^` times the edit
  loop on the last commit.
