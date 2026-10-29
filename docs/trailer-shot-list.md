# Trailer shot list

The shots the trailer capture (#363) records, each reproducible from a pad
script in smashcraft:ts/test/native/pads/trailer/. A shot is a pad script's
setup chat plus its timed inputs; the match it starts is deterministic, so the
same script draws the same frames headless and natively. The order follows
the 75-second cut in [promotion drafts](promotion-drafts.md), "Trailer edit".

## Fields

- **Fighters**: slot a first, then slot b.
- **Stage**: the stage card name and its id in the setup chat.
- **Pad**: the script under ts/test/native/pads/trailer/; its `#! chat`
  line is the setup and its `#! expect` lines are the shot's beats.
- **Frames**: the match frames to keep, first to last. Frame 1 is the first
  match frame after the setup chat; `-dev quick` matches start at frame 1.
- **Camera**: every shot uses the match camera
  (smashcraft:ts/src/game/sim/matchCamera.ts, [Melee camera](melee-camera.md)),
  which is deterministic match state, seen from client a. Promo shots hide
  the HUD, hints and developer receipts (`-dev quick promo`); scripted
  shots keep the HUD, so crop or cover its band in the edit. Cropping and
  reframing belong to the edit, not the capture.

## Shots

| # | Fighters (archetype) | Stage | Pad | Frames | Camera | What it shows |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Lich King (bait-and-punish) / Anub'arak (trapper), both Expert CPUs | Frozen Throne (2) | promo-frozen-throne.pad | 230-500 | match camera, HUD hidden | Anub'arak's two strong hits (264, 322) send Lich King out at 89%; he respawns on 481. |
| 2 | Pit Lord (heavy) / Illidan (rushdown), both Expert CPUs | Hellfire Citadel (14) | promo-hellfire-citadel.pad | 230-520 | match camera, HUD hidden | Pit Lord's heavy strikes (259, 350) knock Illidan out at 80%; respawn on 502. |
| 3 | Blademaster (bait-and-punish) / Thrall (heavy), both Expert CPUs | Durotar Skies (3) | promo-durotar-skies.pad | 1620-1840 | match camera, HUD hidden | Blademaster at 138% spends his up special 1,300 units offstage (1678) and falls short; respawn on 1819. |
| 4 | Cairne Bloodhoof (heavy) / Chen Stormstout (bait-and-punish), both Expert CPUs | Ahn'Qiraj (13) | promo-ahnqiraj.pad | 700-980 | match camera, HUD hidden | Chen launches Cairne at 113% (728) and Cairne never makes it back; respawn on 963. |
| 5 | Sylvanas Windrunner (zoner) / Lich (zoner), both Expert CPUs | Naxxramas (4) | promo-naxxramas.pad | 1440-1590 | match camera, HUD hidden | Sylvanas's strong hit on Lich at 135% (1466) is the knockout; respawn on 1573. |
| 6 | Warden (rushdown) / Murloc (rushdown), both Expert CPUs | Tomb of Sargeras (7) | promo-tomb-of-sargeras.pad | 800-1040 | match camera, HUD hidden | Warden hits Murloc three times as he tries to recover (829, 857, 906) and takes the stock; respawn on 1019. |
| 7 | Jaina Proudmoore (zoner) / Rifleman (zoner), both Expert CPUs | Gryphon Aerie (11) | promo-gryphon-aerie.pad | 1660-1980 | match camera, HUD hidden | Edge-guard: Rifleman reaches the ledge (1682), is hit as he climbs (1721, 131%) and loses the stock; respawn on 1964. |
| 8 | Medivh (mobility trickster) / Malfurion Stormrage (zoner), both Expert CPUs | Nordrassil (10) | promo-nordrassil.pad | 1740-1840 | match camera, HUD hidden | Ledge play: Malfurion hangs on the ledge (1766), Medivh takes a hit to 90% (1783) and Malfurion climbs back (1811). |
| 9 | Dreadlord (grappler) / Forsaken Paladin (bait-and-punish), both Expert CPUs | Stratholme (6) | promo-stratholme.pad | 1480-1660 | match camera, HUD hidden | Forsaken Paladin recovers to the ledge twice (1502, 1605); Dreadlord punishes the first climb (1543, 94%). |
| 10 | Goblin Tinker (setplay) / Mountain King (heavy) | Gryphon Aerie (11) | tinker-laser.pad | 60-140 | match camera, HUD on | Tinker Laser: the arms glow from the side special (70) and the beam catches Mountain King (92). |
| 11 | Shadow Hunter (setplay) / Beastmaster (setplay) | Naxxramas (4) | shadow-hunter-hex.pad | 50-320 | match camera, HUD on | Shadow Hunter's Hex (60) shuts down Beastmaster's mashed attacks, a forward smash lands (143-153), then Beastmaster calls Bear (260). |
| 12 | Peon (grappler) / Grom Hellscream (rushdown) | Blackrock (12) | peon-grab-throw.pad | 40-115 | match camera, HUD on | Peon dashes in, grabs Grom (70) and throws him (84). |
| 13 | Mountain King (heavy) / Cairne Bloodhoof (heavy), both ultimate meters full | Durotar Skies (3) | ex-thunder-clap.pad | 250-340 | match camera, HUD on (the meters matter) | Both fighters wear the gold full-meter glow; Mountain King casts Thunder Clap (260). |
| 14 | Kael'thas Sunstrider (trapper) / Grom Hellscream (rushdown), both meters full | Ahn'Qiraj (13) | ultimate-phoenix.pad | 80-280 | match camera, HUD on (the ultimate meter empties) | Ultimate: Kael'thas spends the whole ultimate meter (91) and its burn hits Grom every 30 frames from 140 to 260. |
| 15 | Grom Hellscream (rushdown) / Thrall (heavy), two players online | Hellfire Citadel (14) | online-rollback.pad | 40-300 | match camera, client a (host) | Online with rollback at 124 ms round trip: Grom grabs Thrall (70) and throws him (85) with both sides in checksum agreement. |

## Coverage

- Stages: all ten selectable stages (smashcraft:ts/src/game/menu/stageCatalog.ts)
  appear at least once, each as a promo shot.
- Roster: all 26 selectable fighters appear; the six without a promo shot
  (Kael'thas Sunstrider, Grom Hellscream, Goblin Tinker, Shadow Hunter,
  Beastmaster, Peon) carry the scripted shots.
- Systems: Expert computers on both sides of every promo shot (the CPU);
  knockouts, a failed recovery and edge-guards (shots 1-7); ledge play
  (8, 9); signature specials and a throw (10-12); a Thunder Clap exchange (13); an ultimate
  (14); online with rollback (15).

## Replaying a shot headless

From ts/, with the journal helper built from smashcraft:controller/
(`cargo build --release --bin wc3-journal`):

```sh
bun wisp pad test/native/pads/trailer/promo-tomb-of-sargeras.pad --headless --helper HELPER --out DIR
```

The run fails unless every edge lands on its frame, every `#! expect` beat
holds and the View-saved moment replays to its checksums. `bun wisp farm
pads --only trailer` plays all of them on GitHub's runners, one job a
script, and keeps each trace. Shot 15 also replays over Wisp's UDP lockstep
between two processes, at 120 ms round trip and 1% loss:

```sh
bun wisp net pair --script test/native/pads/trailer/online-rollback.pad --frames 420 --rtt 120 --loss 0.01
```

It prints each side's rollback depth and the checksum agreement every 60
frames; the shot keeps when both sides report 0 mismatches.

## Playing a shot back natively (#363)

The same scripts drive pool clients through `bun wisp pad SCRIPT|DIR
--helper HELPER --out DIR --map MAP.w3x --pair K`, one game per batch with
`-dev reset` between scripts ([pad](commands/pad.md)); its native-vs-headless
comparison is the proof that the capture shows the stated frames. Shot 13 is
the only script on the `melee` pad preset, and a batch refuses mixed presets,
so play it as its own batch. Scripted ultimate casts have failed to fire in
`nativeCapture.ts` capture maps (2026-10-25); play shot 14 through `bun wisp
pad`, whose parity report shows whether the cast landed.
