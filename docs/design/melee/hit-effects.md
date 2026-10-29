# Melee's hit and movement event language

What Melee shows and plays on each event, as a player sees and hears it, set as
design targets for Smashcraft's own presentation with Warcraft III assets.
Melee's art and audio are never copied or shipped, and its effect and sound
numbering is not recorded here.

## Hits

Every hit shows a spark at the contact point whose look follows the hitbox's
element: a white burst for ordinary hits, flame for fire, crackling sparks for
electric, a slash streak for sword hits, frost for ice and a dark burst for
darkness. Stronger ordinary hits show a larger spark.
The hit sound rises with the hit's strength in a few steps from weak to
strong, and sword and blunt hits sound different. A hit on an intangible or
invincible fighter plays its own dull sound and no spark.

## Hitlag shake and colour

During hitlag the victim shakes in place, harder on an electric hit, and
returns to rest when hitlag ends (SmashWiki "Hitlag"). Damage also flashes the
victim's body: white for ordinary and slash hits, and an elemental tint for
fire, electric, ice and darkness. The flash starts with the hit, before the
freeze ends, and runs through hitlag and the hitstun after it.

## Shield, recovery, ledge and KO events

A shield hit shows a shield spark rather than the element's spark, and a
powershield its own flash and sound. A missed tech thuds and raises dust; a
tech flashes the fighter and plays its recovery voice. A ledge catch flashes at
the ledge lip. A blast KO bursts in the player's colour at the blast line and
shakes the camera and plays ThunderClap.

A top KO is a Star KO about 7 times in 8 and a Screen KO about 1 time in 8
(SmashWiki "Screen KO" and "Star KO": the choice is mostly random, and in the
first three games Screen KOs are considerably rarer than Star KOs; no page
gives an exact rate, so Smashcraft uses 1 in 8, 2026-10-30). The choice is a
hash of the KO frame, the owner slot and the character
(`topKoKind` in smashcraft:ts/src/game/presentation/impactState.ts), so a
replay or rollback picks the same kind. A Star KO tumbles the fighter slowly
away into the background, shrinking toward the screen centre over 90 frames
(1.5 s), then draws a Dispel Magic sparkle and plays a high-pitched DispelMagic
chime (pitch 2.0) as the twinkle at the end. The Screen KO is the near fall
through the screen centre.

## Footsteps and movement

Walk and run animations play footsteps from their own frames, so walking has
no fixed global sound clock, and the floor's material changes the step sound
and dust. Dashing, braking, jumping, aerial jumps, landing, grabbing and
throwing each have their own cue at the start of the action.

## Smashcraft's Warcraft presentation

The mapping lives in smashcraft:ts/src/game/presentation/hitPresentation.ts.
Sounds and elemental effects use stock Warcraft assets; contact stars, rings and dust reuse Smashcraft's existing geometry. This mapping imports no
Melee asset. Effects use the existing pooled handles; audio consumes confirmed
frames and never runs from a rollback replay. Tint and vibration change only
the presented body. The bounded, authored choices below are Smashcraft's style,
not claims that Warcraft renders Melee's artwork or exact animation programs.

| Event | Warcraft effect | Stock sound label |
| --- | --- | --- |
| Ordinary hit / pummel | Smashcraft hit burst | tiered wood strike on flesh; pummel uses higher, quieter Defend |
| Fire hit | orange Smashcraft hit burst | Fireball |
| Electric hit / electric shield | Lightning Shield target (Stand loop, held 24 frames) | LightningBolt |
| Slash hit | Smashcraft hit burst (authored 16-ray star) | Sound\Units\Combat\MetalHeavySliceFlesh1 (heavy sword on flesh, by path) |
| Ice / freeze begins | Frost Nova target | FrostNova |
| Shield / powershield / shield break | Smashcraft shield star (authored 10-ray star; break draws it twice as large) | Defend, powershield higher |
| Missed floor/wall/ceiling tech | War Stomp impact and dust | Warstomp |
| Successful tech | Dispel Magic target | DispelMagic |
| Grab | Smashcraft shield star | EntanglingRoots |
| Throw release | Smashcraft jump ring | BlinkTarget |
| Ledge catch / recovery | Smashcraft shield star (Melee's contact spark at the lip) / Smashcraft dust (climb dust) | quiet BlinkTarget |
| Ground jump / aerial jump | Smashcraft dust / jump ring | quiet BlinkTarget |
| Walk / run / dash / ordinary landing | Smashcraft dust | DeepFootstep / DeepFootstep2; distinct volume and pitch |
| Blast KO / star close / respawn | Smashcraft KO burst / Dispel Magic / Resurrection | ThunderClap for KO, DispelMagic at pitch 2.0 for the star KO twinkle; original fighter death cues remain |

Inspection command in developer builds: `-dev quick`, then `-dev effects N`.
The numbered cases are declared in
smashcraft:ts/src/game/session/hitPresentationCases.ts; the command changes only
presentation. It gives native capture an exact event list, while the matching
headless test checks the effect pose, sound dispatch, and rejection of repeat
or older confirmed frames. A fresh map start is required after changing the
pool's model families; hot reload keeps existing handles and their models.

Stock sound names were resolved from Warcraft's AnimSounds.slk. The stock model
sequences were inspected too: War Stomp, Thunder Clap and Resurrection use
Stand; imported contact geometry also uses Stand. Frost Nova and Dispel Magic use Birth. These names are Warcraft
metadata, not inferred spell-display names.

A pooled cue shows for 9-15 frames (0.15-0.25 s), so a stock model must draw
in that window from where the cue starts it. Read from each model's sequence
keys (`impactStartSeconds` in hitPresentation.ts):

- Bolt impact draws nothing for its first 0.17 s (every material at alpha 0)
  and has no particle emitters, so an electric cue parked before it showed;
  the side camera recorded at most 5 changed pixels. Forked Lightning target
  draws a billboarded flash and lightning particles from 0 s, but in the
  fullscreen native capture of f9d0fbf3 it was a violet speck about 40 px
  across (650 px for a hit, 364 px on a shield) and gone by +8 frames
  (#301, #302). Electric sparks therefore draw Lightning Shield target: its
  orbs are geometry about 340 units across at scale 1, looping Stand from
  0 s. A hit draws it at 1.0 (0.75 for the smallest tier) and a shield hit at 0.6, and both stay in the
  pool for 24 frames (0.4 s) instead of a contact's 9.
- Blink target draws nothing before 0.33 s and peaks at 0.63-0.87 s. The
  attempted 0.6 s seek still left throw invisible in the #82 capture, while
  Impale dust drew an opaque black cloud. Throw now reuses the jump ring
  and ledge recovery reuses the soft dust geometry. Stampede contact and
  Fire Lord explosion also failed that capture; they use the hit burst,
  orange for fire. Contact, grab and throw geometry draws 128 units in
  front of the fighter centre, beyond Mountain King's 115-unit body depth.
- Dispel Magic target's first sparkle ring shows from 0.17 s and peaks at
  0.33-0.43 s; its sparks only emit at 0.7-0.8 s. Ready and the star-KO
  sparkle start it at 0.25 s. Started there, a ledge-catch Dispel showed at
  most 45 px natively, so ledge catch uses the Defend flash, which draws from
  0 s (2,233 px as the shield-hit control).
- Cleave target emits only for its first 0.17 s, and its sparks are 0-12
  units across at scale 1. Normal contact draws at 1.5x to stay readable at
  gameplay zoom.
- In the stamp-verified frozen capture of main 2f1115cd, Defend caster drew
  nothing in all three of its standalone cases (shield hit, shield break,
  ledge catch) and Cleave target drew nothing for slash, while the authored
  Tech star drew at the same points. Shield contact, grab, charge and ledge
  catch therefore use the authored Shield star and slash the authored Hit
  burst (tools/effects/package.ts), both static "Stand" geometry like Tech.

The diagnostic's ledge cues spawn at the stage centre (ledge point 0, 50),
not at a ledge, so a stage-centre capture covers them.
