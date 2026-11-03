# Client interface

The Mak'gora desktop client lives in
[makgora-client](https://github.com/tompassarelli/makgora-client). It
reads Mak'gora only through this interface, which this repository owns. A
change that breaks it bumps the kit number or the record's `v=`, and updates
this page in the same commit.

## Client kit 1 (build time)

From ts/, `bun scripts/clientKit.ts OUT` writes the kit into OUT
(makgora:ts/scripts/clientKit.ts). The client pins a Mak'gora commit and
builds against the kit that commit writes; it imports nothing else from this
repository.

| File | What it is |
| --- | --- |
| `kit.json` | `{"kit": 1, "version": SOURCE, "viewerApi": 1}`; `version` is the source version (makgora:ts/scripts/sourceVersion.ts) |
| `sim.js` | ES module: the replay viewer, the replay files' format and `sourceVersion()`, stamped with `version` |
| `sim.d.ts` | its types (makgora:ts/src/game/replay/clientKitApi.d.ts); `viewerBundle.ts` is checked against them |
| `viewer.lua` | the viewer's Lua modules, added to an older map's `war3map.lua` to play that version's replays |
| `fixtures/tape-replay.json` | a recorded two-player replay of `version`: `serial`, the manifest's lines and each part's lines |
| `fixtures/tape-replay.txt` | the same replay joined, as version `development`, which `fixtures/map.lua` plays |
| `fixtures/map.lua` | a stand-in `war3map.lua` holding the viewer's Lua bundle, for testing `viewer.lua` without a map |

`sim.js` exports `VIEWER_API` (1), `sourceVersion`, `openReplay`,
`parseReplayHeader`, `parseReplayPart` and `joinReplay`. A client keeps the
`sim.js` of every version it has run; any kit-1 `sim.js` opens its own
version's replays.

## Files the map writes (run time)

Each Warcraft III account's CustomMapData folder holds:

- match records, `makgora-match-<serial>.txt`, format `v=1`
  ([client design](design/client.md#match-records-phase-2s-data));
- replays, `makgora-replay-<serial>.txt` and their parts
  `makgora-replay-<serial>-<part>.txt`
  ([client design](design/client.md#full-match-replays-phase-3)).

Both are Warcraft Preload files; each stored line is one `call Preload( "…" )`.

## Maps (run time)

Maps/00-Makgora in the Warcraft III documents folder has, at its top level, the latest release `Makgora X.Y.Z.w3x` and the newest installed
main build `Makgora X.Y.Z-dev.N.w3x`; older releases sit in old/ (makgora:docs/play.md).
Installing a main build removes every older dev build. At most one lane or test build Tom asked to try (`Mak'gora
X.Y.Z-LANE.w3x`, or the map `play --lobby-only` was given) sits beside it; it
replaces any earlier one and goes when the next main build installs. Test,
integrity and diagnostic builds stay in private folders or pool clients. The map's file and title carry its release number (X.Y.Z, from the newest
`vX.Y.Z` tag, makgora:docs/play.md). Each map's `war3map.lua` carries its
source version, a content hash and not that number, in the
`game.shell.sourceVersion` module, so a client finds the map for a replay's
version in any Maps folder (Download included).

## Commands (Mak'gora tools)

Online play runs Wisp's own window over its relay, so it needs Mak'gora's
tools: a checkout's ts/ with its dependencies installed. The client runs, in
that folder:

- `bun wisp play --standalone --host --relay nearest` and
  `bun wisp play --standalone --join CODE`
  ([Online](commands/online.md)). Standard output is lines for players;
  standard error is the technical log, apart from the relay round-trip line
  the client shows.

The client never starts or drives Warcraft III for online play
(makgora-client#28, 2026-10-31).

Without the tools the client's Online page says it isn't set up; History,
Stats, Replays, the controller and Play need nothing from this repository at
run time.
