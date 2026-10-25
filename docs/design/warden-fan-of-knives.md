# Warden: Fan of Knives

Tom (17 Oct): Fan of Knives plays Warcraft III's own Fan of Knives, not too
far out, and works like Falco's shine, the way Illidan's Immolate works like
Fox's.

Falco's Melee Reflector hits on frame 1, its only active frame, with an
invincible first frame. Falco can jump out of it from frame 4, and its
upward angle with high base knockback pops the foe into a follow-up
([SmashWiki: Shine (Falco)](https://ssbwiki.com/Shine_(Falco)),
[SmashWiki: Falco's down special](https://www.ssbwiki.com/Falco_(SSBM)/Down_special),
[Liquipedia: Frame](https://liquipedia.net/smash/Frame)).

Tom (25 Oct, #272) swapped the two down specials' behaviour: Fan of Knives
now has Illidan's former Immolate shape, and Immolate has the shine
described here. Fan of Knives now:

- Strikes on frames 4-7. On the ground only ahead of her: a 24-radius knife
  capsule from 48 to 92 out at 56 up, which a reference body touches exactly
  when its feet are inside Immolate's ground box (0 to 140 ahead, 80 below
  to 100 above). 6.1% pushing the foe back at 15 degrees with a set
  knockback of 60 at every percent: below the tumble threshold (80), its
  launch speed stays under the landing-knockdown speed, so the foe never
  tumbles, is never downed and lands on its feet (Tom, 26 Oct).
- In the air the strike is below her: a 34-radius capsule from -12 to 12 at
  24 below, Immolate's air box (±70, 170 below to 30 above) by the same
  rule, the same damage spiking downward (base 26, growth 110).
- In the air every frame holds her vertical speed at zero while her air
  drift and gravity still act, so she sinks one frame of gravity a frame.
- Jump-cancellable from frame 4, 27 frames uncancelled, no intangible frame.
- Anyone hit is still marked and poisoned for Shadow Pursuit.
- EX: 25% more damage.

Until #272 Fan of Knives copied the Falco shape:

- One active frame, frame 1, on both sides of her body: 8% at 85 degrees
  with the CHASE knockback (base 75, growth about 50), a pop of about 0.6
  fighter heights with 34 frames of hitstun at 0%. It reaches 0.7 fighter
  heights. Anyone hit is still marked and poisoned for Shadow Pursuit.
- Her first frame is intangible.
- A jump press from frame 4 ends it and jumps (her double jump in the air).
- In the air it holds her in place for its 27 frames, as Immolate does.
- Uncancelled it lasts 27 frames, so a whiffed shine is punishable.
- EX: 25% more reach, as before.

It looks like the stock cast: Warcraft's FanOfKnivesCaster effect at scale
0.6, so its knives stop about 450 units out instead of flying about 750 units
as the stock model does at full size. Tom (17 Oct playtest) saw nothing at the
first scale, 0.13: `bun wisp view cues --move warden:down-special` measured 9
pixels at most, against 213 at 0.6, shown from the hit frame through frame 17.
Warden plays her stock Spell animation.
The earlier seven-ray custom knife pose code never drew in-game and is gone.
