# Tyrande Whisperwind

Tyrande is an aerial rushdown archer. Her arrows open offence rather than
zone: they are fast, short-lived and barely stagger, so the foe holds shield
while she closes in the air. Tom asked for her on Retera's dismounted model
(2026-10-28); her spec is the Tyrande section of
smashcraft:docs/design/roster-next.md. All combat values are original,
provisional Smashcraft tuning. The Melee anchor is Falco's shape (a fast
faller whose lasers push into offence, with a reflector), not his numbers.

## How she differs

- From Sylvanas and Lady Vashj, the bow zoners: her arrows deal 3% with almost
  no knockback and vanish after 22 frames, so they win nothing from range.
  They exist to make the foe shield or jump into her aerials.
- From Illidan and Blademaster, the other rushdown fighters: she is the only
  one who approaches behind a projectile, and the only fighter with a
  reflector.
- Weakness: a light body (weight 84) that dies early, a fast fall that makes
  her easy to combo, and a recovery that ends helpless and can be read high.

## Body and model

- **Model.** [Tyrande Dismounted SD by Retera](https://www.hiveworkshop.com/threads/tyrande-dismounted-sd.328533/)
  (Hive Workshop, open source), imported as
  `war3mapImported\TyrandeDismountedSD.mdx` from the `imported-models` input.
  It draws the stock `PriestessOfTheMoon` and `HeroRanger` textures. Its bones
  are biped-named and match the canonical rig like Sylvanas's: the bow is
  `Cylinder02` under `Bone_Hand_L`, and there is no right-hand bone. It has 13
  stock sequences (four stands, Stand Ready, Stand Victory, Stand Hit, Walk,
  two attacks, Spell, Death, Dissipate) and no portrait, so her select and HUD
  busts come from the fighter-portrait renderer and her command icon is
  `BTNPriestessOfTheMoon`.
- **Clips.** The map imports her authored copy from her `hero-models` shard:
  smashcraft:tools/animations/tyrande-clips.ts keeps the 13 stock sequences and
  appends 66 clips timed to her frame data (bow strikes; kicks for down tilt,
  dash attack, down smash, neutral air, back air and down air; her four casts;
  movement, paired grabs and nine damage reactions). Its motion helper parents
  every root node, so the arrow her stock victory looses no longer counts as a
  bobbing body root.
- **Size.** Draw scale 1.0, about 128 units tall. Weight 84, the shared
  reference fall (the roster's fastest), run 1.10 of the reference, hurt
  capsule 0.90 of the reference width and 0.95 of its height. Her shield sits
  at height 64 with radius 112.
- **Voice.** The Priestess of the Moon's unit voice.

## Kit

Normals (startup / active / recovery; damage):

- Jab 1, 2: a bow-limb strike, then a moonlit cut (3/2/12; 3%, then 4/2/14; 4%).
- Forward tilt (three angles): a moonlit bow slash (6/3/18; 9%).
- Up tilt: an overhead bow arc that starts juggles (5/4/16; 7%).
- Down tilt: a low spin kick that starts tech chases (6/3/16; 8%).
- Dash attack: a flying knee (7/5/22; 9%, then 6% late).
- Forward smash: the signature, a moonlight-charged thrust whose bow tip
  deals 16% and kills while the grip deals 12% (14/3/32).
- Up smash: the bow swept overhead (12/4/30; 14%, then 13% behind).
- Down smash: a split kick front then back (11/4/30; 13%).
- Neutral air: a split kick front and back, 10% clean and 6% late (4/8/18).
- Forward air: a four-hit moonlit flurry, 2.5% each; the first three hold the
  foe with a set knockback and the last one launches (6/12/22).
- Back air: a back kick (5/4/18; 13%), her strongest aerial.
- Up air: a bow flip (6/4/18; 10%).
- Down air: a downward bow smash that spikes on the clean hit (8/4/24; 12%).

The plan names a moonglaive for the jab, forward tilt and forward smash. The
model holds only a bow, so those strikes use the bow and moonlight instead;
the frames and damage are the plan's.

Grabs are quick and short (6/2/22) with a 2% pummel. Forward throw kicks the
foe away (6%). Back throw is a spin toss (9%), her kill throw. Up throw
fires an arrow into them (8%, the plan's 5% + 3% as one hit, since a throw
lands one effect). Down throw plants them for a tech chase (5%, set
knockback).

Specials:

- **Searing Arrows** (neutral). A flaming arrow (`SearingArrowMissile`) leaves
  on frame 8 at 24 units a frame and lives 22 frames: 3% with almost no
  knockback. The whole action lasts 24 frames, and in the air it costs no
  height, so she can fire it from a short hop. Shields stop it and reflectors
  return it.
- **Trueshot Aura** (side). A 30-frame stance (`TrueshotAura`). On frame 14 her
  next three Searing Arrows within 300 frames become moonlit arrows
  (`MoonPriestessMissile`): 6% each, and each passes through the first fighter
  it strikes to hit a second. The stance is the cost.
- **Moonlight Leap** (up). After 5 frames she rises 2.2 reference heights over
  20 frames with wide steering, tapping anyone she passes for 5% on frames
  6-12, under a moon-well trail (`MoonWellCasterArt`). Once per airtime, it
  ends helpless with 20 landing frames.
- **Elune's Grace** (down), the roster's reflector. She braces with her bow raised
  before her like a shield, a shield flash (`DefendCaster`) and a silver
  shimmer (`SpellShieldCaster`) in front of her, and turns back every reflectable projectile that touches
  her body on frames 4-12, at the shield reflector's speed and damage
  multipliers. Its frame-4 hit pushes a close foe with 2% and a set
  knockback. It can be jump-cancelled from frame 4, and a 24-frame cooldown
  keeps it from being chained. In the air it stalls her on frames 1-12.
- **Starfall** (ultimate). She channels in place for 116 frames. From frame
  22, four lanes 80, 200, 320 and 440 units ahead are marked 12 frames
  before each star falls; stars fall on every lane three times, on frames 34,
  64 and 94 (each lane 3 frames after the one before). A foe who stays in one
  lane takes 8.5%, 8.5% and 9%: 26%, with the first two holding them in place
  and the last one launching. Hitting her ends the channel and every star
  still to fall. Each star strikes its lane as a falling-star burst
  (`StarfallCaster`), so the stars read as landing ahead of her.

Her home stage is Nordrassil (10), Hyjal's defence. Her Classic route ends
at Archimonde, through Ashenvale and the Battle of Mount Hyjal.

## Play-style profile

Tom-tunable draft (2026-10-29; smashcraft:docs/design/balance.md,
"Play-style profiles"). She approaches in the air behind an arrow, lands
forward airs into jabs and grabs, and kills with the forward smash and the
back air.

```balance-profile
fighter: tyrande
archetype: rushdown
aerials: nair 15-40, fair 20-45, bair 10-35, uair 5-30, dair 0-20
air-share: 30-60
approach: 45-80
ranged: 5-30
specials: neutral 10-35, side 0-10, up 0-8, down 0-10
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: tyrande
path: execution
basic-moves: forward-air,down-tilt,forward-smash,neutral-special
```

Basic gameplan: short hop and fire an arrow, follow it in with the forward
air, and chase with the down tilt. It uses one approach and shield.

Expert gameplan: use Trueshot Aura when the foe is far, push them into
shield with arrows and cross up with the neutral and back air, reflect their
projectiles with Elune's Grace and cancel it into an aerial. It uses the full
authored kit and gameplan at the same CPU skill.

## Measured balance (2026-10-29)

The field ran locally with `bun scripts/cpuField.ts` at the farm balance
settings (wren expert against wren expert, 400 matches a pair, 100 seeds, all
28 opponents), because the GitHub balance run's plan job was timing out on
API calls that day. The first field of the landed kit put her at 32%; a
heavier body (92/75), more knockback growth on her kill moves and more damage
on the down tilt, dash attack and aerials put her at **47% wins** over 11,424
matches. Against the profile above:

- archetype rushdown; air share of normals 29% (band 30-60, one point under)
- aerials n/f/b/u/d 10/44/23/5/18% (neutral air under its 15-40 band; the rest inside)
- approach share of movement 73% (band 45-80)
- ranged share of damage 5% (band 5-30)
- specials n/s/u/d 21/1/7/6% of moves (all inside their bands)

Her kills come from the forward smash (49%), back air (22%) and up smash
(11%). Her worst matchups are Chen (7%), Pit Lord (13%) and Thrall (14%);
her best are Mountain King (89%), Lady Vashj (85%) and Warden (80%).
