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

**Every special is fire; every normal is arcane.** Normals are drawn with the
three violet spheres that orbit him; specials are red and gold Warcraft fire.
"On fire" means "hits a banished fighter", so both players can read the
Banish duel from colour alone, at match size.

## Gameplan

1. **Steer the Pyroblast.** Pyroblast is one slow, heavy fireball he steers
   while he stands rooted. It kills off the side at high percent and cracks
   shields, but every frame he steers he cannot defend himself, a hit on him
   puts it out, and a miss leaves him open for a long time. The opponent
   chooses to outrun it, shield it and pay for it, or rush the rooted caster.
2. **Draw the rune where they will be.** Flame Strike slides a bold ground
   rune outward while he holds and casts on release; a tap casts at a short
   default distance. The opponent has about 30 to 40 frames to read it. The
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
| Neutral: **Pyroblast** | About 18 frames of windup gathering fire in his hands, then one slow heavy fireball he steers with the stick for up to 60 frames, turning about 6 degrees a frame (PK Thunder's sharp turns), while he stands rooted on the ground or sinks slowly in the air. Special or shield lets it go: it flies straight about 14 frames and fizzles. 17%, launches at 40 degrees and kills off the side at high percent; 17 shield damage. One at a time, reflectable. Connecting leaves 18 frames of recovery; a miss (timed out, let go, reflected) leaves 40. | Outrun it, rush and hit Kael while he steers (that puts it out), or shield it and punish the long recovery; reflect it back at him. | [Ness's PK Thunder][pkthunder] (a steered projectile with a rooted caster) |
| Side: **Flame Strike** | Hold to slide the rune outward, release to cast; tap for a short default cast. About 30 to 40 frames from rune to burst, then the pillar stands 0.6 s (36 frames: a 6-frame burst, a 30-frame burn) and its column plays out inside that window. The burst launches and crushes shields; the burn is flinchless chip. One pillar, a recast replaces it, no cooldown. Castable in the air and offstage: his edgeguard. | Leave the rune, roll past it, or punish the cast from outside its line; a shield survives the burst but invites the grab. | [Ness's PK Flash][pkflash] (a placed delayed burst); [Robin's Arcfire][arcfire] (a lingering pillar that zones) |
| Down: **Banish** | A curse that turns the victim ethereal for about 60 frames (the duration sweep decides). They lose normals, grabs and shield, but still move, jump, air dodge and cast their specials. Only spells reach them, at +30%. | Space outside it or shield it; banished, keep away and fight with your specials; his spheres cannot touch you. | [Mewtwo's Disable][disable] (a status that removes options) |
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
[arcfire]: https://www.ssbwiki.com/Arcfire
[disable]: https://www.ssbwiki.com/Disable
[firefox]: https://www.ssbwiki.com/Fire_Fox
[parasol]: https://www.ssbwiki.com/Peach_Parasol
[grapple]: https://www.ssbwiki.com/Grapple_Beam
