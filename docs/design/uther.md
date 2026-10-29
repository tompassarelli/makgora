# Uther the Lightbringer: the Silver Hand's hammer

Uther is the roster's first all-rounder: a stern, unhurried paladin with one
tool for every situation and none of them the best in its class. He replaced
Forsaken Paladin as character code 27 on 28 October 2026, at Tom's request;
code 7 is retired. The plan and its Melee anchors are in
[roster-next.md](roster-next.md#uther-the-lightbringer-replaces-forsaken-paladin).
Every number below is an original, provisional Smashcraft value to tune.

## Body and model

- Model: the stock Classic `units\human\Uther\Uther.mdl` at match scale 1.1,
  portrait `BTNHeroPaladin`. Its 13 stock sequences are kept; every attack,
  special, movement, recovery, throw and pain clip is authored by
  smashcraft:tools/animations/uther-clips.ts on the canonical rig mapping in
  smashcraft:tools/animations/rigs/uther.ts.
- Body: weight 106/75, run 0.86, air 0.84 (slow drift), width 1.08, height 1.02, one aerial jump.
- Strengths: neutral flexibility and durability. Weaknesses: no long-range
  pressure, and a slow air drift that makes his recovery readable.

## The hammer swing table

Every hammer move, and the side and up specials, is one row of
`UTHER_HAMMER_SWINGS` (moves.ts) or `UTHER_SPECIAL_SWINGS` (specials.ts): a
pivot (his right shoulder, standing or crouched), the hand's distance from it,
a grip and one angle per active frame. The hit regions are built from that row,
and the clip producer aims his arm and hammer head along the same angles, so
the drawn hammer and the hit regions agree by construction. The stock
Attack - 2 slides the hammer through his fist for reach; tilts and aerials
slide it half way (head 73 units from the hand), smashes, forward air and down
air all the way (97 units).

## Moves

Startup / active / recovery; damage. Holy moves carry the holy element.

- Jab 1, 2: hammer check, then a gauntlet backhand (4/2/14; 3%, then 6/2/18; 5%).
- Forward tilt (three angles): a short hammer hook (8/3/20; 11%).
- Up tilt: an overhead arc front to back that starts juggles (7/5/20; 8%, 85°).
- Down tilt: a crouched low sweep for tech chases (7/3/18; 9%, 70°).
- Dash attack: a shoulder charge behind the levelled hammer (10/5/26; 9%); it
  stops at the foe instead of passing through, so a shield can punish it.
- Forward smash, his signature: a two-handed overhead blow; the head hits 18%
  as a strong hit, the haft 12% (18/3/36).
- Up smash: a hammer upswing with a halo of light (15/5/32; 14%).
- Down smash: a low ring, front then back (14/4/32; 14%).
- Neutral air: a full hammer spin (7/6/22; 10%).
- Forward air: an overhead chop; the head meteors on its last two frames (14/3/26; 13%).
- Back air: a hammer swung behind him, his air kill move (9/3/22; 12%).
- Up air: an arc over his head (8/4/22; 10%).
- Down air: a two-handed plunge, spiking on the clean frames (16/4/30; 14%).
- Grabs: forward throw a holy shove (8%), back throw a hip toss and his kill
  throw (10%), up throw a juggle starter (7%, 90°), down throw a tech-chase slam (6%).

## Specials

- Neutral, **Holy Light:** a golden column bursts one step ahead on frame 16,
  10% at 80°, 44 frames total, punishable on a whiff. A hit heals him 2%, at
  most 6% in one stock. The hit effect's `heal` and `healPerStock` carry it,
  and the fighter's `status.healed` counts the stock's heals.
- Side, **Devotion Aura:** he steps forward with armour against hits up to 6%
  on frames 6-22 and bashes with the hammer on frames 20-23 (9%). A shield
  stops the advance; grabs and strong hits beat the armour. In the air it is
  once per airtime.
- Up, **Hammer of the Righteous:** a rising two-handed hammer arc that climbs
  2.4 reference heights with light steering, hits 7% on frames 8-14, spends
  the aerial jump and ends helpless.
- Down, **Divine Shield:** the first strike or missile that would reach him on
  frames 4-26 is turned aside and he stays intangible to strikes and missiles
  until frame 48; a grab breaks it, he cannot act inside it, and the move ends
  on frame 50. It reuses the shared guard and `divineFrames` rules, so it is a
  read, not a reflector.
- Ultimate, **Resurrection:** after a 24-frame gathering, rings of golden
  light rise on both sides and throw everyone near him upward in two hits
  (14% then 12%), and he heals 10% as they rise (the special's `selfHeal`).
  Shield or roll away during the gathering.


## Home and Classic route

Home stage: Stratholme (6), because Uther refused the Culling at the city's
gates. Classic route: Lordaeron's fall, from the internment camps and the
plague to Stratholme and Muradin, ending at the Lich King.

## Play-style profile

Provisional; the first farm probe replaces these bands with measured shares.

```balance-profile
fighter: uther
archetype: all-rounder
aerials: nair 10-35, fair 10-35, bair 10-35, uair 5-30, dair 0-20
air-share: 20-50
approach: 40-70
ranged: 0-15
specials: neutral 2-12, side 2-12, up 0-8, down 0-8
```

```ceiling-plan
fighter: uther
path: mixed
basic-moves: forward-tilt,up-tilt,neutral-air
```

Basic gameplan: walk into tilt range, start juggles with up tilt and up throw,
and shield or Divine Shield an obvious approach.

Expert gameplan: mix Devotion Aura through light pokes, place Holy Light
where a landing or roll will end, and edge-guard with back air and forward
air's meteor.
