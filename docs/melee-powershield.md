# Powershield and projectile reflection

SmashWiki "Powershield" states Melee's rule: a shield raised within its first 4
frames of a physical hit powershields it, and within its first 2 frames of a
projectile reflects it. A powershield removes all shield damage and pushes the
defender back further than a full shield; a physical hit keeps the ordinary
hitlag and shieldstun, a reflected projectile deals half its damage, and the
shield can be dropped 1 frame after a powershield instead of 15.

## Input and timers

The shared shield input records the trigger's nonzero-to-press timing in
deterministic fighter state. A full digital trigger press inside the 2-frame
window starts the reflector, and a separate 4-frame timer covers melee
contacts. The input age and both timers are copied, compared and reset by
replay with the other fighter state; the input row keeps its press edge and
trigger activity.

During the melee window a blocked contact keeps shield health and uses the
unmodified defender pushback speed before the existing cap. Hitlag and attacker
recoil keep the ordinary contact path. Success emits one shield-success flash
through the impact journal.

## Shield and reflector geometry

Smashcraft fighters use an authored shield circle centred at local offset
`(0, 45)` with base radius `60` world units, scaled by shield health and
pressure (smashcraft:docs/melee-analog-shield.md). These are Smashcraft tuning
values, not Melee character geometry. While the reflector is up, the whole
shield circle reflects (#118): with a smaller reflector circle checked in the
same swept step, a projectile met the bubble's outer ring a frame before the
reflector and was blocked, and projectiles at height 75 passed above the
reflector of a fully pressed shield, so a timed press rarely reflected. The
reflector state is sampled once per frame, so every projectile meeting the
shield on a reflecting frame, such as a Multishot volley, reflects.

Projectile contact selection checks the shield circle before the body-contact
predicate, after the reflector opportunity. Shield-only intersections block a
projectile; body intersections outside the shield apply body damage despite
held guard. The selected blocked status is kept in the contact batch rather
than inferred again from held guard. The swept path is a point path for both
shield and reflector, through one shared capsule/circle intersection function
with binary32 endpoint differences, a rounded squared-length sum, fused
projection, interpolation and distance sum, a rounded square root and the
joint-radius conversion's rounded multiply and divide. Interpolation starts
from the newest capsule endpoint. Melee attacks still test an authored
rectangle against the victim origin and count every eligible contact as
blocked while shielding; shield coverage and exposed-body pokes are missing.

## Departures from Melee

Smashcraft keeps the 4-frame counter, its consumption while guard stays held
and the cleared minimum hold, but changes the reward (#102,
smashcraft:docs/gameplay-design.md, "Powershield and parry"): a perfect
contact causes no shieldstun, dropping the shield while the counter is positive
has no release lag at all rather than admitting only attacks, and an option
pressed during the contact's hitlag is buffered into its first actionable
frame. A perfect contact or a reflection spends both windows, and a fresh
press during shieldstun opens a 2-frame red parry window that Melee lacks.
Beginning an attack clears the guard clocks and drop recovery. Replay copies
and compares the counter, the red parry try and the buffered option.
