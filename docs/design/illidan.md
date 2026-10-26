# Illidan: the Demon Hunter kit

Owner direction (Tom, 7 Oct 2026, after playtesting): "I don't really know
what his side/forward B does at all. Look at how Demon Hunters work in modern
World of Warcraft and how Illidan works as a raid boss, and come up with
interesting design improvements to how he plays and functions." Same day,
his expressive actions carry the identity: warglaive chains, Fel Rush branches,
wing dive, plunge and Eye Blast. Tom revised the resource rule on 9 Oct
(#148/#335): ordinary hits and throws no longer drain another fighter's
meter; all fighters use the same damage-dealt/taken gain rules. Named spells
remain deliberate actions.


Numbers are provisional authoring values, not measured balance. Frames follow
the roster notation (smashcraft:docs/design/roster.md): the press is frame 1,
windows are inclusive. H is 132 units. The bar is
[kit review 1](kit-review-1.md): a
second decision after the press, a visible setup the opponent can answer, a
cost, and a guess in the safest route.

## What the old side special was

Parry Step moved Illidan 9 units a frame toward the stick for 22 frames and,
on its frames 4–9 only, cancelled any strike that touched him and stunned the
attacker. Nothing told either player which of the two it was: a counter that
travels looks like a dash, the window showed a faint aura for 6 frames, and a
whiff looked identical to a successful step. Kit review 1 scored it 11 on
paper; in play its decision was invisible. A counter is legible when the
fighter stops and poses (Marth's and Roy's Counter); a counter folded into a
dash is not.

## Research

### Demon Hunters in modern World of Warcraft

| Ability | What it does | What a platform fighter can take |
| --- | --- | --- |
| Fel Rush | Rush forward, incinerating anything in the path; 15–20 yards, 10 s cooldown, two charges; on the ground he stays grounded, in the air he flies level, ignoring gravity ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Fel_Rush); [Method](https://method.gg/guides/havoc-demon-hunter/playstyle-and-rotation)) | A fast, straight, readable dash that strikes what it passes and doubles as a level air recovery |
| Vengeful Retreat | Vault away from enemies, damaging and (talented) slowing those nearby; 25 s cooldown ([Wowhead](https://www.wowhead.com/cn/spell=198813/vengeful-retreat)) | The backflip out: the dash's bail-out, the "rush in, flip out" loop Havoc players weave |
| Chaos Strike / Annihilation | The Fury spender; becomes Annihilation in Metamorphosis ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Demon_hunter)) | A committed two-glaive slash that cashes the approach |
| Eye Beam | 2 s channel, 20 yards, in front; he can't move while channelling but can turn; Fel Rush cancels it ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Eye_Beam)) | A committed beam: reach paid for with a rooted channel |
| Blade Dance / Death Sweep | Strike nearby enemies; Death Sweep in Metamorphosis ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Blade_Dance)) | An evasive multi-hit around him |
| Metamorphosis (Havoc) | Leap, land with force for an 8-yard stun, then demon form for 20 s: Annihilation, Death Sweep, 20% haste ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Metamorphosis_(Havoc))) | A temporary form; the landing is a smash-like burst |
| The Hunt | 1 s cast, charge up to 50 yards, root 1.5 s, damage over time ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/The_Hunt)) | A long telegraphed lunge that marks |
| Sigil of Flame | A placed sigil that activates 2 s later ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Sigil_of_Flame)) | A delayed, visible zone |
| Soul Fragments (Vengeance) | Shattered souls left on the ground for 20 s, consumed by walking near; at most 5 ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Shattered_Souls_(Vengeance))) | A pickup resource on the stage |
| Glide, double jump, Spectral Sight, Demon Spikes | Class mobility and defence ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Demon_hunter)) | Wing Ascent's dive covers the mobility (#279); the double jump is every fighter's |

### Illidan as a raid boss (Black Temple)

From the encounter's tactics ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Illidan_Stormrage_(tactics));
[Warcraft Tavern](https://warcrafttavern.com/tbc/guides/illidan-stormrage)):
Shear (a tank-buster), Draw Soul (a frontal cone that heals him), Flame Crash
(a fire hit that leaves a blaze on the ground), Parasitic Shadowfiend (a
spreading damage-over-time), the Warglaives thrown down to become the Flames
of Azzinoth while he flies and casts Fireball and Dark Barrage, Eye Blast (an
eye beam swept across the floor), Agonizing Flames, and Demon Form (Shadow
Blast, Flame Burst, Shadow Demons that stun and pursue). Maiev's Cage Trap
stuns him. The fight's language is telegraphed area denial: everything that
hurts announces where it will land.

### Warcraft III Illidan

The Demon Hunter hero ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Demon_Hunter_(Warcraft_III))):
Mana Burn (a bolt that burns 50/100/150 of the target's mana), Immolation (a
damaging aura), Evasion (10/20/30% chance to dodge) and Metamorphosis (45 s,
+500 hit points, a 600-range chaos attack). The Warcraft III Demon Hunter is,
above all, the hero who empties casters: Mana Burn is why he is picked.

### Making a dash special legible

- Street Fighter's dash specials with follow-ups (Akuma's Demon Flip, Ryu's
  Hashogeki-era rush moves) read because the travel and each branch have
  different silhouettes: the defender sees the commitment, then guesses the
  branch ([fighting-game language](fighting-games.md)).
- Fox's and Falco's Illusion and Phantasm leave an afterimage line along
  the dash: the path is visible after the fact, so the move teaches itself.
- Blademaster's Wind Walk ([kit review 1](kit-review-1.md#side-b-wind-walk-picked))
  shows the house pattern: a tell, travel that stops at a raised shield, and
  attack and special branches.
- #97's legibility rule (smashcraft:docs/gameplay-design.md, "Legible
  hurtboxes"): what the player sees must agree with what the simulation does.

## Side special: Fel Rush

**Alternative A, Fel Rush with Vengeful Retreat and Chaos Strike (picked).**
Ground or air, any facing (the stick picks the side).

- **Frames 1–5, the tell:** Illidan crouches and his fel aura flares green.
  Any hit stops it; no armor.
- **Frames 6–15, the rush:** 20 units a frame (200 in all, 1.5H) in a
  straight line, leaving a fel trail. In the air he flies level (gravity off),
  as Fel Rush does in WoW. The rush passes through bodies, striking each once:
  6% fire at 80°, base 45, growth 40, a pop-up he can follow. It stops just
  short of a raised shield, and the strike meets the shield.
- **Frames 16–29:** recovery; he acts on frame 30.
- **Branches, a press in frames 10–24:** the press replaces the rest of the
  rush:
  - **Special: Vengeful Retreat.** He backflips away from the way he faces:
    16 units a frame back on its frames 1–10 (about 160), rising 16 a frame
    at the start and 1.2 less each frame (a vault about 100 high), then
    drifting back. It ends on frame 16: from frame 17 he is airborne with his
    aerials, air dodge and jump. No hitbox and no intangibility: an escape,
    not a counter.
  - **Attack: Chaos Strike.** A two-glaive slash toward the held stick
    (held back turns him, the cross-up after passing through): active on its
    frames 5–8, 10% fire at 40°, base 30, growth 95; ends on frame 30. In the
    air, landing ends it with 12 frames of landing lag.
- **Limits:** once per airtime (landing, a ledge catch or a hit refreshes it);
  40-frame cooldown from the press; a recovery tool that never ends helpless.
- **Cost:** the mana lane's side-special cost (12); the branches are free.

**Counterplay.** The tell is 5 frames, so up close the rush is a read, not a
reaction; from its full 200 units it arrives on frame 15. A raised shield
stops it, and a rush that branches into nothing sits at the shield until frame
29: punishable. A jump over the low rush leaves him in recovery below. Against
Vengeful Retreat the defender chases: he is airborne and unable to act on its
frames 1–16, in range of a jump-out-of-shield aerial, a dash attack or a shot.
Chaos Strike is punishable on shield. The defender's guess after a rush into
shield: stay shielded (beats Chaos Strike), or let go and chase (beats the
Retreat), while Illidan guesses which.

**Reward.** A pop-up from the rush, a cross-up Chaos Strike, a level air
recovery under an edge-guarder (Wing Ascent covers high), and a way to
drain mana on the way in.

**Alternative B, The Hunt (rejected).** A 20-frame cast, then a 3H lunge that
marks for a damage-over-time and roots for 30 frames on a hit. Rejected: it
duplicates Warden's mark-and-pursue (#126), and a root beside Mana Burn's stun
gives him two lockdowns.

**Alternative C, a legible counter stance, Blur (rejected).** Keep a counter,
but make it stand still with a fel shimmer on frames 4–12 and answer a strike
with a slash behind the attacker. Rejected: counters ask Illidan to stand
still when his identity is air speed and glaive reach, and Forsaken Paladin's Divine
Shield (#131) already owns the defensive-special slot in the roster.

## Drain on hit: what his attacks do

Every attack Illidan lands drains the target's mana as part of the hit, as the
Warcraft III Demon Hunter empties casters. The drain is a property of each
move in his kit data (`manaDrain` on the move's hit effect,
smashcraft:ts/src/game/sim/hitRegions.ts and specials.ts), scaled so combo
enders and big hits drain more:

| Move | Drain | Move | Drain |
| --- | ---: | --- | ---: |
| Jab | 3 | Forward, up, down tilt | 4 |
| Dash attack | 5 | Neutral, forward, up air | 4 |
| Back air | 5 | Down air (the spike) | 8 |
| Forward smash | 10 | Up, down smash | 8 |
| Each throw | 6 | Fel Rush pass | 4 |
| Chaos Strike | 10 | Immolate | 6 |
| Wing Dive | 5 | Mana Burn orb | the mana lane's drain |

A shielded hit drains nothing; pummels, get-up and ledge attacks drain
nothing; mana never goes below 0 and Illidan gains none. Each drain flashes
the victim's mana readout fel purple, so the meter visibly drops with the
hit (the flash rises over the drained fighter's head). A forward air into forward smash drains 14; a throw into an up air
string about 14–18.

Counterplay: drain needs a landed hit, so the answer is the ordinary one,
not getting hit; a fighter who spends mana freely arrives at Illidan's Mana
Burn with less to lose, and a fighter who keeps its mana gives up specials.

**Alternative B, a separate always-on Mana Break at a flat 3 per hit
(superseded).** Tom's refinement: drain is what his hits do, not a
separate rule, and it scales with the move. **Alternative C, drain proportional to damage
dealt (rejected).** It ties drain to his light damage, so his identity
(many light hits) would drain little; per-move authoring lets a combo ender
drain more than its damage implies.



## Neutral special: Mana Burn (kept; drain owned by the mana lane)

The slow orb of #116 stays: cast 16 frames, recovery 30, speed 12, one out.
The mana lane rebuilds its hit around mana: it burns the target's mana and the
stun grows as the target's mana empties, keeping the 300-frame window in which
a stunned fighter can't be stunned again. Every landed attack feeds it: less mana, a
longer next stun. Source of truth for
the formula: smashcraft:docs/design/mana.md and
smashcraft:ts/src/game/sim/projectiles.ts.

## Up and down specials (kept)

- **Wing Ascent, aimed like Fire Bird** (#519): Tom asked on 26 Oct for 4 more
  startup frames and an aimable launch, like Falco's Fire Bird. Illidan holds
  still on spread wings for frames 1-7 (on the ground he stays standing), and
  the stick held on frame 7, the last startup frame, sets the launch
  direction: any angle the stick gives on a pad, 8 directions on a keyboard,
  straight up with none held. Four frames of protection start there, as
  before. The ascent keeps its speed and distance and only turns: 30 units a
  frame at launch, slowing by his gravity (1.14) each frame, about 380 units
  from the launch to frame 32, then helpless fall. No drift steers it once it
  launches. Aimed into the floor, he slides along it until the move ends.
  Before, his frames 1-3 already rose about 56 units and the launch came on
  frame 3; that hop is now the still startup, so his whole rise from the
  press is about 380 instead of 435.
- **Wing Dive** (#279): Tom asked for a follow-up like
  Mountain King's Thunder Leap or Pikachu's second Quick Attack in place of the
  glide (2026-10-25). A second special in the ascent's frames 19-31 (15-27
  before #519 moved it 4 later with the startup) is a
  6-frame backflip, then a 13-frame dive at 30 a frame along the stick held
  at the press, any of 8 directions, forward and down with none held. The
  dive hits along its line (9%, 50 degrees), ends in helpless fall, keeps
  10 frames of landing lag and comes once per airtime. With Fel Rush in the
  air his recovery has a high route (ascent and dive) and a level one (rush,
  then ascent).
- **Immolate on the ground, jump-cancellable** (#128): the Warcraft III
  Immolation as a shine, which Tom asked for. Kept, and in the air it stalls
  him like the shine (below). Since #272 it has Maiev's former Fan of Knives
  shape: Tom asked on 25 Oct to swap the two down specials' behaviour.

## The raid boss across his normals (owner direction)

Tom's direction (7 Oct, through the orchestrator): the primary reference for
the rest of the kit is Illidan the raid boss, with Warcraft III's Immolation
and Mana Burn kept and the modern class filling gaps. Each change keeps the
shared action timing (startup and total; the clip plays over the total) and
uses the per-fighter active-frame seam, so no clip changes length.

### Forward tilt: Shear (picked)

Black Temple's Shear cut the tank's maximum health. Illidan's forward tilt
(all three angles) keeps its reach (135), startup 5 and total 28, and
becomes the mana cutter: 9% (was 8), a low 25° launch (base 20, growth 80),
and the largest drain of any quick move, **12**. The poke that empties a
mana bar; it is the setup for Mana Burn, not a kill move.

Counterplay: unchanged reach and timing, so the same spacing beats it; the
drain needs a body hit. Alternatives: **B, Shear as the jab finisher**
(rejected: Illidan has a single jab, and a finisher needs a multi-hit jab
seam); **C, Shear shrinks the target's shield** (rejected: shield health is a
shared system with its own owner decisions, #102).

### Down smash: Flames of Azzinoth (picked)

In Black Temple he throws both Warglaives into the floor and each becomes a
Flame of Azzinoth. Startup 8 and total 42 as before; active frames 3 → 9:

- Frames 1–3 of the active window: the glaives strike both sides where the
  clip holds them, 14% at 75°, base 22, growth 95, drain 8.
- Frames 4–9: fel fire burns along the held glaives: 3% at 85°, base 30,
  growth 20, drain 2. Glaives and fire share one contact, so only a fighter
  the glaives missed burns.

Both parts use one capsule from 80 behind to 105 in front, 40 to 45 high,
radius 30, on the two glaives the clip holds out and down (#280). The
earlier ±190 box hit 56 to 81 units past the drawn blades.

Counterplay: the total is unchanged, so after the flames he still has 26
frames of recovery: a shield holds both parts and drops with more than 10
frames of the smash left; a full jump clears the
flames' height; a roll through ends past the glaives. Alternatives: **B, the
glaives thrown as two returning projectiles** (rejected: a smash that
becomes two projectiles breaks the 3-projectile cap's spirit and duplicates
Mountain King's returning Storm Bolt); **C, the flames as persistent stage
hazards** (rejected: a lingering zone after a smash outlives his
commitment).

### Forward smash: Fel Lunge (picked, #379)

Tom's playtest (9 Oct, #379): the old forward smash, Eye Blast, became a
645-unit floor beam when charged 20 frames. Its only tell was a glow over his
eyes that did not read at gameplay zoom, and computers fired it from across
the stage: a full-screen zoning tool on a rushdown fighter. Lead decision:
forward smash loses the beam and lunges like Fel Rush; Eye Blast moves into
his meter-gated special (below).

Startup 6 and total 36 as before; active frames 6–8 (3, was 10). On attack
frames 6–9, after any charge, he travels forward 40 units, plus up to 30
more at full charge (60 frames): 10 a frame uncharged, 17.5 fully charged.
The lunge stops at a body or a raised shield, like Fel Rush. The glaive
strikes from 25 to 120 units ahead, from 75 below his feet to 105 above:
10% at 45° (base 20, growth 85), drain 10, scaled by charge like every
smash. Reach from where he starts is 160 uncharged and 190 fully charged,
inside the roster's forward-smash band (62–195; the widest other fighter
reaches 190). No projectile and no beam.

Kill percent, from the centre of stage 0, no DI, against Rifleman / Murloc
/ Cairne: uncharged 128 / 122 / 171 (unchanged); fully charged 94 / 90 /
125, where the charged beam killed at 75 / 76 / 114. Both stay inside the
range the old move covered (75–171).

Counterplay: the lunge is short and straight, so a shield stops it in place
and he still has 27 frames of recovery after the strike; a jump over the low
lunge lands behind him. Alternatives: **B, keep the charged beam with a
louder tell** (rejected by the lead: a 645-unit forward smash is free stage
control at any tell); **C, a lunge as long as Fel Rush** (rejected: it
duplicates his side special and would leave the reach band).

### EX neutral special: Eye Blast (picked, #379)

The issue first placed Eye Blast inside Metamorphosis; the lead corrected
it (9 Oct): Smashcraft has no ultimate system, only the one super meter that
buys EX specials (#335), so Eye Blast is Illidan's EX neutral special under
those rules. Shield + Special with no direction on a full 100-point bar, on
the ground, starts Eye Blast in place of Mana Burn's 25% reach EX and spends
the whole bar. Below a full bar, or in the air, the press is the ordinary or
EX Mana Burn.

- **Frames 1–24, the windup:** he stands rooted; fel fire burns over his
  eyes (his Metamorphosis missile) and eight small green dragon flames stand
  just above the floor from 60 to 645 units ahead, brightening and growing
  over the windup: the ground marker of where the beam will run. A hit
  interrupts it; the bar stays spent.
- **Frames 25–34, the beam:** reaching 195 on frame 25 and 50 further each
  frame to 645 on frame 34, low (60 below his feet to 45 above): 13% at 30°
  (base 24, growth 90), drain 10, one hit per target. Each flame burns
  to full size as the beam passes it.
- **Frames 35–60:** recovery; he acts on frame 61.

Counterplay: 24 frames of windup with the whole path marked is a reaction
for every fighter: a short hop clears the low beam, a shield holds it, and
anyone near him punishes the windup. Alternatives: **B, Eye Blast as the
ordinary neutral special** (rejected: Mana Burn is kept and is his drain
identity); **C, a beam on every forward smash** (rejected: #379).

### Down special in the air: Immolate (picked)

Tom (17 Oct): in the air, Immolate nearly neutralizes his vertical momentum,
as Fox's shine does in Melee. Down special in the air is Immolate, not Flame
Crash:

- The same timing as on the ground: it strikes on frame 1 only, his first
  frame is intangible, 15 in all, jump-cancellable from frame 4.
- Every frame of it zeroes his vertical speed while his horizontal speed
  carries, as every special started in the air keeps it (26 Oct, #490,
  smashcraft:docs/gameplay-design.md#special-momentum).
- Its strike since #272 is Fan of Knives' former shape on both sides of him:
  a foe whose feet are within 116 to either side and 104 below to 108 above
  (140, 114 and 118 for EX) is popped away from him at 85 degrees, base 108,
  growth 18; 7% on the ground, 9% in the air, drain 6. Those bounds are Fan
  of Knives' knife capsule (0.7 fighter heights out, 0.3 radius, centred 48
  up) grown by a reference body, since Immolate tests the foe's feet and Fan
  of Knives tested its hurtbox.

Counterplay: he hangs in place for 15 frames unless he jumps out, so a
fighter outside the flames punishes the stall; offstage the jump cancel
spends his double jump. Alternatives: **B, Flame Crash: hang, plunge, burst
on landing** (replaced by the owner's 17 Oct direction); **C, Agonizing
Flames: a thrown fireball that burns over time** (rejected: a second ranged
option beside Mana Burn, and damage over time without hitstun is Warden's
poison, #126).

### Forward air: twin-glaive cross slash (picked, owner direction)

Tom (7 Oct): forward air multi-hits. Startup 5 and total 31 as before;
active 2 → 6. Active frames 1–2: the **link**, both glaives crossing out to
175: 2%, a fixed small knockback pulling slightly in and up (105°, base 30,
growth 10), drain 1. Frames 5–6: the **launcher**, the cross opening to 150:
3% at 40° (base 18, growth 85), drain 4. 5% in all after #105's bounded retune. The link's
knockback barely grows, so both hits connect at 0, 50 and 100%.

Counterplay: the launcher reaches 25 less than the link, so a fighter caught
at the tip who SDIs away during the link's freeze slips the launcher
(bounded SDI, smashcraft:docs/gameplay-design.md); shields take both hits.
Alternatives: **B, a three-hit drill** (rejected: existing drills
lane own multi-hit drills, and a third hit adds lock without a decision);
**C, a single sweet-spotted slash** (rejected by the owner's direction).
Neutral air stays single-hit: it is his out-of-shield and landing poke, and a
multi-hit there would crowd the forward air's role.

## Ultimate: Metamorphosis (design only)

Tom's direction: an ultimate is earned by skill and switchable off in the
match rules (the ultimate rules in smashcraft:docs/design/mana.md). Illidan's
is **Metamorphosis**, Black Temple's Demon Form and Warcraft III's
ultimate:

- **Earned:** by the mana he drains (his skill measure); the meter and its
  threshold follow the shared ultimate rule.
- **Entry:** he leaps and lands with force (Havoc's Metamorphosis): a
  ±1.2H burst, 12% at 70°, no stun (Mana Burn owns his stun).
- **Demon Form, 600 frames:** weight +15 (Warcraft III's +500 hit points);
  Mana Burn becomes **Shadow Blast**, a fast fel bolt (speed 20, 8%, no
  stun), Warcraft III's 600-range chaos attack; Immolate becomes **Flame
  Burst**, a wider ring; an **Aura of Dread** drains 1 mana every 30 frames
  from fighters within 1.5H; Fel Rush can be used twice per airtime.
- **Ends** at 600 frames or on losing the stock; off in the rules, it does
  not exist.

Counterplay: the entry leap is telegraphed and punishable on whiff; Demon
Form trades his stun for range, so shields and powershields (Shadow Blast is
reflectable) hold it off; staying out of the aura's 1.5H keeps mana.
Alternatives: **B, a Fury meter** (rejected: mana is the one resource);
**C, Soul Fragments on the stage** (rejected: a pickup chore, and healing
works against stock pressure).

## What changes for the computer

#379: the computer no longer charges forward smash at range. It fires Eye
Blast only on a full meter at a grounded, level target 240–600 units ahead,
and never upgrades a close neutral special into it as an armored answer. In
a seeded 20-match Wren Expert sweep against Rifleman (stage 0, 1,800 frames
each), Illidan's average distance to Rifleman fell from 281.7 to 272.4
units; his 27 charged forward-smash beams, none paid for, became 13 Eye
Blasts, each on a full bar.

The computer presses side special as before; the gameplan names the
Fel Rush branches only once a bot lane authors them (#105 is paused). Its
old defence through Parry Step is gone: Illidan's planned stance answers fall
back to shield and spot dodge.

## Presentation (stock Warcraft assets)

Each option shows a stock Warcraft effect (smashcraft:ts/src/game/presentation/specialCues.ts,
attackCues.ts and elementLooks.ts):

| Option | Effect |
| --- | --- |
| Fel Rush tell (frames 1–5), and every branch's startup | Death Coil special art |
| Fel Rush (frames 6–15) | Illidan's Metamorphosis missile trail |
| Vengeful Retreat | Possession missile trailing the vault |
| Chaos Strike (ground and air) | Moon Glaive whirl |
| Shear (forward tilt, all angles) | Demon Bolt impact where the glaive cuts |
| Fel Lunge (forward smash) | Illidan's Metamorphosis missile trail |
| Eye Blast windup / beam | Metamorphosis missile over his eyes and small green dragon flames along the floor / green dragon fire, each floor flame growing as the beam reaches it |
| Flames of Azzinoth glaives / fire wall | Demon Hunter glaive / Flame Strike |
| Twin-glaive forward air | Illidan's missile trail |
| Drain on hit (any victim) | Mana Burn target over the victim's head through that hit's hitlag and hitstun |

Stock effects that a pool shows late draw nothing at their start, so each
of these names the sequence it starts and starts where its model already
draws, read from the model's keys (game archives, 7 Oct): Death Coil special
art's only Stand bursts 0.3–0.6 s, so the tell starts at 0.3 s; Flame Strike's
Birth reaches its full fire at 1.3 s and its Stand draws nothing, so the fire
wall starts at 1.3 s into Birth; Demon Bolt impact and Mana Burn target draw
nothing before 0.23 s and start at 0.3 s; Breath of Fire missile and Volcano
death have only a Birth, drawn 0–0.5 s; the missiles and Moon Glaive draw
from 0 s. smashcraft:ts/src/game/presentation/illidanCues.tests.ts holds the
measured windows.

Source: smashcraft:ts/src/game/sim/specials.ts (Fel Rush),
smashcraft:ts/src/game/sim/hitRegions.ts (drain on hit), contract tests in
smashcraft:ts/src/game/sim/felRush.tests.ts.

## Combo targets: Falco's vertical game (#457)

Tom set the direction on 2026-10-26: Illidan, whose air Immolate is already a
Falco-style shine, owns Falco's vertical combo game; Maiev goes back to Fox
(#456). These are his targets for the retune, written before it starts, as
Maiev's were (#303). The link rows live in `tools/move-data/combo-objectives.json`
and `bun wisp combos --objectives --fighter Illidan` checks them against his
committed link table (`tools/move-data/links/illidan.md`). Each row is a
Falco pattern from SmashWiki's [Falco (SSBM)](https://www.ssbwiki.com/Falco_(SSBM))
and [Pillar](https://www.ssbwiki.com/Pillar) pages, which give the routes but
no percent windows; the windows follow Maiev's Fox-derived rows at weight 75
where the route is shared, and Falco's notes where it is his own.

### Link targets

Against weight 75, clean hits. A class is the floor: true beats DI-dependent
beats read. The DIs listed must not escape.

| Opener | Percent | Follow-up | Floor | DIs that must not escape | Falco source | Today |
| --- | --- | --- | --- | --- | --- | --- |
| down special (Immolate) | 0-50 | up air | true | | shine into up air, the shine's vertical pop | DI-dependent: DI out and down escape |
| down special (Immolate) | 0-60 | down air | DI-dependent | in, none | the pillar: shine into down air | holds |
| down special (Immolate) | 60-100 | back air | DI-dependent | in, none | "back aerial is good out of a shine at higher percents" | holds |
| down air | 0-100 | down special (Immolate) | true | | the pillar: down air into shine | true to 40, read at 50, DI-dependent from 60 |
| down air | 60-100 | forward smash | DI-dependent | in, none | a grounded down air into forward smash | holds |
| down tilt | 0-40 | down special (Immolate) | DI-dependent | in, none | down tilt leads into shine | holds |
| up tilt | 0-40 | down special (Immolate) | DI-dependent | in, none | up tilt segues into more shines | holds |
| up throw | 20-80 | up air | DI-dependent | in, none | up throw starts up air strings; DI out escapes higher | read at 20, holds from 30 |
| down throw | 0-40 | down tilt | read | | down throw into down tilt, a tech chase | holds |
| up air | 10-60 | up air | DI-dependent | in, none | up air strings | read to 30, DI none escapes at 60 |
| up air | 70-100 | up air | read | | the string ends in a read | holds |

### Edge-guard targets

Checked by `--objectives` from the ledge, against every DI:

- down air: Falco's spike, from 40 past the ledge at stage height (60-150%)
  and from 80 past and 80 below (50-150%).
- back air: Falco's offstage kill aerial, from 40 past the ledge (60-150%).

Today 7 of 11 link rows hold, and all three edge guards kill against every
DI; back air kills since it took Falco's back air knockback, 13% at base 10
and growth 100, from 6% at base 18 and growth 85, which killed only at
140-150% (#493, 2026-10-26). The retune (#457): Immolate 15 frames in all,
base 108, growth 18; down tilt and up tilt base 83, growth 20, at 80
degrees, up tilt's capsule reaching down to a grounded foe; up air base 50,
growth 70, capsule radius 55. The rows that still miss:

- Immolate into up air: the link table searches follow-ups only from his
  first actionable frame, not from the frame-4 jump cancel, so the pop must
  outlast 15 frames of Immolate; DI out carries the foe past his drift and
  DI down keeps a grounded foe on the floor.
- Down air into Immolate: from 50% the grounded down air bounces the foe at
  79 degrees into a tech (50%) or past Immolate's reach under DI out (60%+).
- Up throw into up air: at 20% the shared up throw's hitstun ends before
  the up air lands, so the foe acts first; up throw is not his own row.
- Up air into up air: at 10-30% the foe lands or acts before his second
  up air after landing lag and a new hop; at 60% the foe under no DI
  escapes the earliest second up airs.

### Body toward Falco

The retune moves his movement toward Falco's inside Melee's spread
([character attributes](https://wiki.supercombo.gg/w/SSBM/Character_Attributes)):
Falco's gravity 0.17, terminal speed 3.1, fast fall 3.5, full jump 4.1 and
short hop 1.9, against his 0.19, 3.0, 3.45, 4.03 and 2.2. The short hop also
closes his open ledger row (`illidan-short-jump`, above Melee's 2.14).

### Identity guard

What he keeps, so he does not become Falco in a costume:

- Fel Rush and its branches: his side special stays the straight fel dash
  with Vengeful Retreat and Chaos Strike, not Falco's Phantasm.
- Warglaives: his normals keep their glaive reach, the twin-glaive forward air
  and the Flames of Azzinoth down smash.
- Wing Ascent and the Wing Dive: his recovery keeps the ascent and its
  eight-way dive. Since #519 the ascent aims and starts like Fire Bird, but it
  takes no charge and does not hit.
- Eye Blast and Mana Burn: the beam stays a meter-gated EX special and the
  neutral special stays the slow mana orb; he gets no laser.
- Drain on hit: every landed hit still drains mana.
- Immolate stays a shine, not a loop: Immolate into Immolate stays below true,
  and no waveshine infinite.

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Air speed and glaive reach: he attacks from the air and chases.

```balance-profile
fighter: illidan
archetype: rushdown
aerials: nair 15-40, fair 20-45, bair 5-25, uair 5-30, dair 10-35
air-share: 30-65
approach: 55-85
ranged: 0-15
specials: neutral 2-12, side 3-15, up 0-8, down 2-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: illidan
path: execution
basic-moves: forward-tilt,forward-air,neutral-air
```

Basic gameplan: Walk into tilt range, use a forward aerial and save jumps for recovery. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Chain dash approaches, cross-ups and aerial pressure with timed recovery mixups. Use the full authored kit and gameplan at the same CPU skill.

## Signature strong/weak move (#389)

Neutral air, split by timing: strong hit clean, frames 4-7, 7%; weak hit late, frames 8-31, 4.9%. The glaive spin cuts hardest as it starts and punishes a jump-in; its long lingering spin stays a weak landing and edge-guard cover.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).
