# Archimonde the Defiler

Archimonde is a superheavy zone-control punisher: the tallest fighter in the
roster, who marks the ground and waits for the foe to step into it. Tom asked
for him (2026-10-28); his spec is the Archimonde section of
smashcraft:docs/design/roster-next.md. All combat values are original,
provisional Smashcraft tuning; the Melee anchor is Ganondorf's shape (slow,
heavy, huge punishes, a recovery edge-guards punish), not his numbers.

## Body and model

- **Model.** The stock Warlock model (`units\demon\Warlock\Warlock.mdl`), no
  import. It has nine clips: two stands, walk, Spell Slam, death, dissipate,
  two attacks and a spell. Every pose maps onto one of them until his
  authored clips land.
- **Size.** Draw scale 1.45; weight 118, the heaviest in the roster. His hurt
  capsule is the tallest in the roster (1.70 times the reference height, 0.72
  of its width), slow run, low air speed, traction 0.08. His shield sits at
  height 100 with radius 168.
- **Voice.** He has no stock unit soundset, so his ready and warcry lines are
  campaign dialogue (`N07Archimonde04` and `U08Archimonde20`), the way
  Medivh's are.

## Kit

Normals, grabs and throws follow roster-next's frames and damage. The forward
smash is his signature: the fel claws at the end of the slam deal 21% and
kill, while the forearm deals 14% and only shoves. The back air is his
strongest aerial (15%). The down air spikes on its clean hit. His back throw
is the kill throw, and his down throw sets a fixed knockback for tech chases.

Specials:

- **Finger of Death** (neutral). On frame 1 a violet line marks the foe's
  position. On frame 32 a lightning column strikes it: 16% at 70°, growth
  102, active through frame 37. The whole action lasts 58 frames.- **Rain of Fire** (side). Two pillars, 170 and 310 units ahead, hit on
  frames 24 and 36; each one's falling fire shows 14 frames before it hits. Each covers the full stage
  height at its x for 9%.- **Fel Ascent** (up). He rises 1.8 reference heights over frames 10–24 with
  little steering. A fel column below him hits for 7% over frames 10–20. Once
  per airtime, it ends helpless, with 28 landing frames. This is the roster's
  shortest heavy recovery, by design.- **Bash** (down). A hammer-fist into the floor on frames 16–18. A grounded
  foe within 90 units takes 12% and is stunned for 30 frames, with no launch.
  The stun is the shared stun status that ends on damage, like the
  Beastmaster hawk's, and leaves 240 frames of immunity. An airborne foe is
  launched at 45°. In the air the fist spikes for 12%. 46 frames total.
- **Rain of Chaos** (ultimate). Circles mark the foe's position and 220 units
  either side. Then three infernals crash there in sequence, on frames 42, 50
  and 58, for 8%, 8% and 10%. Nothing stays afterwards.

His home stage is Nordrassil (10), the Battle of Mount Hyjal. His Classic
route ends at Kil'jaeden; the Classic boss Archimonde is a separate boss kind.

## Play-style profile

Tom-tunable draft (2026-10-28; smashcraft:docs/design/balance.md,
"Play-style profiles"). He holds ground with the column and the pillars,
then punishes approaches with the claw smash and the back air.

```balance-profile
fighter: archimonde
archetype: bait-and-punish
aerials: nair 15-40, fair 10-35, bair 20-45, uair 5-30, dair 0-20
air-share: 10-35
approach: 25-55
ranged: 20-50
specials: neutral 5-20, side 5-20, up 0-8, down 3-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: archimonde
path: decision
basic-moves: forward-tilt,down-tilt,forward-smash,neutral-special
```

Basic gameplan: poke with the forward tilt, chase with the down tilt, cast
Finger of Death from range and slam into a whiffed approach. It uses one
approach and shield.

Expert gameplan: choose which ground to deny with the column and the pillars,
cover the foe's landing with the back air, and hold the foe in place with
Bash into the forward smash. It uses the full authored kit and gameplan at
the same CPU skill.
