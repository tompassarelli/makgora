# Lan

South's battlenet-accounts skill names the signed-in pairs and how each one
runs; never touch Tom’s install.

- Offline LAN pool, the default for native testing (see "Native testing and
  UI"), on live build 3.0.0.24268 only (the private LAN plugin refuses other
  builds): `bun wisp lan setup --from INSTALL [--pairs N]` creates throwaway
  clients with no account from one updated install (a clone's
  `pfx/drive_c/Program Files (x86)/Warcraft III`, under 1 s for 4 pairs); `bun wisp lan pool --pairs N [--pool-profile
  parity|visual] [--cpus LIST]` runs them in pairs (`--cpus 0-11` pins every
  client to gex45's performance cores for native timing evidence), each pair in a network namespace with
  only loopback unless `--network` with one `--pair K` opens that pair for
  solo games, which 3.0.1.24371 needs to start; a networked pair refuses LAN
  play (foreground, admitted by the capacity helper); `bun wisp lan
  fresh MAP.w3x [--pair K]` hosts and starts a LAN match on Wisp's own host;
  `lan status`, `lan end --pair K`. The host logs every turn's actions and
  compares checksums each turn. Joining LAN games needs Wisp's private LAN
  plugin in ~/.local/share/wisp-private/lan/. The pool's clients file is
  ~/.local/state/wisp/lan/clients.json (wisp:docs/lan.md). Pad parity on the
  pool takes an integrity map (`bun wisp map build --profile integrity` or
  `map rebuild MAP --profile integrity`) and `--pair K...`; measured 9 Oct, a
  pair runs 70 s after `lan pool` starts and is in a match 36 s after `pad`
  asks. Run two pairs by default and add one only while the capacity helper's
  `protectedCpuSomeAvg10` stays under 20 (three pairs read 22-31 under normal
  agent load).

Wisp holds each pair's custody (wisp:docs/lan.md, wisp#69): the pool holding
pair K names itself in `~/.local/state/wisp/lan/pair-K/claim.json` (its PID,
the fleet session from `NORTH_FLEET_SESSION` and the lane label from
`--owner NAME`). Every smashcraft `lan pool` waits in Wisp's line with
`--queue`, so sessions asking for a held pair get it one at a time in the order
they asked (smashcraft:ts/test/lan-pool-queue.test.ts). A pool unit is named per fleet
session and pairs and passes `--owner-pid` with the session's own process, the
outermost ancestor carrying its `NORTH_FLEET_SESSION`, so a running or waiting
unit stops itself once that session ends.

`bun wisp lan stop` stops the pool units, holding or waiting, started from the
caller's `NORTH_FLEET_SESSION` and names each other session's unit it leaves
running; it sweeps a pair's capacity scopes only while no other pool has taken
the pair.
