# Blademaster

The kit is in [roster](roster.md#blademaster) and [kit review 1](kit-review-1.md); this page holds the rules that need a place of their own.

## Mirror Image (side B)

- Facing: the side-B input sets it, turning him first when it points behind him.
- Step: he steps one length (1.0H over frames 12–15) back, opposite his facing, so side-B toward his facing keeps that facing and moves him back, and side-B away turns him to the pressed side and steps him back from it. Simplified from the stick-aimed step at Tom's playtest request (2026-10-28); a stick held after the press changes nothing.
- Unchanged: the image stays where he stood on frame 12, the air step is sideways only and once per airtime, and the action ends on frame 28.
- Computer: its recovery presses side-B away from the stage, so he faces out and steps back in.

## Bladestorm (ultimate)

- Spell immunity (Warcraft III's Bladestorm grants magic immunity; added at Tom's playtest request, 2026-10-28): from f1 through the f75 finish (f1–78) opponents' specials and ultimates pass through him. They deal no damage, knockback or hitlag and apply no status (sleep, poison, roots, Doom, terrify, soak, stun), and a projectile flies on instead of being spent on him. The 30-frame dizzy after it leaves him open.
- Normals, aerials, tilts, smashes, dash attacks, throws and grabs still hit him as before.
- Mechanism: the move's `spellImmune` window. A hit resolves as a spell through `contactIsSpell` (the check Banish's extra damage uses), so one flag in `collectDamageContact` covers every status and every move without a per-move list; the places that choose a target first (melee special regions, projectile flight, the Rifleman bear and trap, companion bites, command grabs) skip a spell-immune target so nothing registers or is consumed.
- Cue: each pass bumps `visuals.spellPass`; the presentation plays the stock Spell Shield flash (`SpellShieldCaster`, the resist flash terrify uses) on him, restarting only after the last one ends.
- Statuses already on him when it starts stay and tick.
