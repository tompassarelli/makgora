# Smashcraft 0.2
*A platform fighter inside Warcraft III*

**Pick a Warcraft hero, fight across floating stages and knock your opponents off the screen.** Smashcraft is a free fan-made platform fighter inspired by Super Smash Bros. Melee, built as a custom map for Warcraft III, with rollback netcode for online games. It is early: tell us what feels off.

**Best in Classic graphics.**

Join the [Discord](https://discord.gg/JQGZs2UJR) if you'd like to play games sometime and/or contribute.

## New in 0.2
- **One meter and orbs:** a single ultimate meter, filled only by orbs that appear at centre stage every 30 seconds. Touch an orb or hit it with a normal attack; two make an ultimate.
- **Melee feel:** Melee's movement and body numbers for every fighter, Melee auto-cancel windows and wavedash exits that walk.
- **Controls:** WASD and Box layouts with Strong on 9, light shield on E (WASD) or A (Box), C-stick on J, L, 0 and P, Mod X on ;, and Shift bindable. Changing a key saves it to Custom.
- **Fighters:** big reworks for Blademaster, Illidan, Maiev, Chen, Peon, Pit Lord and Kael'thas, and changes across most of the roster.

**Full release notes:** [Smashcraft 0.2 on GitHub](https://github.com/tompassarelli/smashcraft/releases/tag/v0.2). Earlier versions: [all releases](https://github.com/tompassarelli/smashcraft/releases).

## What is in the game
- **26 fighters**, each with a ground game, aerials, grabs and throws, four specials and an ultimate.
- **10 stages** plus Random.
- **1 to 4 players**: stocks or time, an endless option and rematches.
- **Computer opponents:** six personalities at five difficulties.
- **Training mode** with frame data, hit areas and slow motion.
- **Classic**, a six-fight route ending in a boss, and **Lore Battles**, covering 21 of the 26 fighters.
- One ultimate meter, filled by orbs at centre stage every 30 seconds.

## How to play
1. Download **Smashcraft 0.2.w3x** from this page and put it in your Warcraft III **Maps** folder.
2. In Warcraft III's options set **Graphics to Classic**, and restart the game if you just changed it.
3. Open **Custom Game**, **Local Area Network** or **Battle.net** custom games and pick Smashcraft 0.2.
4. Choose your controls, your fighter and a stage, then press **Y**.

New here? Place only your own fighter chip and press Y to practice alone.

## Default controls (WASD)
- Move: **A**/**D**. Aim up: **W** or **Space**. Crouch, fast-fall and drop through platforms: **S**
- Jump: **8**. Shield and air dodge: **Q**. Light shield: **E**. Grab: **O**
- Attack: **N**, with a direction for tilts. Hold Strong (**9** or **Y**) with a direction for smashes: up, down, or forward. The C-stick keys give tilts on the ground and aerials in the air. Special: **U**, with a direction
- Ultimate: **N + U** together at a full ultimate meter (two orbs)
- Pause: **Backspace**. Confirm: **Y**. Save the last ten seconds for a bug report: type **-clip**

Rebind any key on the Controls screen, or press **F1** before a match. The full guide is in the GitHub repository: [smashcraft/docs/player-guide.md at main · tompassarelli/smashcraft](https://github.com/tompassarelli/smashcraft/blob/main/docs/player-guide.md)
Controllers work through a separate, experimental helper, [padbridge](https://github.com/tompassarelli/padbridge/releases/latest), which turns a pad into keys while Warcraft III is in front.

## Requirements
- Warcraft III 3.0, with Graphics set to Classic.
- A keyboard. About 66 MB of map download.
- Your own copy of Warcraft III.

## Known issues
- Some effects are still hard to read, for example Lich King's down special and ultimate.
- Thrall's down-special slam still needs animation work.
- Some animations are stiff, such as Mal'Ganis, Cairne's normals and Sylvanas's kicks.
- Some hit areas do not match the drawn weapon exactly, for example Peon, Chen and Grom.
- Murloc's Disease Cloud and a few other effects borrow another unit's look.
- Balance is still a first pass, and the shield bubble can differ slightly from where hits land.
- The game runs at about 59 frames a second and can stutter briefly when your computer is busy.
- Cairne's, Shadow Hunter's and Sylvanas's ultimates and the Gryphon Aerie moving platform are first versions.
- Grom, Anub'arak, Malfurion and Medivh have no Classic route or Lore Battle yet.
- Do not restart with Ctrl+R or F5, because they can hang the game. Use New Match or Quit Mission instead.
- Most testing was on Linux. Tell us if anything differs on Windows or macOS.

## Feedback
Reply in this thread or open an issue at [Issues · tompassarelli/smashcraft](https://github.com/tompassarelli/smashcraft/issues). Say which fighters, which stage and what happened. Typing -clip in chat during a match saves its last ten seconds to `smashcraft-repro-*.txt` in Warcraft III's CustomMapData folder; attach it to the report.

## Credits
- Created by Tompas (Tom Passarelli). Code, design, animation and stage dressing are our own, written in TypeScript and compiled to Warcraft III's Lua. Source: [GitHub - tompassarelli/smashcraft](https://github.com/tompassarelli/smashcraft) (MIT License).
- The Lich King model by [Kwaliti](https://www.hiveworkshop.com/members/kwaliti.136001/), from [Hive Workshop](https://www.hiveworkshop.com/threads/the-lich-king.154837/). Used with credit as the author permits ([Kwaliti's usage statement](https://www.hiveworkshop.com/profile-posts/951524/)).
- Thrall is [Warchief Thrall Dismounted](https://www.hiveworkshop.com/threads/warchief-thrall-dismounted-re-classic.332006/) by johnwar, from Hive Workshop, built on Ujimasa Hojo's Grom Hellscream; we reanimated every move on it.
- Tyrande Dismounted SD by Retera, from [Hive Workshop](https://www.hiveworkshop.com/threads/tyrande-dismounted-sd.328533/), open source, reanimated for Smashcraft as the author allows.
- The menu cursors, wordmark and stage-select art are Smashcraft originals; the pinching-hand cursor was made with AI assistance.
- Music: Before the First Strike by Tom Passarelli, made with Google Lyria.
- Murloc sound from World of Warcraft, Blizzard Entertainment.
- Warcraft III, its unit models, icons and sounds belong to Blizzard Entertainment. Smashcraft is an independent fan project, not affiliated with or endorsed by Blizzard Entertainment or Nintendo.
- Melee's feel comes from public frame data: [SmashWiki](https://www.ssbwiki.com/) and [Smashboards](https://smashboards.com/).
- Built with Wisp, TypeScript, TypeScriptToLua, Effect, Bun and Lua 5.3.

## Fan project and IP statement
Smashcraft is an independent fan game, not affiliated with or endorsed by Blizzard Entertainment or Nintendo. It plays only inside your own copy of Warcraft III, using the game's own unit models with animations we authored, plus the community models credited above.
- The source contains no extracted Blizzard files and no Nintendo code or assets. The one exception is the murloc gurgle imported into the map: a short sound from World of Warcraft, kept in our private build inputs, never in the source, and credited above.
- Behaviour is measured from the outside and from public frame data (SmashWiki, Smashboards); nothing comes from disassembly, decompilation or reading a game's memory.
- No DRM bypass, no Battle.net emulation, no cheats. The map is free.

Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. Nintendo and Super Smash Bros. Melee are trademarks of Nintendo.
