# Kael’thas Sunstrider

**Personality: the prince who plays where you will be.** Kael is the Warcraft
III Blood Mage and nothing else: a fire missile, a pillar of flame, a curse
that turns the body ethereal, a mana siphon and a phoenix that is reborn from
an egg. He wins by deciding, not by executing. Every one of his tools asks a
question about the next half second: where will they be 35 frames from now,
is this the moment to Banish, will they hold that shield or jump it? Jaina
owns space with a delayed Blizzard and an elemental; Medivh is somewhere
else. Kael draws a rune where the opponent is going and dares them to be
there. He beats heavies and predictable recoveries. He loses to rushdown
that reaches him before the pillar does: his dash is slow, his
out-of-shield options are weak except neutral air, and his body is light.

Tom set the direction on 2026-10-26 (#360), superseding the kit core of #381:
the kit is the Warcraft III Blood Mage kit only; skill expression is
decisions rather than inputs; there are no cooldowns, because a pillar on
screen already tells both players why another cannot come; his down air does
not spike and his up smash is not a pillar. The lead's decisions on #360
(same day) bind the meter, the ultimate and the roster-wide Banish rule.
Every value below is an original provisional Smashcraft value; Smash, Rivals
and Street Fighter references explain roles, not copied hitboxes or
animation.

## Research and body

The [Warcraft III Blood Mage][wc] casts Flame Strike (a pillar of fire that
burns an area), Banish (the target turns ethereal: unable to make physical
attacks, open to magic, still able to cast), Siphon Mana (drains an enemy's
mana to the caster) and, as his ultimate, summons a Phoenix with a burning
aura that falls as an egg and is reborn. [Kael’thas][kael] is the Blood Mage
of the campaign, Prince of Quel’Thalas and heir of the Sunstrider phoenix.

His body is **light and floaty with good air drift and a slow dash**, a
Mewtwo-class build ([Mewtwo][mw]) with a slower ground game. A slow dash is
the price of the pillar: he must place a threat before the opponent arrives,
because he cannot run away from one who already has. His three orbiting
arcane spheres are his reach; his casting hand is part of his hurt body and
spell fire is not. Exact weight, run, air speed and size come from the
normals and body box and live in `bun wisp ledger`.

## The visual rule

**Every special is fire, except Banish; every normal is arcane.** Normals are
drawn with the three spheres that orbit him, his stock green Blood Elf orbs
(Tom chose these again on 2026-10-30 over a violet Void Walker missile);
specials are red and gold Warcraft fire. Banish is the one exception: Tom
asked on 2026-10-30 for it to be a green swirling beam from an outstretched
hand, matching the Warcraft III Banish icon, so the curse reads as a different
school from his fire. The stock swirls drew cyan-green in a native capture
against the icon's green, so they are tinted (150, 255, 70), cutting blue and
red (Tom, 2026-10-30). "On fire" still means "hits a banished fighter", so both
players can read the
Banish duel from colour alone, at match size.

## Gameplan

1. **Steer the Pyroblast.** Pyroblast is one slow, heavy fireball he steers
   while he stands rooted. It kills off the side at high percent and cracks
   shields, but every frame he steers he cannot defend himself, a hit on him
   puts it out, and a miss leaves him open for a long time. The opponent
   chooses to outrun it, shield it and pay for it, or rush the rooted caster.
2. **Fly the orb where they will be.** Flame Strike sends a fire orb forward
   that starts slow and gathers speed while he holds, and the stick climbs or
   sinks it. Release, touching a fighter or shield, the floor, or the 50-frame
   timeout erupts the pillar where the orb is; a tap erupts it at his hand.
   The opponent reads the orb in flight. The
   burst carries the knockback and heavy shield damage; the lingering burn
   is flinchless chip that zones without comboing. One pillar at a time;
   recasting replaces it.
3. **Siphon the shield.** A shield held against the pillar is answered by
   Siphon Mana, his long, slow tether grab. It whiffs badly if read.
4. **Banish the duel.** Banish takes away the opponent's normals, grabs and
   shield. Now only spells reach them, and Kael's spells are all of his
   fire. The banished player keeps movement and their own specials, so the
   duel is spell against spell.
5. **Guard the ledge with fire.** Flame Strike casts in the air and offstage,
   so the rune can sit on the ledge or under a recovery line. Predictable
   recoveries die to it.

The opponent's guess at mid range: outrun the Pyroblast or rush the caster; shield
the rune and get siphoned; jump the rune and meet back air or a neutral air;
dash in early and beat him before the fire arrives.

## Specials

| Input | What it does and the decision | Counterplay | Prior art |
|---|---|---|---|
| Neutral: **Pyroblast** | About 21 frames of windup gathering fire in his hands, then one slow heavy fireball he steers with the stick for up to 80 frames (it was 60), turning about 6 degrees a frame (PK Thunder's sharp turns), while he stands rooted on the ground or sinks slowly in the air. Steered back into him after 16 frames of flight, it launches him along its heading for 36 frames at 11 units a frame, intangible for the first 18, with no damage, and leaves him helpless if he ends in the air (PK Thunder 2's self-hit). Special or shield lets it go: it flies straight about 14 frames and fizzles. 13%, launches at 40 degrees and kills a Warden off the side from centre stage at about 170%; 13 shield damage. One at a time, reflectable. Connecting leaves 21 frames of recovery; a miss (timed out, let go, reflected) leaves 46. | Outrun it, rush and hit Kael while he steers (that puts it out), or shield it and punish the long recovery; reflect it back at him. | [Ness's PK Thunder][pkthunder] (a steered projectile with a rooted caster) |
| Side: **Flame Strike** | Hold to fly a fire orb: it leaves his hand on frame 16 after a held cast pose (the rune left on frame 8; this orb left on frame 6 until the 2026-10-30 playtest, so point-blank it erupts no sooner than frame 16) at 5 a frame, gains 0.375 a frame up to 12 (the rune slid 8), and the stick climbs or sinks it up to 5 a frame. Release, touching a fighter or shield, the floor, or 50 frames in the air erupts the pillar at the orb. The pillar stands 0.6 s (36 frames: a 6-frame burst, a 30-frame burn) and its column plays out inside that window. The burst deals 15% and launches; the burn is flinchless chip, 2% every 8 frames. The cast ends on frame 34 and leaves 23 frames of landing lag in the air. One pillar, a recast replaces it, no cooldown. Castable in the air and offstage: his edgeguard. | Dodge or shield the orb, roll past the pillar, or punish the cast from outside its line; a shield survives the burst but invites the grab. | [Ness's PK Flash][pkflash] (a placed delayed burst); [Robin's Arcfire][arcfire] (a lingering pillar that zones) |
| Down: **Banish** | He sticks out one hand and, after a 20-frame delay, a green swirling beam shoots straight ahead from it, three of his body lengths long and live for 6 frames; the beam is stock Banish swirls (`BanishTarget`) spread along the live region from his hand, and he casts with one hand out and the other arm down; it is a hit region along the beam, not a projectile, and deals no damage. A whiff leaves 30 frames of recovery, and 22 frames of landing lag in the air. A fighter it touches turns ethereal for 60 frames (the duration sweep kept 60: over 12,240 matches a duration Kael won 49.0% at 45 frames, 49.7% at 60 and 50.2% at 90, a spread inside the field's noise, so the middle value stays). They lose normals, grabs and shield, but still move, jump, air dodge and cast their specials. Only spells reach them, at +30%. | Space outside it or shield it; banished, keep away and fight with your specials; his spheres cannot touch you. | [Mewtwo's Disable][disable] (a status that removes options) |
| Up: **Phoenix** | He becomes the phoenix and steers with momentum, not snapping. The flames burn down as the visible timer; when they are gone he falls helpless. Hit mid-flight, he becomes an egg that falls fast and helpless and hatches on landing. The phoenix body has a weak contact hitbox. | Hit the flight to make the egg, then cover where it lands; the burning-down flames show how far he can still go. | [Fox's Fire Fox][firefox] (a committed fire recovery), [Peach's Parasol][parasol] (steerable float) |
| Grab: **Siphon Mana** | A long, slow tether grab, punishable on whiff, with an ordinary pummel; no heal, no meter drain. His answer to a shield held against Flame Strike. | Read it and jump or spot dodge; punish the whiff. | [Samus's grapple][grapple] (long tether grab with whiff lag) |

**Banish, roster-wide.** A contact is a *spell* when it comes from a special,
an ultimate, or a projectile, placement or companion a special spawned.
Everything else is an *attack*: normals, grabs, pummels, throws and items. A
banished fighter cannot be hit by attacks or taken by normal grabs (command
grabs from specials still take them), loses normals, grabs and shield, and
takes 30% more from every fighter's spells, not only Kael's. Banish does not
slow. Kael's own spheres pass through the banished body, so Banish never
starts a normal combo; it starts a fire one.

**Phoenix and the egg.** A clean flight reaches the ledge from a long
recovery band; the cost is that the flight is a target. An edge-guarder who
hits the phoenix wins the egg: it drops fast and helpless and must land on
stage to hatch. He can catch the ledge during the flight, and walking off
keeps the aerial jump.

The flight hovers 12 frames, reading an eight-way launch direction, then
burns for 40 frames: it starts at 9 units a frame and gains 0.5 a frame up
to 14.5, and the stick turns its heading at most 5° a frame while a neutral
stick holds the line. Straight up he rises about 600 units and level reach
is about 684 (the Fire Fox version: 612 and 691); a jump and then Phoenix
held up return from 840 below the ledge, where the long band asks 780. The
body hits 4% at 55° once per target. The egg falls at 24 a frame against a
20.4 fast fall, takes no input, cannot catch the ledge and hatches through
30 frames of landing lag. The computer steers up beside the ledge, then in
over the stage.

**Meter.** Kael keeps the universal ultimate meter (strong + B is the ordinary
special, strong + A the smashes, #186). Nothing of his feeds or drains meter.

**Ultimate: Summon Phoenix.** The Blood Mage's Warcraft III ultimate: a
phoenix companion with a burning aura that fights beside him, reusing the
summoned-phoenix data. It is a special, so it is fire and it hits banished
fighters. See [ultimates.md](ultimates.md).

## Normals

Normals are arcane and are roles first. Frames, damage and angles are set by
the normals and body box and checked by `bun wisp ledger --check` and
`bun wisp shapes --check`; this table names what each move is for.

| Input | Role |
|---|---|
| Jab | A quick sphere flick, about frame 4: his fastest touch. |
| Forward tilt | A long disjointed sphere poke for spacing. |
| Up tilt | A sphere arc overhead: grounded anti-air. |
| Down tilt | A slow, long, low skim along the floor. |
| Dash attack | A committed lunge, deliberately unsafe on shield. |
| Forward smash | An arcane palm blast, his grounded kill move, with the strong/weak split below. |
| Up smash | A sphere burst upward for anti-air kills; no pillar. |
| Down smash | A two-sided low sweep for ledge and roll coverage. |
| Neutral air | Three fast orbiting spheres: his panic button and only good out-of-shield option. |
| Forward air | A wide disjointed spacing arc. |
| Back air | His aerial kill move. |
| Up air | A sphere juggle. |
| Down air | A sphere slam that pops opponents up: a landing tool, not a spike. |
| Down throw | A combo angle into up air. |
| Back throw | The kill throw near the ledge. |
| Forward / up throw | Spacing and reset; they set up the rune rather than kill. |

## Cuts and why

- **Pyroblast and Flame Strike redesign** (Tom's playtest, 2026-10-30).
  Pyroblast now steers for 80 frames instead of 60, a third longer, and can
  strike Kael himself like Ness's PK Thunder 2; Flame Strike's ground rune is
  replaced by a steerable fire orb like Zelda's Din's Fire, with a startup 25%
  shorter (frame 6 for 8) and an orb faster than the rune. The playtest
  of the same day found frame 6 as fast as Fox's shine at close range, so the
  orb now leaves on frame 16 with the cast still ending on frame 34 and the air
  landing lag 23 (a first version ended it on frame 44 for 30 and, with no
  balance run behind it, left Kael at 38% of 12,240 expert matches in run
  41177297393 on f3fb969e2d); the orb's flight, steering and pillar are
  unchanged. The numbers
  SmashWiki gives for the Melee originals are durations, not speeds: PK Thunder
  runs frames 20 to 138; PK Thunder 2's self-hit lasts frames 1 to 36 (a clean
  hit 1 to 10), grants intangibility in the first half, sends Ness opposite
  the side he was hit on, and ends helpless in the air ([PK Thunder][pkthunder],
  [Ness (SSBM)][nessmelee]); Din's Fire "can be directed up or down with the
  control stick", explodes "after a time or when the button is released" and
  "charges as it travels" ([Din's Fire][dinsfire]). It publishes no speed,
  acceleration or damage for the self-hit, so the speeds here (11 a frame for
  36 frames, about 400 units, short of Phoenix's 600) are original values,
  and the self-hit deals Kael nothing because PK Thunder 2 deals Ness nothing.
- **Banish became a beam** (Tom, 2026-10-30): the close curse capsule on
  frames 12 to 14 of 36 is replaced by a hand-out cast, an 18-frame delay (20 after the retune below) and
  a 6-frame beam three body lengths long, with 24 frames of recovery (30) after a
  whiff. The statuses, 60 frames and 240-frame immunity are unchanged.
- **Retune after the redesign** (2026-10-30). With the three new moves at
  their first numbers Kael won 82% of 12,240 expert matches against the other
  30 fighters (balance run 41037488273), losing only to Chen; Pyroblast took
  64% of his kills and 37% of his damage, Flame Strike 35% of his damage. Only
  damage, knockback, startup, end lag and landing lag changed; each round
  below is 1,440 local expert matches (40 a pair):
  - Round 1, 36%: Pyroblast 12% with growth 64, startup 22, recovery 22 on a
    hit and 48 on a miss; Flame Strike's burst 10% with growth 75, burn 1.5%,
    cast ending on frame 36, air landing lag 24; Banish's delay 22, whiff
    recovery 32, air landing lag 24.
  - Round 2, 58%: halfway back: Pyroblast 14%, growth 72, startup 20,
    recovery 20 and 44; burst 12%, growth 82, burn 2%, cast ending on 33,
    landing lag 22; Banish's delay 20, whiff 28, landing lag 20.
  - Round 3, 50% (kept): Pyroblast 13%, growth 70, startup 21, recovery 21
    and 46; burst 11%, growth 80, burn 2%, cast ending on 34, landing lag 23;
    Banish's delay 20, whiff 30, landing lag 22.
    The farm field on the landed change (balance run 41042046794) read
    50.5% over 12,240 matches; Chen still beats him and Warden still loses
    90% to him.
  - Retune after the held cast (2026-10-31). The held cast and its longer
    recovery left Kael at 38% (run 41177297393). Restoring the recovery alone
    read 39% (run 41178938037); the burst at 13% with growth 90 and Pyroblast's
    growth 74 read 44.9% (run 41180881248); the burst at 14% read 46.9% (run
    41182313085, 5,745 wins of 12,240); then Flame Strike's 72-frame cooldown
    on main took that tuning to 44.1% (run 41186069426), and the burst at 15%
    with Pyroblast's growth 80 read 49.95% (run 41188018557, 6,114 wins of
    12,240), the release frame staying 16.

- **The World of Warcraft and Heroes of the Storm spells** (a charged fire
  blast, a possession and the raid-boss lifting ring) are cut; Tom kept the
  kit to the Warcraft III Blood Mage (2026-10-26). Summon Phoenix replaces
  the lifting ring as the ultimate.
- **The seeking fire bolt** (the old neutral special) drifted toward its
  target, so it decided for the player; Flame Strike's rune makes the player
  decide (2026-10-26).
- **Fireball**, a fast weak laser with two on screen, was replaced by the steered
  Pyroblast (2026-10-28): Tom wanted a heavy committal neutral special in the
  style of PK Thunder. The player steers it, so it does not decide for them
  the way the seeking bolt did.
- **The old mana drain** fed and denied meter; Siphon Mana is now a grab with
  an ordinary pummel and no heal, so meter stays universal (2026-10-26).
- **Cooldowns** are gone: one pillar on screen shows why there is no second
  one (2026-10-26).
- **The down-air spike and the up-smash pillar** are cut; down air pops up
  and up smash is arcane, keeping every pillar on the side special
  (2026-10-26).
- **Banish's slow** is cut; the duel is about which moves work, not speed
  (lead decision, 2026-10-26).

## Position in the roster

Jaina owns space with a delayed Blizzard; Kael draws a single rune the
opponent can see and dares them into it. Sylvanas's Silence takes specials;
Banish leaves specials and takes everything else, and it makes every
fighter's spells, not only his, land harder. Fox's Fire Fox is one aimed
line; Kael's Phoenix steers but can be broken into an egg.

## Play-style profile

Tom-tunable draft (2026-10-26; smashcraft:docs/design/balance.md,
"Play-style profiles").

```balance-profile
fighter: kael'thas-sunstrider
archetype: trapper
aerials: nair 10-35, fair 10-35, bair 10-40, uair 5-30, dair 0-25
air-share: 15-45
approach: 15-45
ranged: 20-50
specials: neutral 5-30, side 5-25, up 0-8, down 2-15
```

```ceiling-plan
fighter: kael'thas-sunstrider
path: decision
basic-moves: neutral-special,side-special,neutral-air
```

Basic gameplan: Pyroblast steered into the opponent from range, Flame Strike at a short tap, neutral air
when pressed. Recovery is a straight Phoenix.

Expert gameplan: place the rune where the opponent will land, Siphon the
shield that holds it, Banish when they commit to normals, and cover the
ledge with an offstage Flame Strike; steer Phoenix around the edge-guarder.

## Signature strong/weak move (#389)

Forward smash, split by position: a strong sweetspot at the palm and a weak
sourspot at the edge of the blast, re-tuned with the normals box. A vain
duelist who must space to shine.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).

[wc]: https://wowpedia.fandom.com/wiki/Blood_Mage_(Warcraft_III)
[kael]: https://wowpedia.fandom.com/wiki/Kael%27thas_Sunstrider
[mw]: https://www.ssbwiki.com/Mewtwo_(SSBU)
[pkflash]: https://www.ssbwiki.com/PK_Flash
[pkthunder]: https://www.ssbwiki.com/PK_Thunder
[nessmelee]: https://www.ssbwiki.com/Ness_(SSBM)
[dinsfire]: https://www.ssbwiki.com/Din%27s_Fire
[arcfire]: https://www.ssbwiki.com/Arcfire
[disable]: https://www.ssbwiki.com/Disable
[firefox]: https://www.ssbwiki.com/Fire_Fox
[parasol]: https://www.ssbwiki.com/Peach_Parasol
[grapple]: https://www.ssbwiki.com/Grapple_Beam
