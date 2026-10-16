# Stage music

Each stage plays its own track, which loops until the results screen. Tom
added ten tracks on 16 Oct 2026, one per selectable stage; they are imported
into the map at 128 kbps (smashcraft:ts/src/game/assets/importedMusicInfo.ts,
`IMPORTED_STAGE_MUSIC`), so the game's music volume still applies. The test
stage keeps a stock track. Tom first asked for stage music on 8 Oct
([#271](https://github.com/tompassarelli/smashcraft/issues/271)).

The source of truth is `STAGE_MUSIC` in
smashcraft:ts/src/game/presentation/matchAudio.ts. The match starts its
stage's track with `PlayMusic`, which loops it until the results screen.
smashcraft:ts/src/game/presentation/matchCues.tests.ts fails when a stage
in the catalog has no track, when its track is neither a stock path nor an
imported one, or when two stages share one. smashcraft:tools/presentation/stock-sounds.ts
checks each stock path against the installed game.

| Stage | Id | Track |
| --- | --- | --- |
| Sky Deck (test) | 0 | Human1 (stock) |
| Frozen Throne | 2 | Citadel of Winter Kings |
| Durotar Skies | 3 | Iron-Tusk Stomp |
| Naxxramas | 4 | Iron Rites of the Spire |
| Stratholme | 6 | Crown of Broken Kings |
| Tomb of Sargeras | 7 | Throne of Shifting Stone |
| Nordrassil | 10 | Bough and Blade |
| Gryphon Aerie | 11 | Summit of the Steel Wing |
| Blackrock | 12 | Molten Anvil Groove |
| Ahn'Qiraj | 13 | Ritual of the Mandible |
| Hellfire Citadel | 14 | Siege of the Iron Gate |

Stock script paths are `Sound\Music\mp3Music\<Track>.flac`; the game resolves each
to the `.mp3` or `.ogg` it stores. Menus play the imported Before the First Strike and a win plays
the winner's race victory theme, as before.

## Stock music in the client

The installed client (8 Oct) stores these tracks under
`war3.w3mod:sound\music\mp3music\`, listed through CascLib; all are
available to a stage:

- Campaign themes: Human1-3, HumanX1, Orc1-3, OrcX1, NightElf1-3,
  NightElfX1, Undead1-3, UndeadX1.
- Hero and faction themes: ArthasTheme, LichKingTheme, IllidansTheme,
  NagaTheme, BloodElfTheme, OrcTheme.
- Moods: Comradeship, DarkAgents, Doom, PursuitTheme, SadMystery, Tension,
  TragicConfrontation, HeroicVictory, DarkVictory, Credits, PH1.
- Victory and defeat stings: HumanVictory, OrcVictory, NightElfVictory,
  UndeadVictory, and each race's Defeat.
- Menus: MainScreen, War3XMainScreen, War2IntroMusic.
- Reforged-era additions: NaxxramasWalking1-6, Undercity and
  UndercityAmbience01-03, WestPlaguelands, CrimsonForest, Forsaken1-3 and
  their stems, HolyWarriorsOathB/D, AllianceBattleMarch, Battle_A/B,
  Battle_Intense_A-C, Combat1-3, Race1-3.
- Warcraft I and II remakes: `war1\Human1-3`, `war1\Orc1-3`,
  `war2\Human2-5`, `war2\Orc2-5`, each with an `_opl` variant.

## Cues during play

Nothing musical plays between GO and GAME! except the stage track. The
countdown's GO uses `Sound\Interface\GameFound.flac`, a 7.5-second fanfare,
once. A full meter plays `ItemReceived` and an item spawn plays `Hint`; both
played GameFound until #361, which Tom heard mid-match as a stray victory or
campaign-start clip. The sweep in smashcraft:ts/test/match-audio.test.ts plays
3 minutes of Hellfire Citadel and fails on any music or fanfare call mid-match.
