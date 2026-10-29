# The Butcher

The Butcher is a heavy ranged grappler: a stitched Scourge abomination who
flings a hook across the stage, reels the foe into his hands and throws them.
Tom asked for him (2026-10-28); his spec is the Butcher section of
smashcraft:docs/design/roster-next.md, and his name was decided on
2026-10-29 (the Butcher everywhere, code slug `butcher`, character code 31).
His kit takes ideas only from the hero-arena butcher; no name, model, sound
or text from another game appears. All combat values are original,
provisional Smashcraft tuning. The Melee anchor is Donkey Kong's role, a heavy
grappler with strong throws who is combo food, not his numbers.

## Body and model

- **Model.** The stock Classic Abomination (`units\undead\Abomination\Abomination.mdl`),
  no import. It has eight playable clips: three stands, walk, two attacks,
  Stand Channel and death. Its bones are the standard Classic biped names
  (`Bone_Root` to `Bone_Hand_R`), so his rig maps like any biped; the cleaver
  rides `Bone_Hand_R` and the hook chain `Bone_Hand_L`.
- **Authored clips.** `tools/animations/butcher-clips.ts` appends sixteen
  clips to the stock model, timed from his kit: the smashes and their charge
  hold, up tilt, dash attack, every aerial, Meat Hook, Butcher's Charge and
  Dismember. Up moves hold the cleaver overhead through their active frames,
  back air lashes the cleaver straight behind him at body height with the
  back leg kicking out, the down smash spreads both weapons low to both
  sides, the dash attack is a belly flop and the down air a seat drop, Meat
  Hook draws the hook back low and throws it level, and the Charge leads with
  his shoulder in an upright running stride, both weapons trailing, through
  its travel. A contact
  pose is reached one frame before the first active frame, because hitstop
  freezes the attacker's clip at the first contact and a pose keyed on that
  frame is caught halfway there. The rest stay on the stock attacks.
- **Size.** Weight 116, inside Melee's weight spread; Flesh Heap carries him
  past it during a stock. The roster's widest hurt capsule (1.85 times the
  reference width, 1.30 of its height), slow run, low air speed, traction
  0.08. His shield sits at height 68 with radius 150.
- **Voice.** The Abomination unit soundset.

## Kit

Normals, grabs and throws follow roster-next's frames and damage. The forward
smash is his signature: the cleaver's edge carves for 20% and kills, the haft
clubs for 13%. The down air spikes on its clean hit. The back throw is his
kill throw (12%); the down throw sets a fixed knockback for tech chases. His
grab has the longest standing reach in the roster.

Specials:

- **Meat Hook** (neutral). On frame 14 he flings the hook 420 units straight
  ahead over 16 frames. A body it reaches is caught: the hook latches and
  reels the foe to his hand over 14 frames into his grab hold, where any
  throw or pummel follows and the shared mash escape applies. A raised shield
  stops it and takes an 8% projectile hit; a reflector sends it back as an
  ordinary hit. A whiff leaves 40 frames of recovery (70 in all). In the air
  the hook only strikes (8%), since he cannot hold a foe while falling. The
  latch and the reel (`grab.reel`) are rollback state.
- **Butcher's Charge** (side). A belly-led rush on frames 8–20 that stops at
  bodies and shields, with armour over the same frames against hits up to 5%
  plus 1% per Flesh Heap stack, and a bump for 11%. 44 frames.
- **Hook Swing** (up). The hook flies up and ahead. If a free ledge lies
  inside its reach on frames 6–20, the move ends and he is reeled to the
  ledge over 12 frames into ledge hang (`LedgeState.tether`, rollback state);
  a hit during the reel knocks him off. Otherwise he rises 1.4 reference
  heights with a 6% hit and falls helpless. Once per airtime.
- **Rot** (down). A 10-frame toggle. While it runs, a poison cloud around him
  deals 1% every 10 frames to foes within 90 units of his body and slows
  their ground speed by 15%, and costs him 1% every 20 frames. It goes off
  with his stock. The on state and its clock are rollback state.
- **Flesh Heap** (passive). Each KO he scores and each throw he lands adds a
  stack, up to 5; each adds 3% weight and 1% to Butcher's Charge's armour.
  He loses every stack with a stock. A KO goes to the fighter who last
  damaged the falling one. Flesh Heap is the one passive in the roster: the
  roster's no-passives rule (Tom, 9 October 2026) predates the Butcher plan,
  which names Flesh Heap as part of his kit.
- **Dismember** (ultimate). After a 20-frame cleaver raise he lunges on
  frames 21–28. A raised shield stops the lunge, and intangible foes slip it.
  A caught foe is pinned for 90 frames with no mash escape and takes 4% every
  15 frames (24% in all) while he heals the same amount, then is shoved off.
  A whiff ends at frame 78.

The cargo carry in roster-next is not built: Peon already owns the roster's
carry, and a carry would turn the Butcher's forward throw into a hoist.

His home stage is Naxxramas (4), the Scourge's abomination workshop. His
Classic route ends at the Lich King.

## Play-style profile

Tom-tunable draft (2026-10-29; smashcraft:docs/design/balance.md,
"Play-style profiles"). He wins neutral from range with the hook, converts
through throws and smashes, and is open to combos the rest of the time.

```balance-profile
fighter: butcher
archetype: grappler
aerials: nair 20-45, fair 10-35, bair 15-40, uair 5-30, dair 0-20
air-share: 10-35
approach: 25-55
ranged: 5-30
specials: neutral 8-25, side 3-15, up 0-8, down 2-12
```

## Balance

The first field (main 633758b596, balance run 40811020390 on its probe
branch, Wren Expert both sides, 408 matches a pair, 11,016 matches) put him at
67% against the field, above the 40–60% band. Measured shares against the
profile above:

- Archetype: grappler.
- Aerials (neutral/forward/back/up/down): 21%/15%/42%/6%/15% of his aerials;
  back air sits over its 15–40% target.
- Air share of normals: 6% (target 10–35%).
- Approach share of movement: 82% (target 25–55%).
- Ranged share of damage: 4% (target 5–30%).
- Specials (neutral/side/up/down, share of moves started): 20%/15%/8%/0%.
- Damage by move: Butcher's Charge 24%, grab 16%, dash attack 12%, down tilt
  11%. Stocks by move: forward smash 34%, grab 21%, dash attack 10%.

The retune follows the roster retune rule (balance.md, "Roster retune"): 17
points over 50% at about 0.6% of damage a point. Every damage he deals through
his hit table is scaled ×0.898 and its knockback growth ×1.112, so kill
percents stay near their baseline; the down smash keeps its damage, as its
growth is the roster's fixed 40. The move values above are the authored rows;
the live value is the row times the factor (`BALANCE_DAMAGE` and
`BALANCE_GROWTH` in his moves.ts). Rot, Dismember's drain and the pummel are
not scaled.

The field after the retune (main f84192f62a, balance run 40818368946 on its
probe branch, same field, 11,424 matches) puts him at 58%, inside the 40–60%
band. His shares barely moved: aerials 22%/15%/42%/6%/15%, air share 6%,
approach 82%, ranged 4%, specials 20%/15%/8%/0%; Butcher's Charge is still his
top damage share (24%) and forward smash his top kill move (37%). The spam
probe found a degenerate line: Butcher's Charge used alone wins 92% of 1,344
matches against Expert, over the gate's 45% spam limit, so the charge's armour
and bump are the next tuning target.

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: butcher
path: decision
basic-moves: forward-tilt,grab,forward-smash,neutral-special
```

Basic gameplan: hook from range, poke with the forward tilt, grab up close
and throw. It uses one approach and shield.

Expert gameplan: space just outside the foe's reach so the hook catches
their approach, tech-chase the down throw, keep Rot on while the foe is
cornered, and save Dismember for a foe who has to land. It uses the full
authored kit and gameplan at the same CPU skill.
