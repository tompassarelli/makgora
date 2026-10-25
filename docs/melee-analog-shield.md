# Analog shield pressure

Analog shield pressure travels from the NetworkInput trigger bytes through
InputSnapshot, fighter state, replay snapshots and frame comparisons. A digital
click supplies full strength. With no digital click, bytes 0–76 do not request
guard and byte 77 is the first active pressure. Pressure below that threshold
keeps the previous strength through the forced minimum hold. Shieldstun and
hitlag keep the contact's strength.

One pressure interpolation drives guard drain, shield damage, stun, defender
pushback and relative visual size, following the light-shield formulas of
SmashWiki "Shield": the trigger reading n runs from 43 to 140, a Z shield is
s = 0.35, and with a the lightness the shield's size is
(HP × a / 60) × 0.85 + 0.15, damage taken a + 0.7, depletion (a + 0.1) × 0.14,
shieldstun (damage × (a + 0.3) × 1.5 + 2) × 200/201, defender pushback
(damage × (a + 0.09) + 0.4) × shield and attacker pushback damage × a + 0.02.
Authored Warcraft shield scale and fighter parameters are unchanged.

Still open: geometric shield coverage, pokes and tilt, ordinary melee
powershield contacts, physical analog controller capture and native Warcraft
verification. Projectile powershield timing and reflection are in
smashcraft:docs/melee-powershield.md. Melee contacts still use the
whole-fighter guard rule; visual size does not establish collision coverage.
Keyboard producer rows use digital guard and full trigger bytes. A future
physical analog producer must keep the digital-click bits and pressure bytes
independent; setting a digital held bit for every nonzero pressure forces full
shielding.
