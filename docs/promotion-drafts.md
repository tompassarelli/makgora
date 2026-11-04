# Promotion drafts

Private drafts for Tom to approve before anything is posted under his name. `PROJECT_URL` is the Mak'gora project thread drafted in [hive-project.md](hive-project.md) and `PATREON_URL` the Patreon page; both are filled in once they exist.

Mak'gora 0.3 is unreleased: nothing of 0.3 has been published, and the `v0.3` tag is cut only when Tom decides to release, which names its build `Mak'gora 0.3.w3x`. Until then builds are `Mak'gora 0.3-dev.N`. Two tags pushed early on 2026-10-31 were removed from origin on 2026-11-01 because no release used them (Tom's direction, 2026-11-01): `v0.3.0`, tag object 48e402df69fbc8e67d6236e0ffefe23da1c280d0 on commit 06729a41b9b61c38a18410db1faf10f96f9b72bb (the rename to Mak'gora), and `v0.3.1`, tag object bba2957ab866d672ccb9cbd89779b598e4d486a3 on commit 9bf3e613f69ee8bfdae118e462c41fb7c476fdad (the Mak'gora loading-screen art). To restore one, run `git tag -a v0.3.1 9bf3e613f69ee8bfdae118e462c41fb7c476fdad -m "Mak'gora 0.3.1"` and push it with `safe-push --tag v0.3.1`.

## Mak'gora 0.3: Hive thread reply

Posted as a reply in the map's Hive thread after the 0.3 map is uploaded (BBCode):

```
[B]Mak'gora 0.3 is out[/B]
Mak'gora is now [B]Mak'gora[/B]. New in 0.3:
[LIST]
[*]Onyxia joins as Lady Katrana Prestor, who can reveal the black dragon
[*]Up to eight costumes per fighter
[*]New-player mode with your keys on screen, and a longer Tutorial
[*]New names: Samuro, Rokhan, Mannoroth, Arthas, Stitches, and the duo Mrgl & Grgl
[*]Reworks for Thrall, Mal'Ganis, Ragnaros, Stitches and Rexxar, and darker stage backdrops
[/LIST]
How to install and play: [URL="https://github.com/tompassarelli/makgora/blob/main/docs/player-guide.md"]player guide[/URL]. A ranked ladder is coming. News and the roadmap: [URL="PROJECT_URL"]Mak'gora project page[/URL]. Games and feedback: [URL="https://discord.gg/JQGZs2UJR"]Discord[/URL].
```

## Mak'gora 0.3: Discord announcement

**Mak'gora 0.3 is out!** Mak'gora has a new name: Mak'gora.

New in 0.3: Onyxia joins (Lady Katrana Prestor, who can reveal the black dragon), up to eight costumes per fighter, a new-player mode that shows your keys on screen, a longer Tutorial, the new names Samuro, Rokhan, Mannoroth, Arthas, Stitches and Mrgl & Grgl, and reworks for Thrall, Mal'Ganis, Ragnaros, Stitches and Rexxar.

Download: https://www.hiveworkshop.com/threads/smashcraft.375492/ · How to install and play: https://github.com/tompassarelli/makgora/blob/main/docs/player-guide.md

A ranked ladder is coming. Project page: PROJECT_URL · Patreon: PATREON_URL

Post your games, clips and bugs here. — Tompas

# Mak'gora 0.1.0 promotion drafts (history)


Private drafts for Tom to post after [the release gates](https://github.com/tompassarelli/makgora/issues/346) pass and the map is uploaded to Hive Workshop. These describe the intended 0.1.0 release, not a release available today. The existing [GitHub Issues channel](https://github.com/tompassarelli/makgora/issues) is the feedback destination. Download links use the Hive Workshop placeholder; Tom can substitute the map page once it exists. GitHub repositories hold code only, with no map release attachments. Controls, installation and the restart caveat are in [the player guide](player-guide.md), not restated here.
The live Hive Workshop page is written in [hive-post.md](hive-post.md) (makgora:docs/hive-post.md); `bun run hive:post` in ts/ prints it as Hive BBCode to paste into the page editor, followed by the generated [player guide](player-guide.bbcode.txt), so the page never restates guide facts by hand (makgora:ts/scripts/hivePost.ts): `#` is the centred title and the next line its subtitle, `##` a section heading, `###` a bold label, `-` and `1.` lists, and `**bold**`, `*italic*`, `code` and links convert inline.


## Hive Workshop map page

**Mak'gora 0.1.0 — a Warcraft III platform fighter**

Pick a Warcraft fighter, fight across floating stages, and knock your opponents out. Created by Tompas, Mak'gora has 26 fighters, Classic graphics, computer opponents, Training, Classic routes and Lore Battles.

This is the first public version; it's early, expect rough edges, tell us what feels off. Send feedback through [Mak'gora GitHub Issues](https://github.com/tompassarelli/makgora/issues), including your Warcraft version, fighters, stage and what happened. A short clip helps.

**How to play:** installing, controls, controllers, bug clips and known issues are in [the player guide](player-guide.md).

## Discord announcement

Mak'gora 0.1.0 is the first public version of my Warcraft III platform fighter: 26 Warcraft fighters, Classic graphics, computer opponents, Training, Classic routes and Lore Battles. It's early, expect rough edges, tell us what feels off.

[Download the map from Hive Workshop](https://www.hiveworkshop.com/) and start with Training; the player guide covers install, controls and bug clips.

Please send feedback to [Mak'gora GitHub Issues](https://github.com/tompassarelli/makgora/issues), with the fighters, stage and Warcraft version. — Tompas

## Reddit: r/WC3

**Title:** Mak'gora 0.1.0: a platform fighter inside Warcraft III

I've made Mak'gora, a Warcraft III platform fighter with 26 Warcraft fighters, floating stages, computer opponents, Training, Classic routes and Lore Battles. This public version uses Classic graphics.

This is the first public version; it's early, expect rough edges, tell us what feels off. [Download from Hive Workshop](https://www.hiveworkshop.com/) and start with Training; the player guide covers install, controls and bug clips.

I'd like feedback on how the fights feel and anything confusing when you start. Reply here or use [Mak'gora GitHub Issues](https://github.com/tompassarelli/makgora/issues); please mention the fighters, stage and Warcraft version. — Tompas

## Trailer edit: 75 seconds

Use native 1080p60 Warchief computer-vs-computer footage in Classic. Keep the match audio. The cut needs actual clips before the trailer gate passes.

| Time | Shot | On-screen words |
| --- | --- | --- |
| 0–5 s | Wide stage view, then two fighters enter | Mak'gora 0.1.0 |
| 5–17 s | Three short exchanges on different stages | A Warcraft III platform fighter |
| 17–29 s | Grom, Anub'arak, Malfurion and Medivh in action | 26 fighters |
| 29–43 s | Two special moves, a shield exchange and a recovery | None |
| 43–55 s | Classic gameplay on two more stages | Classic graphics |
| 55–67 s | Two readable KOs, one close finish | None |
| 67–75 s | Key art with download destination | First public version. Early; expect rough edges. Created by Tompas. |

Choose 8–10 stills from those clips: one per new fighter, two different stages with a clear exchange, one special move and one KO. Avoid debug overlays. Use the stock-fighter lineup from #317 as the key art. Reference capture paths and approval belong in #346; keep game captures private until Tom posts them.
