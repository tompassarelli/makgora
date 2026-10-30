# Online

- Direct play: `bun wisp online host [--client NAME] [--password VALUE]` hosts the newest
  Smashcraft map as a private Battle.net game and prints its join code;
  `bun wisp online join CODE [--client NAME] [--password VALUE]` joins it;
  with an explicit host password, the guest supplies that same password. All
  hosted games are private and passworded; without the flag the code carries
  the generated password. Both return at fighter selection. The host presses Start now once the guest has joined; no Battle.net chat is sent.
  `online setup` installs the menu page and Allow Local Files after
  the owner agrees. The client's Online page runs them
  (smashcraft:docs/design/client.md, "Direct play").
- Standalone window through Wisp's relay: the client's Online page opens on it
  (smashcraft-client#25, #26). Host runs `bun wisp play --standalone --host --relay nearest`
  in this `ts/` folder (`SMASHCRAFT_TS`). The command pings every relay region
  (the published `sgp`, plus any `WISP_RELAYS="name=ADDRESS:PORT"` adds), opens
  a room on the nearest and prints, on standard error, `net: hosting through
  REGION, round trip to it N ms` and, on standard output, `TITLE: join code
  REGION-XXXX-XXXX-XXXX-X (relay room; …)`. Join runs
  `bun wisp play --standalone --join CODE`, prints `net: joining through REGION,
  round trip to it N ms`, and both open Wisp's window and meet at fighter
  selection; a different source tree fails at once with both map hashes
  (wisp:docs/play.md, "Host and join"). The client shows the code, the region
  and its round trip, keeps the rest of standard error as `standalone.log`, and
  Cancel sends the run's process group SIGTERM, then SIGKILL after 3 s, because
  the run ignores SIGTERM while it waits on the relay. No Warcraft III is needed.
