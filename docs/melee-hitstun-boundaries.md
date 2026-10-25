# Hitstun

`ordinaryHitstunFrames` in smashcraft:ts/src/game/sim/knockback.ts gives a
launched fighter knockback × `HITSTUN_FRAMES_PER_KNOCKBACK` frames of
hitstun, 0.4 as SmashWiki "Hitstun" states for Melee. Smashcraft rounds the
product to binary32, truncates it and gives at least one frame; the page
states neither rounding nor a minimum. The constant is the combo-ease knob
(#300, #301): raising it lengthens every link without moving the reactions
below.

`damageLevelForKnockback` picks the damage reaction (weak, medium, strong,
tumble) from the knockback itself: 25, 52.5 and `TUMBLE_KNOCKBACK` 80, the
knockback whose Melee hitstun is 10, 21 and 32 frames. Tumble at 80 is
SmashWiki "Tumble"; the medium and strong thresholds are Smashcraft's own,
since no public page states Melee's.
