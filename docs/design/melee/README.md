# Melee case study

A descriptive study of Super Smash Bros. Melee (NTSC 1.02) for what it is: its
movement, its attacks and defences, how its cast trades weight against speed
against frame data, the techniques players found in it, and why it came out
this way. It states no preference. What Smashcraft takes from Melee, changes or
leaves out is decided only in [gameplay design decisions](../../gameplay-design.md).

- [Movement](movement.md): ground speeds and the initial dash, jumps, falling,
  air control, wavedashes and wavelands, rolls and spot dodges.
- [Attacks](attacks.md): startup, ending lag, reach and safety on shield across
  the cast; out-of-shield punishes; aerials on shield by timing, spacing and drift.
- [Aerials on shield](aerials-on-shield.md): the shieldstun formula, hitlag on
  shield, landing lag and fast fall, out-of-shield options per fighter, and how
  timing, strength, spacing and side set an aerial's safety, with worked examples.
- [Defence](defense.md): shield, dodges, influence on knockback, techs, ledges and grabs.
- [Archetypes](archetypes.md): weight, speed and frame data across the cast.
- [Techniques and jank](techniques.md): emergent techniques and the engine
  mechanics that cause them, including wobbling, chain grabs and SDI teleports.
- [Why](why.md): what the designer and the community have said about the game's shape.
- [Hit and movement events](hit-effects.md): the effect and sound each hit, element,
  strength, footstep and landing plays.

## Where the numbers come from

The numbers in these pages are frozen gameplay facts, kept as our own design
reference. Per-move frame data comes from
smashcraft:references/melee-frame-data/: meleeframedata.com's database
(startup, active frames, interruptible frame, total, shieldstun, damage,
landing lag) and libmelee's recorded hitbox positions and dodge travel. Its
README records provenance and the meaning and traps of every field. Fighter
attributes (speeds, gravity, jump heights, weights) are the public values that
SmashWiki and the frame-data sites list. The generator that once filled these
pages from a private reference roster is retired; edit the values by hand,
citing a public source (README "Principles").

## Conventions

- Distances are Melee units, speeds Melee units per frame, time in frames at
  60 per second. A fighter's position is the centre of its feet.
- Frames are numbered from 1, the first frame of the action, as
  meleeframedata.com numbers them. Hitlag is excluded: both fighters freeze for
  the same frames, so it moves no advantage.
- "On shield" is the attacker's frame advantage: the frame the defender can act
  out of shieldstun minus the frame the attacker can act. Negative means the
  defender acts first. The formulas are in [Attacks](attacks.md#reading-the-numbers).
- Simulated movement follows the rules named beside each table, on
  flat ground with the stick fully held. It is arithmetic on the recorded
  parameters, not a recorded game trace.

## Smashcraft decisions

The questions raised by Melee's wavedash, dash dancing, shield safety,
out-of-shield actions, ledges, crouch cancelling and ASDI are resolved in
[shared mechanic defaults](../../gameplay-design.md#shared-mechanic-defaults).
Throw-to-regrab chains use the adopted
[throw regrab rule](../../gameplay-design.md#throw-regrabs), and roster physics
and trade-offs use the [expansion defaults](../../gameplay-design.md#expansion-roster-defaults).
The case study's Melee values remain reference facts, not a template for fighters.
