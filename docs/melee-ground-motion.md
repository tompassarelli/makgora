# Flat-ground motion arithmetic

The shared simulation adds a grounded fighter's horizontal channels to its
position in a fixed order, self-movement, then launch, then attacker recoil,
rounding each sum to binary32 in Melee units. It also rounds the digital
defender decrement, the grounded recoil friction product and the recoil
decrement to binary32. World coordinates use six Warcraft units per Melee unit.
The order and rounding are Smashcraft's determinism rules; no public page
states Melee's.

A grounded shield contact replaces the defender's previous self ground speed:
the simulation keeps its pushback in a separate field and clears the old self
velocity when installing it, so earlier movement is not added again. The
pushback's size follows SmashWiki "Shield" ((damage × 0.09 + 0.4) × shield,
at most 2). Stale moves stay omitted (smashcraft:docs/gameplay-design.md).

The native profile is documented in smashcraft:docs/native-physics-precision.md.
Ground dodge travel keeps its separately modeled path
(smashcraft:references/melee-frame-data/libmelee.jsonl, `locomotion_x`).
