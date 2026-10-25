# Tech input timing

SmashWiki "Tech" states Melee's rule: a fighter techs if the shield button was
pressed within 20 frames before contact, and after a press it cannot tech for
40 frames, counted from the end of hitlag.

smashcraft:ts/src/game/sim/geometry/techInput.ts keeps the current press's age
and the interval to the press before it. Both advance on every input frame,
hitlag included, and a press made during hitlag counts from that frame. A
contact techs while the current press is under 20 frames old and the press
before it was at least 40 frames earlier, so the window is derived from the
ages rather than from a countdown paused by hitlag. Reset, stock loss, replay
copy, replay comparison and the replay checksum include this state.
