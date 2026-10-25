# Ledger

- Melee parity ledger: `bun wisp ledger` writes `docs/design/melee-parity.md`
  from the rows in `ts/scripts/ledger/`, one module per family; each row reads
  our value from the exported constant or a headless probe, links Melee's
  public source and resolves its code anchor to `file:line`.
- `bun wisp ledger --check`, part of `bun run check`, fails on a stale page, a
  value that differs from Melee's with no deviation row, a deviation that now
  matches Melee, an unresolved anchor or a row with no public source.
- `bun wisp ledger --open` lists the rows awaiting Tom's decision
  (smashcraft:docs/design/melee-parity-plan.md, "Ledger").
