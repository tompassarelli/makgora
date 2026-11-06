# Mak'gora

Mak'gora, formerly called Smashcraft, is a platform fighter for Warcraft III,
inspired by Super Smash Bros. Melee. Warcraft heroes fight on floating stages
with jumps, air dodges, shields, hitstun, knockback and stocks, over rollback
netcode.

Warcraft III is still a great platform for custom games, and Melee's movement and
combat remain the model for the platform fighter. Mak'gora brings that
depth to Warcraft III's heroes, with the rollback netcode that online play needs.

- **Download:** [Hive Workshop](https://www.hiveworkshop.com/threads/makgora.375492/).
  **Release notes:** [latest GitHub release](https://github.com/tompassarelli/makgora/releases/latest).
  GitHub holds code and notes only, never the map.
- **How to play and controls:** [player guide](docs/player-guide.md).
- **Games, questions and bug reports:** [Discord](https://discord.gg/JQGZs2UJR) and
  [issues](https://github.com/tompassarelli/makgora/issues), where status and next work live.
- **Desktop client** (controller, play, history, stats, replays, online):
  [makgora-client](https://github.com/tompassarelli/makgora-client), which
  reads Mak'gora through the [client interface](docs/client-interface.md).
- **Design and systems:** the [documentation index](docs/README.md).

## Principles

Mak'gora is an independent fan game inspired by Super Smash Bros. Melee, not
affiliated with or endorsed by Blizzard Entertainment or Nintendo. It is
built with our own code and animations on Warcraft III's unit models, alongside
the community models credited below. The map plays only inside your own copy of
Warcraft III; it never replaces the game.

- **Respect copyright and publisher IP.** The map uses Warcraft III's own
  models with animations we authored, plus credited Hive Workshop models,
  some of them ported by their authors from other Blizzard games. Those models
  ship only inside the map, and the map ships only on Hive Workshop and
  Battle.net, never on GitHub; a check after each landing fails if a GitHub
  release carries a map or model file. The repositories contain no Blizzard
  files: models, textures, sounds, data, scripts or in-game text. Build inputs
  stay private, outside Git, and Nintendo's code and assets are neither in the
  repositories nor shipped with Mak'gora.
- **Learn by observation.** Behaviour is measured from the outside: what
  Warcraft III shows, plays, logs and writes, and the traffic of LAN games we
  host, plus public documentation. Melee's feel comes from public frame data
  (SmashWiki, Smashboards) and from watching the game, never from the community
  decompilation or Melee's own files. Never from disassembly, decompilation or
  a game's memory. Gameplay facts are written as our own design targets, citing
  public sources where they exist.
- **Play fair.** No DRM bypass, no Battle.net emulation, no cheats, and nothing
  that touches other players or Blizzard's services.
- **Original work.** Our own code only. No code from AGPL projects such as
  Warsmash, and "Warcraft" stays out of our product names.

The long form, with what counts as observation and how the checks enforce it,
is Wisp's [clean-room rules](https://github.com/tompassarelli/wisp/blob/main/docs/clean-room.md).
The map's credited Hive Workshop models are Mak'gora's one exception to their
ban on distributing Blizzard art (decided 4 November 2026); Wisp's standalone
engine keeps the ban.

## Develop

Mak'gora is written in TypeScript on [Wisp](https://github.com/tompassarelli/wisp),
which compiles it to Warcraft III's Lua. From [ts/](ts/):

```sh
bun install --frozen-lockfile
bun wisp dev
```

Keep `bun wisp dev` running: every save reports type errors, affected tests
and simulated matches. `bun run check` checks types and the repository's
records. Building the playable map also needs a locally installed Warcraft III
and private game assets, which are not in this repository
([build inputs](docs/build-inputs.md)).

Where to look next:

- [AGENTS.md](AGENTS.md): repository rules and task routers; from ts/, run `bun wisp help` for commands.
- [Documentation index](docs/README.md): how the game and its systems work.
- [Wisp feature index](https://github.com/tompassarelli/wisp/blob/main/docs/index.md):
  framework capabilities and opt-in diagnostics.

## Credits

The credits are written once, in [ts/src/game/ui/credits.ts](ts/src/game/ui/credits.ts):
the in-game Credits screen shows it, the credits-single-source goal holds the release post's credits equal to it, and
it names every author of the community models the map imports. The source terms
behind each model are in [model credits](docs/design/roster.md#credits).

## License

Mak'gora is released under the [MIT License](LICENSE). The vendored Effect
source under repos/effect/ keeps its own MIT license. Warcraft III, Super Smash
Bros. Melee and their assets belong to their owners and are not part of this
repository; reference values cite their sources.

<small>Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard
Entertainment, Inc. Nintendo and Super Smash Bros. Melee are trademarks of Nintendo.</small>
