# Hitlag scalar and cap observations

The 52 original NTSC 1.02 observations in
the recorded design targets cover integer
attack powers 1–90, ordinary/electric multipliers, and ordinary/crouching action
states. They include durations on both sides of the 20-frame cap.

The complete original scalar routine at – executes unchanged
under QEMU PPC750 using the privately loaded retail common table. Its result
then enters the original positive-duration cap block at . A return
at  ends that block before hitlag initialization side effects. The
corpus retains uncapped and capped values separately, so the fixture does not
invent the cap by applying it to the observations afterward.

The recorded constants are damage coefficient 0.3333333432674408, base 3,
crouch multiplier 0.6666666865348816, electric multiplier 1.5, and cap 20.
For these inputs the production formula's staged integer truncations already
agree with the original outputs; this observation does not establish a defect
requiring a formula repair.

The multipliers are our own design targets, set from public frame data
(SmashWiki's Hitlag page).

The caller supplies integer power, electric multiplier and action state.
These observations do not prove their selection, zero-damage dispatch, complete
contact initialization, release timing, GameCube hardware, or Warcraft runtime.
The emitted-Lua fixture calls the production victimHitlagFrames function; it
does not substitute a reference formula.

Observed check: HITLAG_SCALARS_EXACT_PASS for all 52 cases, alongside the twelve
existing precision groups, with zero compiler errors or warnings. No production
formula or normal test changed. Native execution of this group remains open.
