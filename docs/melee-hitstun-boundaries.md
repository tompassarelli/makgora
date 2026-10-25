# Hitstun

`ordinaryHitstunFrames` in smashcraft:ts/src/game/sim/knockback.ts gives a
launched fighter knockback × 0.4 frames of hitstun, as SmashWiki "Hitstun"
states for Melee. Smashcraft rounds the product to binary32, truncates it and
gives at least one frame; the page states neither rounding nor a minimum.

`damageLevelForKnockback` picks the damage reaction (weak, medium, strong,
tumble) from the same scaled value. Its thresholds are Smashcraft's own, held
in knockback.ts; no public page states Melee's.
