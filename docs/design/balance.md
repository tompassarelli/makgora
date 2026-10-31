# Balance

Tom's balance spec (8 Oct 2026). Every number here is an **initial value
Tom tunes**; the code holds each in one constant, `BALANCE_SPEC`,
`PUNISH_RESET_FRAMES`, `DISADVANTAGE_FRAMES` and `SCORE_WEIGHTS` in
smashcraft:ts/scripts/balance.ts. Changing one changes the code and this doc
together.

## Philosophy

- Balance is an optimization toward Tom's taste written as numbers, not a
  playtest loop. The numbers are the win band, each fighter's play-style
  profile, move variety, the spam probe and conversion targets below.
- A fighter may not reach the 45-55% band through a degenerate strategy.
  A little signature-move dominance is fine (Jigglypuff's back air in
  Smash), but the game must not collapse into one-move spam. An offensive
  fighter spamming back air is a red flag.
- Each fighter plays its archetype: a rushdown fighter (Captain Falcon)
  leans on forward, neutral and down air and approaches; a zoner uses back
  air, retreats and projectiles.
- Gameplay is explosive: at high-level play a stock falls to about 3-4
  openings by Slippi's count, about 1.5-2x as explosive as master-level
  Melee (edgeguard mixups are part of why); about 2 is fine for a fighter
  whose design calls for it, never anywhere near 10, and a few correct reads
  can take a stock from zero.
- Playtests calibrate the profiles; they are not the primary engine. What
  Tom notices in play becomes a change to a profile or a threshold, and the
  tools then hold every fighter to it.

## Gate

A fighter is **balanced** only when all gates hold, with both computers at
Wren Expert:

| Rule | Initial value |
| --- | --- |
| Win rate against the field | 45% to 55% |
| Each matchup at 400 matches a pair | 30% to 70% |
| Defining archetype traits | inside the profile ranges below |
| Kit values | within the frozen baseline bounds below |
| Feel | block advantage keeps its sign; kill percent within ±15% of baseline |
| Spam probe win rate against the Expert field | at most 45% |
| Largest single move's share of the fighter's damage | at most 40%, except its signature move |

The win-rate rule is the roster's existing gate (smashcraft:docs/design/roster.md,
"Balance gate"). A **signature move** is named by the
`signature: MOVE PERCENT` line of the fighter's play-style profile in its
own design doc; that move may carry up to that share of the damage, every
other move stays under the ceiling. Only a design doc names a signature
move, never the measurement.

The full-roster `bun wisp farm balance` run prints the verdict as
"Balanced (win band, spam probe, move share, matchup, archetype, fixed baseline, feel): passes" or "fails" with each
failing fighter, rule and number; a Wren Expert run at 400 a pair fails the
run when either this or the win-rate gate fails.

## Spam probe

Each fighter's spam probe takes its top damage move from the same run's
field (the move that dealt the most of its damage) and plays the Expert
field attacking with that move only: the ordinary Expert computer moves,
shields, dodges and recovers (an up special offstage stays), but every other
attack, special, get-up and ledge attack it chooses is dropped. The move is
pressed whenever it reaches, a grounded fighter runs toward its target
until it does, and an aerial is jumped for near the target
(smashcraft:ts/scripts/spamPolicy.ts). It plays every other fighter, both
orders on every soak stage, 40 matches a pair (800 a fighter, a 95% interval
of about +-3.5 points), in the same farm run as the field.

The spammer perceives its target as late as the Expert it plays: it reads the
target from the same observation history at the perception delay its own
Wren Expert skill would wait (smashcraft:ts/scripts/spamPolicy.ts
`perceivedTarget`), so its reach, spacing and facing use the target's old
position while its own body is read live. The probe models a human mashing
one move, who reacts late too; zero delay against an Expert that sees 16 or
more frames late measured the asymmetry, not the move. The 45% line and the
probe's move choice are unchanged, and a fighter still over the line is a
real failure for the retune (decided 2026-10-30, #790).

## Field report

Beside each fighter's win rate the field prints, from the simulation state
read after every frame (deterministic for a given commit and seed):

- **Damage and stocks by move.** A hit is credited to the move the
  attacker's body was striking with (a grab hold or throw is the grab, a
  running special its slot), else to the last move it started (projectiles,
  summons, placed objects). Jab strings count as the jab, angled forward
  tilts as the forward tilt. A stock is credited to the move of the last
  hit; self-destructs are no one's. Top move share and top-2 share are of
  damage dealt.
- **Move variety:** the normalized Shannon entropy of moves started over the
  18-move kit (jab or shot, three tilts, three smashes, dash attack, grab,
  five aerials, four specials): 1 when every move is used alike, 0 for one
  move.
- **Play style:** each aerial's share of aerials started, aerials over
  normals started, frames moving toward the opponent over frames moving
  (while able to act and over the main stage, so recovering is not
  approaching), the ranged share (damage dealt while the body struck nothing,
  so a projectile landing during its special counts unless that special's own
  hit region is active) and each special's share of moves started.
- **Openings and punishes**, below.

## Openings and punishes

Slippi's conversion statistics are the reference
([slippi-js stats](https://github.com/project-slippi/slippi-js/tree/master/src/stats)).

- A **punish** starts with a hit and lasts until the opponent has spent
  **45 frames** in control, grounded and actionable (out of hitlag, hitstun,
  a hold, tumble and the floor), without being hit (`PUNISH_RESET_FRAMES`,
  Slippi's `PUNISH_RESET_FRAMES`), or loses the stock. Being hit or held
  restarts the count; actionable in the air pauses it.
- A punish is an **opening** when it leads somewhere: a second hit lands
  within it, or its hit leaves the opponent in a disadvantage state:
  knocked down or tumbling, on the ledge, off the main deck, or unable to
  act for at least **30 frames** (`DISADVANTAGE_FRAMES`). Any other lone hit,
  projectile or melee, is a **poke**: it isn't an opening, and its damage
  counts as poke damage.
- An opening is a **neutral win** when the opponent wasn't punishing the
  fighter at the time (otherwise a counter-attack). A neutral win
  **converts** when it lands a second hit.
- A **zero-to-death** is a stock taken by one opening that began at that
  stock's first hit.

Reported per fighter, over **kills ending an opening** (Slippi's kill
count): openings per kill by **Slippi's count** (every punish, pokes
included) and **pokes excluded**, the **one-hit share** of punishes, pokes
per kill and poke damage per kill, damage per opening (the average combo's
damage), the share of neutral wins converted, combo hits (average and
most), the most damage in one combo and the zero-to-death share of those
kills. A combo here is an opening's hits.

**Reference.** slippi-js stats on 1,345 master-versus-master ranked Melee
games (Fox, Falco, Marth, Sheik, Jigglypuff, Captain Falcon and Peach
mains; measured for this spec on 8 Oct 2026): about **5.9 openings per kill**
by Slippi's count (Captain Falcon 5.3 to Falco 6.5), about **3 multi-hit
openings per kill** (2.4-3.8), about 21% damage per opening (30-34% for a
multi-hit one) and a one-hit share of about 48%.

**Targets (Tom, 8 Oct)**, about 1.5-2x as explosive as that Melee:

| Measure | Target |
| --- | --- |
| Openings per kill, Slippi count: 3-4 | `slippiOpeningsLow`, `slippiOpeningsHigh` |
| Openings per kill, pokes excluded: 2-3 | `openingsLow`, `openingsHigh` |
| One-hit share of punishes | flagged (!) above 50% (`oneHitWarn`) |

About 2 by Slippi's count is fine where a fighter's design calls for it (its
profile's `openings-per-kill`); far above 4 is the failure. The Slippi-count
target applies to **combo potential**, measured by the combo search
independent of computer skill; the field's realized rates show whether the
computers actually convert, and are reported, not scored.

## Combo potential

`bun wisp combos [--fighter NAME]... [--jobs N]` measures the fighter's
available punish rather than its computer player's choices. It plays ordinary
controller inputs through the match frame executor. Each of 21 fighters is
measured against Mrgl & Grgl, Rifleman and Cairne (light, middle and heavy bodies)
at the centre and ledge of stage 0: 126 units. Every landing opener is searched
at 0–180% in 10% steps and five held DI directions: out, up, down, in and none.
The defender's result is the least damaging of the attacker's best routes
against each DI, preferring a route that escapes a KO.

The search saves each contact state and tries grounded, dash, hop, drift and
double-jump follow-ups. It retains four routes at each of eight depths. Attack
presses cover the first six available frames individually and later frames at
two-frame intervals. A link must hit before the defender's first free frame;
a tumble landing ends the true combo because it offers a tech. Offstage flight
is played with the defender jumping and using up special toward the stage.
The search is finite; the table reports the routes it found.

A conversion begins with the best searched opener at the grid percent at or
below the current damage. True links count together. Up to two best reads of
the four tech outcomes may continue that conversion, because a tech chase
does not provide the 45 grounded actionable frames that end a Slippi punish.
Otherwise the next setup begins a new conversion; this models separate neutral
wins rather than playing a complete neutral exchange. Repeat from 0% until a
KO or 12 conversions. A `+` marks any fighter with an unfinished chain.
The target is 3–4 conversions by Slippi's count and 2–3 conversions with two
or more hits. The separate read count charges each tech read as another opening.

The table includes maximum true damage, median best punish damage across
0–120% and six opponent/position units, median kill-confirm percent, mean
openings per kill, multi-hit openings, openings counting reads and damage per
opening. The command writes detailed units to `tools/move-data/combos/units.jsonl`
and the roster table to `tools/move-data/combo-potential.json` and `.md`.
Every retained opener route is replayed from a fresh match; any changed damage
or stock result fails the command. Route playback also runs in Bun and Lua32,
and a seeded Wren match checks that the explorer finds an observed true follow-up.

## Play-style profiles

Each fighter's design doc (its own doc, or its section of
smashcraft:docs/design/roster.md) ends its identity with a "Play-style
profile" holding one fenced `balance-profile` block. They are Tom-tunable
drafts written from the design docs and kits on 8 Oct; playtests calibrate
them. Keys, percentages as LOW-HIGH ranges:

| Key | Meaning |
| --- | --- |
| `fighter` | the fighter's slug |
| `archetype` | rushdown, zoner, bait-and-punish, heavy, grappler, setplay or all-rounder |
| `aerials` | each aerial's share of aerials started: `nair`, `fair`, `bair`, `uair`, `dair` |
| `air-share` | aerials over normals started |
| `approach` | frames moving toward the opponent over frames moving |
| `ranged` | share of damage dealt while the body struck nothing |
| `specials` | each special's share of all moves started (`neutral`, `side`, `up`, `down`), from the fighter's design, not cross-roster norms |
| `variety-floor` | optional; the move-variety floor, 0.55 by default |
| `top-move-ceiling` | optional; the largest move's damage share, 40 by default |
| `signature` | optional; `MOVE PERCENT`, the signature move and the damage share it may carry |
| `openings-per-kill` | optional; the fighter's combo-potential target by Slippi's count, 3-4 by default |

smashcraft:ts/scripts/balance.ts reads every block under docs/design/; a
fighter without one is scored without profile terms, and the tests require
one for every selectable fighter.

## Balance score

Each fighter's score is a weighted sum of distances outside its targets, in
percentage points (openings in openings); 0 meets every target. The field
report prints the total and each term.

| Term | Distance | Weight |
| --- | --- | ---: |
| Win | outside 45-55% | 1 |
| Profile | summed over every profile range missed | 0.5 |
| Variety | below the variety floor (x100) | 1 |
| Top move | above the top-move ceiling, or the signature move's allowance | 1 |
| Probe | spam probe above 45% | 1 |
| Openings | potential openings per kill (Slippi's count) outside the profile's range (default 3-4) | 10 |
| Recovery | recovery envelope outside the roster band | 1 |

**Slots for other tools.** `Measured.potentialOpeningsPerKill` takes the
combo search's openings per kill for each fighter, and
`Measured.recoveryDistance` its distance outside the roster's recovery
band (double jump plus up and side special, vertically and horizontally,
from below and beside the ledge, against Melee bands). Until those tools
report, the terms print "-" and add nothing.

## Tunable parameters

An optimizer that tunes a fighter against its score changes only these, per
fighter, within these bounds:

- **Normals and throws** (`AuthoredMove` and `AuthoredThrow` in
  smashcraft:ts/src/game/fighters/NAME/moves.ts; the original fighters'
  in smashcraft:ts/src/game/sim/moves.ts): each hit region's damage, base
  knockback and growth within ±25% of the frozen baseline value; startup, active
  and ending frames and landing lag within ±3 frames (startup at least 1).
- **Specials** (smashcraft:ts/src/game/fighters/NAME/specials.ts): damage,
  knockback, mana cost and cooldown within ±25% of the frozen baseline; frames within ±3 of baseline.
- **Computer weights** (the fighter's gameplan,
  smashcraft:ts/src/game/fighters/NAME/gameplan.ts or
  smashcraft:ts/src/game/sim/originalGameplans.ts): calibrate weights and spacing against its play-style profile first,
  then freeze the complete gameplan, computer code and chosen opponent/tier
  before kit tuning. Win rate is never
  the calibration target; kit rounds cannot change computer play.
- **Fixed:** anything the fighter's design doc states as a commitment
  (a named frame, a reach, a weakness such as Mountain King's air drift),
  physics shared by the roster, and every value in this doc.

### Fixed baseline and feel

`ts/scripts/balanceBaseline.json` records the actual authored values for every
selectable fighter. `bun scripts/balanceFreeze.ts` (from `ts/`) rewrites it from
`currentKit` and `currentFeel`, never by hand; `test/balanceBaseline.test.ts`
fails when a kit key is renamed, added or dropped without re-running it. `currentKit` reads the same normal tables and
special records as the game, including the original fighters' shared tables
and numeric values in their special/projectile/summon/throw source. Damage,
base knockback and growth stay within ±25%; startup, active, ending and
landing frames within ±3 frames. Bounds always use this fixed file, never
last round's values. Specials' mana costs and cooldown stay within ±25%.
Reach, launch angle, physics, hurtboxes and other values are fixed.

Every contact keeps the sign of its digital-shield advantage: negative stays
negative, positive stays positive, and zero stays zero. Normal contacts use
first active contact; aerials land on contact and use their final landing lag.
Special contacts use first active contact or projectile emission with zero
travel time. The same contexts are used before and after; a projectile's
travel-distance spacing is fixed, never a tuning variable.

Kill percent is measured in the production hit and motion code: one uncharged
contact against a grounded Rifleman at Sky Deck centre, neutral DI, no
recovery input, followed for 360 frames. The first whole percent killing
within the 0–300% range is recorded separately for each damaging contact.
Each recorded kill threshold stays within ±15% of baseline; a contact with
no KO through 300% cannot gain one. Both are feel locks, alongside the
whole-field matchup and identity gates.

### Defining archetype traits

The following profile ranges are hard gates; all other profile ranges stay
scored. Each range comes from that fighter's own design profile.

| Archetype | Defining trait |
| --- | --- |
| rushdown | approach share |
| zoner | ranged damage share |
| bait-and-punish | approach share (measured patience and approach mix) |
| heavy | air share (grounded commitment) |
| grappler | approach share (closing to grab range) |
| setplay | ranged damage share (placed threats and summons) |
| all-rounder | approach and ranged shares |
| skirmisher | approach and air shares |
| trapper | ranged and down-special shares |
| mobility trickster | air and side-special shares |

### Honest optimizer rounds

`balanceOptimizer.ts` provides finite-difference coordinate descent over real
kit values: each candidate moves one allowed scalar by one frame or 1% of
baseline. No candidate contains code, opponent/stage conditions, computer
rules, reach changes or gameplan weights. The optimizer's profile phase must
finish before it freezes computer play; kit rounds reject changed gameplans.

The win-rate gate remains 45–55%, but the optimizer's target is **50%**
(`winTarget`). Its score replaces the win-band distance with distance from
50; other score terms remain the same. Among valid candidates, prefer the
one closer to 50, then the fewest/smallest changes from baseline. A fighter
stops once its measured two-sided **95% Wilson interval** includes 50%, using
its total decisive matches (ties excluded). At 400 a pair across 25 opponents
this is about ±1 percentage point; it is measured, never a separate 49–51%
hard gate. This avoids demanding precision the field cannot support.

Every trial re-measures the whole roster, every pair on every seed, with at
least 400 matches a pair in aggregate. Partial fields cannot estimate a rate
or enter candidate acceptance. Score samples come from each seed's measured
whole field and the production balance score, not a supplied improvement.

A change is kept only when its paired improvement on held-out seeds exceeds
the run's 95% interval: mean improvement > Student-t 0.975 critical value × standard error. The
normal-limit constant is 1.96; finite seed counts use the conservative
lower-degrees-of-freedom entry from the [NIST Student-t table](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm). Among
passing candidates equally close to 50%, fewest values changed from baseline wins; total distance
in baseline-bound units breaks ties. Training, held-out selection and final
confirmation use disjoint seeds. The final confirmation must pass the same
rules and improvement interval on seeds never used by the optimizer.

Every kept change writes through the required Balance record callback before
returning a kept result. Its row contains the changed before/after
values, held-out seeds and scores, improvement and interval, and unused-seed
confirmation scores. The retune writes this row into the roster's Balance
record in the same commit as the kit change. A discarded/noisy change has no
kept record. #355 establishes these rules; the retune follows #354's fresh field.

## Check

`bun wisp farm balance --wait` (from ts/) plays the field, then the spam
probes (`--probe N` matches a pair, 0 skips them), and prints the field,
style, conversion and balance tables with both verdicts. Locally, `--seed-offset N` selects a fresh seed range and `--orbs` plays with ultimate orbs on (the gate field plays with them off, so meter-spending moves such as Mana Shield need an orbs run to show); from
cpuField `--json` files: `bun scripts/cpuField.ts --merge FIELD_SHARDS
--probe PROBE_FILES`; one fighter's probe is `bun scripts/cpuField.ts
--probe-fighter SLUG --from FIELD.json --per-pair 40 --seeds 100 --json
OUT.json`.

## Roster retune (#414)

10 Oct 2026. Measured on main 38ee916d7 with the Balance workflow's field
(Wren Expert both sides, 48 matches a pair, seed offset 0, 1,200 matches a
fighter), 8 of 26 fighters were inside 45–55%. Each fighter outside 47–53% had
every damage literal in its moves and specials scaled by one factor, about
0.6% of damage for each point it sat from 50%. Its knockback growth was scaled
the other way so kill percents stay close to their baseline: ×(1 + 1.1 × the
cut) for a nerf and ×(1 − 0.6 × the buff) for a buff. Down smashes keep their
damage, because their growth is the roster's fixed 40. Rifleman keeps his
values: his normals are the reference attacker the physics and input
reference tests measure against. Dreadlord's forward and back air land in 11
frames instead of 10, so their shield advantage stays −1 with the extra
damage. Literals stay exact float32 values. Each fighter's design doc keeps its pre-#414 move rows;
the live value is that row times the factor below.

| Fighter | Damage | Growth |
| --- | ---: | ---: |
| blademaster | ×0.929 | ×1.078 |
| mountain-king | ×0.978 | ×1.025 |
| warden | ×0.913 | ×1.096 |
| lich | ×1.067 | ×0.960 |
| forsaken-paladin | ×1.072 | ×0.957 |
| dreadlord | ×1.109 | ×0.935 |
| shadow-hunter | ×0.951 | ×1.054 |
| pit-lord | ×1.055 | ×0.967 |
| beastmaster | ×0.881 | ×1.131 |
| thrall | ×1.024 | ×0.986 |
| jaina-proudmoore | ×0.952 | ×1.053 |
| sylvanas-windrunner | ×0.972 | ×1.031 |
| cairne-bloodhoof | ×0.973 | ×1.030 |
| chen-stormstout | ×0.966 | ×1.038 |
| peon | ×1.024 | ×0.985 |
| goblin-tinker | ×0.923 | ×1.084 |
| kael'thas-sunstrider | ×1.035 | ×0.979 |
| murloc | ×1.073 | ×0.956 |
| grom-hellscream | ×0.904 | ×1.105 |
| kobold | ×1.121 | ×0.928 |
| medivh | ×1.057 | ×0.966 |
| anub'arak | ×1.116 | ×0.930 |

The same field on this retune puts 12 of 26 inside 45–55%. The low end moved
up (Kobold 29.9→35.3%, Anub'arak 30.7→37.0%, Dreadlord 31.8→39.6%) and the
high end down (Gazlowe 62.7→54.9%, Grom 65.9→61.4%), but 14 fighters
are still outside the band; Rifleman rose to 77.3%.

Step 2 multiplies on top of step 1 (same field, same seeds). Fighters kept at
or under step 1's feel-lock count use half the kill-percent compensation; the
others keep it all. Kobold, Mrgl & Grgl, Lich, Medivh and Pit Lord keep their
forward smash. Rifleman's ground blaster deals 3 instead of 4 (9 frames of
flinch instead of 12) and his bear swipes for 7.9 instead of 9.3, with growth
raised so it still kills near its old percent; his normals stay the reference.

| Fighter | Damage | Growth |
| --- | ---: | ---: |
| kobold | ×1.11 | ×0.967 |
| anub'arak | ×1.11 | ×0.967 |
| murloc | ×1.13 | ×0.961 |
| medivh | ×1.06 | ×0.982 |
| forsaken-paladin | ×1.14 | ×0.916 |
| lich | ×1.14 | ×0.916 |
| pit-lord | ×1.14 | ×0.916 |
| dreadlord | ×1.06 | ×0.964 |
| shadow-hunter | ×0.93 | ×1.039 |
| blademaster | ×0.90 | ×1.055 |
| beastmaster | ×0.86 | ×1.077 |
| goblin-tinker | ×0.97 | ×1.017 |
| warden | ×0.88 | ×1.132 |
| grom-hellscream | ×0.89 | ×1.121 |
| jaina-proudmoore | ×0.97 | ×1.033 |
| chen-stormstout | ×0.97 | ×1.033 |

The field puts 18 of 26 inside 45–55%. Still outside: Dreadlord 37.2%,
Lich 42.6%, Kobold 42.8%, Forsaken Paladin 43.4%, Cairne 44.9%, Grom 58.2%,
Warden 58.5%, Rifleman 71.4%. Dreadlord fell with more damage, so his gap is
not damage.

16 Oct 2026 (#10, 35–65% scope). The full field on bd796adcb5 put Cairne at
71.7% with Shockwave at 28% of his moves started (profile 2–12%). His
gameplan's shoot approach weight drops from 2 to 1 and his run approach rises
from 2 to 3, and every Cairne damage literal is scaled ×0.9 with his strength
growths ×1.11, on top of the factors above. Cairne's 25 pairs on 4efda67835
measured 66.9% with War Stomp at 16% of moves started, so War Stomp leaves
his run approach and a second pass scales damage ×0.92 and growth ×1.06,
the smallest growth that keeps every kill percent within 15% without
gaining one; up throw keeps its first-pass values, because its juggle growth carries his
DI mix-up against the heavy target.

17 Oct 2026 (#46). Lich King's 25 pairs on 4df269f4bf (Balance run
38987502563) measured 25%. With Howling Blast's and Val'kyr Shadowguard's
casts back at 19 and 17 frames (diagnosis only; Tom asked for the long
casts, so they stay) the same pairs measured 35%. Neither armor through the
casts, a faster and wider gust nor fewer close casts recovered it: the
casts cost time, not hits. Every Lich King damage literal is scaled ×1.24 to the nearest quarter
point (down smash ×1.1, forward smash's sweet spot ×1.21) with his strength
growths ×0.85, the window that keeps every kill percent within 15%; his
tilts, smashes, dash attack, third jab and grab recover 3 frames sooner
and his aerials land 3 frames sooner, inside the ±3-frame bound; and both
casts carry armor through 8 damage from frame 10. His 25 pairs at 200 a
pair measured 43%.

17 Oct 2026 (#46). Illidan's air Immolate stall (80fce5213e) and the
up-special refresh on a hit (63a0655a38) cut his stocks lost over 3 s after
a hit from 33% to 15%, and his 25 pairs on 4df269f4bf (Balance run
38987519354) measured 71%, with Eye Blast at 32% of his kills. Both
mechanics stay as Tom asked. Eye Blast drops from 13% with growth 90 and
base 24 to 12% with growth 75 and base 24; up smash's growth from 100 to
94, Azzinoth's glaives from 14% to 13% and forward tilt from 9% to 8%, each
kill percent within 15%. His 25 pairs at 200 a pair measured 62%.

18 Oct 2026 (#45, 35–65% playtester band). The nightly playtest on
893751939b (run 39015787000, 77 decisive matches a fighter) put Peon at 29%,
Beastmaster 32%, Grom 34%, Lich King 69% and Blademaster 73%, with
Blademaster's forward smash taking 62% of his KOs and Lich King's 56%.
Blademaster keeps his forward smash kill power (Tom, 17 Oct) but it
recovers 3 frames later and his dash attack 2, and his forward tilt tip
drops 10%. His down tilt keeps its recovery, so its tip stays out of reach
on shield (#151), and his dash attack tip its damage, so its weak hit stays
under 0.85 of the strong one. Lich King's forward smash drops from
25.5/21 to 23.5/19.5 and Frostmourne Sweep from 15 to 14. Beastmaster's and
Grom's forward tilts, dash attacks and forward smashes and Beastmaster's
back air deal 10% more. Peon's forward tilts and dash attack deal 10% more
and his forward smash 5%. A second Peon step (dash attack and forward smash
recovering 3 frames sooner, down tilt, up smash and both throws about 1%
stronger) was reverted: on recorded playtest seed 43 it let Peon chain
ultimate, grab, down air and jab against Kael'thas with no escape (#119).
Malfurion, at 66-70% in the lane runs, drops forward smash from 17 to
16, recovers 3 frames later from it, and his dash check drops from 10 to
9.25. Every changed kill percent stays within 15% of the fixed baseline and
every change inside its ±25% and ±3-frame bounds.

18 Oct 2026 (#45 pass 2, 45–55% Wren field). The Wren Expert field on
31cc0b9e96 (Balance run 39091849148, 400 a pair) put Rifleman at 65% with
his dash attack at 25% of his damage and its spam probe winning 81%,
Blademaster 64%, Kael'thas 63% (forward smash 60% of his KOs), Illidan 61%,
Cairne 57% and Dreadlord 56%; Lich King 36%, Gazlowe 37%, Forsaken
Paladin 40%, Thrall and Shadow Hunter 43%, Pit Lord 44% and Mountain King
45%. Rifleman's dash attack starts 2 frames later (first active 11, total
unchanged) and deals 8.25 instead of 10.23 with growth 114, so it kills at
100% instead of 88%. Blademaster's dash attack drops to 8.5/7 (the tip stays
under 0.85 of the strong hit) and Backstab to 8.5 with growth 116; his
forward smash is unchanged. Kael'thas's forward smash deals 15.5 instead of
17.35 with growth 108 and recovers 2 frames later; his dash attack deals 9.
Cairne's War Stomp (9.75) and Dreadlord's pounce bite
(11.75) deal about 6% less. Lich King's forward smash comes partly back,
24.75/20.5, Frostmourne Sweep goes to 15 and his dash attack's growth to 88.
Gazlowe's forward tilts (7.5), dash attack (9.375), forward smash
(15.75) and rockets (3.75), Forsaken Paladin's forward tilt and dash attack
(14.75), Thrall's forward tilts (13.25), down tilt (9.75) and dash attack
(13.75), Shadow Hunter's forward tilts (11.75) and down tilt (8.5), and
Mountain King's forward tilts and dash attack (13.75) deal more; Pit Lord's
forward tilt and dash attack recover 2 frames sooner. Tinker's laser keeps
6.85, since any more gives it a kill below 300%, and Forsaken Paladin's
Righteous Fury keeps its damage. Every changed kill percent stays within 15% of the fixed baseline
and every change inside its ±25% and ±3-frame bounds.

24 Oct 2026 (#45 pass 3, 45–55% Wren field, frames only). After the #223
aerial refits, the Wren Expert field on aacadefb0a (Balance run 40124983073,
400 a pair) put Blademaster at 61%, Cairne 58%, Kael'thas 56% and
Malfurion, Anub'arak and Beastmaster at 55.1–55.4%; Gazlowe 36% and
Shadow Hunter 44%. Pass 2's damage raises had left Tinker where he was, so
this pass moves recovery frames and keeps every kill percent. Blademaster's
forward tilt recovers 2 frames later and his dash attack 1; Wind Walk ends at
47 and Backstab at 33, so a read walk-in costs more; his forward smash is
unchanged. Cairne's dash attack and forward smash and Anub'arak's and
Malfurion's dash attacks recover 2–3 frames later, Kael'thas's dash attack 2
and forward smash 1, Beastmaster's forward tilts 1. Tinker's forward tilts,
dash attack and forward smash recover 3 frames sooner and his forward smash
deals 16.25 (kill 42%, baseline 48%); Shadow Hunter's forward tilt and dash
attack recover 2 frames sooner. No change adds a fixed-baseline or feel-lock
miss.

25 Oct 2026 (#45 pass 4, 45–55% Wren field). On 69d6977fd2 (Balance run
40134258732, 400 a pair) Cairne read 58.6%, Lich King 44.8% and Goblin
Tinker 38.4%. Cairne's forward smash already sits outside its kill-percent
lock (25 against a baseline of 21), so its growth stays and its swing lands 2
frames later on the same total; Shockwave deals 7.5 and ends at 61, Gore ends
at 60 and his dash attack deals 11.25 (kill 65%, baseline 58%). Tinker's
forward and up smash start 3 frames sooner on the same totals; his up smash
deals 15.5 (kill 119%, baseline 132%), down smash 12.5 (kill 98%, baseline
108%), dash attack 9.75, rockets 4.5 and Clockwerk Goblins 6. Lich King's dash
attack and forward smash recovery were already at the 3-frame floor, so his
forward smash starts 3 frames sooner and his dash attack 2, on the same totals.
A lane probe of the three fighters' 72 pairs at 120 a pair (run 40149071697)
read Cairne 52%, Tinker 48% and Lich King 49%. No change adds a
fixed-baseline or feel-lock miss.

25 Oct 2026 (#266, Blademaster without his forward smash). On 8b2120af61
(Balance run 40151181673, 400 a pair) Blademaster read 61%. His forward smash
took 69% of the stocks he won and keeps its damage, growth and kill percent,
so this pass slows the damage that sets it up. His forward tilts deal 7.9 and
6.0 (from 9.17 and 7.41), his down tilt 5.95 and 3.72 (from 7.41 and 4.63) and
his dash attack 7.2 and 5.75 (from 8.5 and 7.0). Each hit's growth rises just
enough to hold its kill percent: forward tilts 113.6 and 79.8, down tilt tip
71.6, dash attack 105 and 89.5. Forward tilts recover 1 frame later, down tilt
3, and the dash attack swings 2 frames later on the same total. A probe of his
25 pairs at 400 a pair on a `probe/` branch (run 40200022190) read 52.7%; the
damage cuts alone read 55.2% (run 40200007303). No change adds a
fixed-baseline or feel-lock miss.

## Player panel and equal skill ceilings (#358)

Every fighter targets a 45–55% mean over all six Expert personalities, with
an equal vote for Rook, Ember, Flint, Vale, Kite and Wren. Each personality's
fighter rate must be 40–60%. Each personality must share first place on at
least 1 fighter, and on at most 50% of the roster; ties count for every tied
personality. Wren keeps 400 matches a pair; the other five use 100.

Each fighter's `ceiling-plan` block is a **draft for Tom to correct**. Its
basic gameplan uses the named subset, one approach and shield, without combo
routes, advanced kit sequences or read-based punishes. Its expert gameplan
uses the full authored plan at the same mechanical and judgment skill. Expert
must win at least 55% (a fixed 5 percentage point depth margin) over basic in
100 mirror matches, with both sides measured equally.

Final skill profiles run 25 matches a pair. Perfect execution removes tech,
DI, SDI, hop and aerial drift slips and uses 100% execution with full kit
reliability. Perfect judgment removes judgment, spacing, guess and repeated
answer mistakes, idle stretches and punish misjudgments. It keeps personality
preferences, human observation delays and the shared move-value estimate;
that estimate is fallible, so this is a mistake-free judgment profile, not an
omniscient opponent. The ceiling combines both improvements.

The execution and judgment gains are measured against the same fixed Wren
Expert field, as is Advanced-to-ceiling headroom. An `execution` or `decision`
path needs at least 60% of the positive single-axis gains on its named axis;
there must be a positive gain. `mixed` needs a gain above 0 on each axis.
Ceiling versus ceiling targets 45–55% for every fighter. Each fighter's
Advanced-to-ceiling gain must be positive and within 10 percentage points of
the roster median. The depth margin, axis majority and headroom tolerance are
initial draft values; `CEILING_SPEC` in balance.ts owns every number here.

`bun wisp farm balance` runs the panel after the existing Wren field and spam
probes, using at most eight hosted jobs at once. The final table prints panel,
diversity, depth, declared path, ceiling and headroom pass/fail verdicts. Missing
samples fail completeness; no kit is retuned by the measurement. The profile
runner reports actual process CPU (user plus system) for production matches.

## Projectile spam cooldowns (2026-10-31, #789)

An Expert that only shields or never attacks lost every match to Sylvanas's
Black Arrow spam (96 of 96), so no Expert choice was the answer and the move's
rate was. A cooldown counts from the cast, so it cuts the spam rate while
Expert's mixed play barely notices: Black Arrow 52 frames, Frost Nova 46 and
Flame Strike 72. Between main 4bc5834452 (run 41172461896) and the candidate
(run 41173676469) the probe moved Sylvanas 78.8% to 16.1%, Lich 54.2% to 27.7%
and Kael'thas 26.7% to 26.5%, and Stitches stayed at 11.0%. Frost Nova's
cooldown also delays its press-again burst, so keep it close to the 41-frame
cast. The refit of Sylvanas's bow (61a1934ec7) took forward smash from 142 to
76 reach, so its radius and the dash attack's go from 8 to 34, forward tilt's
to 26, and each loses 3 recovery frames. Her field rose from 20.6% to 32.4%,
and her damage stays put because a raise breaks the kill-percent lock.
