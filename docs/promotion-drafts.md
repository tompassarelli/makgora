# Promotion drafts

Private drafts for Tom to approve before anything is posted under his name. `PROJECT_URL` is the Mak'gora project thread drafted in [hive-project.md](hive-project.md) and `PATREON_URL` the Patreon page; both are filled in once they exist.

## Mak'gora 0.3.1: Hive thread reply

Posted as a reply in the map's Hive thread after the 0.3.1 map is uploaded (BBCode):

```
[B]Mak'gora 0.3.1 is out[/B]
Smashcraft is now [B]Mak'gora[/B]. New in 0.3:
[LIST]
[*]Onyxia joins as Lady Katrana Prestor, who can reveal the black dragon
[*]Up to eight costumes per fighter
[*]New-player mode with your keys on screen, and a longer Tutorial
[*]New names: Samuro, Rokhan, Mannoroth, Arthas, Stitches, and the duo Mrgl & Grgl
[*]Reworks for Thrall, Mal'Ganis, Firelord, Stitches and Rexxar, and darker stage backdrops
[/LIST]
Controllers work through [URL="https://github.com/tompassarelli/padbridge/releases/latest"]padbridge[/URL], and a ranked ladder is coming. News and the roadmap: [URL="PROJECT_URL"]Mak'gora project page[/URL]. Games and feedback: [URL="https://discord.gg/JQGZs2UJR"]Discord[/URL].
```

## Mak'gora 0.3.1: Discord announcement

**Mak'gora 0.3.1 is out!** Smashcraft has a new name: Mak'gora.

New in 0.3: Onyxia joins (Lady Katrana Prestor, who can reveal the black dragon), up to eight costumes per fighter, a new-player mode that shows your keys on screen, a longer Tutorial, the new names Samuro, Rokhan, Mannoroth, Arthas, Stitches and Mrgl & Grgl, and reworks for Thrall, Mal'Ganis, Firelord, Stitches and Rexxar.

Download: https://www.hiveworkshop.com/threads/smashcraft.375492/ (put the map in your Warcraft III Maps folder, Graphics on Classic, open it from Custom Game). Controllers work through padbridge: https://github.com/tompassarelli/padbridge/releases/latest

A ranked ladder is coming. Project page: PROJECT_URL · Patreon: PATREON_URL

Post your games, clips and bugs here. — Tompas

# Smashcraft 0.1.0 promotion drafts (history)


Private drafts for Tom to post after [the release gates](https://github.com/tompassarelli/smashcraft/issues/346) pass and the map is uploaded to Hive Workshop. These describe the intended 0.1.0 release, not a release available today. The existing [GitHub Issues channel](https://github.com/tompassarelli/smashcraft/issues) is the feedback destination. Download links use the Hive Workshop placeholder; Tom can substitute the map page once it exists. GitHub repositories hold code only, with no map release attachments. Controls, installation and the restart caveat come from [the player guide](player-guide.md).
The live Hive Workshop page is written in [hive-post.md](hive-post.md) (smashcraft:docs/hive-post.md); `bun run hive:post` in ts/ prints it as Hive BBCode to paste into the page editor (smashcraft:ts/scripts/hivePost.ts): `#` is the centred title and the next line its subtitle, `##` a section heading, `###` a bold label, `-` and `1.` lists, and `**bold**`, `*italic*`, `code` and links convert inline.


## Hive Workshop map page

**Smashcraft 0.1.0 — a Warcraft III platform fighter**

Pick a Warcraft fighter, fight across floating stages, and knock your opponents out. Created by Tompas, Smashcraft has 26 fighters, Classic graphics, computer opponents, Training, Classic routes and Lore Battles.

This is the first public version; it's early, expect rough edges, tell us what feels off. Send feedback through [Smashcraft GitHub Issues](https://github.com/tompassarelli/smashcraft/issues), including your Warcraft version, fighters, stage and what happened. A short clip helps. Type -clip in chat during a match to save its last ten seconds for a bug report; the saved `smashcraft-repro-*.txt` is in Warcraft III's CustomMapData folder.

**Controls:** keyboard play needs no extra software. Open Controls with F1 before a match to choose QWERTY or Custom and save bindings. Custom uses W/R to move, Space to aim up, E to aim down or drop through platforms, I/9 to jump, Z to short hop, N to attack, U for specials, Q/8 to shield or air-dodge, and O to grab. Y confirms selections and pauses or resumes. Optional controllers use the Smashcraft controller helper; keyboard play is the simplest way to start.

**Install:** requires Warcraft III 3.0 with Graphics set to Classic. Download `Smashcraft 0.1.0.w3x` from [Hive Workshop](https://www.hiveworkshop.com/), put it in your Warcraft III Maps folder, and open it through Custom Games. Start with Training to learn the controls, or select computer opponents for a match.

**How to use a controller:** install and start the optional [Smashcraft controller helper](https://github.com/tompassarelli/padbridge), connect your pad, and open the map through Custom Games. The default controls already match the helper; if you saved Custom controls earlier, press F1, choose QWERTY and Save. Keep the Warcraft window focused. The helper starts with **Melee**; choose **Tom** on the companion's Controller page if you prefer that layout. These are Xbox button labels, with no custom remaps:

| Control | Melee (default) | Tom |
| --- | --- | --- |
| A | Attack | Attack |
| B | Special | Grab |
| X | Jump | Special |
| Y | Jump | Jump |
| LB | Strong: hold with A for a smash | Short hop, even when held |
| RB | Grab | Strong: hold with A for a smash |
| LT (left trigger) | Shield / air-dodge | Shield / air-dodge |
| RT (right trigger) | Shield / air-dodge | Shield / air-dodge |
| Left stick | Move; up aims, down crouches / fast-falls / drops through platforms | Same |
| Right stick | Directional tilts on the ground; aerial attacks in the air | Same |
| Start | Confirm selections; pause / resume | Same |

Tap a jump button for a short hop or hold it for a full hop. Stick-up does not jump unless you enable Tap jump. In fighter and stage menus, the left stick moves the pointer, A chooses, B goes back and Start confirms. Start with Training and try each trigger separately; either one shields on the ground and air-dodges in the air.

**Known issues:** the guide documents unreliable Ctrl+R restarting and a past F5 hang when returning to the menu. Use New Match after a result; to leave, use Warcraft's ordinary Quit Mission and recreate the custom game. Follow [open reports](https://github.com/tompassarelli/smashcraft/issues) for current problems and workarounds.

## Discord announcement

Smashcraft 0.1.0 is the first public version of my Warcraft III platform fighter: 26 Warcraft fighters, Classic graphics, computer opponents, Training, Classic routes and Lore Battles. It's early, expect rough edges, tell us what feels off.

[Download the map from Hive Workshop](https://www.hiveworkshop.com/), put `Smashcraft 0.1.0.w3x` in your Warcraft III Maps folder, then open Custom Games. Requires Warcraft III 3.0 with Graphics set to Classic; keyboard play needs no helper. Start with Training. F1 opens Controls before a match; the Custom layout uses W/R to move, I to jump, N to attack, U for specials, Q to shield, O to grab and Y to pause.

Please send feedback to [Smashcraft GitHub Issues](https://github.com/tompassarelli/smashcraft/issues), with the fighters, stage and Warcraft version. Type -clip in chat to save a recent match moment for a report. For now, avoid Ctrl+R and F5 restarting; use New Match or Warcraft's Quit Mission instead. — Tompas

## Reddit: r/WC3

**Title:** Smashcraft 0.1.0: a platform fighter inside Warcraft III

I've made Smashcraft, a Warcraft III platform fighter with 26 Warcraft fighters, floating stages, computer opponents, Training, Classic routes and Lore Battles. This public version uses Classic graphics.

This is the first public version; it's early, expect rough edges, tell us what feels off. [Download from Hive Workshop](https://www.hiveworkshop.com/): put `Smashcraft 0.1.0.w3x` in your Warcraft III Maps folder and open it through Custom Games. Requires Warcraft III 3.0 with Graphics set to Classic. Keyboard play is built in; controllers use an optional helper. Start with Training and F1 for Controls. Custom uses W/R to move, I to jump, N to attack, U for specials, Q to shield, O to grab and Y to pause.

I'd like feedback on how the fights feel and anything confusing when you start. Reply here or use [Smashcraft GitHub Issues](https://github.com/tompassarelli/smashcraft/issues); please mention the fighters, stage and Warcraft version. -clip in chat saves a recent match moment for a report. Known restart caveat: avoid Ctrl+R and F5; use New Match or Warcraft's Quit Mission. — Tompas

## Trailer edit: 75 seconds

Use native 1080p60 Expert computer-vs-computer footage in Classic. Keep the match audio. The cut needs actual clips before the trailer gate passes.

| Time | Shot | On-screen words |
| --- | --- | --- |
| 0–5 s | Wide stage view, then two fighters enter | Smashcraft 0.1.0 |
| 5–17 s | Three short exchanges on different stages | A Warcraft III platform fighter |
| 17–29 s | Grom, Anub'arak, Malfurion and Medivh in action | 26 fighters |
| 29–43 s | Two special moves, a shield exchange and a recovery | None |
| 43–55 s | Classic gameplay on two more stages | Classic graphics |
| 55–67 s | Two readable KOs, one close finish | None |
| 67–75 s | Key art with download destination | First public version. Early; expect rough edges. Created by Tompas. |

Choose 8–10 stills from those clips: one per new fighter, two different stages with a clear exchange, one special move and one KO. Avoid debug overlays. Use the stock-fighter lineup from #317 as the key art. Reference capture paths and approval belong in #346; keep game captures private until Tom posts them.
