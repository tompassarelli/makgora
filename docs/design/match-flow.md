# Match rules and another match

Smashcraft puts Stocks, Time, Endless and Automatic rematch in the rules
drawer above the fighter roster (the top bar's rules pill shows them). Every player sees the same choices and any present player can change
them before continuing to stages. The defaults are 3 stocks, 7:00, Endless off
and Automatic rematch off. These are a short competitive match with room for a
comeback; automatic play is an explicit session choice.

## Prior art

| Game or tool | Match rules and repeat play | Wording and consequence |
| --- | --- | --- |
| Slippi Melee | The local Slippi settings inject Salty Runback. The upstream assembly checks each of four players' held A and B, then reloads the match scene; otherwise it loads fighter selection. Faster Melee settings include Stock Mode, 4 Stocks, 8 Minutes and Skip Results Screen. | “Salty Runback” is a held shortcut at the end, not an unattended restart. Skipping results removes a stop between games. |
| Rivals of Aether II 1.6.1 | In local play or lobbies with tournament mode off, any player presses TriggerLeft + TriggerRight + Jump after the game ends and before results. It restarts with the current stage and characters. | The official notes call it “Runback” and a “New QoL feature”. Patch 1.6.1.2 corrects prompts shown where runback is unavailable and a black-screen edge case. A visible, available action matters as much as the shortcut. |
| Super Smash Bros. Ultimate | Quickplay chooses preferred rules (Time, Stock or Stamina, player count, stock/time and items); those preferences do not guarantee the next match's rules. Battle Arenas instead show the host's rules, require ready-up, allow back-out, and rotate designated players after results. | “Preferred rules”, “Battle Arena”, ready-up and back-out make the choice visible. Arena rotation serves a waiting group rather than immediate repeated games between the same people. |

Sources:

- Local source: `~/code/resources/melee-unlocked/port/slippi_sys/GameSettings/Melee.ini`
  and the parallel `slippi_sys_general` / `slippi_sys_playback` trees. These
  identify the injected Salty Runback code; they are private reference inputs.
- [Slippi Salty Runback assembly](https://github.com/project-slippi/slippi-ssbm-asm/blob/master/External/Salty%20Runback/Salty%20Runback.asm),
  especially `Inputs_GetPlayerHeldInputs`, checks A/B and `Runback` / `LoadCSS`.
- [Slippi Faster Melee settings](https://github.com/project-slippi/slippi-ssbm-asm/tree/master/Binary/FasterMeleeSettings),
  including `4Stocks.bin`, `8Minutes.bin`, `StockMode.bin` and `SkipResultsScreen.bin`.
- [Rivals II Patch 1.6.1, official announcement](https://store.steampowered.com/news/app/2217000/view/1830163047269145), “Runback”.
- [Rivals II Hotfix 1.6.1.2, official announcement](https://store.steampowered.com/news/app/2217000/view/1830797770236938).
- [SmashWiki Quickplay](https://www.ssbwiki.com/Quickplay), “Preferred rules”,
  and [Battle Arena](https://www.ssbwiki.com/Battle_Arena), a secondary description
  of host rules, ready-up/back-out and rotation.

The direct player preference informing this choice is Tom's request in
[Smashcraft #74](https://github.com/tompassarelli/smashcraft/issues/74): he liked
Slippi's repeat-match shortcut and wants two people to keep playing without
menus. “Friendlies” did not communicate that purpose. Rivals' developer calls
its equivalent quality of life; that is developer intent, not a player survey.
SmashWiki records complaints about Quickplay failing to honor preferred rules,
which supports showing the actual shared rules here. These sources do not
establish a community consensus on automatic restarts.

For a quick reset during practice, SmashWiki describes the Smash series'
**Reset** control: it sends fighters to their original spawn points and restores
damage. In Ultimate it also restores stage state, removes items and restarts
the music; random events repeat. That is a practice reset, distinct from
finishing and repeating a competitive match. Source: [Training Mode,
Reset](https://www.ssbwiki.com/Training_Mode#Training_options).

## Smashcraft's choice

Use **Automatic rematch**, not “Friendlies” or “Salty Runback”: it names what
happens. After a normal result, a visible **Rematch in N** counts down five
seconds. The countdown begins advancing once the controller helpers have
stopped the previous match. Any player can stop it with a menu control; the
press is consumed, so cancelling does not also start a match. The next press
chooses a new match through fighter selection. An automatic rematch preserves
fighters, slot modes, stage and rules, while resetting combat and the clock.
A player leaving cancels the countdown.

The match clock sits at top centre in the Smash timer layout: large white
MM:SS in the menu font with a thick dark outline, and the hundredths in smaller
digits on the same baseline to its right. Hundredths come from the 60 Hz frame
count and round up, so 342.85 s reads 05:42 with 85, 59.99 s reads 00:59 with
99 and the last frame before the end reads 00:00 with 01. The pause screen
shows the same MM:SS.

### Clock size

Tom asked on 2026-11-02 for the clock to be about the size of Melee's, as ours read much larger. Melee's clock was measured from uncropped public frames, as shares of the frame's height, which makes the numbers independent of 4:3 or 16:9 (SmashWiki's Melee screenshots "Great Bay Ingame Melee.png", 640x480 and read at 1:1, and "15MinuteMeleeGameplay.png", 997x748; a 1280x720 "Melee Match Start.jpg" agrees on the height). Outer sizes include the dark outline:

- MM:SS digits stand 24 px of 480, **5.0%** of the height; the hundredths 20 px, **4.17%**, a little lower on the same baseline (0.2%).
- The digits' outer top sits 54 px down, **11.25%** of the height; the group sits about 2% of the width right of centre, which ours keeps centred.
- Melee's digits are wide: MM:SS is 119 px (24.8% of the height), the hundredths 40 px (8.3%), the whole group 169 px (35.2%). Our font is narrower, so at Melee's height ours is 16.3%, 5.7% and 22.9%. The height share is what the clock matches; the font stays.

`src/game/ui/clockLayout.ts` holds the shares (`MELEE_CLOCK_SHARE`) and derives the sizes, boxes and split from them, and `test/clock-size.test.ts` pins them. Native 1280x720 captures of the Wisp window before and after (Illidan against a CPU on Tomb of Sargeras) read 51 px (7.08%) and 29 px (4.03%) at a 2.2% margin before, and **36 px (5.00%)**, **30 px (4.17%)** and a **81 px (11.25%)** margin after; the group is centred (x 557 to 721 of 1280) and clear of the fighters' damage tags. Captures: `~/.local/state/smashcraft/evidence/timer-size-20261102` (`before.png`, `after.png`).

**No time limit** removes only the clock. **Endless** additionally removes the
stock end: fighters respawn after knockouts, the HUD hides stocks and time,
and any player can pause and press Escape to return to fighter selection.
Stock and time choices remain available when Endless is turned off again.

This deliberately differs from a quick reset during combat: the ordinary
match still finishes and shows its result. Automatic rematch stays off until
chosen, avoiding an unexpected second game. Slippi and Rivals use end-of-match
button shortcuts; neither source above describes an unattended automatic
session. Saved presets, ranking and matchmaking are separate concerns.

## Opening, ending and results

The Smash series frames every match the same way. Melee holds the fighters
through "Ready... GO!": a replay's first frame is -123 and its first playable
frame is -39 (Slippi's frame convention, also in
`melee-unlocked:port/app/launcher_replay_stats.inl`). Brawl, Ultimate and Rivals
of Aether II count "3, 2, 1, GO!" over about three seconds. The final KO is
called "GAME!" (or "TIME!" when the clock ends it), the action holds on that
moment, and then a results screen shows the winner in its victory pose with
its series' victory fanfare, beside every fighter's KOs, falls and damage.
Each stage plays music from its own franchise.

Smashcraft follows that shape with Warcraft III's built-in assets
([#123](https://github.com/tompassarelli/smashcraft/issues/123); the held start is
[#129](https://github.com/tompassarelli/smashcraft/issues/129)):

- **Calls.** "3", "2" and "1" tick with the Battle.net countdown tick, "GO!"
  plays the Battle.net game-found sting, and "GAME!"/"TIME!" tolls the
  Alliance bell. A stock loss plays the Battle.net death sting, and the move to a
  last stock adds the interface warning. The status line carries the words.
- **Results.** "GAME!" holds for 90 frames (1.5 s). Then a panel lists each
  fighter's stocks, damage, KOs and falls, with the winner first. The winner
  stands where it finished, facing the camera in its model's Stand Victory
  (Stand Channel or Stand Ready where the model has none). It shouts its battle
  cry over a crowd cheer and its race's victory theme. A KO goes to the last
  fighter whose hit landed.
- **Closing camera.** From the frame of the final KO or the TIME! call the
  camera never moves toward the knocked-out fighter: it eases from the match's
  last shot straight into the victory view over 30 frames, each of its
  position, distance and field of view only closing on that view. Until
  2026-11-01 the native window first zoomed onto the KO point for 45 frames
  and back, which in Tom's playtest that day read as a pump fake following the
  dead fighter toward the blast zone, and he asked for it gone; the results
  shot no longer snaps its distance in on its first frame either.
  Mid-match KOs keep the follow camera (docs/melee-camera.md).
- **Choices.** Rematch and New stage go ahead only when every present player
  picks the same one. Character select goes at once when any player picks it,
  since a split vote ends there anyway (Tom, 20 Oct 2026).
- **Selection.** Hovering a fighter or a stage ticks. Confirming a fighter
  clicks and plays that hero's trained-unit line ("Ready" in its sound set),
  the closest Warcraft has to Smash's announced pick. Fighter and stage
  selection play the Frozen Throne menu theme.
- **Hurt cries.** Melee gives a damage voice only to knockback past its
  damage-fly threshold and to KOs.
  Smashcraft's hero models carry their death cry in the Death sequence, so a
  weak hit shows a silent stand-in, and one fighter cries at most every 120
  frames (smashcraft:ts/src/game/presentation/hurtVoice.ts).

Stage themes are matched to setting and race:

| Stage | Track | Why |
| --- | --- | --- |
| Frozen Throne | Lich King's theme | Icecrown's master |
| Nordrassil | Night Elf 1 | the World Tree's people |
| Gryphon Aerie | Human (Frozen Throne) 1 | Aerie Peak's dwarves and the Alliance |
| Durotar Skies | Orc 1 | the orcs' homeland |
| Naxxramas | Undead 3 | the Scourge citadel |
| Hellfire Citadel | Illidan's theme | Illidan's Outland fortress |
| Blackrock | Orc (Frozen Throne) 1 | the Blackrock clan's mountain |
| Ahn'Qiraj | Naga theme | an alien, ancient people beneath the sands |
| Sky Deck (test) | Human 1 | neutral practice ground |

All of these are presentation, so they read confirmed frames and never feed the
simulation. Every path is a script path into the installed game:
`bun tools/presentation/stock-sounds.ts --extract CASC_EXTRACT` checks each
against the game's storage through CascLib and records it in
smashcraft:ts/src/generated/assets/stockSoundInfo.ts, and a test holds the
presentation to that table. It also resolves every sound label hit
presentation plays through the game's AnimSounds.slk and AbilitySounds.slk and
checks each file: a label can name a file the game doesn't store
(RelentlessCleave names a missing RelentlessCleave.ogg and plays nothing).
No audio is copied.

### Stage loading

Warcraft III streams a stage's models and textures after the script creates
them, so a match that begins on the start press can open on a half-drawn stage
(Tom, 7 Oct). Smashcraft puts a loading screen between the press and the
match: the chosen stage's square card picture (smashcraft:docs/design/stage-select.md) and name over a dark cover, with the
stage drawn behind it. Each client reports "stage drawn" through a
synchronized message once its drawing has settled (`STAGE_SETTLE_FRAMES`). The
match, and so its countdown, begins on the callback where the last present
player's report arrives, or after `STAGE_LOAD_TIMEOUT_FRAMES` (ten seconds), so
a stuck client can't hold the others. Every step runs from a synchronized event,
so all clients start together (smashcraft:ts/src/game/session/stageLoad.ts).
The slowest stage, Gryphon Aerie, measured natively on Smashcraft 0.0.72
(Warcraft 3.0.0.24268, 2880x1920, one human and a computer, two samples):
the loading screen is up 0.05 s after the press, the match starts at
0.91-0.93 s (30 settle frames plus the sync round trip), and every deck and
scenery piece is visible on the first unobscured frame, with nothing popping
in afterwards. Thirty settle frames is therefore enough, and the ten-second
timeout is about ten times the observed load. An automatic rematch keeps its drawn stage and
starts at once, and `-dev quick` skips both the loading screen and the
countdown.
