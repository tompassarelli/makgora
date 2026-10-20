# Smashcraft 0.1.3
*A platform fighter inside Warcraft III*

**Pick a Warcraft hero, fight across floating stages and knock your opponents off the screen.** Smashcraft is a free fan-made platform fighter inspired by Super Smash Bros. Melee, built as a custom map for Warcraft III, with rollback netcode for online games. It is early: tell us what feels off.

**Best in Classic graphics.**

## New in 0.1.3
- **Tutorial in any lobby:** the Tutorial button now works with other players in the lobby, not only when you play alone. Everyone joins the lessons, with a computer partner when a slot is free.

## New in 0.1.2
- **Online play:** input delay is one value for the whole match, the same for every player, set automatically from the slowest connection and capped at 16 frames. Character select shows it with the match rules, and each player's ping on their card. Rollback and pacing are tuned for Battle.net, and the game does less work each frame, so there are fewer stutters.
- **Chat:** Warcraft's chat shows on character select, stage select and in matches, and the select screens leave a clear column for it.
- **Select screens:** buttons sit in the header and player cards along the bottom. Click the **VERSUS** header to switch between Versus, Training, Classic and Lore Battles; Team Battle and Friendly Fire sit right below it. In Team Battle, fighters, portraits and the match HUD all take their team's colour.
- **Tutorial:** lessons and the pause-menu controls name your own keys, and finishing it returns you to Versus.
- **Fighters:** Tinker stops sliding when he starts the Laser, Shadow Hunter's Hex lasts one second longer, Rifleman keeps his rifle through his victory cheer and Warden's cloak hangs properly in hers. A KO'd fighter tumbles in its colour, and rolling or being hit no longer picks up an EX drop.
- **Computer opponents:** a new CPU slot starts as a Random opponent, and CPU chips are numbered by their own slot.
- **Camera:** four-player games ease their zoom, and the pre-match camera no longer shakes.
- **Results screen:** Character select goes there at once for everyone; Rematch and New stage still wait for every player. Attacks held into GAME! no longer count as a vote.
- **Controls profile:** it saves keys only, and the help hint sits on the Controls screen.

## What is in the game
- **26 fighters**, each with a ground game, aerials, grabs and throws, four specials, EX specials and an ultimate.
- **10 stages** plus Random.
- **1 to 4 players**: stocks or time, an endless option and rematches.
- **Computer opponents:** six personalities at five difficulties.
- **Training mode** with frame data, hit areas and slow motion.
- **Classic**, a six-fight route ending in a boss, and **Lore Battles**, covering 21 of the 26 fighters.
- A super meter for EX specials and ultimates.

## How to play
1. Download **Smashcraft 0.1.3.w3x** from this page and put it in your Warcraft III **Maps** folder.
2. In Warcraft III's options set **Graphics to Classic**, and restart the game if you just changed it.
3. Open **Custom Game**, **Local Area Network** or **Battle.net** custom games and pick Smashcraft 0.1.3.
4. Choose your controls, your fighter and a stage, then press **Y**.

New here? Place only your own fighter chip and press Y to practice alone.

## Default controls (ESDF)
- Move: **S**/**F**. Aim up: **E**. Crouch, fast-fall and drop through platforms: **D**
- Jump: **Space** or **8**. Shield and air dodge: **A**. Light shield: **0**. Grab: **O**
- Attack: **N**, with a direction for tilts and smashes. Special: **U**, with a direction
- EX special: **9**, which costs one meter segment. Ultimate: **N + U** together at a full meter
- Pause: **Backspace**. Confirm: **Y**. Save the last ten seconds for a bug report: **K**

Rebind any key on the Controls screen, or press **F1** before a match. The full guide is in the GitHub repository: [smashcraft/docs/player-guide.md at main · tompassarelli/smashcraft](https://github.com/tompassarelli/smashcraft/blob/main/docs/player-guide.md)
Controllers work through a separate, experimental helper, [padbridge](https://github.com/tompassarelli/padbridge/releases/latest), which turns a pad into keys while Warcraft III is in front.

## Requirements
- Warcraft III 3.0, with Graphics set to Classic.
- A keyboard. About 66 MB of map download.
- Your own copy of Warcraft III.

## Known issues
- Some effects are still hard to read, for example Lich King's down special and ultimate.
- Forsaken Paladin's attacks and Thrall's down-special slam still need animation work.
- Some animations are stiff, such as Mal'Ganis, Cairne's normals and Sylvanas's kicks.
- Some hit areas do not match the drawn weapon exactly, for example Peon, Chen and Grom.
- Murloc's Disease Cloud and a few other effects borrow another unit's look, and Kobold's Panic Dig draws as a tornado.
- Balance is still a first pass, and the shield bubble can differ slightly from where hits land.
- The game runs at about 59 frames a second and can stutter briefly when your computer is busy.
- Cairne's, Shadow Hunter's and Sylvanas's ultimates and the Gryphon Aerie moving platform are first versions.
- Grom, Anub'arak, Malfurion, Medivh and Kobold have no Classic route or Lore Battle yet.
- Do not restart with Ctrl+R or F5, because they can hang the game. Use New Match or Quit Mission instead.
- Most testing was on Linux. Tell us if anything differs on Windows or macOS.

## Feedback
Reply in this thread or open an issue at [Issues · tompassarelli/smashcraft](https://github.com/tompassarelli/smashcraft/issues). Say which fighters, which stage and what happened. Pressing K in a match saves its last ten seconds to `smashcraft-repro-*.txt` in Warcraft III's CustomMapData folder; attach it to the report.

## Credits
- Created by Tompas (Tom Passarelli). Code, design, animation and stage dressing are our own, written in TypeScript and compiled to Warcraft III's Lua. Source: [GitHub - tompassarelli/smashcraft](https://github.com/tompassarelli/smashcraft) (MIT License).
- The Lich King model by Kwaliti, from Hive Workshop: [The Lich King](https://www.hiveworkshop.com/threads/the-lich-king.154837/). Used with credit as the author permits: [Kwaliti's usage statement](https://www.hiveworkshop.com/profile-posts/951524/) ([Kwaliti](https://www.hiveworkshop.com/members/kwaliti.136001/)).
- The menu cursors, wordmark and stage-select art are Smashcraft originals; the pinching-hand cursor was made with AI assistance.
- Music: Before the First Strike by Tom Passarelli, made with Google Lyria.
- Built with Wisp, TypeScript, TypeScriptToLua, Effect, Bun and Lua 5.3.

## Fan project and IP statement
Smashcraft is an independent fan game, not affiliated with or endorsed by Blizzard Entertainment or Nintendo. It plays only inside your own copy of Warcraft III, using the game's own unit models with animations we authored, plus the community model credited above.
- The source contains no extracted Blizzard files and no Nintendo code or assets.
- Behaviour is measured from the outside and from public frame data (SmashWiki, Smashboards); nothing comes from disassembly, decompilation or reading a game's memory.
- No DRM bypass, no Battle.net emulation, no cheats. The map is free.

Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. Nintendo and Super Smash Bros. Melee are trademarks of Nintendo.
