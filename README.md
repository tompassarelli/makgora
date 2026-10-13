# Smashcraft

<p align="center">
  <img src="docs/assets/smashcraft-wordmark.svg" alt="Smashcraft" width="100%">
</p>

Smashcraft is an in-development platform fighter for Warcraft III, inspired by
Super Smash Bros. Melee. Warcraft heroes fight on floating stages with jumps,
air dodges, shields, hitstun, knockback and stocks, over rollback netcode.

There is no public release yet. How to play: [player guide](docs/player-guide.md).
The desktop client (controller, play, history, stats, replays, online) is
[smashcraft-client](https://github.com/tompassarelli/smashcraft-client); it
reads Smashcraft through the [client interface](docs/client-interface.md).
Status and next work: [roadmap #16](https://github.com/tompassarelli/smashcraft/issues/16).

## Respecting Blizzard's and Nintendo's IP

Smashcraft is a fan project that works with your own copy of Warcraft III and
takes its feel from Super Smash Bros. Melee. We keep it clean of Blizzard's and
Nintendo's property and of anything that reaches inside either game:

- We never copy or distribute Blizzard's code, art, models, textures, sounds,
  music, data tables, game scripts (the bodies of common.j and blizzard.j) or
  in-game text. Players load art from their own legally owned install at run
  time. Short identifying quotes and native names and signatures are the
  map-facing interface, and those are fine.
- What we know about Warcraft III's behaviour comes only from black-box
  observation of the game as a player sees it (pictures, sound, logs and files
  the game writes, replays, timing, LAN network traffic of games we host) and
  from public documentation. Never from disassembly, decompilation, decrypted
  or dumped executables, debugger sessions, or reading the game's memory.
- No DRM bypass, no Battle.net sign-in emulation, no cheating or anti-cheat
  evasion, and nothing that touches other players' games or Blizzard's
  services.
- Private local test tools (the LAN switch that patches our own test clients
  so they offer LAN, and the desync debugger that reads our own clients'
  memory) live outside every repository under `~/.local/share/wisp-private/`.
  They run only on our own machines and test accounts and never feed the
  implementation. Their addresses, offsets, dumps, byte patterns and
  procedures are never committed, posted in issues or pull requests, or quoted
  in docs. Their findings may only help diagnose our own bugs (a desync, for
  example), never decide how the engine behaves.
- "Warcraft" stays out of product names and logos; "works with your Warcraft
  III install" is fine.
- No Warsmash (AGPL) code.
- Melee gets the same rules. Its feel comes from public frame data and from
  watching the game, never from the community decompilation or Melee's own
  files: no decompiled function names, addresses, struct offsets or code
  excerpts, and no values read out of the disc's files. Gameplay facts (frame
  counts, speeds, design intent) are written as our own design targets, citing
  public frame-data sources where they exist.

The long form, with what counts as observation and how the checks enforce it,
is Wisp's [clean-room rules](https://github.com/tompassarelli/wisp/blob/main/docs/clean-room.md).

## Develop

Smashcraft is written in TypeScript on [Wisp](https://github.com/tompassarelli/wisp),
which compiles it to Warcraft III's Lua. From [smashcraft:ts/](ts/):

```sh
bun install --frozen-lockfile
bun wisp dev
```

Keep `bun wisp dev` running: every save reports type errors, affected tests
and simulated matches. Building the playable map also needs a locally
installed Warcraft III and private game assets, which are not in this
repository.

Where to look next:

- [AGENTS.md](AGENTS.md): repository rules and task routers; from ts/, run `bun wisp help` for commands.
- [Documentation index](docs/README.md): how the game and its systems work.
- [Wisp feature index](https://github.com/tompassarelli/wisp/blob/main/docs/index.md):
  framework capabilities and opt-in diagnostics.

## License

Smashcraft is released under the [MIT License](LICENSE). The vendored Effect
source under repos/effect/ keeps its own MIT license. Warcraft III, Super Smash
Bros. Melee and their assets belong to their owners and are not part of this
repository; reference values cite their sources.
