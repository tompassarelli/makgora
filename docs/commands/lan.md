# Lan

The offline pool is Classic only. Use the signed-in pairs clone-c+clone-b and
clone-a+clone-d for Definitive checks; never touch Tom’s install, and run
clone-a only through its launch.sh.

- Offline LAN pool, the default for native testing (see "Native testing and
  UI"), on live build 3.0.0.24268 only (the private LAN plugin refuses other
  builds): `bun wisp lan setup --from INSTALL [--pairs N]` creates throwaway
  clients with no account from one updated install (a clone's
  `pfx/drive_c/Program Files (x86)/Warcraft III`, under 1 s for 4 pairs); `bun wisp lan pool --pairs N [--pool-profile
  parity|visual]` runs them in pairs, each pair in a network namespace with
  only loopback (foreground, admitted by the capacity helper); `bun wisp lan
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

Pair 0's pool unit owns `~/.local/state/wisp/lan/pair-0/claim.json` for its
fleet session. `NORTH_FLEET_SESSION` names that session; `--owner NAME` names
the lane in the claim. `lan fresh`, `accept`, native pair pad scripts and
capture batches refuse pair 0 unless this live claim belongs to their session.
To label an already-running pool explicitly, run
`bun wisp lan claim --pair 0 --owner NAME`. `bun wisp lan stop --pair 0` or
`bun wisp lan release --pair 0` stops the pool and releases the claim. A live
claim from another session refuses with its owner, session and PID; a claim
whose pool process exited can be taken over and reports that takeover.
