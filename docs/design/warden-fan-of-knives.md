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
described here.

Tom (26 Oct, #494) made it a ring of knives all around her, as Warcraft
III's Fan of Knives bursts around the Warden, with the same look on the
ground and in the air. Fan of Knives now:

- Strikes on frames 4-7 on both sides of her: two mirrored 24-radius knife
  capsules, 48 to 92 out at 56 up, ahead of her and behind her. Each side
  launches away from her, so a foe on either side is sent outward.
- On the ground: 6.1% pushing the foe away at 15 degrees with shine's set
  knockback of 80 at every percent, so it stuns a foe for the frames Fox's
  shine does and the foe's weight alone sets the knockback: 34 frames on
  Kael'thas, 31 on Jaina, 26 on Cairne. Foes of weight 84 or less (13 of the
  26 fighters) are launched past the tumble threshold (80), as Fox's shine
  tumbles them; heavier foes stay under it, are never downed and land on
  their feet. It was a set 60 that never tumbled anyone and stunned
  21-28 frames, 6-8 short of shine (Tom, 26 Oct; Tom asked for shine's
  hitstun, 27 Oct).
- In the air it hits like Fox's Melee shine: 5% with a set knockback of 80
  and no growth, on a fixed horizontal semi-spike away from her, the same at
  every percent, which makes a shine spike off-stage. SmashWiki's Melee
  Reflector table lists 5%, angle 0, base 0 and set knockback 80
  ([SmashWiki: Fox's down special](https://www.ssbwiki.com/Fox_(SSBM)/Down_special)).
  It replaces the earlier straight-down spike below her.
- In the air every frame holds her vertical speed at zero while her air
  drift and gravity still act, so she sinks one frame of gravity a frame.
- Jump-cancellable from frame 4, 27 frames uncancelled, no intangible frame.
- Anyone hit is still poisoned.

From #272 until #494 it struck only ahead of her on the ground (the front
capsule above), a reach a reference body touches exactly when its feet are
inside Immolate's ground box (0 to 140 ahead, 80 below to 100 above), and in
the air only below her: a 34-radius capsule from -12 to 12 at 24 below, the
same damage spiking downward (base 26, growth 110).

Until #272 Fan of Knives copied the Falco shape:

- One active frame, frame 1, on both sides of her body: 8% at 85 degrees
  with the CHASE knockback (base 75, growth about 50), a pop of about 0.6
  fighter heights with 34 frames of hitstun at 0%. It reaches 0.7 fighter
  heights. Anyone hit is still poisoned.
- Her first frame is intangible.
- A jump press from frame 4 ends it and jumps (her double jump in the air).
- In the air it holds her in place for its 27 frames, as Immolate does.
- Uncancelled it lasts 27 frames, so a whiffed shine is punishable.

It looks like the stock cast: Warcraft's FanOfKnivesCaster effect at scale
0.6, so its knives stop about 450 units out instead of flying about 750 units
as the stock model does at full size. Tom (17 Oct playtest) saw nothing at the
first scale, 0.13: `bun wisp view cues --move warden:down-special` measured 9
pixels at most, against 213 at 0.6, shown from the hit frame through frame 17.
Warden plays her stock Spell animation.
The earlier seven-ray custom knife pose code never drew in-game and is gone.
