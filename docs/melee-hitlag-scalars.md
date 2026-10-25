# Hitlag

`victimHitlagFrames` in smashcraft:ts/src/game/sim/knockback.ts gives a
victim's hitlag as SmashWiki "Hitlag" states it for Melee:
⌊⌊⌊d/3 + 3⌋ × e⌋ × c⌋ frames, where d is the hit's damage, e is 1.5 on an
electric hit and c is two thirds while crouch cancelling, capped at 20 frames.

Smashcraft truncates the damage to an integer first and rounds each product to
binary32 before truncating it, so the same inputs give the same frames on every
client. The page does not state a zero-damage rule; Smashcraft gives a hit
without damage no hitlag.
