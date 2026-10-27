# Throw roles

#330 proposes the roles a throw can play and the rule that decides how a
fighter's four throws fill them, so Tom can pick the rule in #331. Today's rule
(#107, smashcraft:docs/gameplay-design.md "Throw roles") fixes one slot per role:
every up throw is a short juggle, every down throw a tech chase, and forward
and back throws follow identity. Regrabs follow #85 (same file, "Throw
regrabs"): a grab cannot catch a fighter whose current hitstun came from a
throw.

Prior art below is restated in our own words from public sources. Melee
numbers come from smashcraft:references/melee-frame-data/fightcore.csv (angle,
base knockback, growth, set knockback); its provenance is in
smashcraft:references/melee-frame-data/README.md.

## Prior art

### Sakurai: throws answer shields

Sakurai's Brawl DOJO "Grab and Throw" update (7 Nov 2007,
https://www.smashbros.com/wii/en_us/howto/basic/basic08.html) presents the
grab as the option that breaks a shield wall: it adds a dimension to plain
attacking, it is the answer to an opponent sitting in shield, and the player
should chase the throw with follow-up attacks. It gives the four throw
directions no separate purpose. The series therefore treats a throw as two
things: the payoff for beating a shield, and the start of a punish. No public
Sakurai column or interview we found
(https://www.ssbwiki.com/Smash_Bros._DOJO!!_updates_(archive_3)) assigns roles
to throw directions. That assignment came from players and from later games.

### Rivals of Aether: from no grabs to combo throws

Rivals of Aether (2017) shipped without grabs. Its defence was rolls and
parry, and Dan Fornace explained that each throw in 2D would need a drawn
reaction for every character
(https://kotaku.com/rivals-of-aether-makes-the-smash-bros-formula-feel-new-1793727912).
Rivals of Aether II added grabs and shields. Its developer FAQ
(https://rivals2.com/faq) gives the reason in five words, "Because they counter
shields!", and adds that throws set up combos. It also keeps the grab costly:
the grabbed player can break a pummel by matching its button, so the grabber
may throw at once instead. Throws were cut from the first game for their cost,
then brought back in the sequel as a shield counter and a way into combos.

### Melee's throws as played

- **Throw physics.** In Melee every throw computes knockback as if the victim
  weighed 100. Weight only changes the speed of weight-dependent throws:
  heavier victims are thrown more slowly
  (https://www.ssbwiki.com/Throw). A heavy and a light fighter therefore fly
  the same distance off the same throw, but fall differently, so whether a
  follow-up works depends on fall speed.
- **Captain Falcon's down throw** is his main grab payoff. It combos directly
  into neutral air, up air and the knee, and tech chases fast and mid fallers
  (https://www.ssbwiki.com/Captain_Falcon_(SSBM)/Down_throw). At low percent,
  depending on DI and fall speed, it leads to aerials or to a tech-chase
  regrab, and it chain grabs floaty heavies such as Ganondorf
  (https://www.ssbwiki.com/Captain_Falcon_(SSBM)). The regrab on Sheik that
  #330 names is the tech-chase regrab on a fast faller. We found no public
  page that records a true regrab chain on Sheik.
- **Captain Falcon's up throw** gives tech chases and low-percent follow-ups,
  and aerial follow-ups are easier at higher percent (same page). #330 calls it
  a set-knockback throw. Neither source supports that: SmashWiki lists base 70,
  growth 105 and no fixed value
  (https://www.ssbwiki.com/Captain_Falcon_(SSBM)/Up_throw), and fightcore.csv
  lists 80°, base 60, growth 100 and no set knockback. Its knockback grows
  slowly enough to read as nearly constant across the tech-chase range, but it
  is not set knockback. The menu below keeps set knockback as a role test,
  because Sheik's throws do use it.
- **Falco's up throw** launches upward and fires three lasers. It starts aerial
  combos, but the lasers have their own hitstun, so the victim can SDI them.
  That makes the follow-up less certain than Fox's
  (https://www.ssbwiki.com/Falco_(SSBM)).
- **Back throws rarely combo.** Falcon's back throw is hard to follow up
  except near a ledge (https://www.ssbwiki.com/Captain_Falcon_(SSBM)). Fox's
  back throw mainly sets up edgeguards and platform throws
  (https://www.ssbwiki.com/Fox_(SSBM)), and Falco's is mostly a way to push
  the opponent off stage (https://www.ssbwiki.com/Falco_(SSBM)). In practice a
  back throw is a positional tool.
- **Percent-window confirms.** Fox's up throw into up air is the best-known
  confirm in the game: it kills reliably only inside a percent band, which
  depends on the victim's weight and fall speed (Fox page). Falcon's down throw
  into knee is the same idea. SmashWiki lists the knee as a direct down-throw
  follow-up, but we found no public source that gives the percent window on
  Jigglypuff that #330 names. Jigglypuff's own up and down throws into Rest are
  the same kind of confirm from her side (https://www.ssbwiki.com/Jigglypuff_(SSBM)).
- **Chain grabs** are throw-and-regrab loops before the victim can tech. DI is
  the main way out, and they usually end at mid percent as knockback grows,
  though set-knockback throws last longer. Sheik's down throw is the standard
  example, and Marth's up throw on Fox and Falco is another. Smash 4 ended
  chain grabs with a grab immunity after each throw
  (https://www.ssbwiki.com/Chain_grab). Our #85 rule ends them in a different
  way, by tying the immunity to the throw's own hitstun.

## Role menu

Each role has a test that `bun wisp interactions` can measure in the same way as
smashcraft:ts/scripts/throwRoles.ts. Every test uses a Fox-weight victim (75)
at the role's percents, against every victim DI choice and tech option that
script already enumerates. A throw passes a role when it meets that role's
test at every listed percent.

| Role | What it is | Measurable test |
| --- | --- | --- |
| Combo starter | The throw leads straight into a follow-up, and a grab counts as one: a chain grab is a combo starter whose follow-up is a grab. | At 0, 30 and 60%, at least one follow-up lands before the victim's first actionable frame against every DI (`guaranteedFollowups >= 1`). |
| Tech-chase starter, set knockback | The victim must pick a tech option, and the thrower reads it. | At 0, 30, 60 and 90%, the victim tumbles and lands inside throw hitstun. The landing frame varies by at most 3 frames across those percents, which is what set knockback buys. Each of the four tech options has a follow-up that lands when read. |
| Kill throw | The throw itself ends the stock. | Released at the ledge facing off stage, it KOs at 150% or lower under the worst DI. |
| Positional or edge throw | It wins stage position instead of damage. | Released halfway between centre stage and the ledge, the victim's first actionable frame is past the ledge at 60%, or more than 15% of the stage width from the release point. No follow-up is required. |
| Percent-window confirm | It becomes a guaranteed kill inside a band of percents. | For a Fox-weight victim, some percent band at least 10% wide has a follow-up that lands against every DI and KOs. Outside the band no kill is guaranteed. |

The positional share was 40% until 2026-10-26 (#493). Melee's Fox back throw,
the first positional row in the reference table below, carries the victim
16.6% of the stage width under DI in at 60% when `fixture:fox` runs this test,
so the 40% bar failed the throw it was written from. 16% is that carry rounded
down. Since throws knock every victim back as if it weighed 100 (#533), the
same throw carries 15.9%, so the bar is 15% from 2026-10-27 (#493).

A tech-chase declaration may name tech options it does not read (`unread` in
`tools/move-data/combo-objectives.json`). The one exception, since 2026-10-27
(#493): Jaina's down throw reads tech in place, tech in and a missed tech, not
tech away. Melee's 20-frame intangible tech roll (#532) and throws knocking
back as if the victim weighs 100 (#533) put the roll past her reach, gate 63
keeps the down throws as they are, and she is a caster, not a tech-chase
fighter.

A throw can pass more than one role. Fox's up throw, for example, is both a
combo starter and a percent-window confirm.

Regrab is not a role of its own; Tom folded it into combo starter (2026-10-26).
Under #85 a grab cannot connect during throw hitstun, so in our game a grab
after a throw is either a read on the victim's tech option, which the
tech-chase test already covers, or impossible. Melee's true chain grabs are
combo starters, and allowing them here would need #85 relaxed, which this page
does not propose.

## Melee reference fighters

Columns are fightcore.csv's angle, base knockback, growth and set knockback for
the throw row (`-` = none). Roles come from those numbers together with the
cited play above. For Sheik and Peach the csv rows describe the throw's hit
rather than its release. For example, Peach's forward throw reads 2% at 80°,
base 10 and growth 200, while SmashWiki gives 8% and calls it the strongest
forward throw in the game (https://www.ssbwiki.com/Peach_(SSBM)). For those
two fighters the role rests on the cited play. Fox's and Falco's laser hits are
outside the csv rows and are left to a later per-fighter issue.

| Fighter | Throw | Angle / base / growth / set | Roles |
| --- | --- | --- | --- |
| Fox | Up | 90 / 75 / 110 / - | Combo starter; percent-window confirm (up air) |
| Fox | Down | 270 / 150 / 40 / - | Tech-chase starter at high percent (meteor, teched) |
| Fox | Forward | 55 / 10 / 100 / 140 | Positional (off stage); chain grabs some heavies |
| Fox | Back | 124 / 80 / 85 / - | Positional (edge, platforms) |
| Falco | Up | 90 / 75 / 110 / - | Combo starter (lasers SDI-escapable) |
| Falco | Down | 270 / 150 / 40 / - | Tech-chase starter (grab on the lightest fighters); on Fox the last laser overrides the throw into true follow-ups |
| Falco | Forward | 60 / 60 / 180 / - | Positional; chain grabs floaties at low percent |
| Falco | Back | 124 / 80 / 85 / - | Positional (off stage) |
| Sheik | Down | 361 / - / - / 90 | Combo starter (chain grabs Pikachu and Link); tech-chase starter on fast fallers (https://www.ssbwiki.com/Sheik_(SSBM)) |
| Sheik | Up | 361 / - / - / 90 | Combo starter (low hitstun); chain grabs Fox and Falco at high percent |
| Sheik | Forward | 361 / - / - / 80 | Positional (weak) |
| Sheik | Back | 361 / - / - / 80 | Positional (edge) |
| Marth | Up | 93 / 60 / 130 / - | Combo starter (chain grabs Fox and Falco at low percent; juggles) (https://www.ssbwiki.com/Marth_(SSBM)) |
| Marth | Forward | 50 / 70 / 45 / - | Tech-chase starter (trip into dash attack, down tilt, forward smash) |
| Marth | Down | 135 / 65 / 50 / - | Positional (behind him, off stage); percent-window confirm (tipped forward smash at low percent) |
| Marth | Back | 117 / 70 / 60 / - | Positional (DI trap at high percent) |
| Captain Falcon | Down | 65 / 75 / 34 / - | Combo starter; tech-chase starter (grab or attack on read); percent-window confirm (knee) |
| Captain Falcon | Up | 80 / 60 / 100 / - | Tech-chase starter at low percent; combo starter at higher percent |
| Captain Falcon | Forward | 80 / 70 / 100 / - | Positional (off stage at high percent) |
| Captain Falcon | Back | 70 / 70 / 100 / - | Positional (rarely combos) |
| Jigglypuff | Up | 90 / 130 / 25 / - | Combo starter on fast fallers; percent-window confirm (Rest) |
| Jigglypuff | Down | 40 / 0-10 / 100 / 0-25 (multi-hit) | Percent-window confirm (Rest on floaties) |
| Jigglypuff | Forward | 361 / 40 / 110 / - | Kill throw near the ledge above about 130% (SDI-able hit) |
| Jigglypuff | Back | 135 / 90 / 25 / - | Positional (her best edgeguard setup) |
| Peach | Forward | 80 / 10 / 200 / - | Kill throw |
| Peach | Back | 70 / 10 / 200 / - | Positional (edge); KOs only above about 170%, past the kill-throw test |
| Peach | Up | 80 / - / 100 / 20 | Combo starter (chain grabs floaties from 0%, fast fallers from about 40%) |
| Peach | Down | 270 / - / 100 / 20 | Combo starter (chain grab, or into forward tilt) |

Two patterns stand out. Up throw is a combo starter for all seven
fighters, which matches #107's up-throw slot. Down throw is a tech chase for
only four of them (Fox, Falco, Sheik, Falcon). Marth's is positional,
Jigglypuff's is a Rest confirm and Peach's is a chain grab. Each of the seven
fighters covers at least three roles across its four throws.

## Roster rules

### Rule A: one fixed slot per role (today, #107)

Every up throw is a combo starter (short juggle), every down throw a
tech-chase starter, and forward and back follow identity.

- For: a player learns one table and it holds for all 26 fighters. Its tests
  already run per slot in throwRoles.ts. Balance compares like with like.
- Against: Melee does not work this way. Three of the seven reference
  fighters' down throws play other roles, and those differences are much of
  what makes a matchup's grab game distinct. The rule leaves kill throws,
  chain grabs and percent-window confirms to forward and back by accident, never
  by design. Every fighter also gets the same grab game.

### Rule B: a per-fighter set covering at least three roles

Each fighter declares a role for each of its four throws, and the four must
cover at least three roles from the menu. Each throw is tested against its
declared role.

- For: it matches the evidence, since all seven reference fighters pass. It
  turns the grab game into fighter identity (Peach's kill throws, Marth's
  chain grab, Jigglypuff's Rest confirms), and it still guarantees breadth, so no
  fighter's grab is a single trick.
- Against: 104 throws need a declared role and a passing test, not two slot
  tests. Players learn each fighter's throws. Balance needs care, because a
  kill throw on a fast-grab fighter is worth more than on a slow one. It also
  needs the role tests above to exist before retunes can be judged.

### Recommendation: Rule B

Rule B, with the roles declared in each fighter's move data and checked by
the menu's tests. Up throw would usually be declared a combo starter, as #107
has it, but that becomes a default and stops being a requirement. Two reasons
decide it. First, the evidence: Melee's up throws already converge on combo
starter without a rule, while its down throws diverge. Fixing the down slot
removes exactly the variety the reference fighters show. Second, the cost
falls in the right place. The extra cost is tests and declarations, which the
#329 throw-parity measurement already needs per throw. Rule A's cost is a
uniform grab game, which no retune can fix later.
