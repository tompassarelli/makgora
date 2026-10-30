# Murlocs

The Murlocs are a pair: the leader Mrgl, whom the player drives, and his
partner Grgl, a smaller murloc who copies Mrgl's inputs five frames late, in
the manner of Melee's Ice Climbers. Tom asked on 2026-10-30 to rework the
single Murloc into this duo: fast, multi-hit and annoying up close, light and
easy to kill, and weak once Grgl is down. Later that day he asked for play deep
enough that the Ice Climbers look simple beside it, with full independence of
the two bodies at its core and deliberate, readable depth beyond accidental
desyncs. The plan and its decisions are in
south:agents/decisions/smashcraft/murlocs-duo-plan.md.

All geometry, damage, timings and bars below are original provisional
Smashcraft values, relayed with Tom's approval of the plan on 2026-10-30, to be
revisited when the balance pass reports or a native capture shows a bar
misreads. Smash references explain roles and trade-offs, not copied hitboxes.
The Melee facts used come only from SmashWiki
([Ice Climbers (SSBM)](https://www.ssbwiki.com/Ice_Climbers_(SSBM)),
[Desynchronization](https://www.ssbwiki.com/Desynchronization),
[Wobbling](https://www.ssbwiki.com/Wobbling)) and describe relations only: a
delay exists, the partner is weaker alone, and wobbling must be impossible.
Murky (Heroes of the Storm) was checked as the alias named on #262; he is the
same creature, not a third body, and the kit takes its abilities from the
Warcraft III murloc creeps.

## Research and body

Warcraft III's [murloc creeps](https://wowpedia.fandom.com/wiki/Murloc_(Warcraft_III))
supply the kit: the Tiderunner's claw attacks for the normals and the
[Murloc Huntsman's Ensnare](https://wowpedia.fandom.com/wiki/Ensnare) for the
neutral special, the Net. Belly Slide and Tidal Surf turn the murloc's
swimming into a slide and a wave, and "Mrglglgl!" is the creeps' gurgle given
an order's job. Presentation is the stock classic Tiderunner,
`units\creeps\Murloc\Murloc.mdl` (unit `nmrl`, model scale 1.0), its command
icon `BTNMurloc` and its own `Murloc` unit sounds; the stock Ensnare model
draws the Net. No downloaded art or recordings are needed.

History: until the duo rework (2026-10-30) the down special was the Murloc Plaguebearer's [Disease Cloud](https://wowpedia.fandom.com/wiki/Disease_Cloud), a poison pool drawn with private bog-green copies of the stock Plague Cloud models (`MurlocSwampCloud`, `MurlocSwampMist`, #39); the rework cuts it, its cues and that model family.

Grgl uses a different stock Classic murloc creep model at scale 0.9: the one
among `units\creeps\Murloc*` whose bone names match `Murloc.mdl`, so the
authored clips 9–89 export onto it unchanged, and whose silhouette or colour
differs at match zoom. If none matches, the clips are retargeted onto the
closest model. Definitive Edition art is never used (roster.md).

The stock model has nine sequences: two stands, a ready stand (Stand -3), a
walk, Attack - 1 (claw swipe), Attack Spell (a thrown arm), Death and two
decays. Like Beastmaster's, moves share clips by motion.

The body counterpart is [Squirtle in Ultimate](https://www.ssbwiki.com/Squirtle_(SSBU)):
a light character, small enough to duck many highs, with a
belly-slide side special ([Withdraw](https://www.ssbwiki.com/Withdraw)) and
a water recovery ([Waterfall](https://www.ssbwiki.com/Waterfall)). The values
are original:

| Body | Weight | Run | Air | Width | Height |
| --- | --- | --- | --- | --- | --- |
| Mrgl | 0.88 | 1.12 | 1.06 | 0.90 | 0.72 |
| Grgl | 0.80 | 1.12 | 1.06 | 0.81 | 0.648 |

Mrgl dropped from 0.94 to 0.88 with the duo; Grgl's hurt capsules and hit
regions are Mrgl's ×0.9. Both are among the lightest fighters (Lich 0.85,
Warden 0.88, Shadow Hunter 0.94). Height 0.72 puts Mrgl's hurt capsule's top
at 77 units against the drawn Stand's 76: the shortest body in the cast
(Rifleman 87, Peon 89) until Grgl. Shared gravity, jumps and dodge timing stay
the roster's.

## Voice

His moves use the game's own Murloc unit sound set (UnitAckSounds.slk, `Units\Creeps\Murloc\`), referenced by path, nothing extracted or added to the map. The set holds `MurlocReady1`, three takes each of `MurlocWhat`, `MurlocYes`, `MurlocYesAttack` and `MurlocPissed`, and `MurlocDeath` (AnimSounds). The Mur'gul (`MurgulDeathSwim`) is a death only, and the other murloc creeps share this set.

- **Smashes (up, down, forward), side special (Belly Slide) and up special (Tidal Surf):** the three `MurlocYesAttack` takes as the move's voice layer, on two of three uses, the take picked by the hit serial. Jabs, tilts, aerials and the Net stay silent. `MurlocYesAttack` is the set's attack gurgle; `MurlocWhat`, `MurlocYes` and `MurlocPissed` are the quieter acknowledge and annoyed lines.
- **Orders, swap and revive ("Mrglglgl!"):** `MurlocYes` and `MurlocWhat` by path, so the player hears an order land.
- **Entrance and victory:** the imported World of Warcraft murloc aggro clip, a Blizzard sound the map ships by Tom's choice (2026-10-28, reasons and source in [sound.md](sound.md)). Warcraft III's `MurlocReady1` and `MurlocYesAttack1` no longer play there.

[sound-table.md](sound-table.md) lists the voice column; `murlocVoice.tests.ts` ties the move voices to the installed game's stored files and the moves that play them.

## Full kit

Frames count entry as 1. Columns are first active / active duration / recovery;
aerial landing is the authored landing lag (aerials land with half of it).
Reach is world units from his centre. Every contact is one hit per target
and action.

| Input | Gesture and role | Frames; damage; reach | Warcraft source | Smash reference |
|---|---|---|---|---|
| Jab 1 → 2 | Short point-first spear stab, then a second, longer stab | 3/2/11, 2% → 5/2/15, 4%; 70 → 78 | [Tiderunner claws][wc] | [Squirtle jab][sq] |
| Forward tilt / angled | Stepping spear stab, shoulder and hips behind it (forward and down); upward claw swing; spacing poke | 6/3/19; 8%; 76 | [Tiderunner claws][wc] | [Squirtle forward tilt][sq] |
| Up tilt | Overhead swipe; juggle starter | 5/4/18; 7%; height 102 | [Tiderunner claws][wc] | [Squirtle up tilt][sq] |
| Down tilt | Floor claw; low launcher | 5/3/16; 6%; 70 | [Tiderunner claws][wc] | [Squirtle down tilt][sq] |
| Dash attack | Belly-flop with a 48-unit slide | 7/5/26; 9%; 76 | [murloc swim][wc] | [Squirtle dash attack][sq] |
| Forward smash | Two-claw lunge; finisher | 14/3/36; 16%; 98 | [Tiderunner claws][wc] | [Squirtle forward smash][sq] |
| Up smash | Hop and overhead slash | 11/4/34; 15%; height 128 | [Tiderunner claws][wc] | [Squirtle up smash][sq] |
| Down smash | Spinning sweep both sides | 12/4/34; 13%; ±86 | [Tiderunner claws][wc] | [Squirtle down smash][sq] |
| Neutral air | Tucked spin; close escape | 5/6/20, land 12; 8%; ±48 | [murloc swim][wc] | [Squirtle neutral air][sq] |
| Forward air | Claw rake ahead | 7/3/24, land 14; 10%; 80 | [Tiderunner claws][wc] | [Squirtle forward air][sq] |
| Back air | Fin kick behind; strongest aerial | 8/3/24, land 14; 12%; −84 | [murloc swim][wc] | [Squirtle back air][sq] |
| Up air | Overhead flip; juggle | 6/4/20, land 12; 9%; height 108 | [Tiderunner claws][wc] | [Squirtle up air][sq] |
| Down air | Stomping dive; air spike, ground lift | 12/3/28, land 18; 11%; −58 | [murloc swim][wc] | [Squirtle down air][sq] |
| Grab / pummel | Short claw grab; shared pummel timing, 2% | Grab 7/2/24, reach 52 | [Tiderunner claws][wc] | [Squirtle grab][sq] |
| Forward throw | Shove; spacing | release 12, recover 20; 7%, 40° | [Tiderunner claws][wc] | [Squirtle forward throw][sq] |
| Back throw | Roll behind; edge position | release 14, recover 22; 9%, 40° back | [murloc swim][wc] | [Squirtle back throw][sq] |
| Up throw | Head toss; juggle | release 12, recover 14; 6%, 90° | [Tiderunner claws][wc] | [Squirtle up throw][sq] |
| Down throw | Belly-press; tech chase | release 16, recover 22; 6%, 70°, set knockback 90 | [murloc swim][wc] | [Squirtle down throw][sq] |
| Get-up / ledge attack | Low sweep / forward claw | shared action timings; 6% / 6% | [Tiderunner claws][wc] | [Squirtle floor/ledge attacks][sq] |

Launch classes: 70/18 for pokes, 90/22 for launchers, 105/26 for finishers
(forward smash 112/26, back air 110/26),
90/22 for the spike, 55/50 for up throw and set knockback 90 for down throw. Smashes
use the shared charge (physics.md, "Smash charge"). Shared grab escape, pummel limit,
DI/SDI, techs and shield rules apply. No guaranteed repeat-grab or net loop
is designed: Ensnare's slow lowers top speeds only, so the victim keeps every
action, shield, jump and dodge.

## The duo

Grgl is a real fighter body: a full `Fighter` of character `murloc` with
`duo.role = partner`, in the lowest world slot no participant uses. He is
active in the world mask but not in the participant or input masks. Each frame
`match/partnerDrive.ts` writes his controls and attack command from rollback
state alone (the delay ring, the order and the separation driver), so he
needs no network row. Because he is a normal fighter, hurtboxes, knockback,
blast-zone KOs, ledges, shields, grabs, techs, the camera and the canonical
hash all cover him.

Grgl needs a free slot. Duels and three-player matches get him; when two
Murlocs share a three-slot match, the lower slot gets the partner. A
four-participant match (2v2 or a four-way free-for-all) plays the Murlocs as
Mrgl alone under the solo rules, and the HUD pip reads "no room". Grgl in
four-participant matches waits for body slots to split from participant slots.

Delay: Grgl replays Mrgl's packed controls and attack command from five
frames earlier (Melee's public figure is six). Stick values are quantised to
steps of 1/127 before packing. A copied press that Grgl cannot start on its
frame, because of hitstun, landing lag, hitlag or his own move, goes through
the shared attack buffer and nothing more, so the pair drifts apart in a
readable way. While Mrgl holds a grab, Grgl gets neutral controls and cheers.

### Grgl's rules

| Area | Rule |
|---|---|
| Body | Character `murloc` with `fighters/murloc/partner.ts` tuning: hurt capsules and hit regions ×0.9, weight 0.80 (Mrgl 0.88), the same run and air speeds; model scale 0.9 |
| Hits | Every Grgl hit deals ×0.75 damage with the same knockback formula. One hit per target per attack, per body |
| Knockback and KO | Grgl has his own percent. A blast zone KOs him. He also faints at 70%: a 30-frame knockdown, then he leaves. Neither costs a stock |
| Stock | Mrgl's stock is the only one. When Mrgl loses a stock, Grgl leaves at once and both respawn together, Grgl at 0% |
| Ledge | Normal catch and regrab rules. Grgl's hang occupies the ledge against foes. He gets ledge intangibility on the first catch of an airtime only |
| Shield | His own shield and shield HP. A break leaves him dizzy and easy to kill |
| Grab | Grgl grabs, pummels and throws from copied or ordered input, and can be grabbed and thrown. While either body holds a foe, the other body's strikes skip that foe |
| Separation | Beyond 260 units, or offstage while Mrgl stands on stage, Grgl's order becomes `separated`: he stops copying, returns toward Mrgl on the ground and recovers on his own through `chooseRecoveryInput` at full skill (no random draws), with his own up special. He re-syncs within 60 units once both bodies are actionable |
| Teams | Grgl copies Mrgl's team. Linked bodies never hit each other, whatever the team or friendly-fire setting |

### Solo Mrgl

While no live Grgl exists (fainted, KOed, left behind by a blast zone or no
room in the match), Mrgl deals ×0.9 damage on every hit, throws the solo net,
rides the solo Tidal Surf (220 units instead of 340), and has no orders, swap
or toss. Down B becomes the revive. Killing Grgl is the standard plan against
the Murlocs.

## Specials and orders

| Input | Duo (Grgl synced and within 120 units) | Solo, or Grgl far |
|---|---|---|
| Neutral B: Net | Both hold the net: radius 30 against the solo net's 18. A caught foe is rooted; mash-out takes 30 + damage/4 frames, capped at 75. The net breaks after 3 hits taken or at the 75-frame cap, whichever comes first. Shield it, jump it, or punish the throw at close range | The Huntsman's Ensnare: a net in a shallow arc that slows the first fighter it reaches (top speeds only, like Chill), no root. 10 mana; spawns f12 at x32/z40, 8/frame with a slight drop, life 40, radius 18; 4%; one live net; action ends f36; air landing 18 |
| Side B: Belly Slide | Mrgl slides and Grgl copies five frames later: two hits of 5%, one per body (Grgl's at ×0.75). Both stop at a raised shield, which punishes them | One slide: 10 mana; slides f8–22 at 11/frame, about 165 units; 5% contact f8–22; ends f32; air landing 20 |
| Up B: Tidal Surf | One steerable wave carries both bodies if Grgl is within 120 units on frame 6: 340 units with three 2% hits, then helpless | A Grgl beyond 120 units is left behind and casts his own solo surf (220 units), as a partner who misses the rope does. Solo Mrgl rises 220 units |
| Down B: "Mrglglgl!" | Grgl alive. Tap: order Hold. Tap again: Regroup. Hold B 20 frames: leader swap | Grgl dead: revive. A 50-frame cast, then Grgl surfaces beside Mrgl at 0%. Once per stock; a hit during the cast cancels it without spending it |
| Grab with Grgl in reach | With no foe in grab reach and Grgl actionable within 40 units, Mrgl lifts Grgl. The throw direction tosses him as a body projectile: 6%, one hit per target, about 300 units. He lands in Hold | Normal grab |
| Ultimate: Mrgllgll Swarm | A tide of murlocs rushes across the stage. Designed only: ultimates remain off under the current match rules | Same |

**Hold.** Grgl plants. He copies attacks, specials, shield and jumps in place,
but no walk, run or drift. He faces the nearest foe by x, with ties going to
Mrgl's facing, so a foe between the two meets a pincer net or crossed slides.
Regroup is Down B again, or happens on its own after 600 frames. A stance ring
on Grgl shows the order.

**Swap.** Holding Down B for 20 frames exchanges the two bodies' motion only:
position, velocity, grounded surface and jumps left. Identity, percent, shield
and stock stay with each role, so Mrgl and Grgl visibly trade places with a
splash on both. The 12-frame startup leaves both bodies vulnerable. Swap is
refused in hitstun, helpless, a grab or on the ledge, and its cooldown is 240
frames. Offstage, a swap can save Mrgl by sending Grgl to the fall: a real
trade.

**Toss.** The lift and throw above, on a 150-frame cooldown. A tossed Grgl
cannot be lifted again until he lands, and hits each target once per toss.

**Handoff.** After Mrgl's throw, Grgl's grab (copied or from Hold) may regrab
the victim, and the same holds the other way, within the lock table's limits.

Recovery: the duo's Tidal Surf reaches the ledge from below and beside it
after the double jump, spends the remaining aerial jump and ends helpless.
Walking off a ledge keeps the aerial jump. A separated Grgl recovers alone
with his own surf. The bodies are light and the solo surf is short, so
edge-guards on the surf's path, early kills and picking off a stray Grgl are
the Murlocs' weakness.

## Locks and infinites

One rule prevents each loop the pair could build:

| Risk | Rule that prevents it | Checked by |
|---|---|---|
| Wobbling (pummel plus partner hits in a grab) | A body's strikes skip a foe its linked body holds, and Grgl's controls go neutral during Mrgl's grab hold | Unit test, plus `bun wisp agency --attacker murloc --starter grab` |
| Handoff chain grab | `victim.handoffs` allows one handoff per chain. After the chain's second throw neither body can grab the victim for 90 frames, doubling to 180 if the chain repeats within 300 frames. The pummel count carries across the handoff | Unit test, plus the agency grab starter |
| Net loop | The net breaks at 3 hits or 75 frames. Grgl's hits never add frames. After a break the victim cannot be netted for 120 frames, and a second net on a rooted victim deals only its 3% | Unit test |
| Alternating jab or tilt lock from two bodies | `victim.duoChain` caps at 12 duo hits. Past the cap, duo hits deal damage with zero hitstun and knockback until the victim has been actionable for 20 frames. Hitstun from the two bodies never adds; it takes the maximum | Agency sweep, plus the soak's `lock-loop` detector |
| Jab-reset lock on a lying victim | The victim-side jab-reset limit in `sim/contacts.ts` is shared by both bodies, because it lives on the victim | Agency `--starter "jab reset"` |
| Shield lock | Shieldstun from the pair is capped at 30 consecutive frames. After that, duo hits on that shield deal shield damage only until the shield is free for 10 frames | Unit test |
| Toss spam | A 150-frame cooldown. A tossed Grgl cannot be lifted again until he lands, and hits each target once per toss | Unit test |
| Swap or revive stalling | Swap has a 240-frame cooldown and is refused in hitstun, helpless, a grab or on the ledge. Revive happens once per stock, so Grgl never stacks lives | Unit test |
| Desync for timer resets | Grgl never refreshes a timer on a victim (net, root, hitstun, grab escape, status). His contacts only add damage and their own knockback | Code rule in `partnerDrive.ts` and `sim/contacts.ts`, plus unit test |

## Presentation

The selection name is "Murlocs" and the HUD plate reads "Mrgl & Grgl", with a
Grgl pip showing his percent and a state glyph: synced, holding, separated,
down, revive ready or no room. The camera frames Grgl as any active fighter,
and a separated Grgl near a blast zone gets the off-screen indicator at
partner size.

## Home stage

Tomb of Sargeras (stage 7, smashcraft:docs/design/home-stages.md): TFT's
"Terror of the Tides" puts murlocs and the naga's mur'gul thralls on the
Broken Isles' shores around the tomb, and the stage's shallow tide floor and
waterfall are a murloc's coast. The Murlocs share it with the Warden. No new
stage or asset is needed.

## Position in the roster

The Murlocs are the cast's small rushdown and its only pair. Rifleman,
Kael'thas and Lich win from range; the Murlocs close with dash, Belly Slide
and the Net, and a held Grgl cuts off their retreat. Blademaster and Warden
also rush but with longer weapons; the Murlocs trade reach for the smallest
hurt bodies, the fastest normals and two bodies' worth of hits. Mountain
King, Forsaken Paladin, Pit Lord, Thrall and Cairne survive trades and
out-reach them; the Murlocs win by starting combos, pincering and losing
nothing on a whiff. Peon and Shadow Hunter fight around placed objects; the
Murlocs place a body instead. They die early, have a short solo recovery and
cannot shield-pressure past the 30-frame cap: Belly Slide stops at a shield
and is punished. Without Grgl, Mrgl is a weaker solo rushdown until he
revives him.

Launchers: down tilt and up tilt pop opponents for up air and forward air,
and a delayed Grgl lands the second hit; down throw starts a tech chase toward
Belly Slide, a dash attack or a handoff. The Net's root and the duo's
alternating hits are pressure tools, bounded by the lock table, not loops.

## CPU

Grgl is driven by the sim-side partner driver for humans and computers alike,
so the duo needs no second bot. Mrgl's computer keeps its shape: it runs in
and pokes with tilts, throws the Net at a retreating or far opponent, uses
Belly Slide to close a medium gap and recovers with Tidal Surf after its
double jump. It revives Grgl when the nearest foe is beyond 400 units. Expert
issues Hold when a foe stands between Mrgl and a ledge (the pincer), swaps
when Mrgl is offstage and Grgl stands on stage, and tosses Grgl as an
edge-guard. Basic uses none of the orders.

Opponents treat Grgl as a hittable target. Expert opponents prefer him when he
is separated by more than 200 units or offstage, the standard anti-pair plan.

[wc]: https://wowpedia.fandom.com/wiki/Murloc_(Warcraft_III)
[sq]: https://www.ssbwiki.com/Squirtle_(SSBU)#Moveset

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). A small, light rushdown pair: Mrgl closes with dash attacks, Belly Slides and the Net while Grgl doubles the hits, holds a flank or recovers alone.

```balance-profile
fighter: murloc
archetype: rushdown
aerials: nair 15-40, fair 15-40, bair 10-35, uair 10-35, dair 0-20
air-share: 25-55
approach: 55-85
ranged: 0-20
specials: neutral 3-15, side 3-15, up 0-8, down 0-8
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: murloc
path: execution
basic-moves: forward-tilt,down-tilt,neutral-air
```

Basic gameplan: Use quick pokes and simple neutral aerials. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special, and Grgl only copies: no Hold, swap or toss.

Expert gameplan: Link fast movement, the duo Net, Hold pincers, swaps, tosses and handoffs, aerial pressure and slippery recovery routes. Use the full authored kit and gameplan at the same CPU skill.


## Balance record

This record predates the duo rework: Tidal Rush is now Belly Slide and Ensnare the solo Net.

First seeded Wren Expert field (e5709fe6, 400 a pair against all 21
fighters): 27%. Tidal Rush was a fifth of his moves and was punished on
shields, and his weight lost stocks early. One tuning pass: weight 0.80 to
0.94, one more damage on every tilt, smash and aerial, forward smash growth
105 to 112 and back air 105 to 110, Tidal Rush ends on f32 instead of f40,
and the computer no longer approaches with it.
After (dc96043e, same field and seeds): 46% over 8568 matches; balance score
23.7 to 9.7, with the profile misses (back air 40%, up air 5%, Ensnare 19%,
Tidal Rush 20%) left for later tuning.

## Signature strong/weak move (#389)

Neutral air, split by timing: strong hit clean, frames 5-6, 8%; weak hit late, frames 7-10, 5.6%. A flailing spin strongest at its first slap; the rest is a scrappy weak wall.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).
