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

Authored damage drains and steals operate on the same 100-point bar; gain still comes only from the trickle and drops. Illidan's Mana Burn can
drain the opponent's stored meter and its stun reads the resulting bar.
Hero-specific spell refunds remain authored move effects; they never make
an ordinary special cost meter.

## Every special has an EX form (#329)

Tom's 8 October super-bar decision (#335), with the #382 segments:
ordinary specials are free; the trickle and meter drops build one bar (#484), and one
segment buys one EX with Shield + Special in any direction. #335 owns the bar's
earning rules and display. This section owns the move upgrades.

Each EX keeps the base move's startup, active windows, recovery, landing lag,
entity limits, status immunity, once-per-airtime limit and helpless ending.
It also keeps the existing one-light-hit protection at entry. The upgrade
below adds reach, damage or utility to that same move; it does not turn a
special into an ultimate. Damage upgrades leave launch base and growth alone.
Travel upgrades scale the authored motion, including steering, while retaining
collision stops. Reach upgrades enlarge the existing strike/projectile, not
its active time. Status durations and healing caps stay unchanged.

| Fighter | Neutral EX | Side EX | Up EX | Down EX |
|---|---|---|---|---|
| Rifleman | Blaster deals 25% more damage. | Bear's strike deals 25% more damage. | Recoil travels 25% farther, including its second shot. | Freeze Trap has 25% more trigger reach, with the same freeze and f22 placement/f38 end. |
| Illidan | On the ground, Eye Blast: a 24-frame marked windup, then a floor beam to 645 (#379, docs/design/illidan.md); in the air, the Mana Burn orb has 25% more reach, its resource denial following #335. | Fel Rush and its branches deal 25% more damage. | Wing Ascent rises 25% farther; glide choices stay intact. | Immolation deals 25% more damage. |
| Blademaster | Wind Cutter deals 25% more damage. | Wind Walk's Backstab deals 25% more damage. | Rising Whirlwind travels 25% farther. | Mirror Image has twice the durability; Image Swap deals 25% more damage. |
| Mountain King | Storm Bolt deals 25% more damage. | Storm Rush and Hammerfall deal 25% more damage. | Thunder Leap travels 25% farther. | Thunder Clap and its charged forms have 25% more reach. |
| Warden | Shadow Strike deals 25% more damage. | Pursuit Lunge/marked slash deals 25% more damage. | Blink travels 25% farther. | Fan of Knives has 25% more reach. |
| Lich | Frost Nova orb/burst has 25% more reach. | Death and Decay deals 25% more damage. | Spectral Ascent travels 25% farther. | Frost Armor absorbs a hit 25% heavier; Dark Ritual gains four protected entry frames. |
| Forsaken Paladin | Cleansing Sword deals 25% more damage. | Righteous Fury deals 25% more damage. | Ascension travels 25% farther. | Consecration has 25% more reach. |
| Dreadlord | Carrion Swarm has 25% more reach. | Vampiric Pounce's bite deals 25% more damage, with the same heal cap. | Bat Ascension travels 25% farther. | Sleep orb has 25% more reach, with unchanged sleep and immunity. |
| Shadow Hunter | Spirit Glaive deals 25% more damage in both directions. | Serpent Ward shots deal 25% more damage; recall gains four protected entry frames. | Loa Vault travels 25% farther. | Hex orb has 25% more reach, with unchanged Hex and immunity. |
| Pit Lord | Howl of Terror has 25% more reach. | Ruin Charge deals 25% more damage. | Abyssal Leap travels 25% farther. | Rain of Fire deals 25% more damage. |
| Beastmaster | Wild Axes deal 25% more damage. | Bear has 25% more durability and bite damage; Stampede deals 25% more damage. | Hawk has 25% more durability; Hawk Lift travels 25% farther; grounded dive command gains four protected entry frames. | Quilbeast has 25% more durability and shot damage; volley command gains four protected entry frames. |
| Lich King | Howling Blast, deals 25% more damage. | Val'kyr Shadowguard deals 25% more damage. | Ascension of the Damned travels 25% farther. | Defile's radius, radial growth and maximum radius increase 25%; its tick rate stays unchanged. |
| Thrall | Chain Lightning deals 25% more damage. | Feral Spirit wolves deal 25% more damage. | Far Sight travels 25% farther. | Doomhammer Slam has 25% more reach. |
| Jaina | Frostbolt deals 25% more damage. | Blizzard deals 25% more damage. | Blink travels 25% farther. | Water Elemental has 25% more durability and shot damage; recall gains four protected entry frames. |
| Sylvanas | Black Arrow deals 25% more damage. | Silence has 25% more reach, with unchanged silence duration. | Banshee Flight travels 25% farther. | Life Drain deals 25% more damage, with the same heal cap. |
| Cairne | Shockwave deals 25% more damage. | Bloodhoof Gore deals 25% more damage. | Spirit Lift travels 25% farther. | War Stomp's armor absorbs a hit 50% heavier and its reach, ring included, grows 20%. |
| Chen | Breath of Fire has 25% more reach. | Drunken Haze has 25% more reach, with unchanged slow. | Storm Rise travels 25% farther. | Earth Stance absorbs a hit 25% heavier; Fire Palm/Storm Step deal 25% more damage. |
| Peon | Lumber Toss deals 25% more damage. | Burrow has 25% more durability and spear damage; Pack Up gains four protected entry frames. | Worksite Launch travels 25% farther. | Rest's sweetspot and sourspot are 25% wider. |
| Tinker | Cluster Rockets deal 25% more damage. | Laser deals 25% more damage and reaches 25% farther. | Rocket Boots travels 25% farther. | Pocket Factory has 25% more durability and goblin damage; recall gains four protected entry frames. |
| Kael'thas | Fireball deals 25% more damage. | Flame Strike deals 25% more damage. | Phoenix travels 25% farther. | Banish has 25% more reach. |
| Murloc | Ensnare has 25% more reach, with unchanged slow. | Tidal Rush deals 25% more damage. | Tide Spout travels 25% farther. | Disease Cloud has 25% more reach, with unchanged poison duration and tick rate. |
| Grom | Warsong Cry deals 25% more damage with 15% more reach. | Gorehowl Rush deals 25% more damage and travels 25% farther. | Blood Leap rises and steers 25% farther. | Mannoroth's Bane deals 25% more damage. |
| Kobold | Wick Flick deals 25% more damage, on top of the candle level's flame. | Panic Dig deals 25% more damage, on top of the candle level's dig. | Candle Escape rises and steers 25% farther; the candle never changes it. | Mine! has 25% more reach on both sides, on top of the candle level's sweep. |

Ground, air, marked and recall forms use their matching upgrade. A
follow-up keeps the EX cast's upgrade and never buys a second EX. Authored EX
data is immutable; the existing replayed `special.ex` selects it. Projectiles
and placed objects retain the selected authored data after the cast ends.
Kobold's EX is built on every candle level's form, so EX and the candle
level stack: the level is chosen first, then EX upgrades that form
([roster.md](roster.md#candle)).
The native models, sounds and animations remain the move's existing ones;
there are no new imports.

## Ultimates

[ultimates.md](ultimates.md) owns the ultimate moves. They spend the whole
shared bar; there is no second resource.
