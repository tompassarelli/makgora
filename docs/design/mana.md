# Super meter

Tom replaced special costs with one super meter on 8 October 2026 (#335).
Every regular special is free, including its full recovery form. Normals,
grabs and throws remain free. Shield + Special requests the EX version in
any of the four directions. The bar has three segments (33/33/34 points,
#382): an EX costs one segment and an ultimate ([ultimates.md](ultimates.md))
costs the full bar.

The simulation stores the bar in each fighter's `mana.points`; meter is part
of replay and rollback state. The rules live in
smashcraft:ts/src/game/sim/mana.ts and sim/exSpecials.ts; the match step runs
the trickle and smashcraft:ts/src/game/match/meterDrops.ts the drops.

Tom rebuilt how the bar fills on 26 October 2026 (#484): no meter comes from
damage, taken or dealt. Gain from taking damage rewarded the player who guessed
wrong, and gain from dealing it was win-more. The bar now fills from two
sources: a trickle that both players earn at the same rate on a pure clock
(as Street Fighter 6's Drive gauge regenerates), and meter drops on a fixed
20 s clock (as Dota 2's power runes spawn,
[gameplay design](../gameplay-design.md#meter-drops-385)). In an even match
about half of each player's meter comes from each, so the player who wins the
drops earns about one extra ultimate a match.

| Rule | Value |
|---|---|
| Bar size | 100 integer points, one bar in three segments at 33 and 66. A new match starts at 0. |
| Trickle | 1 point every 150 frames (2.5 s, `ROSTER_MANA.trickleFrames`) for each fighter in the match, counted from GO on a pure clock with no conditions: none in the start hold or while KO'd. 24 points a minute. |
| Meter drop | 18 points (`ROSTER_MANA.dropGain`) to the fighter who takes it; one drop every 20 s on a fixed clock. |
| Damage dealt or taken | 0 points. |
| Idle, movement or shielding | Nothing beyond the trickle. |
| Shield damage or parry | 0 points. |
| Stock loss | Keep the current points through the KO and respawn. |
| Regular special | 0 points; always chooses its full ground or air form. Existing cooldowns, airtime limits and entity limits still apply. |
| EX special | Needs one segment (33 points); pays 33 once when the action starts. A full bar buys three. |
| Ultimate | Needs all 100 points; pays 100 once when it starts, leaving 0. |
| EX below 33, or ultimate below 100 | The ordinary free special starts. No refusal or partial spend. |
| Interrupted or missed EX | The bar stays spent. Follow-up inputs do not spend it again. |
| Full bar | Further gain stops at 100; no second bar or stored overflow. |

Examples: the trickle alone fills one EX segment in 82.5 s and a full bar in
250 s. A player who takes two drops and trickles for a minute holds 60 points.
A fighter at 99 that takes a drop holds 100.

The values come from `bun scripts/meterRate.ts` (from ts/): a seeded field of
Expert CPUs over every pair of the roster, 3 stocks on Frozen Throne. Over 325
matches (median 2.3 minutes, 2.5 stocks lost per player), 150 frames per
trickle point and 18 points per drop earned 0.50 full bars per stock lost
(one ultimate per two stocks lost if EX is unspent). 49% of all meter came
from drops. The fighter ahead on stocks took 16% of drops, the fighter behind
25%, and 58% were taken with stocks level (#484).

Training and Classic and lore runs have no drops, so the trickle alone fills
the bar there.

## Ready signal

A thin segmented blue bar sits on each fighter's HUD plate. Two marks
divide it into its three segments, one EX each. The HUD is the only meter display;
fighters carry no duplicate overhead bar or pips.

At 100 points the bar glows gold continuously until the bar is spent or
drained. Crossing from below 100 to 100 flashes the fighter white for 12
frames and plays Warcraft's stock `Sound\Interface\ItemReceived.flac` once on
the confirmed frame (GameFound until #361: a 7.5-second fanfare that was
heard mid-match as a stray music clip). Replay and prediction never play the sound. A rise of
at least 3 points also gives the bar a short 12-update glow. The old
“EX Neutral + Side” affordability label is removed: a full bar pays for any
direction, so its glow carries the whole message. The full-bar glow is
also the ultimate's ready signal.

These cues reuse the game's white fighter flash and stock sound; they add
no imported art or audio. sim/mana.tests.ts and sim/exSpecials.tests.ts pin
the resource rules in Bun and Lua32. test/mana-bar.test.ts checks the Wisp
frames, fighter flash and ready sound log.

## Drain and refunds

Authored damage drains and steals operate on the same 100-point bar; gain still comes only from the trickle and drops. No status reads the bar:
Illidan's Mana Burn stun, the one that did, left his kit with Eye Beam (2026-10-28).
Hero-specific spell refunds remain authored move effects; they never make
an ordinary special cost meter.

## Every special has an EX form (#329)

Tom's 8 October super-bar decision (#335), with the #382 segments:
ordinary specials are free; the trickle and meter drops build one bar (#484), and one
segment buys one EX with Shield + Special in any direction. #335 owns the bar's
earning rules and display. This section owns the move upgrades.

### EX design principles (2026-10-28)

Tom set the EX design rules on 28 October 2026; in paraphrase:

- An EX is a natural upgrade of the same move, never a different move. It is
  stronger but never game-defining.
- Its frame data stays the move's own: never faster, never slower.
- It carries no super armor or invulnerability unless armor is already the
  move's identity.
- It has one headline change, ideally one that beats the move's usual
  answer: safe on shield (beats shielding), more range or a bigger hit
  (beats spacing or jumping over), or an after-effect hitbox that works as a
  frame trap.
- Every EX shows the same distinct EX flash.

The shared levers in smashcraft:ts/src/game/sim/exSpecialAuthoring.ts carry
those headlines, one per EX:

- **Range** (`range`): projectiles fly 25% longer (life x1.25), beams reach
  25% farther; size, speed and damage stay.
- **Reach** (`reach`): strikes, projectiles, pools, triggers and command
  grabs grow 25%.
- **Travel** (`travel`): movement and recoveries carry 25% farther over the
  same frames.
- **Shield-safe** (`shieldSafe`): a blocked hit holds the shield in shieldstun
  for at least the attacker's remaining frames of the move, so the move is no
  worse than even on shield. The attacker's own frames are unchanged.
- **Durability** (`durability`): a placed object or summon takes more damage
  before it breaks.
- **Armor** (`armorDamage`): only where armor is the move's identity, the
  armor holds against heavier hits.

Each EX keeps the base move's startup, active windows, recovery, landing lag,
entity limits, status immunity, once-per-airtime limit and helpless ending;
smashcraft:ts/src/game/roster/exSpecials.tests.ts checks every roster EX
form against its base. Damage upgrades are gone: 25% more damage beat no
answer, so it failed the headline rule everywhere it was the whole EX.
The one-light-hit entry armor every EX used to carry (8% for six frames)
was removed for the no-armor rule. Status durations and healing caps stay
unchanged.

The EX flash is shared by every fighter and every special: an EX cast raises
the cyan Tome of Retraining pillar at the caster's feet for 30 frames with its
own sound ([ultimates.md](ultimates.md), smashcraft:ts/src/game/presentation/meterCues.ts).
A follow-up of an EX cast never raises a second one.

### EX audit (2026-10-28)

Verdict reasons: **damage** = the whole EX was 25% more damage, which beats no
answer; **two** = more than one headline; **armor** = added armor or
invulnerability; **other move** = a different move, not an upgrade.

| Fighter | Special | EX before | Verdict | EX now |
|---|---|---|---|---|
| All | Every EX | One light hit (8% or less) absorbed on frames 1-6 | Fail: armor | No entry armor |
| Rifleman | Blaster | +25% damage | Fail: damage | Shot 25% larger, so it is harder to jump or crouch under |
| Rifleman | Bear | +25% swipe damage | Fail: damage | Bear runs 25% longer (75 frames), reaching foes who spaced it |
| Rifleman | Recoil | Travels 25% farther | Pass | Unchanged |
| Rifleman | Freeze Trap | 25% more trigger reach | Pass | Unchanged |
| Illidan | Eye Beam | Ground: Eye Blast, a 24-frame windup and a floor beam to 645; air: +25% damage | Fail: other move, slower; damage | Beam flies 25% farther (19 frames, 912 units) in both forms |
| Illidan | Fel Rush | +25% damage, branches too | Fail: damage | Shield-safe, branches too |
| Illidan | Wing Ascent | Rises 25% farther | Pass | Unchanged |
| Illidan | Immolation | Reach 116 to 140 | Pass | Unchanged |
| Blademaster | Wind Cutter | +25% damage | Fail: damage | Range |
| Blademaster | Wind Walk | Travel (the dash, before the 2026-10-28 counter rework) | Pass | Travel: the counter steps out behind an attacker up to 3.1H away instead of 2.5H, beating a strike spaced at the tip |
| Blademaster | Rising Whirlwind | Travel | Pass | Unchanged |
| Blademaster | Mirror Image | x2 durability and +25% swap damage | Fail: two | x2 durability |
| Mountain King | Storm Bolt | +25% damage | Fail: damage | Range |
| Mountain King | Storm Rush | +25% damage | Fail: damage | Shield-safe |
| Mountain King | Thunder Leap | Travel, and +25% Hammerfall damage | Fail: two | Travel, Hammerfall dive included |
| Mountain King | Thunder Clap | Reach | Pass | Unchanged |
| Warden | Shadow Strike | +25% damage | Fail: damage | Range |
| Warden | Shadow Pursuit | +25% damage | Fail: damage | Shield-safe |
| Warden | Blink | Travel | Pass | Unchanged |
| Warden | Fan of Knives | +25% damage | Fail: damage | Reach |
| Lich | Frost Nova | Reach | Pass | Unchanged |
| Lich | Death and Decay | +25% damage | Fail: damage | Reach: the clouds are 25% larger |
| Lich | Spectral Ascent | Travel | Pass | Unchanged |
| Lich | Frost Armor | Armor holds a 25% heavier hit; Dark Ritual 4 invulnerable entry frames | Fail: two, armor | Armor holds a 25% heavier hit (armor is the move); invulnerable entry removed |
| Forsaken Paladin | Cleansing Sword | +25% damage | Fail: damage | Shield-safe |
| Forsaken Paladin | Righteous Fury | +25% damage | Fail: damage | Shield-safe |
| Forsaken Paladin | Ascension | Travel | Pass | Unchanged |
| Forsaken Paladin | Consecration | Reach | Pass | Unchanged |
| Dreadlord | Carrion Swarm | Reach | Pass | Unchanged |
| Dreadlord | Vampiric Pounce | +25% bite damage | Fail: damage | Travel: the pounce carries 25% farther; same bite and heal cap |
| Dreadlord | Bat Ascension | Travel | Pass | Unchanged |
| Dreadlord | Sleep | Reach | Pass | Unchanged |
| Shadow Hunter | Spirit Glaive | +25% damage | Fail: damage | Reach: a 25% larger glaive both ways |
| Shadow Hunter | Serpent Ward | +25% shot damage; recall 4 invulnerable frames | Fail: damage, two, armor | x1.25 ward durability; invulnerable recall removed |
| Shadow Hunter | Loa Vault | Travel | Pass | Unchanged |
| Shadow Hunter | Hex | Reach | Pass | Unchanged |
| Pit Lord | Howl of Terror | Reach | Pass | Unchanged |
| Pit Lord | Ruin Charge | +25% damage | Fail: damage | Shield-safe |
| Pit Lord | Abyssal Leap | Travel | Pass | Unchanged |
| Pit Lord | Rain of Fire | +25% damage | Fail: damage | Reach: 25% larger fireballs |
| Beastmaster | Wild Axes | +25% damage | Fail: damage | Reach: 25% larger axes |
| Beastmaster | Summon Bear | +25% durability and damage | Fail: two | x1.25 bear durability |
| Beastmaster | Summon Hawk | Travel, +25% durability, dive 4 invulnerable frames | Fail: two, armor | x1.25 hawk durability in both forms; invulnerable dive removed |
| Beastmaster | Summon Quilbeast | +25% durability and damage; volley 4 invulnerable frames | Fail: two, armor | x1.25 quilbeast durability; invulnerable volley removed |
| Lich King | Howling Blast | +25% damage | Fail: damage | Range |
| Lich King | Val'kyr Shadowguard | +25% damage | Fail: damage | Range |
| Lich King | Ascension of the Damned | Travel | Pass | Unchanged |
| Lich King | Defile | Reach | Pass | Unchanged |
| Thrall | Chain Lightning | +25% damage | Fail: damage | Reach: a 25% wider bolt |
| Thrall | Feral Spirit | +25% damage | Fail: damage | Range: the wolves run 25% farther |
| Thrall | Far Sight | Travel | Pass | Unchanged |
| Thrall | Doomhammer Slam | Reach | Pass | Unchanged |
| Jaina | Frostbolt | +25% damage | Fail: damage | Reach: a 25% larger bolt |
| Jaina | Blizzard | +25% damage | Fail: damage | Reach: a 25% wider patch |
| Jaina | Blink | Travel | Pass | Unchanged |
| Jaina | Water Elemental | +25% durability and damage; recall 4 invulnerable frames | Fail: two, armor | x1.25 elemental durability; invulnerable recall removed |
| Sylvanas | Black Arrow | +25% damage | Fail: damage | Range |
| Sylvanas | Silence | Reach | Pass | Unchanged |
| Sylvanas | Banshee Flight | Travel | Pass | Unchanged |
| Sylvanas | Life Drain | +25% damage | Fail: damage | Reach: the drain grabs 25% farther; same heal cap |
| Cairne | Shockwave | +25% damage | Fail: damage | Range: the wave runs 25% farther |
| Cairne | Bloodhoof Gore | +25% damage | Fail: damage | Reach: the horns catch 25% farther |
| Cairne | Spirit Lift | Travel | Pass | Unchanged |
| Cairne | War Stomp | Armor 50% heavier and 20% more reach | Fail: two | Reach: the stomp and ring grow 25%; the armor is unchanged |
| Chen | Breath of Fire | Reach | Pass | Unchanged |
| Chen | Body Slam | Travel | Pass | Unchanged |
| Chen | Storm Rise | Travel | Pass | Unchanged |
| Chen | Brew Keg | Reach | Pass | Unchanged |
| Peon | Gold Sack | +25% damage | Fail: damage | Shield-safe bonks |
| Peon | Log Heave | +25% damage | Fail: damage | Reach: a 25% longer log |
| Peon | Worksite Launch | Travel | Pass | Unchanged |
| Peon | Rest | Reach | Pass | Unchanged |
| Tinker | Cluster Rockets | +25% damage | Fail: damage | Range |
| Tinker | Laser | +25% damage and reach | Fail: two | Reach: a 25% longer beam |
| Tinker | Rocket Boots | Travel | Pass | Unchanged |
| Tinker | Pocket Factory | +25% durability and damage; recall 4 invulnerable frames | Fail: two, armor | x1.25 factory durability; invulnerable recall removed |
| Kael'thas | Pyroblast | +25% damage | Fail: damage | Reach: a 25% larger fireball |
| Kael'thas | Flame Strike | +25% damage | Fail: damage | Reach: a 25% wider pillar |
| Kael'thas | Phoenix | Travel | Pass | Unchanged |
| Kael'thas | Banish | Reach | Pass | Unchanged |
| Murloc | Ensnare | Reach | Pass | Unchanged |
| Murloc | Tidal Rush | +25% damage | Fail: damage | Shield-safe |
| Murloc | Tide Spout | Travel | Pass | Unchanged |
| Murloc | Disease Cloud | Reach | Pass | Unchanged |
| Grom | Warsong Cry | +25% damage and 15% reach | Fail: two | Reach: a 25% wider roar, same damage |
| Grom | Gorehowl Rush | +25% damage and travel | Fail: two | Shield-safe |
| Grom | Blood Leap | Travel | Pass | Unchanged |
| Grom | Mannoroth's Bane | +25% damage | Fail: damage | Reach: a 25% longer chop |
| Kobold | Wick Flick | +25% damage | Fail: damage | Range: the flame flies 25% longer at every candle level |
| Kobold | Panic Dig | +25% damage | Fail: damage | Shield-safe at every candle level |
| Kobold | Candle Escape | Travel | Pass | Unchanged |
| Kobold | Mine! | Reach | Pass | Unchanged |
| Malfurion | Entangling Roots | +25% damage and reach | Fail: two | Reach: 25% wider roots |
| Malfurion | Stag Charge | +25% damage and travel | Fail: two | Shield-safe |
| Malfurion | Dream Ascent | Travel | Pass | Unchanged |
| Malfurion | Force of Nature | +25% durability and damage; recall 4 invulnerable frames | Fail: two, armor | x1.25 treant durability; invulnerable recall removed |
| Medivh | Arcane Omen | 37% faster, 25% larger, +33% damage | Fail: two | Reach: a 25% larger omen |
| Medivh | Vanishing Act | Blinks 39% farther, +40% and +57% damage | Fail: two | Travel: blinks 25% farther |
| Medivh | Raven Flight | 33% faster flight, +60% damage | Fail: two | Travel: flies 25% farther |
| Medivh | Last Word | Blinks 33% farther, 43% larger burst, +80% damage | Fail: two | Reach: a 25% larger burst |
| Anub'arak | Impale | Larger spines (28 from 18), +84% damage, more knockback | Fail: two | Reach |
| Anub'arak | Burrow Hunt | Burrows 4 frames longer and faster, erupts 4 frames later, larger, +33% damage | Fail: slower, two | Travel |
| Anub'arak | Crypt Eruption | 60% farther, larger, +50% damage | Fail: two | Travel |
| Anub'arak | Carrion Beetle | x1.5 durability, a fourth beetle, +40% damage; recall 4 invulnerable frames | Fail: two, armor | x1.5 durability |

Ground, air, marked and recall forms use their matching upgrade. A
follow-up keeps the EX cast's upgrade and never buys a second EX. Authored EX
data is immutable; the existing replayed `special.ex` selects it. Projectiles
and placed objects retain the selected authored data after the cast ends.
Kobold's EX is built on every candle level's form, so EX and the candle
level stack: the level is chosen first, then EX upgrades that form
([roster.md](roster.md#candle)).
The native models, sounds and animations remain the move's existing ones;
there are no new imports.

## EX wavedash

Tom asked for an EX wavedash on 28 October 2026: hold Strong while air
dodging into the ground, the input that makes an EX special. When the dodge
lands as a wavedash or waveland with horizontal speed and the fighter can pay
an EX, it pays one EX once on the landing frame and adds a fixed
`EX_WAVEDASH_SPEED` of 0.625 Melee units a frame (3.75 world units) to the
slide in its direction (smashcraft:ts/src/game/sim/exWavedash.ts). Every
fighter and every angle gets the same speed, so a 45-degree EX wavedash is the
45-degree slide plus the same push and a max-length one is the longest slide
plus it. Landing lag (10 frames) and every animation keep their timing; only
the distance changes. Without Strong or without an EX, and for a dodge with no
horizontal part (straight down), the landing is the ordinary wavedash and
nothing is spent, so the ordinary wavedash keeps all its angles and lengths.

The speed is sized so the median fighter's longest wavedash (the 18-degree
dodge buffered in jump squat) slides 40% further: 228.5 to 321.0 world units,
with the roster spread 1.35x to 1.46x.
`dodge.ex` holds the request through the dodge and marks the slide, and is
replay and rollback state. While it lasts the wavedash's own dust puffs, at
their usual places and times, are tinted the EX glow's blue, with the EX cast
flash on the first slide frame and blue mana sparkles every third slide frame.

## Ultimates

[ultimates.md](ultimates.md) owns the ultimate moves. They spend the whole
shared bar; there is no second resource.
