# Smashcraft 0.2
*A platform fighter inside Warcraft III*

**Pick a Warcraft hero, fight across floating stages and knock your opponents off the screen.** Smashcraft is a free fan-made platform fighter inspired by Super Smash Bros. Melee, built as a custom map for Warcraft III, with rollback netcode for online games. It is early: tell us what feels off.

**Best in Classic graphics.**

## New in 0.2
- **Meter and orbs:** the single super bar is now two meters that fill by themselves. The EX charge refills in 12 seconds and pays for EX specials and the EX wavedash; the ultimate meter fills over 2 minutes. Damage builds neither, and a KO keeps both. Orbs appear above the stage near centre, warned 3 seconds ahead by a Mass Teleport marker: a blue orb at 15, 30 and 45 seconds past each minute refills your EX charge, an orange orb on the minute adds half an ultimate meter, and any fighter under it or jumping through it takes it. The rim glows blue with an EX charge and gold at a full ultimate.
- **HUD:** a small square EX cell beside the damage percent fills upward and lights bright blue when charged, and a thin gold ultimate bar under the number fills and pulses when full.
- **EX specials:** each is now the same move with one clear upgrade, such as a farther beam or a shield-safe rush, instead of 25% more damage, and none carries armor.
- **EX wavedash:** hold Strong while air dodging into the ground to spend one EX charge and slide about 40% farther, with blue dust along the slide.
- **Ultimates:** retuned to deal about 25-30% in total. Seventeen weak ones were raised, among them Mountain King's Avatar, Illidan's Metamorphosis and Cairne's Reincarnation, and Dreadlord's Summon Inferno was cut.
- **Strong is Y** on every layout (Custom keeps X as a second Strong). Y still confirms on the select screens, and it can now be bound to any action on the Controls screen.
- **C-stick:** the smash keys are now C-up, C-down, C-left and C-right. On the ground they give tilts (C-left and C-right the forward tilt, turning you first, C-up the up tilt, C-down the down tilt) and in the air the aerials; smashes come only from Strong plus a direction.
- **Dash attack:** a direction plus attack on any frame of a dash is the dash attack, never a forward tilt.
- **Saving a moment:** type -clip in chat instead of pressing =. The = and - keys are ordinary bindable keys.
- **Select screens:** the Controls button now sits left of Moves, and a Random CPU keeps its fighter through Rematch and automatic rematches; New Match and character select draw again.
- **Short-hop down air:** every fighter's down air now hits a standing opponent from a short hop, which Pit Lord and Lich King could not do before.
- **Up specials:** Mountain King's Thunder Leap dive and Illidan's Wing Ascent dive start on their own when you move the stick to a different direction, with no second special press.
- **Ground momentum:** Maiev's Fan of Knives and Illidan's Immolate keep your ground speed like Fox's shine and stop you dead sideways in the air.
- **Blademaster:** Quickdraw replaces Wind Cutter as his neutral special: hold special in a sheathed iaido stance as the hilt glows and release to cut. Longer charges hit for 7-24%, dash from 0.3 to 2.2 body heights and pass through the foe to land behind them, and each hit pops a red Critical Strike number. Wind Walk is now a Marth-style counter on down special: a strike in its window freezes the attacker and he steps out behind them with a handstand kick straight up, but a whiff leaves him wide open. Mirror Image moved to side special and steps the way the stick points while he gathers, leaving the image where he stood. Bladestorm cast in the air floats: hover with nothing held, sink with down, rise with jump. His down air ends in 44 frames instead of 59 so he can down air off stage and still recover, and his back air is a reverse-grip back stab.
- **Illidan:** Fel Rush is now Falco's Phantasm beside Maiev's Shadow Dash: a long dash that a second special press stops short, sending grounded foes low into a tech chase and spiking airborne ones, with the aimed second rush kept and Vengeful Retreat and Chaos Strike gone. The forward smash is a stepping spinning roundhouse kick whose heel is the sweetspot, with a fel crescent behind it. The down air has Falco's frame data and hit, Eye Beam refires like Falco's laser, and he walks on the Demon Hunter's own walk.
- **Maiev:** the side special is Shadow Dash, a Fox Illusion-style blink dash that special cuts short and whose slash pops the foe up; the mark and stun mechanics are gone. Shadow Strike loops like Fox's Blaster, so a short hop throws two daggers. Each dagger is a flinchless 2% hit that adds a poison stack, up to 5, which bursts for 1% a stack when the timer runs out. The down air is a feet-first 45-degree drill, the down tilt a low leg sweep, and the back air is Illidan's back air fitted to her rig.
- **Mountain King:** a Pikachu-style single-flip neutral air with one hit, strong early and weak late, and a Pikachu-style down air where he flips head-down and drills with the hammer held out.
- **Chen:** a drunken-boxing rework with Captain Falcon's influence: near-Falcon ground speed, a keg-slam spike down air, an electric flying-kick forward air with a sweetspot, a two-hit staff spin and a staff scoop, and an up air that juggles straight up, so a combo can carry from 0%. Body Slam is the side special, Brew Keg the down special (fill it in three glugs, then lob it to soak and slow a foe), Breath of Fire ignites a soaked foe, and Storm Rise is electric and opens a parasol float. Storm, Earth and Fire summons the three Brewmaster spirits in turn.
- **Peon:** Log Heave replaces the Burrow as his side special: he heaves a huge log whose far end tips foes up and back toward him, while the near end barely moves them. Gold Sack replaces Lumber Toss: charge it like Donkey Kong's Giant Punch, keep the charge with shield, and a full sack kills. His grab follows Donkey Kong's cargo carry: pummel and throw from the hold, hoist forward onto his shoulder with "Work, work.", walk and jump while carrying, and throw four ways from the carry. His dash attack is a trip-and-dive belly flop.
- **Pit Lord:** Howl of Terror is a fear roar: a fel-red shockwave that grows on both sides and leaves grounded foes cowering, longer at higher damage. Doom curses the grabbed foe at 1% a second until they lose a stock, then a Doom Guard steps out of a fel portal where they fell. His down air is driven straight down under him.
- **Lich King:** Howling Blast leaves his hand sooner, 6 frames earlier, and carries 35% farther.
- **Kael'thas:** Pyroblast replaces Fireball: a slow heavy fireball you steer with the stick while rooted, which kills off the side at high percent and leaves long end lag on a miss. Flame Strike's pillar is shorter, and his victory cheer is a raised fist.
- **Tinker:** a Laser or Cluster Rockets cast started in the air carries through a landing instead of being cut off.

## New in 0.1.5
- **Blademaster:** a new Marth-style two-hit neutral air and down air, a Marth-style up air arc, a quick Wind Walk dash through the opponent, Bladestorm castable in the air, a longer Mirror Image, and more startup and landing lag on Rising Whirlwind and Mirror Image.
- **Mountain King:** a two-hit forward air with alternating hammers, and an 11-frame landing after Thunder Leap.
- **Illidan:** Eye Beam replaces Mana Burn, a Falco-style stomp down air, a twice-per-airtime aimed Fel Rush, an aimed Wing Ascent with quicker startup, a Falco-like fall and jump, a stronger back air for offstage kills, glaives that now carry his hit regions, and a new victory cheer.
- **Maiev:** a Fan of Knives ring, a Fox-style drill down air and split down smash, a Pursuit Lunge somersault, a stun-combo side special, Falco-like gravity, Fox-like grab and throws, a better neutral air and up air, and hit regions fitted to her glaive.
- **Maiev and Illidan down special:** turn around by holding the stick away as you press it, or cancel it into an up smash with Strong + up.
- **Dreadlord (Mal'Ganis):** a two-hoof back kick, an overhead claw rake forward air, a Vampiric Pounce that bites on contact and launches straight up, and a new ultimate, Summon Inferno.
- **Anub'arak:** a down air that drives straight down and hits from a short hop, a snapping back-air lunge, and Impale spikes on his dash attack.
- **Kael'thas:** a Blood Mage kit with a steerable Pyroblast, Flame Strike, a steerable Phoenix and a long Siphon Mana grab.
- **Cairne, Chen, Murloc and Thrall:** hit regions now follow Cairne's axe, Chen's staff and Thrall's Doomhammer, and Murloc stabs with his spear on jabs and forward tilt.
- **Sylvanas, Muradin and Malfurion:** a longer-reaching standing grab, a backhand axe back air with lightning trailing Hammerfall, and a rework of the dash attack.
- **Hex and Sleep:** Hex lasts 140 frames with the frog hopping at random, Sleep lasts a full 160 frames in the air and on the ground, and a Hexed or Slept fighter floats down slowly.
- **Shield stop:** raising a shield during the initial dash stops you dead, and a shield out of a run slides by Melee's traction rule.
- **Platforms:** falling onto a platform with down held lands on it; the only way down through one is a down input while standing on it.
- **Strong-button smashes:** Strong is a pure modifier that only upgrades A to a smash, holding Strong plus a direction smashes in place, and Strong + up + A gives an up smash out of a dash.
- **Chat in select screens:** player chat and the chat box now draw over character and stage select.
- **Percent display:** whole percents with a stock row on a mirrored HUD panel, a marker over each fighter with percent, name and slot colour, and damage stops at 999%.
- **Battle.net names:** the fighter marker shows your name without the #number tag.
- **-clip command:** type -clip in chat to save a moment, and = and - are ordinary keys you can bind.
- **Smashes and aerials:** every smash holds full charge for 120 more frames, every aerial now has Melee's auto-cancel windows, and short hopping lets you land an aerial's first active frame.
- **Melee feel:** every fighter gets Melee's movement and body numbers, throws launch as if the victim weighed 100, tech rolls are intangible for 20 frames, and wall techs hold until they end.
- **Banish:** attacks pass through a Banished fighter, as in Warcraft III.
- **Meter:** two meters, an EX charge (12 s) and an ultimate meter (2 min), fill over time and from orbs at centre stage; a coloured rim shows which is ready, blue for EX and gold for the ultimate.
- **CPU slots and edges:** new CPU slots default to a Random fighter, and fighters lean over the drop when teetering at a stage edge.

## New in 0.1.4
- **WASD controls:** the default layout is now WASD: A/D move, W aims up, S crouches and drops through platforms, and Q shields. A saved ESDF profile keeps its keys and shows as Custom.

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
- Two meters for EX specials and ultimates, with orbs at centre stage.

## How to play
1. Download **Smashcraft 0.2.w3x** from this page and put it in your Warcraft III **Maps** folder.
2. In Warcraft III's options set **Graphics to Classic**, and restart the game if you just changed it.
3. Open **Custom Game**, **Local Area Network** or **Battle.net** custom games and pick Smashcraft 0.2.
4. Choose your controls, your fighter and a stage, then press **Y**.

New here? Place only your own fighter chip and press Y to practice alone.

## Default controls (WASD)
- Move: **A**/**D**. Aim up: **W**. Crouch, fast-fall and drop through platforms: **S**
- Jump: **Space** or **8**. Shield and air dodge: **Q**. Light shield: **0**. Grab: **O**
- Attack: **N**, with a direction for tilts. Hold Strong (**Y**) with a direction for smashes: up, down, or forward. The C-stick keys give tilts on the ground and aerials in the air. Special: **U**, with a direction
- EX special: **Y + U** with a direction, which spends the EX charge. Ultimate: **N + U** together at a full ultimate meter
- Pause: **Backspace**. Confirm: **Y**. Save the last ten seconds for a bug report: type **-clip**

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
Reply in this thread or open an issue at [Issues · tompassarelli/smashcraft](https://github.com/tompassarelli/smashcraft/issues). Say which fighters, which stage and what happened. Typing -clip in chat during a match saves its last ten seconds to `smashcraft-repro-*.txt` in Warcraft III's CustomMapData folder; attach it to the report.

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
